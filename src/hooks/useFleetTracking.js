import { useEffect, useRef, useState } from 'react';
import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../amplify_outputs.json';

const IDLE_THRESHOLD_MIN = 3; // minutes
const SPEED_EPSILON = 0.00001; // ~1m movement

export function useFleetTracking({ pollInterval = 5000, normalizeId }) {
  const [positions, setPositions] = useState({});
  const prevPositionsRef = useRef({});

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const session = await fetchAuthSession();
        const client = new LocationClient({
          region: outputs.geo.aws_region,
          credentials: session.credentials
        });

        const res = await client.send(
          new ListDevicePositionsCommand({
            TrackerName: outputs.custom.amazon_location_service.trackers.default
          })
        );

        if (!mounted || !res.Entries) return;

        const now = Date.now();
        const next = {};

        res.Entries.forEach(e => {
          if (!e.DeviceId || !e.Position) return;

          const id = normalizeId(e.DeviceId);
          const prev = prevPositionsRef.current[id];

          const lat = e.Position[1];
          const lng = e.Position[0];
          const lastUpdated = new Date(e.SampleTime).getTime();

          const distance = prev
            ? Math.hypot(prev.lat - lat, prev.lng - lng)
            : 0;

          const idleMinutes = (now - lastUpdated) / 60000;

          next[id] = {
            lat,
            lng,
            lastUpdated,
            isIdle: idleMinutes > IDLE_THRESHOLD_MIN || distance < SPEED_EPSILON,
            speed: prev ? distance / (pollInterval / 1000) : 0
          };
        });

        prevPositionsRef.current = next;
        setPositions(next);
      } catch (e) {
        console.warn("Fleet poll error", e);
      }
    };

    poll();
    const t = setInterval(poll, pollInterval);
    return () => { mounted = false; clearInterval(t); };
  }, [pollInterval, normalizeId]);

  return { positions };
}

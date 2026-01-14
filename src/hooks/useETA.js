import { useEffect, useState } from "react";

const AVG_SPEED_KMH = 30;

const haversine = (a, b) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
      Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export function useETA({ from, to }) {
  const [eta, setEta] = useState(null);

  useEffect(() => {
    if (!from || !to) return;

    const km = haversine(from, to);
    const minutes = Math.round((km / AVG_SPEED_KMH) * 60);

    setEta(minutes);
  }, [from, to]);

  return eta;
}

import React, { useEffect, useRef } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';

export const MapView = ({ orders }) => {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    async function initializeMap() {
      if (mapInstance.current) return;

      try {
        const map = await createMap({
          container: mapContainerRef.current,
          center: [50.505919, 26.179207], // Default to Bahrain
          zoom: 12,
          attributionControl: false
        });

        mapInstance.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
      } catch (error) {
        console.error("Error creating map:", error);
      }
    }

    initializeMap();
  }, []);

  // Update Markers when orders change
  useEffect(() => {
    if (!mapInstance.current || !orders) return;

    const map = mapInstance.current;

    // 1. Clear Old Markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // 2. Add New Markers
    orders.forEach((order) => {
      let loc = null;
      try {
        const parsed = typeof order.location === 'string' ? JSON.parse(order.location) : order.location;
        if (parsed && (parsed.latitude || parsed.lat)) {
             loc = { 
                lng: parseFloat(parsed.longitude?.N || parsed.longitude || 0),
                lat: parseFloat(parsed.latitude?.N || parsed.latitude || 0)
            };
        }
      } catch(e) { return; }

      if (!loc || (loc.lat === 0 && loc.lng === 0)) return;

      // Color coding based on status
      let color = '#f97316'; // Orange (Delivering)
      let icon = '🚚';
      
      if (order.orderStatus === 'DELIVERED') {
          color = '#22c55e'; // Green
          icon = '✓';
      }

      const el = document.createElement('div');
      el.style.backgroundColor = color;
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.display = 'flex';
      el.style.justifyContent = 'center';
      el.style.alignItems = 'center';
      el.style.color = 'white';
      el.style.fontSize = '14px';
      el.innerHTML = icon;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="color:black; padding:5px;">
            <b>Order:</b> ${order.sk.split('#')[1].substring(0,8)}<br/>
            <b>Status:</b> ${order.orderStatus}
          </div>
        `))
        .addTo(map);

      markersRef.current[order.sk] = marker;
    });

  }, [orders]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />;
};
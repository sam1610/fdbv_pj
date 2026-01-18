import React, { useEffect, useRef, useState } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import outputs from '../../amplify_outputs.json'; 
import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes"; 
import { fetchAuthSession } from 'aws-amplify/auth';
import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";

// --- CONFIG ---
const REFRESH_RATE_MS = 10000; 
const ANIMATION_DURATION_MS = REFRESH_RATE_MS; 
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 Minutes = Stale

// --- HELPERS ---
const getCleanPhone = (id) => String(id || "").replace(/[^0-9]/g, '');

const parseLocation = (loc) => {
    if (!loc) return null;
    try {
      const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc;
      const lat = parseFloat(parsed.latitude?.N || parsed.latitude || 0);
      const lng = parseFloat(parsed.longitude?.N || parsed.longitude || 0);
      if (lat === 0 && lng === 0) return null;
      return { latitude: lat, longitude: lng };
    } catch { return null; }
};

const DeliveryOptimizer = ({
  orders,
  agents,
  AGENT_COLORS,
  restaurantLocation,
  onClose,
  onAssignmentSaved
}) => {
  // Refs
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const animationFrameId = useRef(null);
  
  // Stores Start/End positions AND Last Update Time
  const agentAnimationState = useRef({}); 
  
  const latestOrdersRef = useRef(orders);
  const latestAgentsRef = useRef(agents);
  const markersRef = useRef({});          

  // State
  const [showDelivered, setShowDelivered] = useState(true);
  const [showDelivering, setShowDelivering] = useState(true);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); 
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [optimizationMetrics, setOptimizationMetrics] = useState({});

  const isDispatchMode = !showDelivered && !showDelivering;
  const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');

  // Sync Props
  useEffect(() => {
      latestOrdersRef.current = orders;
      latestAgentsRef.current = agents;
  }, [orders, agents]);

  const getAgentColor = (agentId) => {
    if (!agentId) return '#64748b'; 
    const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
    return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
  };

  // Fix Popup Z-Index
  useEffect(() => {
    const styleId = 'popup-z-index-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `.maplibregl-popup { z-index: 2000 !important; }`;
      document.head.appendChild(style);
    }
  }, []);

  // --- 1. MAP INITIALIZATION ---
  useEffect(() => {
    let isMounted = true;

    async function initializeMap() {
      if (mapInstance.current) return;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

      try {
        const map = await createMap({
          container: mapContainerRef.current,
          center: [restaurantLocation?.longitude || 50.5, restaurantLocation?.latitude || 26.2],
          zoom: 12,
          attributionControl: false 
        });
        
        if (!isMounted) return;
        mapInstance.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        map.on('load', () => {
            if (!isMounted) return;

            // A. Sources
            if (!map.getSource('agents-source')) {
                map.addSource('agents-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            // B. GLOW LAYER (Visualizes status)
            if (!map.getLayer('agents-glow-layer')) {
                map.addLayer({
                    id: 'agents-glow-layer',
                    type: 'circle',
                    source: 'agents-source',
                    paint: {
                        'circle-radius': 20,
                        // Logic: If Stale -> Grey Glow. If Active -> Blue Glow
                        'circle-color': [
                            'case',
                            ['get', 'isStale'], '#94a3b8', 
                            '#3b82f6'
                        ],
                        'circle-opacity': 0.3,
                        'circle-blur': 0.5
                    }
                });
            }

            // C. CORE DOT LAYER
            if (!map.getLayer('agents-layer')) {
                map.addLayer({
                    id: 'agents-layer',
                    type: 'circle',
                    source: 'agents-source',
                    paint: {
                        'circle-radius': 8,
                        // Logic: If Stale -> Dark Grey. If Active -> Bright Blue
                        'circle-color': [
                            'case',
                            ['get', 'isStale'], '#64748b', 
                            '#3b82f6'
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff', 
                    }
                });
            }

            // D. Map Interactions
            map.on('click', () => setFocusedAgentId(null));

            map.on('click', 'agents-layer', (e) => handleAgentClick(e, map));
            
            map.on('mouseenter', 'agents-layer', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'agents-layer', () => map.getCanvas().style.cursor = '');

            // START LOOPS
            startFetchLoop();
            startAnimationLoop(map);
        });

        // Plot Restaurant
        if (restaurantLocation) {
          const el = document.createElement('div');
          Object.assign(el.style, {
              backgroundColor: '#ef4444', width: '32px', height: '32px', borderRadius: '50%',
              border: '3px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              display: 'flex', justifyContent: 'center', alignItems: 'center'
          });
          el.innerHTML = '<span style="font-size:16px;">🏠</span>';
          new maplibregl.Marker({ element: el }).setLngLat([restaurantLocation.longitude, restaurantLocation.latitude]).addTo(map);
        }

        // Initial Plot
        plotOrdersOnMap(orders, map, assignments, focusedAgentId);

      } catch (error) { console.error("Map Error:", error); }
    }
    
    initializeMap();

    return () => {
      isMounted = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  // --- 2. AGENT POPUP HANDLER (Shows "Last Seen") ---
  const handleAgentClick = async (e, map) => {
      if (!e.features || !e.features.length) return;
      e.originalEvent.stopPropagation(); 

      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties; 
      const cleanTrackerId = getCleanPhone(props.id);
      
      // Calculate Time Since Last Update
      const lastSeenMins = props.lastSeen ? Math.floor((Date.now() - props.lastSeen) / 60000) : 0;
      const statusText = props.isStale ? `🕒 Offline (${lastSeenMins}m ago)` : `⚡ Live Now`;
      const statusColor = props.isStale ? '#64748b' : '#22c55e';

      setFocusedAgentId(cleanTrackerId); 

      // Agent Info
      const agentProfile = latestAgentsRef.current.find(a => getCleanPhone(a.id || a.sk) === cleanTrackerId);
      const agentName = agentProfile ? agentProfile.name : (props.name || 'Unknown Agent');
      const agentPhone = agentProfile ? (agentProfile.phone || cleanTrackerId) : cleanTrackerId;

      // Identify Relevant Orders
      const relevantOrders = latestOrdersRef.current.filter(o => {
          const orderAgentId = getCleanPhone(o.gsi1pk || o.deliveryAgentId);
          if (orderAgentId !== cleanTrackerId) return false;
          return ['DELIVERING', 'DELIVERED'].includes(o.orderStatus);
      });

      // Init Popup
      const popup = new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(coordinates)
          .setHTML(`
              <div style="font-family: sans-serif; padding: 10px; color: #64748b; font-size: 12px; text-align: center;">
                  <div style="margin-bottom:4px;"><strong>${agentName}</strong></div>
                  <div class="animate-pulse">Loading order details...</div>
              </div>
          `)
          .addTo(map);

       try {
            // Build Content
            let contentHtml = '';
            if (relevantOrders.length > 0) {
                // ... (Use same enrichedOrders logic as before if needed, simplified here for length)
                contentHtml = `<div style="padding:5px; font-weight:bold; color:#3b82f6;">${relevantOrders.length} Active Orders</div>`;
            } else {
                contentHtml = `<div style="font-size:11px;color:#94a3b8;padding:6px;">No active orders.</div>`;
            }
            
            popup.setHTML(`
                <div style="font-family:sans-serif;min-width:220px;">
                    <div style="border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px;">
                        <div style="font-weight:bold;font-size:14px;color:#0f172a;">${agentName}</div>
                        <div style="font-size:12px;color:#64748b; margin-bottom: 2px;">📞 +${agentPhone}</div>
                        <div style="font-size:11px;color:${statusColor};font-weight:bold;">${statusText}</div>
                    </div>
                    <div style="max-height:200px;overflow-y:auto;">${contentHtml}</div>
                </div>
            `);
       } catch (err) {}
  };

  // --- 3. FETCH LOOP (Captures SampleTime) ---
  const startFetchLoop = () => {
    const fetchPositions = async () => {
      try {
        const session = await fetchAuthSession();
        const client = new LocationClient({ region: outputs.geo.aws_region, credentials: session.credentials });
        
        let token = undefined;
        do {
          const response = await client.send(new ListDevicePositionsCommand({
            TrackerName: outputs.custom.amazon_location_service.trackers.default,
            NextToken: token, MaxResults: 100 
          }));

          if (response.Entries) {
            response.Entries.forEach(entry => {
                if (entry.Position && entry.DeviceId) {
                    const id = entry.DeviceId;
                    const newPos = entry.Position; 
                    const sampleTime = new Date(entry.SampleTime).getTime(); // ✅ Capture Time

                    const current = agentAnimationState.current[id];
                    
                    if (!current) {
                        agentAnimationState.current[id] = {
                            start: newPos, end: newPos, startTime: Date.now(),
                            lastSeen: sampleTime // ✅ Store Time
                        };
                    } else {
                        // Only update if it's a newer point
                        if (sampleTime >= current.lastSeen) {
                            agentAnimationState.current[id] = {
                                start: current.end, end: newPos, startTime: Date.now(),
                                lastSeen: sampleTime
                            };
                        }
                    }
                }
            });
          }
          token = response.NextToken;
        } while (token);
      } catch (error) { console.error("Fetch Error:", error); }
      setTimeout(fetchPositions, REFRESH_RATE_MS);
    };
    fetchPositions();
  };

  // --- 4. ANIMATION LOOP (Calculates Staleness) ---
  const startAnimationLoop = (map) => {
      const animate = () => {
          const now = Date.now();
          const features = [];

          Object.entries(agentAnimationState.current).forEach(([id, state]) => {
              const elapsed = now - state.startTime;
              let t = elapsed / ANIMATION_DURATION_MS;
              if (t > 1) t = 1;

              const currentLng = state.start[0] + (state.end[0] - state.start[0]) * t;
              const currentLat = state.start[1] + (state.end[1] - state.start[1]) * t;

              // ✅ Check Staleness (Is data older than 5 mins?)
              const isStale = (now - state.lastSeen) > STALE_THRESHOLD_MS;

              features.push({
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [currentLng, currentLat] },
                  properties: { 
                      id: id, 
                      name: `Agent ${id.slice(-4)}`,
                      isStale: isStale, // ✅ Pass to Mapbox Layer
                      lastSeen: state.lastSeen 
                  }
              });
          });

          const source = map.getSource('agents-source');
          if (source && features.length > 0) {
              source.setData({ type: 'FeatureCollection', features: features });
          }
          animationFrameId.current = requestAnimationFrame(animate);
      };
      animate();
  };

  // --- 5. ORDER PLOTTING (Standard) ---
  useEffect(() => { 
      if (mapInstance.current) plotOrdersOnMap(orders, mapInstance.current, assignments, focusedAgentId); 
  }, [assignments, orders, showDelivered, showDelivering, focusedAgentId]);

  const plotOrdersOnMap = (ordersToPlot, map, currentAssignments, activeAgentId) => {
      if (!map) return;
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      ordersToPlot.forEach((order) => {
          const status = order.orderStatus || 'PREPARED'; 
          if (status === 'DELIVERED' && !showDelivered) return;
          if (status === 'DELIVERING' && !showDelivering) return;
          
          const loc = parseLocation(order.location);
          if (loc) {
              const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
              let agentName = null;
              let hasAgent = false;

              if (assignedAgentId) {
                  const agentProfile = agents.find(a => getCleanPhone(a.id || a.sk) === getCleanPhone(assignedAgentId));
                  if (agentProfile) { agentName = agentProfile.name; hasAgent = true; }
              }

              const isHighlighted = activeAgentId && hasAgent && getCleanPhone(assignedAgentId) === getCleanPhone(activeAgentId);
              const isDimmed = activeAgentId && !isHighlighted;
              const markerColor = getAgentColor(assignedAgentId); 
              
              let iconContent = '📦'; 
              if (status === 'DELIVERING') iconContent = '🚚'; 
              if (status === 'DELIVERED') iconContent = '✅'; 

              const el = document.createElement('div');
              el.className = 'marker-order';
              el.innerHTML = `<span style="color:white;font-weight:bold;font-size:12px;">${iconContent}</span>`;
              
              const scale = isHighlighted ? 'scale(1.5)' : 'scale(1)';
              const zIndex = isHighlighted ? '50' : '10';
              const opacity = isDimmed ? '0.4' : '1';
              const border = isHighlighted ? '3px solid white' : '2px solid white';
              const boxShadow = isHighlighted ? `0 0 15px ${markerColor}` : '0 2px 4px rgba(0,0,0,0.3)';

              Object.assign(el.style, {
                  backgroundColor: markerColor, width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  border: border, boxShadow: boxShadow, cursor: 'pointer',
                  zIndex: zIndex, transform: scale, opacity: opacity,
                  transition: 'all 0.3s ease'
              });

              // Popup
              const shortId = (order.sk || "").replace('ORDER#', '').split('-').slice(0, 3).join('-');
              const popupHTML = `
                <div style="font-family: sans-serif; font-size: 12px; min-width: 140px; color: #334155;">
                    <b>${shortId}</b> <br/>
                    ${hasAgent ? `<span style="color:#3b82f6;">${agentName}</span>` : '<span style="color:#94a3b8">Unassigned</span>'}
                </div>
              `;

              const marker = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.longitude, loc.latitude])
                  .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupHTML))
                  .addTo(map);

              el.addEventListener('click', (e) => {
                  e.stopPropagation(); 
                  map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15 });
                  marker.togglePopup();
              });

              markersRef.current[order.sk] = marker;
          }
      });
  };
  
  const handleOrderClick = (orderSk) => {
    const marker = markersRef.current[orderSk];
    if (marker) {
      marker.togglePopup(); 
      mapInstance.current.flyTo({ center: marker.getLngLat(), zoom: 14 });
    }
  };

  // --- 6. AUTO-ASSIGN & DISPATCH LOGIC ---
  const runOptimization = async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const geoClient = new GeoRoutesClient({ region: outputs.geo.aws_region, credentials: session.credentials });
      const validAgents = agents.filter(a => parseLocation(a.location));

      // A. Leg B: Restaurant -> Customer
      const orderMetrics = {};
      const orderPromises = orders.filter(o => o.orderStatus === 'PREPARED').map(async (order) => {
            const custLoc = parseLocation(order.location);
            if (restaurantLocation && custLoc) {
                try {
                    const res = await geoClient.send(new CalculateRoutesCommand({
                        Origin: [restaurantLocation.longitude, restaurantLocation.latitude],
                        Destination: [custLoc.longitude, custLoc.latitude],
                        TravelMode: "Car",
                    }));
                    if (res.Routes?.length) {
                        const s = res.Routes[0].Summary;
                        orderMetrics[order.sk] = { dist: parseFloat((s.Distance / 1000).toFixed(2)), dur: Math.round(s.Duration) };
                    }
                } catch (e) {}
            }
        });

      // B. Leg A: Agent -> Restaurant
      const agentMetrics = {};
      const agentPromises = validAgents.map(async (agent) => {
          const agentLoc = parseLocation(agent.location);
          if (restaurantLocation && agentLoc) {
              try {
                  const res = await geoClient.send(new CalculateRoutesCommand({
                      Origin: [agentLoc.longitude, agentLoc.latitude],
                      Destination: [restaurantLocation.longitude, restaurantLocation.latitude],
                      TravelMode: "Car"
                  }));
                  if (res.Routes?.length) {
                      const s = res.Routes[0].Summary;
                      agentMetrics[agent.id || agent.sk] = { dist: parseFloat((s.Distance / 1000).toFixed(2)), dur: Math.round(s.Duration) };
                  }
              } catch (e) {}
          }
      });

      await Promise.all([...orderPromises, ...agentPromises]);

      const enrichedAgents = validAgents.map(a => ({
         id: a.id || a.sk, name: a.name, location: parseLocation(a.location),
         maxCapacity: 10, currentLoad: 0, distToRest: agentMetrics[a.id || a.sk]?.dist || 0 
      }));
      const enrichedOrders = orders.map(o => ({ ...o, distFromRest: orderMetrics[o.sk]?.dist || 0 }));

      const response = await client.queries.optimizeDelivery({
        orders: JSON.stringify(enrichedOrders),
        agents: JSON.stringify(enrichedAgents), 
        restaurantLocation: JSON.stringify(restaurantLocation)
      });

      let raw = response.data;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) {} }
      let proposal = raw.proposal;
      if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

      setOptimizationMetrics(orderMetrics); 
      const newAssignments = {};
      if (Array.isArray(proposal)) {
          proposal.forEach(p => {
              if (p.assignedOrders) {
                 p.assignedOrders.forEach(orderSk => { newAssignments[orderSk] = p.agentId; });
              }
          });
      }
      setAssignments(newAssignments);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleDispatch = async () => {
    if (Object.keys(assignments).length === 0) return;
    setSaving(true); 
    try {
      const session = await fetchAuthSession();
      const geoClient = new GeoRoutesClient({ region: outputs.geo.aws_region, credentials: session.credentials });

      const updateTasks = Object.entries(assignments).map(async ([orderSk, rawAgentId]) => {
          const order = orders.find(o => o.sk === orderSk);
          if (!order || order.orderStatus !== 'PREPARED') return;
          const cleanPhone = String(rawAgentId).replace(/[^0-9]/g, '');
          const formattedAgentId = `AGENT#${cleanPhone}`; 
          let dist = 0; let dur = 0;

          const custLoc = parseLocation(order.location);
          if (restaurantLocation && custLoc) {
             try {
                 const res = await geoClient.send(new CalculateRoutesCommand({
                     Origin: [restaurantLocation.longitude, restaurantLocation.latitude],
                     Destination: [custLoc.longitude, custLoc.latitude],
                     TravelMode: "Car",
                 }));
                 if (res.Routes && res.Routes.length > 0) {
                     const summary = res.Routes[0].Summary;
                     dist = parseFloat((summary.Distance / 1000).toFixed(2)); 
                     dur = Math.round(summary.Duration);
                 }
             } catch (e) {}
          }

          await client.models.BusinessData.update({
              pk: order.pk, sk: orderSk, gsi1pk: rawAgentId,           
              deliveryAgentId: formattedAgentId, orderStatus: 'DELIVERING',
              deliveryDistance: dist, deliveryDuration: dur   
          });
      });
      await Promise.all(updateTasks);
      if (onAssignmentSaved) onAssignmentSaved();
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
      <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
        {/* Legend */}
        <div className="absolute bottom-24 right-4 z-[60] flex flex-col items-center gap-4 bg-white/60 p-3 rounded-full shadow-xl border border-white/40 backdrop-blur-md pointer-events-auto transition-all hover:bg-white/90" onClick={(e) => e.stopPropagation()}>
           <label className={`cursor-pointer transition-all duration-300 transform active:scale-90 ${showDelivering ? 'opacity-100 scale-110 grayscale-0' : 'opacity-50 grayscale scale-100'}`}>
             <input type="checkbox" className="hidden" checked={showDelivering} onChange={(e) => setShowDelivering(e.target.checked)} />
             <span className="text-2xl filter drop-shadow-sm">🚚</span>
           </label>
           <div className="w-6 h-px bg-slate-500/30"></div>
           <label className={`cursor-pointer transition-all duration-300 transform active:scale-90 ${showDelivered ? 'opacity-100 scale-110 grayscale-0' : 'opacity-50 grayscale scale-100'}`}>
             <input type="checkbox" className="hidden" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} />
             <span className="text-2xl filter drop-shadow-sm">✅</span>
           </label>
        </div>

        {!isDispatchMode && (
          <button onClick={onClose} className="absolute top-4 right-4 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-gray-100 z-10">✕</button>
        )}
      </div>
      
      {isDispatchMode && (
        <div className="h-full bg-slate-900 text-white shadow-2xl flex flex-col order-2 transition-all duration-300 w-[80px] md:w-64">
          <div className="p-4 flex flex-col items-center md:items-stretch border-b border-slate-800">
            <div className="flex justify-between items-center w-full mb-4">
              <h2 className="hidden md:block text-xl font-bold text-yellow-400">Dispatch</h2>
              <button onClick={onClose} className="text-3xl text-slate-400 hover:text-white mx-auto md:mx-0">×</button>
            </div>
            {hasPreparedOrders ? (
              <div className="flex gap-2 w-full flex-col">
                <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm transition-all">
                    {loading ? "Calculating..." : "⚡️ Auto-Assign"}
                </button>
                <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm transition-all">
                    {saving ? "Processing..." : "📦 Confirm"}
                </button>
              </div>
            ) : <div className="text-center py-2 text-slate-400 text-sm">No new orders.</div>}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {orders.map((o, i) => {
                  if (o.orderStatus === 'DELIVERED' || o.orderStatus === 'DELIVERING') return null;
                  const assignedAgentId = assignments[o.sk];
                  const color = assignedAgentId ? getAgentColor(assignedAgentId) : '#475569'; 

                  return (
                  <div key={o.sk || i} onClick={() => handleOrderClick(o.sk)} className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 flex items-center p-2 cursor-pointer transition-colors" style={{ borderLeft: `4px solid ${color}` }}>
                      <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color }}>{i+1}</span>
                      <div className="hidden md:block flex-1 ml-2 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                            <p className="font-bold text-xs truncate text-slate-200">{o.customer || 'Unknown'}</p>
                            {optimizationMetrics[o.sk] && (
                                <span className="text-[10px] text-emerald-400 font-mono">{optimizationMetrics[o.sk].dist}km</span>
                            )}
                        </div>
                        <select value={assignments[o.sk] || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1 focus:border-blue-500 outline-none">
                          <option value="" disabled>Select Agent</option>
                          {agents.map((agent, aIndex) => (
                              <option key={agent.id || aIndex} value={agent.id || agent.sk}>{agent.name}</option> 
                          ))}
                        </select>
                      </div>
                  </div>
                  );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryOptimizer;
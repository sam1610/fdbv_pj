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
const REFRESH_RATE_MS = 5000; 
const ANIMATION_DURATION_MS = REFRESH_RATE_MS; 
const STALE_THRESHOLD_MS = 5 * 60 * 1000; 

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
  
  // State
  const agentAnimationState = useRef({}); 
  const latestOrdersRef = useRef(orders);
  const latestAgentsRef = useRef(agents);
  const markersRef = useRef({});          

  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(true); // Default open for Dispatcher
  const [showDelivered, setShowDelivered] = useState(false); // Default hide delivered for dispatch
  const [showDelivering, setShowDelivering] = useState(true);
  
  // Logic State
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); 
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [optimizationMetrics, setOptimizationMetrics] = useState({});

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
      // Boosted z-indexes: Map Popups (2000), Drawer (4000), Bun (5000)
      style.innerHTML = `.maplibregl-popup { z-index: 2000 !important; } summary { list-style: none; } summary::-webkit-details-marker { display: none; }`;
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

        // ✅ Global Click: Close Menu & Reset Focus
        map.on('click', () => {
            setFocusedAgentId(null);
            setIsMenuOpen(false);
        });

        map.on('load', () => {
            if (!isMounted) return;

            if (!map.getSource('agents-source')) {
                map.addSource('agents-source', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }

            // Glow Layer
            if (!map.getLayer('agents-glow-layer')) {
                map.addLayer({
                    id: 'agents-glow-layer',
                    type: 'circle',
                    source: 'agents-source',
                    paint: {
                        'circle-radius': 20,
                        'circle-color': ['case', ['get', 'isStale'], '#94a3b8', '#3b82f6'],
                        'circle-opacity': 0.3,
                        'circle-blur': 0.5
                    }
                });
            }

            // Core Layer
            if (!map.getLayer('agents-layer')) {
                map.addLayer({
                    id: 'agents-layer',
                    type: 'circle',
                    source: 'agents-source',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': ['case', ['get', 'isStale'], '#64748b', '#3b82f6'],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff', 
                    }
                });
            }

            map.on('click', 'agents-layer', (e) => handleAgentClick(e, map));
            map.on('mouseenter', 'agents-layer', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'agents-layer', () => map.getCanvas().style.cursor = '');

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

  // --- 2. AGENT POPUP HANDLER ---
  const handleAgentClick = async (e, map) => {
      if (!e.features || !e.features.length) return;
      e.originalEvent.stopPropagation(); 

      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties; 
      const cleanTrackerId = getCleanPhone(props.id);
      
      const lastSeenMins = props.lastSeen ? Math.floor((Date.now() - props.lastSeen) / 60000) : 0;
      const statusText = props.isStale ? `🕒 Offline (${lastSeenMins}m ago)` : `⚡ Live Now`;
      const statusColor = props.isStale ? '#64748b' : '#22c55e';

      setFocusedAgentId(cleanTrackerId); 

      const agentProfile = latestAgentsRef.current.find(a => getCleanPhone(a.id || a.sk) === cleanTrackerId);
      const agentName = agentProfile ? agentProfile.name : (props.name || 'Unknown Agent');
      const agentPhone = agentProfile ? (agentProfile.phone || cleanTrackerId) : cleanTrackerId;

      const relevantOrders = latestOrdersRef.current.filter(o => {
          const orderAgentId = getCleanPhone(o.gsi1pk || o.deliveryAgentId);
          if (orderAgentId !== cleanTrackerId) return false;
          return ['DELIVERING', 'DELIVERED'].includes(o.orderStatus);
      });

      const popup = new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(coordinates)
          .setHTML(`
              <div style="font-family: sans-serif; padding: 10px; color: #64748b; font-size: 12px; text-align: center;">
                  <div style="margin-bottom:4px;"><strong>${agentName}</strong></div>
                  <div class="animate-pulse">Loading orders...</div>
              </div>
          `)
          .addTo(map);

       try {
            const enrichedOrders = await Promise.all(relevantOrders.map(async (order) => {
                try {
                    const phoneNbr = order.pk.split('#')[1];
                    const orderIdPart = order.sk.split('#')[1];
                    const { data: lineItems } = await client.models.BusinessData.listByBusiness({
                        pk: `ORDER#${phoneNbr}#${orderIdPart}`,
                        sk: { beginsWith: 'ITEM#' },
                        sortDirection: 'DESC'
                    });
                    return { ...order, itemsList: lineItems };
                } catch { return { ...order, itemsList: [] }; }
            }));

            let contentHtml = '';
            if (enrichedOrders.length > 0) {
                contentHtml = enrichedOrders.map(o => {
                    const isDelivering = o.orderStatus === 'DELIVERING';
                    const icon = isDelivering ? '🚚' : '✅';
                    const shortId = (o.sk || "").replace('ORDER#', '').slice(0, 10);
                    const statusColor = isDelivering ? '#3b82f6' : '#22c55e';
                    const bg = isDelivering ? '#eff6ff' : '#f0fdf4';
                    
                    const detailsHtml = (o.itemsList || []).map(i => `
                        <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;padding:4px 0;border-bottom:1px dashed #cbd5e1;">
                            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:4px;">${i.name}</span>
                            <span style="font-weight:600;">x${i.quantity || 1}</span>
                        </div>
                    `).join('');

                    return `<details style="background:${bg};margin-bottom:4px;border-radius:4px;border-left:3px solid ${statusColor};overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                        <summary style="display:flex;align-items:center;font-size:11px;padding:8px 6px;cursor:pointer;outline:none;">
                            <span style="font-weight:700;color:#334155;margin-right:6px;">${icon} ${shortId}</span>
                            <span style="color:#64748b;font-size:10px;">(${o.itemsNbr||o.itemsList.length})</span>
                            <span style="margin-left:auto;font-weight:600;color:${statusColor};font-size:10px;">${o.orderStatus}</span>
                        </summary>
                        <div style="padding:2px 8px 8px 8px;background:rgba(255,255,255,0.6);border-top:1px dashed #e2e8f0;">${detailsHtml || 'No Items'}</div>
                    </details>`;
                }).join('');
            } else {
                contentHtml = `<div style="font-size:11px;color:#94a3b8;padding:6px;text-align:center;">No active orders.</div>`;
            }
            
            popup.setHTML(`
                <div style="font-family:sans-serif;min-width:220px;max-width:260px;">
                    <div style="border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold;font-size:13px;color:#0f172a;">${agentName}</div>
                            <div style="font-size:11px;color:#64748b;">+${agentPhone}</div>
                        </div>
                        <span style="font-size:9px; font-weight:bold; color:${statusColor}; background:${props.isStale?'#f1f5f9':'#dcfce7'}; padding:2px 5px; rounded:99px;">${statusText}</span>
                    </div>
                    <div style="max-height:200px;overflow-y:auto;padding-right:2px;">${contentHtml}</div>
                </div>
            `);
       } catch (err) {
           popup.setHTML('<div style="padding:5px;color:red;font-size:10px;">Failed to load data</div>');
       }
  };

  // --- 3. FETCH LOOP ---
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
                    const sampleTime = entry.SampleTime ? new Date(entry.SampleTime).getTime() : Date.now();
                    const current = agentAnimationState.current[id];
                    
                    if (!current) {
                        agentAnimationState.current[id] = { start: newPos, end: newPos, startTime: Date.now(), lastSeen: sampleTime };
                    } else if (sampleTime >= current.lastSeen) {
                        agentAnimationState.current[id] = { start: current.end, end: newPos, startTime: Date.now(), lastSeen: sampleTime };
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

  // --- 4. ANIMATION LOOP ---
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
              const isStale = (now - state.lastSeen) > STALE_THRESHOLD_MS;
              features.push({
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [currentLng, currentLat] },
                  properties: { id: id, name: `Agent ${id.slice(-4)}`, isStale: isStale, lastSeen: state.lastSeen }
              });
          });
          const source = map.getSource('agents-source');
          if (source && features.length > 0) source.setData({ type: 'FeatureCollection', features: features });
          animationFrameId.current = requestAnimationFrame(animate);
      };
      animate();
  };

  // --- 5. ORDER PLOTTING ---
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
              Object.assign(el.style, {
                  backgroundColor: markerColor, width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  border: isHighlighted ? '3px solid white' : '2px solid white', 
                  boxShadow: isHighlighted ? `0 0 15px ${markerColor}` : '0 2px 4px rgba(0,0,0,0.3)', 
                  cursor: 'pointer', zIndex: isHighlighted ? '50' : '10', 
                  transform: isHighlighted ? 'scale(1.5)' : 'scale(1)', 
                  opacity: isDimmed ? '0.4' : '1', transition: 'all 0.3s ease'
              });

              // Initial Popup
              const shortId = (order.sk || "").replace('ORDER#', '').split('-').slice(0, 3).join('-');
              const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
                <div style="font-family: sans-serif; font-size: 12px; color: #64748b; padding: 5px;">
                    <b>${shortId}</b><br/>Loading items...
                </div>
              `);

              const marker = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.longitude, loc.latitude])
                  .setPopup(popup)
                  .addTo(map);

              // Click Handler
              el.addEventListener('click', async (e) => {
                  e.stopPropagation(); 
                  map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15 });
                  marker.togglePopup();

                  try {
                      const phoneNbr = order.pk.split('#')[1];
                      const orderIdPart = order.sk.split('#')[1];
                      const { data: lineItems } = await client.models.BusinessData.listByBusiness({
                          pk: `ORDER#${phoneNbr}#${orderIdPart}`,
                          sk: { beginsWith: 'ITEM#' }
                      });

                      const itemsHtml = lineItems.length ? lineItems.map(i => `
                        <div style="display:flex;justify-content:space-between;border-bottom:1px dashed #eee;padding:4px 0;">
                            <span style="color:#334155;">${i.name}</span><strong style="color:#0f172a;">x${i.quantity || 1}</strong>
                        </div>
                      `).join('') : '<span style="color:#94a3b8; font-style:italic;">No items found</span>';

                      const agentDisplay = hasAgent 
                        ? `<span style="color:#0f172a; font-weight:700;">${agentName}</span>` 
                        : `<span style="color:#ef4444; font-weight:800; letter-spacing:0.5px;">UNASSIGNED</span>`;

                      const customerPhone = order.phone || "Unknown";

                      popup.setHTML(`
                        <div style="font-family: sans-serif; font-size: 12px; min-width: 180px; color: #334155;">
                            <div style="background:${status === 'DELIVERING' ? '#eff6ff' : '#f0fdf4'}; padding:6px; border-radius:6px; margin-bottom:8px; border:1px solid ${status === 'DELIVERING' ? '#bfdbfe' : '#bbf7d0'}; display:flex; justify-content:space-between; align-items:center;">
                                <b style="color:#1e293b; letter-spacing:0.5px;">${shortId}</b> 
                                <span style="font-size:14px;">${status === 'DELIVERING' ? '🚚' : '✅'}</span>
                            </div>
                            <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #f1f5f9; font-weight:600; color:#475569; display:flex; align-items:center;">
                                <span style="font-size:16px; margin-right:6px;">📞</span> 
                                <span style="color:#334155; font-size:13px;">${customerPhone}</span>
                            </div>
                            <div style="max-height:150px; overflow-y:auto; margin-bottom:8px;">${itemsHtml}</div>
                            <div style="margin-top:4px; font-size:11px; color:#64748b; background:#f8fafc; padding:6px; border-radius:4px; border:1px solid #e2e8f0;">
                                Agent: ${agentDisplay}
                            </div>
                        </div>
                      `);
                  } catch (err) {
                      popup.setHTML(`<div style="color:red;padding:10px;text-align:center;">⚠️ Error loading items</div>`);
                  }
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
      marker.getElement().click(); 
    }
  };

  // --- 6. OPTIMIZATION LOGIC ---
  const runOptimization = async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const geoClient = new GeoRoutesClient({ region: outputs.geo.aws_region, credentials: session.credentials });
      const validAgents = agents.filter(a => parseLocation(a.location));

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
    <div className="fixed inset-0 bg-slate-900 z-[3000] overflow-hidden flex flex-col h-[100dvh]">
      
      {/* 1. FLOATING HEADER (Burger Icon + Close) */}
      <div className="absolute top-4 left-4 right-4 z-[5000] flex justify-between pointer-events-none">
          {/* Burger Toggle */}
          <button 
            onClick={() => setIsMenuOpen(prev => !prev)} 
            className="pointer-events-auto bg-slate-800/90 text-white p-3 rounded-full shadow-xl border border-slate-700 hover:bg-slate-700 transition-transform active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Close Button (Existing) */}
          <button onClick={onClose} className="pointer-events-auto bg-slate-800/90 text-slate-300 p-3 rounded-full shadow-xl border border-slate-700 hover:text-white hover:bg-red-900/50 transition-colors">
            ✕
          </button>
      </div>

      {/* 2. MAP CONTAINER */}
      <div className="flex-1 relative w-full h-full">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
        {/* Legend */}
        <div className="absolute bottom-10 right-4 z-[2500] flex flex-col items-center gap-4 bg-white/60 p-3 rounded-full shadow-xl border border-white/40 backdrop-blur-md pointer-events-auto transition-all hover:bg-white/90" onClick={(e) => e.stopPropagation()}>
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
      </div>
      
      {/* 3. SLIDING DRAWER (Dispatch Panel) */}
      <div className={`fixed inset-0 z-[4000] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
        
        <div className={`absolute top-0 bottom-0 left-0 w-80 bg-slate-900 border-r border-slate-700 shadow-2xl transform transition-transform duration-300 flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            
            {/* Drawer Header: Dispatch Controls */}
            <div className="p-6 border-b border-slate-700 bg-slate-800">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Dispatch</h2>
                
                {hasPreparedOrders ? (
                  <div className="flex gap-2 w-full flex-col">
                    <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm transition-all">
                        {loading ? "Calculating..." : "⚡️ Auto-Assign"}
                    </button>
                    <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm transition-all">
                        {saving ? "Processing..." : "📦 Confirm"}
                    </button>
                  </div>
                ) : <div className="text-center py-2 text-slate-400 text-sm bg-slate-700/30 rounded border border-slate-600">No new orders.</div>}
            </div>

            {/* Drawer Content: Order List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Orders</h3>
              {orders.map((o, i) => {
                  if (o.orderStatus === 'DELIVERED' || o.orderStatus === 'DELIVERING') return null;
                  const assignedAgentId = assignments[o.sk];
                  const color = assignedAgentId ? getAgentColor(assignedAgentId) : '#475569'; 

                  return (
                  <div key={o.sk || i} onClick={() => { handleOrderClick(o.sk); setIsMenuOpen(false); }} className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 p-3 cursor-pointer transition-colors shadow-sm group" style={{ borderLeft: `4px solid ${color}` }}>
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color }}>{i+1}</span>
                          {optimizationMetrics[o.sk] && (
                                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/30 px-2 py-0.5 rounded">{optimizationMetrics[o.sk].dist}km</span>
                          )}
                      </div>
                      <div className="mb-2">
                            <p className="font-bold text-xs truncate text-slate-200">{o.customer || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-500">{o.sk.split('#')[1].slice(0, 8)}...</p>
                      </div>
                      <select value={assignments[o.sk] || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none">
                          <option value="" disabled>Select Agent</option>
                          {agents.map((agent, aIndex) => (
                              <option key={agent.id || aIndex} value={agent.id || agent.sk}>{agent.name}</option> 
                          ))}
                      </select>
                  </div>
                  );
              })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryOptimizer;
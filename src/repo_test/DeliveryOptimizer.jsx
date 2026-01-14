// import React, { useEffect, useRef, useState } from 'react';
// import { createMap } from 'maplibre-gl-js-amplify';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
// import outputs from '../../amplify_outputs.json';
// import { client } from '../DataHook/amplifyClient'; 
// import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";
// import { fetchAuthSession } from 'aws-amplify/auth';

// const DeliveryOptimizer = ({
//   orders,
//   agents,
//   AGENT_COLORS,
//   restaurantLocation,
//   onClose,
//   onAssignmentSaved
// }) => {
//   const mapContainerRef = useRef(null);
//   const mapInstance = useRef(null);
  
//   // Refs for markers and animations
//   const markersRef = useRef({});          
//   const agentMarkersRef = useRef({});     
//   const restaurantMarkerRef = useRef(null);
//   const animationRefs = useRef({}); // Stores animation frame IDs

//   const [loading, setLoading] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [assignments, setAssignments] = useState({});
//   const [errorMessage, setErrorMessage] = useState(null);
  
//   const [livePositions, setLivePositions] = useState({});
//   const [showDelivered, setShowDelivered] = useState(false);
//   const [showDelivering, setShowDelivering] = useState(false);

//   const isDispatchMode = !showDelivered && !showDelivering;
//   const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');
  
//   // ---------------------------------------------------------
//   // 0. INJECT CSS STYLES (Pulse Animation)
//   // ---------------------------------------------------------
//   useEffect(() => {
//     if (!document.getElementById('pulse-style')) {
//         const style = document.createElement('style');
//         style.id = 'pulse-style';
//         style.innerHTML = `
//             @keyframes pulse-ring {
//                 0% { transform: scale(0.5); opacity: 0.8; }
//                 80% { transform: scale(2.5); opacity: 0; }
//                 100% { transform: scale(2.5); opacity: 0; }
//             }
//             .pulse-container {
//                 position: relative;
//                 display: flex;
//                 justify-content: center;
//                 align-items: center;
//             }
//             .pulse-ring {
//                 position: absolute;
//                 width: 20px; 
//                 height: 20px;
//                 border-radius: 50%;
//                 background-color: rgba(34, 197, 94, 0.6); /* Green Glow */
//                 animation: pulse-ring 2s infinite cubic-bezier(0.455, 0.03, 0.515, 0.955);
//                 z-index: -1;
//             }
//         `;
//         document.head.appendChild(style);
//     }
//   }, []);

//   // --- 🛠 HELPER: Normalize IDs to Pure Digits ---
//   const getCleanPhone = (id) => {
//       if (!id) return "";
//       return String(id).replace(/[^0-9]/g, ''); 
//   };

//   const getAgentColor = (agentId) => {
//     if (!agentId) return '#64748b'; 
//     const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
//     if (index === -1) return '#64748b';
//     return AGENT_COLORS[index % AGENT_COLORS.length];
//   };

//   const parseLocation = (loc) => {
//     if (!loc) return null;
//     try {
//       const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc;
//       const lat = parseFloat(parsed.latitude?.N || parsed.latitude || 0);
//       const lng = parseFloat(parsed.longitude?.N || parsed.longitude || 0);
//       if (lat === 0 && lng === 0) return null;
//       return { latitude: lat, longitude: lng };
//     } catch { return null; }
//   };

//   // 1. HELPER: Fit Map Logic
//   const fitMapToMarkers = () => {
//     const map = mapInstance.current;
//     if (!map) return;

//     const bounds = new maplibregl.LngLatBounds();
//     let hasPoints = false;

//     if (restaurantLocation) {
//         bounds.extend([restaurantLocation.longitude, restaurantLocation.latitude]);
//         hasPoints = true;
//     }

//     Object.values(livePositions).forEach(pos => {
//         if (pos.longitude && pos.latitude) {
//             bounds.extend([pos.longitude, pos.latitude]);
//             hasPoints = true;
//         }
//     });

//     if (hasPoints) {
//         map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
//     }
//   };

//   // 2. TRIGGER: Auto-zoom
//   useEffect(() => {
//     if (mapInstance.current && Object.keys(livePositions).length > 0) {
//         if (!mapInstance.current._hasInitialFit) {
//              fitMapToMarkers();
//              mapInstance.current._hasInitialFit = true;
//         }
//     }
//     plotAgentsOnMap();
//   }, [livePositions]);

//   // 3. INITIALIZE MAP
//   useEffect(() => {
//     async function initializeMap() {
//       if (mapInstance.current) return;
//       try {
//         const map = await createMap({
//           container: mapContainerRef.current,
//           center: [
//             restaurantLocation?.longitude || 50.5,
//             restaurantLocation?.latitude || 26.2
//           ],
//           zoom: 12,
//           attributionControl: false 
//         });

//         mapInstance.current = map;
//         map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

//         plotOrdersOnMap(orders, map, assignments);
//         plotAgentsOnMap(); 

//       } catch (error) { console.error("Error creating map:", error); }
//     }
//     initializeMap();
    
//     return () => {
//       if (mapInstance.current) { 
//           mapInstance.current.remove(); 
//           mapInstance.current = null; 
//       }
//     };
//   }, []);

//   // 4. POLL AWS TRACKER (Every 5s)
//   useEffect(() => {
//       let isMounted = true;
//       const fetchLivePositions = async () => {
//           try {
//               const session = await fetchAuthSession();
//               const client = new LocationClient({
//                   region: outputs.geo.aws_region,
//                   credentials: session.credentials
//               });

//               const response = await client.send(new ListDevicePositionsCommand({
//                   TrackerName: outputs.custom.amazon_location_service.trackers.default
//               }));

//               if (isMounted && response.Entries) {
//                   const newPositions = {};
//                   const now = new Date();
                  
//                   response.Entries.forEach(entry => {
//                       if (entry.Position && entry.DeviceId) {
//                           // ✅ FRESHNESS CHECK (5 mins)
//                           const posTime = new Date(entry.SampleTime);
//                           const ageMinutes = (now - posTime) / 1000 / 60;
                          
//                           if (ageMinutes < 5) { 
//                               const cleanId = getCleanPhone(entry.DeviceId);
//                               newPositions[cleanId] = {
//                                   latitude: entry.Position[1],
//                                   longitude: entry.Position[0],
//                                   lastUpdated: entry.SampleTime
//                               };
//                           }
//                       }
//                   });
//                   setLivePositions(newPositions);
//               }
//           } catch (e) { console.warn("Poll error:", e); }
//       };

//       fetchLivePositions();
//       const interval = setInterval(fetchLivePositions, 5000); 
//       return () => { isMounted = false; clearInterval(interval); };
//   }, []);

//   // 5. PLOT RESTAURANT (HQ)
//   useEffect(() => {
//     const map = mapInstance.current;
//     if (!map || !restaurantLocation) return;

//     if (restaurantMarkerRef.current) {
//         restaurantMarkerRef.current.remove();
//         restaurantMarkerRef.current = null;
//     }

//     const el = document.createElement('div');
//     el.style.backgroundColor = '#ef4444'; 
//     el.style.width = '32px'; el.style.height = '32px';
//     el.style.borderRadius = '50%'; el.style.border = '3px solid white';
//     el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
//     el.style.display = 'flex'; el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//     el.innerHTML = '<span style="font-size:16px;">🏠</span>';
//     el.style.zIndex = '50'; 

//     const newMarker = new maplibregl.Marker({ element: el })
//       .setLngLat([restaurantLocation.longitude, restaurantLocation.latitude])
//       .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML("<b>HQ / Restaurant</b>"))
//       .addTo(map);

//     restaurantMarkerRef.current = newMarker;

//   }, [restaurantLocation]); 

//   // 6. REACTIVE PLOTTING
//   useEffect(() => {
//     if (mapInstance.current) {
//         plotOrdersOnMap(orders, mapInstance.current, assignments);
//     }
//   }, [assignments, orders, showDelivered, showDelivering]); 

//   useEffect(() => {
//     if (mapInstance.current) {
//         plotAgentsOnMap();
//     }
//   }, [livePositions, agents]); 


//   // --- PLOTTING FUNCTIONS ---

//   const plotAgentsOnMap = () => {
//     const map = mapInstance.current;
//     if (!map) return;

//     const processedIds = new Set();

//     agents.forEach(agent => {
//       // 1. Get Robust ID
//       const agentId = agent.id || agent.sk || agent.pk || agent.phone;
//       if (!agentId) return;
//       const cleanId = getCleanPhone(agentId);
//       processedIds.add(agentId);

//       // 2. Determine Target Location
//       const liveLoc = livePositions[cleanId];
//       let targetLoc = null;

//       if (liveLoc) {
//           targetLoc = { lng: liveLoc.longitude, lat: liveLoc.latitude };
//       } else {
//           // Fallback to stored location (Offline/Stale)
//           const parsed = parseLocation(agent.location);
//           if (parsed) targetLoc = { lng: parsed.longitude, lat: parsed.latitude };
//       }

//       if (!targetLoc || isNaN(targetLoc.lat) || isNaN(targetLoc.lng)) return;

//       const color = getAgentColor(agentId);
//       const markerHTML = `
//             <div class="pulse-ring"></div>
//             <div style="
//                 display: flex; justify-content: center; align-items: center;
//                 width: 20px; height: 20px; 
//                 background-color: white; border-radius: 50%; 
//                 border: 2px solid ${color}; 
//                 box-shadow: 0 2px 5px rgba(0,0,0,0.5);
//                 font-size: 14px; z-index: 2; position: relative;
//             ">🛵</div>
//       `;

//       // 3. UPDATE OR CREATE MARKER
//       if (agentMarkersRef.current[agentId]) {
//         // --- ⚡️ UPDATE EXISTING ---
//         const marker = agentMarkersRef.current[agentId];
//         const startLoc = marker.getLngLat();

//         // ** ANIMATION LOGIC (Interpolation) **
//         // Cancel any previous animation for this agent
//         if (animationRefs.current[agentId]) cancelAnimationFrame(animationRefs.current[agentId]);

//         const startTime = performance.now();
//         const distance = Math.hypot(
//   targetLoc.lng - startLoc.lng,
//   targetLoc.lat - startLoc.lat
// );

// if (distance < 0.00002) return; // ~2m GPS noise

// const speed = 0.00008; // degrees/sec (~30km/h)
// const duration = Math.min(Math.max(distance / speed * 1000, 1500), 8000);
// const bearing = Math.atan2(
//   targetLoc.lng - startLoc.lng,
//   targetLoc.lat - startLoc.lat
// ) * 180 / Math.PI;

// marker.getElement().style.transform = `rotate(${bearing}deg)`;

//         const animate = (time) => {
//             const elapsed = time - startTime;
//             const progress = Math.min(elapsed / duration, 1);
            
//             // Linear Interpolation
//             const currentLng = startLoc.lng + (targetLoc.lng - startLoc.lng) * progress;
//             const currentLat = startLoc.lat + (targetLoc.lat - startLoc.lat) * progress;

//             marker.setLngLat([currentLng, currentLat]);

//             if (progress < 1) {
//                 animationRefs.current[agentId] = requestAnimationFrame(animate);
//             }
//         };
//         // Start animation
//         animationRefs.current[agentId] = requestAnimationFrame(animate);

//         // ** SELF HEALING **
//         // If innerHTML is lost (re-renders), repair it
//         const el = marker.getElement();
//         if (!el.innerHTML.includes('pulse-ring')) {
//              el.className = 'marker-agent pulse-container';
//              el.innerHTML = markerHTML;
//         }

//       } else {
//         // --- 🆕 CREATE NEW ---
//         const el = document.createElement('div');
//         el.className = 'marker-agent pulse-container';
//         el.innerHTML = markerHTML;
        
//         el.setAttribute('draggable', 'false'); 
//         Object.assign(el.style, {
//             width: '20px', height: '20px', 
//             cursor: 'default', userSelect: 'none', touchAction: 'none',
//             position: 'relative', overflow: 'visible' 
//         });

//         const marker = new maplibregl.Marker({ 
//             element: el, 
//             anchor: 'center',         // ✅ FIX: Prevents drifting when zooming
//             pitchAlignment: 'viewport', // ✅ FIX: Prevents hiding when tilting
//             rotationAlignment: 'auto', 
//             draggable: false          
//         })
//           .setLngLat([targetLoc.lng, targetLoc.lat])
//           .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${agent.name}</b>`))
//           .addTo(map);
        
//         agentMarkersRef.current[agentId] = marker;
//       }
//     });

//     // 4. CLEANUP (Remove agents not in list or too old)
//     Object.keys(agentMarkersRef.current).forEach(id => {
//         if (!processedIds.has(id)) {
//             if (animationRefs.current[id]) cancelAnimationFrame(animationRefs.current[id]);
//             agentMarkersRef.current[id].remove();
//             delete agentMarkersRef.current[id];
//         }
//     });
//   };

//   const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
//       if (!map) return;
//       Object.values(markersRef.current).forEach(m => m.remove());
//       markersRef.current = {};

//       ordersToPlot.forEach((order, index) => {
//           const status = order.orderStatus || 'PREPARED'; 
//           if (status === 'DELIVERED' && !showDelivered) return;
//           if (status === 'DELIVERING' && !showDelivering) return;
          
//           const loc = parseLocation(order.location);
//           if (loc) {
//               const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
//               const assignedAgent = agents.find(a => (a.id || a.sk) === assignedAgentId);
//               const agentName = assignedAgent ? assignedAgent.name : 'Unassigned';
//               const markerColor = getAgentColor(assignedAgentId);

//               const el = document.createElement('div');
//               let iconContent = index + 1;
//               if (status === 'DELIVERED') iconContent = '√';
//               else if (status === 'DELIVERING') iconContent = '🚚';

//               el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${iconContent}</span>`;
//               el.style.backgroundColor = markerColor;
//               el.style.width = '24px'; el.style.height = '24px';
//               el.style.borderRadius = '50%';
//               el.style.display = 'flex'; el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//               el.style.border = '2px solid white';
//               el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
//               el.style.cursor = 'pointer';
//               el.style.zIndex = '10';

//               const cleanId = order.sk.split('#')[1] || order.sk;
//               const phone = order.customer || 'No Phone';

//               const popupContent = `
//                 <div style="color: black; min-width: 180px; padding: 5px;">
//                   <div style="font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">ORDER ${index + 1}</div>
//                   <div style="font-size: 13px; margin-top: 4px;">Agent: ${agentName}</div>
//                   <div style="font-size: 13px;">Customer: ${phone}</div>
//                 </div>
//               `;

//               const marker = new maplibregl.Marker({ element: el })
//                   .setLngLat([loc.longitude, loc.latitude])
//                   .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
//                   .addTo(map);

//               markersRef.current[order.sk] = marker;
//           }
//       });
//   };

//   const handleOrderClick = (orderSk) => {
//     const marker = markersRef.current[orderSk];
//     if (marker) {
//       marker.togglePopup(); 
//       mapInstance.current.flyTo({ center: marker.getLngLat(), zoom: 14 });
//     }
//   };

//   const runOptimization = async () => {
//     setLoading(true);
//     setErrorMessage(null); 
//     try {
//       const validAgents = agents.filter(a => parseLocation(a.location)).map(a => ({
//          id: a.id || a.sk, 
//          name: a.name,
//          location: parseLocation(a.location),
//          maxCapacity: 10,
//          currentLoad: 0
//       }));

//       if (validAgents.length === 0) throw new Error("No active agents with locations found.");

//       const response = await client.queries.optimizeDelivery({
//         orders: JSON.stringify(orders),
//         agents: JSON.stringify(validAgents), 
//         restaurantLocation: JSON.stringify(restaurantLocation)
//       });

//       let raw = response.data;
//       if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) {} }
      
//       let proposal = raw.proposal;
//       if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

//       const newAssignments = {};
//       if (Array.isArray(proposal)) {
//           proposal.forEach(p => {
//               if (p.assignedOrders) {
//                  p.assignedOrders.forEach(orderSk => {
//                      newAssignments[orderSk] = p.agentId;
//                  });
//               }
//           });
//       }
//       setAssignments(newAssignments);

//     } catch (err) {
//       console.error("Optimization failed:", err);
//       setErrorMessage(err.message || "Optimization Failed");
//     } finally { setLoading(false); }
//   };

//   const handleDispatch = async () => {
//     if (Object.keys(assignments).length === 0) return;
//     setSaving(true);
//     try {
//       const updatesByAgent = {};
//       Object.entries(assignments).forEach(([orderSk, agentId]) => {
//           const order = orders.find(o => o.sk === orderSk);
//           if (order && order.orderStatus === 'PREPARED') {
//               if (!updatesByAgent[agentId]) updatesByAgent[agentId] = [];
//               updatesByAgent[agentId].push(orderSk);
//           }
//       });

//       const updatePromises = Object.entries(updatesByAgent).map(async ([agentId, skList]) => {
//           for (const sk of skList) {
//              const order = orders.find(o => o.sk === sk);
//              await client.models.BusinessData.update({
//                 pk: order.pk,
//                 sk: sk,
//                 gsi1pk: agentId,           
//                 deliveryAgentId: agentId,  
//                 orderStatus: 'DELIVERING'
//              });
//           }
//       });
//       await Promise.all(updatePromises);
//       if (onAssignmentSaved) onAssignmentSaved();
//     } catch (error) {
//       console.error("Dispatch Error", error);
//     } finally { setSaving(false); }
//   };

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
//       <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
//         <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
//         <div className="absolute bottom-6 left-4 bg-white/95 p-3 rounded-lg shadow-xl text-sm pointer-events-auto backdrop-blur-sm border border-gray-200" onClick={(e) => e.stopPropagation()}>
//            <label className="flex items-center mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition">
//              <input type="checkbox" checked={showDelivering} onChange={(e) => setShowDelivering(e.target.checked)} className="mr-2 cursor-pointer accent-orange-500 h-4 w-4" />
//              <span className="mr-2">🚚</span><span className="text-gray-700">DELIVERING</span>
//            </label>
//            <label className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition">
//              <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} className="mr-2 cursor-pointer accent-green-600 h-4 w-4" />
//              <span className="mr-2">✅</span><span className="text-gray-700">DELIVERED</span>
//            </label>
//         </div>
        
//         {!isDispatchMode && (
//           <button onClick={onClose} className="absolute top-4 right-4 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-gray-100 z-10">✕</button>
//         )}
//       </div>

//       {isDispatchMode && (
//         <div className="h-full bg-slate-900 text-white shadow-2xl flex flex-col order-2 transition-all duration-300 w-[80px] md:w-64">
//           <div className="p-4 flex flex-col items-center md:items-stretch border-b border-slate-800">
//             <div className="flex justify-between items-center w-full mb-4">
//               <h2 className="hidden md:block text-xl font-bold text-yellow-400">Dispatch</h2>
//               <button onClick={onClose} className="text-3xl text-slate-400 hover:text-white mx-auto md:mx-0">×</button>
//             </div>
//             {hasPreparedOrders ? (
//               <div className="flex gap-2 w-full flex-col">
//                 <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm">{loading ? "..." : "⚡️ Auto-Assign"}</button>
//                 <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center disabled:opacity-50 text-sm">{saving ? "..." : "📦 Confirm"}</button>
//               </div>
//             ) : <div className="text-center py-2 text-slate-400 text-sm">No new orders.</div>}
//           </div>
//           <div className="flex-1 overflow-y-auto p-2 space-y-2">
//               {orders.map((o, i) => {
//                   if (o.orderStatus === 'DELIVERED' || o.orderStatus === 'DELIVERING') return null;
//                   const agentId = assignments[o.sk];
//                   const color = getAgentColor(agentId);
                  
//                   return (
//                   <div key={o.sk || i} onClick={() => handleOrderClick(o.sk)} className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 flex items-center p-2" style={{ borderLeft: `3px solid ${color}` }}>
//                       <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color }}>{i+1}</span>
//                       <div className="hidden md:block flex-1 ml-2 min-w-0">
//                         <p className="font-bold text-xs truncate mb-1">{o.customer || 'Unknown'}</p>
//                         <select value={assignments[o.sk] || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1">
//                           <option value="" disabled>Select Agent</option>
//                           {agents.map((agent, aIndex) => (
//                               <option key={agent.id || aIndex} value={agent.id || agent.sk}>{agent.name}</option> 
//                           ))}
//                         </select>
//                       </div>
//                   </div>
//                   );
//               })}
//           </div>
//         </div>
//       )}
      
//       {/* --- 🛡️ FLEET STATUS PANEL --- */}
//       <div className="absolute top-4 left-4 bg-slate-900/90 text-white p-4 rounded-lg shadow-2xl border border-slate-700 w-64 z-[9999]">
//         <h3 className="font-bold text-yellow-400 mb-2 border-b border-slate-600 pb-1">📡 Live Fleet Status</h3>
//         <div className="space-y-2 max-h-60 overflow-y-auto">
//             {agents.map((agent, i) => {
//                 const agentId = agent.id || agent.sk;
//                 const cleanId = getCleanPhone(agentId);
//                 const isLive = !!livePositions[cleanId];
                
//                 const loc = isLive ? livePositions[cleanId] : parseLocation(agent.location);
                
//                 return (
//                     <div key={agentId || i} className="flex flex-col bg-slate-800 p-2 rounded text-xs">
//                         <div className="flex justify-between items-center mb-1">
//                             <span className="font-bold">{agent.name}</span>
//                             {isLive ? (
//                                 <span className="text-green-400 font-mono animate-pulse">● LIVE</span>
//                             ) : (
//                                 <span className="text-slate-500">○ OFFLINE</span>
//                             )}
//                         </div>
//                         <div className="text-slate-400 font-mono text-[10px] mb-2">ID: {cleanId || "MISSING"}</div>
//                         {loc ? (
//                              <button 
//                                 onClick={() => {
//                                     if (mapInstance.current) {
//                                         mapInstance.current.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15, speed: 2 });
//                                     }
//                                 }}
//                                 className="bg-blue-600 hover:bg-blue-500 text-white py-1 px-2 rounded text-center font-bold transition"
//                             >
//                                 🎯 LOCATE {isLive ? '(ACTUAL)' : '(STORED)'}
//                             </button>
//                         ) : (
//                             <div className="text-red-400 italic">No Location Data</div>
//                         )}
//                     </div>
//                 );
//             })}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default DeliveryOptimizer;



// functional component code
// import React, { useEffect, useRef, useState } from 'react';
// import { createMap } from 'maplibre-gl-js-amplify';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
// import outputs from '../../amplify_outputs.json';
// import { client } from '../DataHook/amplifyClient'; 
// import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";
// import { fetchAuthSession } from 'aws-amplify/auth';

// const DeliveryOptimizer = ({
//   orders,
//   agents,
//   AGENT_COLORS,
//   restaurantLocation,
//   onClose,
//   onAssignmentSaved
// }) => {
//   const mapContainerRef = useRef(null);
//   const mapInstance = useRef(null);
  
//   // Refs
//   const markersRef = useRef({});          
//   const agentMarkersRef = useRef({});     
//   const restaurantMarkerRef = useRef(null);
//   const animationRefs = useRef({});

//   const [livePositions, setLivePositions] = useState({});
//   const [showDelivered, setShowDelivered] = useState(false);
//   const [showDelivering, setShowDelivering] = useState(false);
//   const [assignments, setAssignments] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [saving, setSaving] = useState(false);

//   const isDispatchMode = !showDelivered && !showDelivering;
//   const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');

//   // 0. INJECT CSS STYLES
//   useEffect(() => {
//     if (!document.getElementById('pulse-style')) {
//         const style = document.createElement('style');
//         style.id = 'pulse-style';
//         style.innerHTML = `
//             @keyframes pulse-ring {
//                 0% { transform: scale(0.5); opacity: 0.8; }
//                 80% { transform: scale(2.5); opacity: 0; }
//                 100% { transform: scale(2.5); opacity: 0; }
//             }
//             .pulse-container { position: relative; display: flex; justify-content: center; align-items: center; }
//             .pulse-ring {
//                 position: absolute; width: 20px; height: 20px; border-radius: 50%;
//                 background-color: rgba(34, 197, 94, 0.6); z-index: -1;
//                 animation: pulse-ring 2s infinite cubic-bezier(0.455, 0.03, 0.515, 0.955);
//             }
//         `;
//         document.head.appendChild(style);
//     }
//   }, []);

//   // --- Helpers ---
//   const getCleanPhone = (id) => String(id || "").replace(/[^0-9]/g, '');
  
//   const getAgentColor = (agentId) => {
//     if (!agentId) return '#64748b'; 
//     const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
//     return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
//   };

//   const parseLocation = (loc) => {
//     if (!loc) return null;
//     try {
//       const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc;
//       const lat = parseFloat(parsed.latitude?.N || parsed.latitude || 0);
//       const lng = parseFloat(parsed.longitude?.N || parsed.longitude || 0);
//       if (lat === 0 && lng === 0) return null;
//       return { latitude: lat, longitude: lng };
//     } catch { return null; }
//   };

//   // --- Map Init ---
//   useEffect(() => {
//     async function initializeMap() {
//       if (mapInstance.current) return;
//       try {
//         const map = await createMap({
//           container: mapContainerRef.current,
//           center: [restaurantLocation?.longitude || 50.5, restaurantLocation?.latitude || 26.2],
//           zoom: 12,
//           attributionControl: false 
//         });
//         mapInstance.current = map;
//         map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
//         plotOrdersOnMap(orders, map, assignments);
//       } catch (error) { console.error("Error creating map:", error); }
//     }
//     initializeMap();
//   }, []);

//   // --- 📡 POLL AWS TRACKER (Every 5s) ---
//   useEffect(() => {
//       let isMounted = true;
//       const fetchLivePositions = async () => {
//           try {
//               const session = await fetchAuthSession();
//               const client = new LocationClient({
//                   region: outputs.geo.aws_region,
//                   credentials: session.credentials
//               });
//               const response = await client.send(new ListDevicePositionsCommand({
//                   TrackerName: outputs.custom.amazon_location_service.trackers.default
//               }));

//               if (isMounted && response.Entries) {
//                   const newPositions = {};
//                   const now = new Date();
                  
//                   response.Entries.forEach(entry => {
//                       if (entry.Position && entry.DeviceId) {
//                           const posTime = new Date(entry.SampleTime);
//                           const ageMinutes = (now - posTime) / 1000 / 60;
                          
//                           // ✅ DEBUG LOG: See if data is being rejected
//                           if (ageMinutes >= 15) {
//                               console.warn(`⚠️ Dropping stale data for ${entry.DeviceId}. Age: ${ageMinutes.toFixed(1)} mins`);
//                           }

//                           // ✅ RELAXED CHECK: Increased to 15 mins to prevent accidental "disappearing"
//                           if (ageMinutes < 15) { 
//                               const cleanId = getCleanPhone(entry.DeviceId);
//                               newPositions[cleanId] = {
//                                   latitude: entry.Position[1],
//                                   longitude: entry.Position[0]
//                               };
//                           }
//                       }
//                   });
//                   setLivePositions(newPositions);
//               }
//           } catch (e) { console.warn("Poll error:", e); }
//       };
//       fetchLivePositions();
//       const interval = setInterval(fetchLivePositions, 5000); 
//       return () => { isMounted = false; clearInterval(interval); };
//   }, []);

//   // --- React to Updates ---
//   useEffect(() => {
//     if (mapInstance.current) plotAgentsOnMap();
//   }, [livePositions]); 

//   const plotAgentsOnMap = () => {
//     const map = mapInstance.current;
//     if (!map) return;
//     const processedIds = new Set();

//     agents.forEach(agent => {
//       const agentId = agent.id || agent.sk || agent.pk || agent.phone;
//       if (!agentId) return;
//       const cleanId = getCleanPhone(agentId);
//       processedIds.add(agentId); // ✅ Mark as processed immediately so it doesn't get deleted

//       // Location Priority: Live > Stored > Null
//       const liveLoc = livePositions[cleanId];
//       let targetLoc = liveLoc ? { lng: liveLoc.longitude, lat: liveLoc.latitude } : null;
      
//       if (!targetLoc) {
//           const parsed = parseLocation(agent.location);
//           if (parsed) targetLoc = { lng: parsed.longitude, lat: parsed.latitude };
//       }

//       // If absolutely no location, we can't plot, but we already marked ID as processed
//       // so the cleanup won't run on it if it had a previous marker (optional safety)
//       if (!targetLoc) return; 

//       const color = getAgentColor(agentId);
//       const markerHTML = `
//             <div class="pulse-ring"></div>
//             <div style="
//                 display: flex; justify-content: center; align-items: center;
//                 width: 20px; height: 20px; background-color: white; border-radius: 50%; 
//                 border: 2px solid ${color}; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
//                 font-size: 14px; z-index: 2; position: relative;
//             ">🛵</div>
//       `;

//       if (agentMarkersRef.current[agentId]) {
//         // --- UPDATE EXISTING ---
//         const marker = agentMarkersRef.current[agentId];
//         const startLoc = marker.getLngLat();
        
//         // Only animate if distance is significant (prevents micro-jitter)
//         const dist = Math.sqrt(Math.pow(targetLoc.lng - startLoc.lng, 2) + Math.pow(targetLoc.lat - startLoc.lat, 2));
//         if (dist > 0.000001) {
//             if (animationRefs.current[agentId]) cancelAnimationFrame(animationRefs.current[agentId]);
//             const startTime = performance.now();
//             const duration = 5000; // 5s Smooth Glide
            
//             const animate = (time) => {
//                 const progress = Math.min((time - startTime) / duration, 1);
//                 const currentLng = startLoc.lng + (targetLoc.lng - startLoc.lng) * progress;
//                 const currentLat = startLoc.lat + (targetLoc.lat - startLoc.lat) * progress;
//                 marker.setLngLat([currentLng, currentLat]);
//                 if (progress < 1) animationRefs.current[agentId] = requestAnimationFrame(animate);
//             };
//             animationRefs.current[agentId] = requestAnimationFrame(animate);
//         }

//         // Repair Visuals (Self-Healing)
//         const el = marker.getElement();
//         if (!el.innerHTML.includes('pulse-ring')) {
//              el.className = 'marker-agent pulse-container';
//              el.innerHTML = markerHTML;
//         }

//       } else {
//         // --- CREATE NEW ---
//         const el = document.createElement('div');
//         el.className = 'marker-agent pulse-container';
//         el.innerHTML = markerHTML;
//         el.setAttribute('draggable', 'false');
//         Object.assign(el.style, {
//             width: '20px', height: '20px', cursor: 'default', 
//             userSelect: 'none', touchAction: 'none', position: 'relative', overflow: 'visible' 
//         });

//         const marker = new maplibregl.Marker({ 
//             element: el, 
//             anchor: 'center',          // Fixes Drifting
//             pitchAlignment: 'viewport', // Fixes Disappearing
//             rotationAlignment: 'auto',
//             draggable: false
//         })
//           .setLngLat([targetLoc.lng, targetLoc.lat])
//           .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${agent.name}</b>`))
//           .addTo(map);
        
//         agentMarkersRef.current[agentId] = marker;
//       }
//     });

//     // --- CLEANUP ---
//     Object.keys(agentMarkersRef.current).forEach(id => {
//         if (!processedIds.has(id)) {
//             if (animationRefs.current[id]) cancelAnimationFrame(animationRefs.current[id]);
//             agentMarkersRef.current[id].remove();
//             delete agentMarkersRef.current[id];
//         }
//     });
//   };

//   const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
//       if (!map) return;
//       Object.values(markersRef.current).forEach(m => m.remove());
//       markersRef.current = {};

//       ordersToPlot.forEach((order, index) => {
//           const status = order.orderStatus || 'PREPARED'; 
//           if (status === 'DELIVERED' && !showDelivered) return;
//           if (status === 'DELIVERING' && !showDelivering) return;
          
//           const loc = parseLocation(order.location);
//           if (loc) {
//               const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
//               const assignedAgent = agents.find(a => (a.id || a.sk) === assignedAgentId);
//               const markerColor = getAgentColor(assignedAgentId);
//               const el = document.createElement('div');
//               let iconContent = index + 1;
//               if (status === 'DELIVERED') iconContent = '✓';
//               else if (status === 'DELIVERING') iconContent = '🚚';

//               el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${iconContent}</span>`;
//               el.style.backgroundColor = markerColor;
//               el.style.width = '24px'; el.style.height = '24px';
//               el.style.borderRadius = '50%';
//               el.style.display = 'flex'; el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//               el.style.border = '2px solid white';
//               el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
//               el.style.cursor = 'pointer';
//               el.style.zIndex = '10';

//               const marker = new maplibregl.Marker({ element: el })
//                   .setLngLat([loc.longitude, loc.latitude])
//                   .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML('Order ' + (index+1)))
//                   .addTo(map);
//               markersRef.current[order.sk] = marker;
//           }
//       });
//   };

//   const handleOrderClick = (orderSk) => {
//     const marker = markersRef.current[orderSk];
//     if (marker) {
//       marker.togglePopup(); 
//       mapInstance.current.flyTo({ center: marker.getLngLat(), zoom: 14 });
//     }
//   };

//   const runOptimization = async () => {
//     setLoading(true);
//     setErrorMessage(null); 
//     try {
//       const validAgents = agents.filter(a => parseLocation(a.location)).map(a => ({
//          id: a.id || a.sk, 
//          name: a.name,
//          location: parseLocation(a.location),
//          maxCapacity: 10,
//          currentLoad: 0
//       }));

//       if (validAgents.length === 0) throw new Error("No active agents with locations found.");

//       const response = await client.queries.optimizeDelivery({
//         orders: JSON.stringify(orders),
//         agents: JSON.stringify(validAgents), 
//         restaurantLocation: JSON.stringify(restaurantLocation)
//       });

//       let raw = response.data;
//       if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) {} }
      
//       let proposal = raw.proposal;
//       if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

//       const newAssignments = {};
//       if (Array.isArray(proposal)) {
//           proposal.forEach(p => {
//               if (p.assignedOrders) {
//                  p.assignedOrders.forEach(orderSk => {
//                      newAssignments[orderSk] = p.agentId;
//                  });
//               }
//           });
//       }
//       setAssignments(newAssignments);

//     } catch (err) {
//       console.error("Optimization failed:", err);
//       setErrorMessage(err.message || "Optimization Failed");
//     } finally { setLoading(false); }
//   };

//   const handleDispatch = async () => {
//     if (Object.keys(assignments).length === 0) return;
//     setSaving(true);
//     try {
//       const updatesByAgent = {};
//       Object.entries(assignments).forEach(([orderSk, agentId]) => {
//           const order = orders.find(o => o.sk === orderSk);
//           if (order && order.orderStatus === 'PREPARED') {
//               if (!updatesByAgent[agentId]) updatesByAgent[agentId] = [];
//               updatesByAgent[agentId].push(orderSk);
//           }
//       });

//       const updatePromises = Object.entries(updatesByAgent).map(async ([agentId, skList]) => {
//           for (const sk of skList) {
//              const order = orders.find(o => o.sk === sk);
//              await client.models.BusinessData.update({
//                 pk: order.pk,
//                 sk: sk,
//                 gsi1pk: agentId,           
//                 deliveryAgentId: agentId,  
//                 orderStatus: 'DELIVERING'
//              });
//           }
//       });
//       await Promise.all(updatePromises);
//       if (onAssignmentSaved) onAssignmentSaved();
//     } catch (error) {
//       console.error("Dispatch Error", error);
//     } finally { setSaving(false); }
//   };

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
//       <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
//         <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
//         <button onClick={onClose} className="absolute top-4 right-4 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-gray-100 z-10">✕</button>
//       </div>
//       {/* ... (Keep your existing sidebars) ... */}
//     </div>
//   );
// };

// export default DeliveryOptimizer;



// import React, { useEffect, useRef, useState } from 'react';
// import { createMap } from 'maplibre-gl-js-amplify';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
// import outputs from '../../amplify_outputs.json';
// import { client } from '../DataHook/amplifyClient'; 
// import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";
// import { fetchAuthSession } from 'aws-amplify/auth';

// // --- 📏 NEW HELPER: Calculate Distance (km) ---
// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     if (!lat1 || !lon1 || !lat2 || !lon2) return null;
//     const R = 6371; // Earth Radius in km
//     const dLat = (lat2 - lat1) * Math.PI / 180;
//     const dLon = (lon2 - lon1) * Math.PI / 180;
//     const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
//               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return (R * c).toFixed(1);
// };

// const DeliveryOptimizer = ({
//   orders,
//   agents,
//   AGENT_COLORS,
//   restaurantLocation,
//   onClose,
//   onAssignmentSaved
// }) => {
//   const mapContainerRef = useRef(null);
//   const mapInstance = useRef(null);
  
//   // Refs
//   const markersRef = useRef({});          
//   const agentMarkersRef = useRef({});     
//   const restaurantMarkerRef = useRef(null);
//   const animationRefs = useRef({});

//   // State
//   const [livePositions, setLivePositions] = useState({});
//   const [showDelivered, setShowDelivered] = useState(false);
//   const [showDelivering, setShowDelivering] = useState(false);
//   const [assignments, setAssignments] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [errorMessage, setErrorMessage] = useState(null);

//   const isDispatchMode = !showDelivered && !showDelivering;
//   const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');

//   // 0. INJECT CSS STYLES
//   useEffect(() => {
//     if (!document.getElementById('pulse-style')) {
//         const style = document.createElement('style');
//         style.id = 'pulse-style';
//         style.innerHTML = `
//             @keyframes pulse-ring {
//                 0% { transform: scale(0.5); opacity: 0.8; }
//                 80% { transform: scale(2.5); opacity: 0; }
//                 100% { transform: scale(2.5); opacity: 0; }
//             }
//             .pulse-container { position: relative; display: flex; justify-content: center; align-items: center; }
//             .pulse-ring {
//                 position: absolute; width: 20px; height: 20px; border-radius: 50%;
//                 background-color: rgba(34, 197, 94, 0.6); z-index: -1;
//                 animation: pulse-ring 2s infinite cubic-bezier(0.455, 0.03, 0.515, 0.955);
//             }
//         `;
//         document.head.appendChild(style);
//     }
//   }, []);

//   // --- Helpers ---
//   const getCleanPhone = (id) => String(id || "").replace(/[^0-9]/g, '');
  
//   const getAgentColor = (agentId) => {
//     if (!agentId) return '#64748b'; 
//     const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
//     return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
//   };

//   const parseLocation = (loc) => {
//     if (!loc) return null;
//     try {
//       const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc;
//       const lat = parseFloat(parsed.latitude?.N || parsed.latitude || 0);
//       const lng = parseFloat(parsed.longitude?.N || parsed.longitude || 0);
//       if (lat === 0 && lng === 0) return null;
//       return { latitude: lat, longitude: lng };
//     } catch { return null; }
//   };

//   // --- Map Init ---
//   useEffect(() => {
//     async function initializeMap() {
//       if (mapInstance.current) return;
//       try {
//         const map = await createMap({
//           container: mapContainerRef.current,
//           center: [restaurantLocation?.longitude || 50.5, restaurantLocation?.latitude || 26.2],
//           zoom: 12,
//           attributionControl: false 
//         });
//         mapInstance.current = map;
//         map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
        
//         plotOrdersOnMap(orders, map, assignments);
//       } catch (error) { console.error("Error creating map:", error); }
//     }
//     initializeMap();
//   }, []);

//   // 1. ROBUST POLLING ENGINE
//   useEffect(() => {
//       let isMounted = true;
//       const fetchLivePositions = async () => {
//           try {
//               const session = await fetchAuthSession();
//               const client = new LocationClient({
//                   region: outputs.geo.aws_region,
//                   credentials: session.credentials
//               });
//               const response = await client.send(new ListDevicePositionsCommand({
//                   TrackerName: outputs.custom.amazon_location_service.trackers.default
//               }));

//               if (isMounted && response.Entries) {
//                   const newPositions = {};
//                   const now = new Date();
                  
//                   response.Entries.forEach(entry => {
//                       if (entry.Position && entry.DeviceId) {
//                           const posTime = new Date(entry.SampleTime);
//                           const ageMinutes = (now - posTime) / 1000 / 60;
                          
//                           if (ageMinutes < 15) { 
//                               const cleanId = getCleanPhone(entry.DeviceId);
//                               newPositions[cleanId] = {
//                                   latitude: entry.Position[1],
//                                   longitude: entry.Position[0]
//                               };
//                           }
//                       }
//                   });
//                   setLivePositions(newPositions);
//               }
//           } catch (e) { console.warn("Poll error:", e); }
//       };
//       fetchLivePositions();
//       const interval = setInterval(fetchLivePositions, 5000); 
//       return () => { isMounted = false; clearInterval(interval); };
//   }, []);

//   // Trigger Plot on Update
//   useEffect(() => {
//     if (mapInstance.current) plotAgentsOnMap();
//   }, [livePositions, agents]); 

//   // Trigger Order Plot on Update
//   useEffect(() => {
//     if (mapInstance.current) plotOrdersOnMap(orders, mapInstance.current, assignments);
//   }, [assignments, orders, showDelivered, showDelivering]);

//   // 2. SMOOTH AGENT PLOTTING
//   const plotAgentsOnMap = () => {
//     const map = mapInstance.current;
//     if (!map) return;
//     const processedIds = new Set();

//     agents.forEach(agent => {
//       const agentId = agent.id || agent.sk || agent.pk || agent.phone;
//       if (!agentId) return;
//       const cleanId = getCleanPhone(agentId);
//       processedIds.add(agentId); 

//       const liveLoc = livePositions[cleanId];
//       let targetLoc = liveLoc ? { lng: liveLoc.longitude, lat: liveLoc.latitude } : null;
      
//       if (!targetLoc) {
//           const parsed = parseLocation(agent.location);
//           if (parsed) targetLoc = { lng: parsed.longitude, lat: parsed.latitude };
//       }

//       if (!targetLoc) return; 

//       const color = getAgentColor(agentId);
//       const markerHTML = `
//             <div class="pulse-ring"></div>
//             <div style="
//                 display: flex; justify-content: center; align-items: center;
//                 width: 20px; height: 20px; background-color: white; border-radius: 50%; 
//                 border: 2px solid ${color}; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
//                 font-size: 14px; z-index: 2; position: relative;
//             ">🛵</div>
//       `;

//       if (agentMarkersRef.current[agentId]) {
//         const marker = agentMarkersRef.current[agentId];
//         const startLoc = marker.getLngLat();
//         const dist = Math.sqrt(Math.pow(targetLoc.lng - startLoc.lng, 2) + Math.pow(targetLoc.lat - startLoc.lat, 2));
        
//         if (dist > 0.000001) {
//             if (animationRefs.current[agentId]) cancelAnimationFrame(animationRefs.current[agentId]);
//             const startTime = performance.now();
//             const duration = 5000; 
            
//             const animate = (time) => {
//                 const progress = Math.min((time - startTime) / duration, 1);
//                 const currentLng = startLoc.lng + (targetLoc.lng - startLoc.lng) * progress;
//                 const currentLat = startLoc.lat + (targetLoc.lat - startLoc.lat) * progress;
//                 marker.setLngLat([currentLng, currentLat]);
//                 if (progress < 1) animationRefs.current[agentId] = requestAnimationFrame(animate);
//             };
//             animationRefs.current[agentId] = requestAnimationFrame(animate);
//         }

//         const el = marker.getElement();
//         if (!el.innerHTML.includes('pulse-ring')) {
//              el.className = 'marker-agent pulse-container';
//              el.innerHTML = markerHTML;
//         }

//       } else {
//         const el = document.createElement('div');
//         el.className = 'marker-agent pulse-container';
//         el.innerHTML = markerHTML;
//         el.setAttribute('draggable', 'false');
//         Object.assign(el.style, {
//             width: '20px', height: '20px', cursor: 'default', 
//             userSelect: 'none', touchAction: 'none', position: 'relative', overflow: 'visible' 
//         });

//         const marker = new maplibregl.Marker({ 
//             element: el, 
//             anchor: 'center',          
//             pitchAlignment: 'viewport',
//             rotationAlignment: 'auto',
//             draggable: false
//         })
//           .setLngLat([targetLoc.lng, targetLoc.lat])
//           .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${agent.name}</b>`))
//           .addTo(map);
        
//         agentMarkersRef.current[agentId] = marker;
//       }
//     });

//     Object.keys(agentMarkersRef.current).forEach(id => {
//         if (!processedIds.has(id)) {
//             if (animationRefs.current[id]) cancelAnimationFrame(animationRefs.current[id]);
//             agentMarkersRef.current[id].remove();
//             delete agentMarkersRef.current[id];
//         }
//     });
//   };

//   // 3. ORDER PLOTTING
//   const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
//       if (!map) return;
//       Object.values(markersRef.current).forEach(m => m.remove());
//       markersRef.current = {};

//       ordersToPlot.forEach((order, index) => {
//           const status = order.orderStatus || 'PREPARED'; 
//           if (status === 'DELIVERED' && !showDelivered) return;
//           if (status === 'DELIVERING' && !showDelivering) return;
          
//           const loc = parseLocation(order.location);
//           if (loc) {
//               const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
//               const assignedAgent = agents.find(a => (a.id || a.sk) === assignedAgentId);
//               const markerColor = getAgentColor(assignedAgentId);
//               const el = document.createElement('div');
//               let iconContent = index + 1;
//               if (status === 'DELIVERED') iconContent = '✓';
//               else if (status === 'DELIVERING') iconContent = '🚚';

//               el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${iconContent}</span>`;
//               el.style.backgroundColor = markerColor;
//               el.style.width = '24px'; el.style.height = '24px';
//               el.style.borderRadius = '50%';
//               el.style.display = 'flex'; el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//               el.style.border = '2px solid white';
//               el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
//               el.style.cursor = 'pointer';
//               el.style.zIndex = '10';

//               const marker = new maplibregl.Marker({ element: el })
//                   .setLngLat([loc.longitude, loc.latitude])
//                   .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML('Order ' + (index+1)))
//                   .addTo(map);
//               markersRef.current[order.sk] = marker;
//           }
//       });
//   };

//   // 4. BUSINESS LOGIC
//   const handleOrderClick = (orderSk) => {
//     const marker = markersRef.current[orderSk];
//     if (marker) {
//       marker.togglePopup(); 
//       mapInstance.current.flyTo({ center: marker.getLngLat(), zoom: 14 });
//     }
//   };

//   const runOptimization = async () => {
//     setLoading(true);
//     setErrorMessage(null); 
//     try {
//       const validAgents = agents.filter(a => parseLocation(a.location)).map(a => ({
//          id: a.id || a.sk, 
//          name: a.name,
//          location: parseLocation(a.location),
//          maxCapacity: 10,
//          currentLoad: 0
//       }));

//       if (validAgents.length === 0) throw new Error("No active agents with locations found.");

//       const response = await client.queries.optimizeDelivery({
//         orders: JSON.stringify(orders),
//         agents: JSON.stringify(validAgents), 
//         restaurantLocation: JSON.stringify(restaurantLocation)
//       });

//       let raw = response.data;
//       if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) {} }
//       let proposal = raw.proposal;
//       if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

//       const newAssignments = {};
//       if (Array.isArray(proposal)) {
//           proposal.forEach(p => {
//               if (p.assignedOrders) {
//                  p.assignedOrders.forEach(orderSk => {
//                      newAssignments[orderSk] = p.agentId;
//                  });
//               }
//           });
//       }
//       setAssignments(newAssignments);
//     } catch (err) {
//       console.error("Optimization failed:", err);
//       setErrorMessage(err.message || "Optimization Failed");
//     } finally { setLoading(false); }
//   };

//   // const handleDispatch = async () => {
//   //   if (Object.keys(assignments).length === 0) return;
//   //   setSaving(true);
//   //   try {
//   //     const updatesByAgent = {};
//   //     Object.entries(assignments).forEach(([orderSk, agentId]) => {
//   //         const order = orders.find(o => o.sk === orderSk);
//   //         if (order && order.orderStatus === 'PREPARED') {
//   //             if (!updatesByAgent[agentId]) updatesByAgent[agentId] = [];
//   //             updatesByAgent[agentId].push(orderSk);
//   //         }
//   //     });

//   //     const updatePromises = Object.entries(updatesByAgent).map(async ([agentId, skList]) => {
//   //         for (const sk of skList) {
//   //            const order = orders.find(o => o.sk === sk);
//   //            await client.models.BusinessData.update({
//   //               pk: order.pk,
//   //               sk: sk,
//   //               gsi1pk: agentId,           
//   //               deliveryAgentId: agentId,  
//   //               orderStatus: 'DELIVERING'
//   //            });
//   //         }
//   //     });
//   //     await Promise.all(updatePromises);
//   //     if (onAssignmentSaved) onAssignmentSaved();
//   //   } catch (error) {
//   //     console.error("Dispatch Error", error);
//   //   } finally { setSaving(false); }
//   // };
  

//   // ---------------------------------------------------------
//   // 5. RENDER UI
//   // ---------------------------------------------------------
  
//   // 🚀 5. SMART DISPATCH (Calculates Distance/Time on Confirm)
//   const handleDispatch = async () => {
//     if (Object.keys(assignments).length === 0) return;
//     setSaving(true); // Locks UI
    
//     try {
//       // Init AWS Client once
//       const session = await fetchAuthSession();
//       const locationClient = new LocationClient({
//           region: outputs.geo.aws_region,
//           credentials: session.credentials
//       });

//       // Process assignments in parallel
//       const updateTasks = Object.entries(assignments).map(async ([orderSk, agentId]) => {
//           const order = orders.find(o => o.sk === orderSk);
//           if (!order || order.orderStatus !== 'PREPARED') return;

//           let dist = null;
//           let dur = null;

//           // A. Calculate Route (Restaurant -> Customer)
//           const custLoc = parseLocation(order.location);
//           if (restaurantLocation && custLoc) {
//              try {
//                  // 👇 1. THIS CALCULATES THE ROUTE (Cost Incurred Here)
//                  const res = await locationClient.send(new CalculateRouteCommand({
//                      CalculatorName: outputs.custom.amazon_location_service.route_calculators.default,
//                      DeparturePosition: [restaurantLocation.longitude, restaurantLocation.latitude],
//                      DestinationPosition: [custLoc.longitude, custLoc.latitude],
//                      TravelMode: "Car"
//                  }));
                 
//                  // Save the results locally
//                  dist = parseFloat(res.Summary.Distance.toFixed(2)); // km
//                  dur = Math.round(res.Summary.DurationSeconds);      // seconds
//              } catch (e) { 
//                  console.warn("Route calc skipped for", orderSk); 
//              }
//           }

//           // 👇 2. THIS UPDATES DYNAMODB (Saves Agent + Distance + Duration)
//           await client.models.BusinessData.update({
//               pk: order.pk,
//               sk: orderSk,
//               gsi1pk: agentId,            // Assign Agent
//               deliveryAgentId: agentId,   // Assign Agent
//               orderStatus: 'DELIVERING',  // Update Status
//               deliveryDistance: dist,     // ✅ SAVES CALCULATED DISTANCE
//               deliveryDuration: dur       // ✅ SAVES CALCULATED DURATION
//           });
//       });

//       await Promise.all(updateTasks);
//       if (onAssignmentSaved) onAssignmentSaved();

//     } catch (error) {
//       console.error("Dispatch Error", error);
//     } finally { setSaving(false); }
//   };
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
//       <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
//         <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
//         <div className="absolute bottom-6 left-4 bg-white/95 p-3 rounded-lg shadow-xl text-sm pointer-events-auto backdrop-blur-sm border border-gray-200" onClick={(e) => e.stopPropagation()}>
//            <label className="flex items-center mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition">
//              <input type="checkbox" checked={showDelivering} onChange={(e) => setShowDelivering(e.target.checked)} className="mr-2 cursor-pointer accent-orange-500 h-4 w-4" />
//              <span className="mr-2">🚚</span><span className="text-gray-700">DELIVERING</span>
//            </label>
//            <label className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition">
//              <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} className="mr-2 cursor-pointer accent-green-600 h-4 w-4" />
//              <span className="mr-2">✅</span><span className="text-gray-700">DELIVERED</span>
//            </label>
//         </div>
        
//         {!isDispatchMode && (
//           <button onClick={onClose} className="absolute top-4 right-4 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-gray-100 z-10">✕</button>
//         )}
//       </div>

//       {isDispatchMode && (
//         <div className="h-full bg-slate-900 text-white shadow-2xl flex flex-col order-2 transition-all duration-300 w-[80px] md:w-64">
//           <div className="p-4 flex flex-col items-center md:items-stretch border-b border-slate-800">
//             <div className="flex justify-between items-center w-full mb-4">
//               <h2 className="hidden md:block text-xl font-bold text-yellow-400">Dispatch</h2>
//               <button onClick={onClose} className="text-3xl text-slate-400 hover:text-white mx-auto md:mx-0">×</button>
//             </div>
//             {hasPreparedOrders ? (
//               <div className="flex gap-2 w-full flex-col">
//                 <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm">{loading ? "..." : "⚡️ Auto-Assign"}</button>
//                 <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center disabled:opacity-50 text-sm">{saving ? "..." : "📦 Confirm"}</button>
//               </div>
//             ) : <div className="text-center py-2 text-slate-400 text-sm">No new orders.</div>}
//           </div>
//           <div className="flex-1 overflow-y-auto p-2 space-y-2">
//               {orders.map((o, i) => {
//                   if (o.orderStatus === 'DELIVERED' || o.orderStatus === 'DELIVERING') return null;
//                   const agentId = assignments[o.sk];
//                   const color = getAgentColor(agentId);
                  
//                   // ✅ CALCULATE DISTANCE (Restaurant -> Customer)
//                   const custLoc = parseLocation(o.location);
//                   const distKm = (restaurantLocation && custLoc) 
//                       ? calculateDistance(restaurantLocation.latitude, restaurantLocation.longitude, custLoc.latitude, custLoc.longitude) 
//                       : null;

//                   return (
//                   <div key={o.sk || i} onClick={() => handleOrderClick(o.sk)} className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 flex items-center p-2" style={{ borderLeft: `3px solid ${color}` }}>
//                       <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color }}>{i+1}</span>
//                       <div className="hidden md:block flex-1 ml-2 min-w-0">
//                         <div className="flex justify-between items-start">
//                            <p className="font-bold text-xs truncate mb-1 text-slate-200">{o.customer || 'Unknown'}</p>
//                            {/* ✅ DISPLAY DISTANCE */}
//                            {distKm && <span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/30 px-1 rounded">{distKm} km</span>}
//                         </div>
//                         <select value={assignments[o.sk] || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1">
//                           <option value="" disabled>Select Agent</option>
//                           {agents.map((agent, aIndex) => (
//                               <option key={agent.id || aIndex} value={agent.id || agent.sk}>{agent.name}</option> 
//                           ))}
//                         </select>
//                       </div>
//                   </div>
//                   );
//               })}
//           </div>
//         </div>
//       )}
      
//       {/* --- 🛡️ FLEET STATUS PANEL --- */}
//       {/* <div className="absolute top-4 left-4 bg-slate-900/90 text-white p-4 rounded-lg shadow-2xl border border-slate-700 w-64 z-[9999]">
//         <h3 className="font-bold text-yellow-400 mb-2 border-b border-slate-600 pb-1">📡 Live Fleet Status</h3>
//         <div className="space-y-2 max-h-60 overflow-y-auto">
//             {agents.map((agent, i) => {
//                 const agentId = agent.id || agent.sk;
//                 const cleanId = getCleanPhone(agentId);
//                 const isLive = !!livePositions[cleanId];
                
//                 const loc = isLive ? livePositions[cleanId] : parseLocation(agent.location);
                
//                 return (
//                     <div key={agentId || i} className="flex flex-col bg-slate-800 p-2 rounded text-xs">
//                         <div className="flex justify-between items-center mb-1">
//                             <span className="font-bold">{agent.name}</span>
//                             {isLive ? (
//                                 <span className="text-green-400 font-mono animate-pulse">● LIVE</span>
//                             ) : (
//                                 <span className="text-slate-500">○ OFFLINE</span>
//                             )}
//                         </div>
//                         <div className="text-slate-400 font-mono text-[10px] mb-2">ID: {cleanId || "MISSING"}</div>
//                         {loc ? (
//                              <button 
//                                 onClick={() => {
//                                     if (mapInstance.current) {
//                                         mapInstance.current.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15, speed: 2 });
//                                     }
//                                 }}
//                                 className="bg-blue-600 hover:bg-blue-500 text-white py-1 px-2 rounded text-center font-bold transition"
//                             >
//                                 🎯 LOCATE {isLive ? '(ACTUAL)' : '(STORED)'}
//                             </button>
//                         ) : (
//                             <div className="text-red-400 italic">No Location Data</div>
//                         )}
//                     </div>
//                 );
//             })}
//         </div>
//       </div> */}
//     </div>
//   );
// };

// export default DeliveryOptimizer;




import React, { useEffect, useRef, useState } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import outputs from '../../amplify_outputs.json';
import { client } from '../DataHook/amplifyClient'; 
// ✅ ADD CalculateRouteCommand
import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes"; 
import { fetchAuthSession } from 'aws-amplify/auth';
import { LocationClient, ListDevicePositionsCommand, CalculateRouteCommand } from "@aws-sdk/client-location";
// import { fetchAuthSession } from 'aws-amplify/auth';
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function estimateDurationSeconds(distanceKm) {
    if (!distanceKm) return 0;
    // Assumption: Average city speed ~20km/h = 3 mins per km
    // + 5 minutes (300s) fixed time for parking/handover
    return Math.round((distanceKm * 180) + 300);
}

const DeliveryOptimizer = ({
  orders,
  agents,
  AGENT_COLORS,
  restaurantLocation,
  onClose,
  onAssignmentSaved
}) => {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  
  // Refs
  const markersRef = useRef({});          
  const agentMarkersRef = useRef({});     
  const restaurantMarkerRef = useRef(null);
  const animationRefs = useRef({});

  // State
  const [livePositions, setLivePositions] = useState({});
  const [showDelivered, setShowDelivered] = useState(false);
  const [showDelivering, setShowDelivering] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); // Used for "Confirm" button loading state
  const [optimizationMetrics, setOptimizationMetrics] = useState({});
    const [errorMessage, setErrorMessage] = useState(null);


  const isDispatchMode = !showDelivered && !showDelivering;
  const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');

  // --- Helpers ---
  const getCleanPhone = (id) => String(id || "").replace(/[^0-9]/g, '');
  
  const getAgentColor = (agentId) => {
    if (!agentId) return '#64748b'; 
    const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
    return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
  };

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

  // 0. INJECT CSS STYLES (Pulse Animation)
  useEffect(() => {
    if (!document.getElementById('pulse-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-style';
        style.innerHTML = `
            @keyframes pulse-ring {
                0% { transform: scale(0.5); opacity: 0.8; }
                80% { transform: scale(2.5); opacity: 0; }
                100% { transform: scale(2.5); opacity: 0; }
            }
            .pulse-container { position: relative; display: flex; justify-content: center; align-items: center; }
            .pulse-ring {
                position: absolute; width: 20px; height: 20px; border-radius: 50%;
                background-color: rgba(34, 197, 94, 0.6); z-index: -1;
                animation: pulse-ring 2s infinite cubic-bezier(0.455, 0.03, 0.515, 0.955);
            }
        `;
        document.head.appendChild(style);
    }
  }, []);

  // --- Map Init ---
  useEffect(() => {
    async function initializeMap() {
      if (mapInstance.current) return;
      try {
        const map = await createMap({
          container: mapContainerRef.current,
          center: [restaurantLocation?.longitude || 50.5, restaurantLocation?.latitude || 26.2],
          zoom: 12,
          attributionControl: false 
        });
        mapInstance.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
        plotOrdersOnMap(orders, map, assignments);
      } catch (error) { console.error("Error creating map:", error); }
    }
    initializeMap();
  }, []);

  // 1. POLL AWS TRACKER (15m buffer)
  useEffect(() => {
      let isMounted = true;
      const fetchLivePositions = async () => {
          try {
              const session = await fetchAuthSession();
              const client = new LocationClient({
                  region: outputs.geo.aws_region,
                  credentials: session.credentials
              });
              const response = await client.send(new ListDevicePositionsCommand({
                  TrackerName: outputs.custom.amazon_location_service.trackers.default
              }));

              if (isMounted && response.Entries) {
                  const newPositions = {};
                  const now = new Date();
                  response.Entries.forEach(entry => {
                      if (entry.Position && entry.DeviceId) {
                          const posTime = new Date(entry.SampleTime);
                          const ageMinutes = (now - posTime) / 1000 / 60;
                          if (ageMinutes < 15) { 
                              const cleanId = getCleanPhone(entry.DeviceId);
                              newPositions[cleanId] = {
                                  latitude: entry.Position[1],
                                  longitude: entry.Position[0]
                              };
                          }
                      }
                  });
                  setLivePositions(newPositions);
              }
          } catch (e) { console.warn("Poll error:", e); }
      };
      fetchLivePositions();
      const interval = setInterval(fetchLivePositions, 5000); 
      return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // Map Update Triggers
  useEffect(() => { if (mapInstance.current) plotAgentsOnMap(); }, [livePositions, agents]); 
  useEffect(() => { if (mapInstance.current) plotOrdersOnMap(orders, mapInstance.current, assignments); }, [assignments, orders, showDelivered, showDelivering]);

  // 2. AGENT PLOTTING (Smooth)
  const plotAgentsOnMap = () => {
    const map = mapInstance.current;
    if (!map) return;
    const processedIds = new Set();

    agents.forEach(agent => {
      const agentId = agent.id || agent.sk || agent.pk || agent.phone;
      if (!agentId) return;
      const cleanId = getCleanPhone(agentId);
      processedIds.add(agentId); 

      const liveLoc = livePositions[cleanId];
      let targetLoc = liveLoc ? { lng: liveLoc.longitude, lat: liveLoc.latitude } : null;
      if (!targetLoc) {
          const parsed = parseLocation(agent.location);
          if (parsed) targetLoc = { lng: parsed.longitude, lat: parsed.latitude };
      }
      if (!targetLoc) return; 

      const color = getAgentColor(agentId);
      const markerHTML = `<div class="pulse-ring"></div><div style="display: flex; justify-content: center; align-items: center; width: 20px; height: 20px; background-color: white; border-radius: 50%; border: 2px solid ${color}; box-shadow: 0 2px 5px rgba(0,0,0,0.5); font-size: 14px; z-index: 2; position: relative;">🛵</div>`;

      if (agentMarkersRef.current[agentId]) {
        const marker = agentMarkersRef.current[agentId];
        const startLoc = marker.getLngLat();
        const dist = Math.sqrt(Math.pow(targetLoc.lng - startLoc.lng, 2) + Math.pow(targetLoc.lat - startLoc.lat, 2));
        
        if (dist > 0.000001) {
            if (animationRefs.current[agentId]) cancelAnimationFrame(animationRefs.current[agentId]);
            const startTime = performance.now();
            const duration = 5000; 
            const animate = (time) => {
                const progress = Math.min((time - startTime) / duration, 1);
                const currentLng = startLoc.lng + (targetLoc.lng - startLoc.lng) * progress;
                const currentLat = startLoc.lat + (targetLoc.lat - startLoc.lat) * progress;
                marker.setLngLat([currentLng, currentLat]);
                if (progress < 1) animationRefs.current[agentId] = requestAnimationFrame(animate);
            };
            animationRefs.current[agentId] = requestAnimationFrame(animate);
        }
        const el = marker.getElement();
        if (!el.innerHTML.includes('pulse-ring')) { el.className = 'marker-agent pulse-container'; el.innerHTML = markerHTML; }
      } else {
        const el = document.createElement('div');
        el.className = 'marker-agent pulse-container';
        el.innerHTML = markerHTML;
        el.setAttribute('draggable', 'false');
        Object.assign(el.style, { width: '20px', height: '20px', cursor: 'default', userSelect: 'none', touchAction: 'none', position: 'relative', overflow: 'visible' });
        const marker = new maplibregl.Marker({ element: el, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'auto', draggable: false })
          .setLngLat([targetLoc.lng, targetLoc.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${agent.name}</b>`))
          .addTo(map);
        agentMarkersRef.current[agentId] = marker;
      }
    });

    Object.keys(agentMarkersRef.current).forEach(id => {
        if (!processedIds.has(id)) {
            if (animationRefs.current[id]) cancelAnimationFrame(animationRefs.current[id]);
            agentMarkersRef.current[id].remove();
            delete agentMarkersRef.current[id];
        }
    });
  };

  // 3. ORDER PLOTTING
  const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
      if (!map) return;
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      ordersToPlot.forEach((order, index) => {
          const status = order.orderStatus || 'PREPARED'; 
          if (status === 'DELIVERED' && !showDelivered) return;
          if (status === 'DELIVERING' && !showDelivering) return;
          
          const loc = parseLocation(order.location);
          if (loc) {
              const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
              const assignedAgent = agents.find(a => (a.id || a.sk) === assignedAgentId);
              const markerColor = getAgentColor(assignedAgentId);
              const el = document.createElement('div');
              let iconContent = index + 1;
              if (status === 'DELIVERED') iconContent = '✓';
              else if (status === 'DELIVERING') iconContent = '🚚';

              el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${iconContent}</span>`;
              el.style.backgroundColor = markerColor;
              el.style.width = '24px'; el.style.height = '24px';
              el.style.borderRadius = '50%';
              el.style.display = 'flex'; el.style.justifyContent = 'center'; el.style.alignItems = 'center';
              el.style.border = '2px solid white';
              el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
              el.style.cursor = 'pointer';
              el.style.zIndex = '10';

              const marker = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.longitude, loc.latitude])
                  .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML('Order ' + (index+1)))
                  .addTo(map);
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

  // 4. AUTO-ASSIGN LOGIC
const runOptimization = async () => {
    setLoading(true);
    try {
      // 1. Prepare Inputs
      const validAgents = agents.filter(a => parseLocation(a.location)).map(a => ({
         id: a.id || a.sk, 
         name: a.name,
         location: parseLocation(a.location),
         maxCapacity: 10,
         currentLoad: 0
      }));

      // 2. Call Cloud Function
      const response = await client.queries.optimizeDelivery({
        orders: JSON.stringify(orders),
        agents: JSON.stringify(validAgents), 
        restaurantLocation: JSON.stringify(restaurantLocation)
      });

      // 3. Parse Response
      let raw = response.data;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) {} }
      
      let proposal = raw.proposal;
      if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

      // ---------------------------------------------------------
      // 🎯 KEY STEP: BUILD THE METRICS MAP
      // ---------------------------------------------------------
      let metrics = raw.routeMetrics;
      if (typeof metrics === 'string') { try { metrics = JSON.parse(metrics); } catch (e) { metrics = []; } }
      
      const metricsMap = {}; // This is our Lookup Table
      
      if (Array.isArray(metrics)) {
          metrics.forEach(m => {
              // We map the specific Order ID to its specific calculated values
              metricsMap[m.orderId] = {
                  dist: parseFloat(m.distanceKm),
                  dur: parseInt(m.durationSeconds)
              };
          });
      }
      
      console.log("📊 Optimized Metrics Map:", metricsMap); // Check console to verify!
      setOptimizationMetrics(metricsMap); // Save to State

      // 4. Update Assignments
      const newAssignments = {};
      if (Array.isArray(proposal)) {
          proposal.forEach(p => {
              if (p.assignedOrders) {
                 p.assignedOrders.forEach(orderSk => { 
                     newAssignments[orderSk] = p.agentId; 
                 });
              }
          });
      }
      setAssignments(newAssignments);

    } catch (err) {
      console.error("Optimization failed:", err);
    } finally { setLoading(false); }
  };
// ---------------------------------------------------------
  // 🚀 SMART DISPATCH: Calculates Leg B (Rest -> Cust)
  // ---------------------------------------------------------
 const handleDispatch = async () => {
    if (Object.keys(assignments).length === 0) return;
    setSaving(true); 
    
    try {
      const session = await fetchAuthSession();
      
      // ✅ USE GEN 2 CLIENT
      const geoClient = new GeoRoutesClient({
          region: outputs.geo.aws_region, // Ensure this is "us-east-1"
          credentials: session.credentials
      });

      const updateTasks = Object.entries(assignments).map(async ([orderSk, rawAgentId]) => {
          const order = orders.find(o => o.sk === orderSk);
          if (!order || order.orderStatus !== 'PREPARED') return;

          const cleanPhone = String(rawAgentId).replace(/[^0-9]/g, '');
          const formattedAgentId = `AGENT#${cleanPhone}`; 

          let dist = 0;
          let dur = 0;

          // 2. CALCULATE ROUTE (Restaurant -> Customer)
          const custLoc = parseLocation(order.location);
          
          if (restaurantLocation && custLoc) {
             try {
                 console.log(`🤖 Gen2 Calc: Rest -> Cust for ${orderSk}...`);
                 
                 // ✅ GEN 2 COMMAND (No CalculatorName needed!)
                 const res = await geoClient.send(new CalculateRoutesCommand({
                     Origin: [restaurantLocation.longitude, restaurantLocation.latitude],
                     Destination: [custLoc.longitude, custLoc.latitude],
                     TravelMode: "Car",
                     // Optional: Add specific routing preferences here if needed
                 }));
                 
                 // ✅ EXTRACT GEN 2 METRICS
                 // Gen 2 returns an array of routes. We take the first (best) one.
                 if (res.Routes && res.Routes.length > 0) {
                     const summary = res.Routes[0].Summary;
                     
                     // ⚠️ IMPORTANT: Gen 2 returns METERS. Convert to KM.
                     dist = parseFloat((summary.Distance / 1000).toFixed(2)); 
                     dur = Math.round(summary.Duration); // Seconds
                     
                     console.log(`✅ ${orderSk}: ${dist}km (Gen 2)`);
                 }
                 
             } catch (e) { 
                 console.warn(`⚠️ Gen 2 calc failed for ${orderSk}:`, e.message); 
             }
          }

          // 3. Update DB
          await client.models.BusinessData.update({
              pk: order.pk,
              sk: orderSk,
              gsi1pk: formattedAgentId,           
              deliveryAgentId: formattedAgentId,  
              orderStatus: 'DELIVERING',
              deliveryDistance: dist, 
              deliveryDuration: dur   
          });
      });

      await Promise.all(updateTasks);
      if (onAssignmentSaved) onAssignmentSaved();

    } catch (error) {
      console.error("Dispatch Error", error);
    } finally { setSaving(false); }
  };
// ---------------------------------------------------------
  // 🚀 SMART DISPATCH (Corrected: Keeps the "+" sign)
  // ---------------------------------------------------------
//  const handleDispatch = async () => {
//     if (Object.keys(assignments).length === 0) return;
//     setSaving(true);

//     try {
//       const updatesByAgent = {};

//       // 1. Group orders by Agent
//       Object.entries(assignments).forEach(([orderSk, agentId]) => {
//           const order = orders.find(o => o.sk === orderSk);
//           if (order && order.orderStatus === 'PREPARED') {
//               if (!updatesByAgent[agentId]) updatesByAgent[agentId] = [];
//               updatesByAgent[agentId].push(orderSk);
//           }
//       });

//       if (Object.keys(updatesByAgent).length === 0) {
//           console.warn("No valid PREPARED orders to dispatch.");
//           setSaving(false);
//           return;
//       }

//       // 2. Perform Updates
//       const updatePromises = Object.entries(updatesByAgent).map(async ([agentId, skList]) => {
          
//           // A. Update Agent Capacity (Load)
//           try {
//               const agent = agents.find(a => a.id === agentId);
//               if (agent) {
//                  await client.models.BusinessData.update({
//                     pk: agentId, 
//                     sk: agentId, 
//                     currentLoad: (agent.currentLoad || 0) + skList.length // Simplified load calc
//                  });
//               }
//           } catch(e) { console.warn("Capacity update failed", e); }

//           // B. Update Orders (Trigger Subscription)
//           for (const sk of skList) {
//     const order = orders.find(o => o.sk === sk);
//     const orderLoc = parseLocation(order.location);

//     let deliveryDist = 0;
//     let deliveryDur = 0;

//     // 1. Try to get ACCURATE data from the Optimization Cache first
//     // (This comes from your backend optimization which likely used AWS/Here/Google)
//     if (metricsCache[sk] && metricsCache[sk].deliveryDistance) {
//         deliveryDist = metricsCache[sk].deliveryDistance;
//         deliveryDur = metricsCache[sk].deliveryDuration;
//     } 
//     // 2. Fallback to Simple Math if manual override happened (or cache missing)
//     else if (orderLoc && restaurantLocation) {
//         // You still need the helper function defined for this fallback!
//         deliveryDist = getDistanceFromLatLonInKm(
//             restaurantLocation.latitude,
//             restaurantLocation.longitude,
//             orderLoc.latitude,
//             orderLoc.longitude
//         );
//         deliveryDur = estimateDurationSeconds(deliveryDist);
//     }

//     console.log(`📦 Dispatching ${sk} to ${agentId} (Dist: ${deliveryDist}km)`);

//     await client.models.BusinessData.update({
//         pk: order.pk,
//         sk: sk,
//         gsi1pk: `AGENT#${agentId.replace('AGENT#', '')}`,
//         deliveryAgentId: agentId,
//         orderStatus: 'DELIVERING',
//         deliveryDistance: parseFloat(Number(deliveryDist).toFixed(2)), // Ensure number
//         deliveryDuration: parseInt(deliveryDur)
//     });
// }
//       });

//       await Promise.all(updatePromises);
      
//       console.log("✅ All assignments saved successfully.");
//       if (onAssignmentSaved) onAssignmentSaved(); // Refresh parent list
//       onClose(); // Close optimizer

//     } catch (error) {
//       console.error("Dispatch Error", error);
//       setErrorMessage("Failed to save assignments: " + error.message);
//     } finally {
//       setSaving(false);
//     }
//   };
  // ---------------------------------------------------------
  // 6. UI RENDER
  // ---------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
      <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        <button onClick={onClose} className="absolute top-4 right-4 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-gray-100 z-10">✕</button>
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
                <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm">{loading ? "..." : "⚡️ Auto-Assign"}</button>
                {/* DISPATCH BUTTON (Triggers Calculation) */}
                <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center disabled:opacity-50 text-sm">
                    {saving ? "Calculating..." : "📦 Confirm"}
                </button>
              </div>
            ) : <div className="text-center py-2 text-slate-400 text-sm">No new orders.</div>}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {orders.map((o, i) => {
                  if (o.orderStatus === 'DELIVERED' || o.orderStatus === 'DELIVERING') return null;
                  const agentId = assignments[o.sk];
                  const color = getAgentColor(agentId);
                  
                  return (
                  <div key={o.sk || i} onClick={() => handleOrderClick(o.sk)} className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 flex items-center p-2" style={{ borderLeft: `3px solid ${color}` }}>
                      <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color }}>{i+1}</span>
                      <div className="hidden md:block flex-1 ml-2 min-w-0">
                        <p className="font-bold text-xs truncate mb-1">{o.customer || 'Unknown'}</p>
                        <select value={assignments[o.sk] || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1">
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
      
      {/* Fleet Status Panel */}
    </div>
  );
};

export default DeliveryOptimizer;


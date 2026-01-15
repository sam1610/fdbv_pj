// import React, { useEffect, useRef, useState } from 'react';
// import { createMap } from 'maplibre-gl-js-amplify';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
// import { client } from '../DataHook/amplifyClient';
// import outputs from '../../amplify_outputs.json'; 
// import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";
// import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes"; 
// import { fetchAuthSession } from 'aws-amplify/auth';

// // --- CONFIG ---
// const REFRESH_RATE_MS = 10000; 

// // --- HELPERS ---
// function deg2rad(deg) { return deg * (Math.PI / 180); }

// function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
//   if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
//   const R = 6371; 
//   const dLat = deg2rad(lat2 - lat1);
//   const dLon = deg2rad(lon2 - lon1);
//   const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//             Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
//             Math.sin(dLon / 2) * Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c; 
// }

// function estimateDurationSeconds(distanceKm) {
//     if (!distanceKm) return 0;
//     return Math.round((distanceKm * 180) + 300);
// }

// const getCleanPhone = (id) => String(id || "").replace(/[^0-9]/g, '');

// const parseLocation = (loc) => {
//     if (!loc) return null;
//     try {
//       const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc;
//       const lat = parseFloat(parsed.latitude?.N || parsed.latitude || 0);
//       const lng = parseFloat(parsed.longitude?.N || parsed.longitude || 0);
//       if (lat === 0 && lng === 0) return null;
//       return { latitude: lat, longitude: lng };
//     } catch { return null; }
// };

// const DeliveryOptimizer = ({
//   orders,
//   agents,
//   AGENT_COLORS,
//   restaurantLocation,
//   onClose,
//   onAssignmentSaved,
//   phoneNbr
// }) => {
//   const mapInstance = useRef(null);
//   const intervalRef = useRef(null); // Ref to clear interval on unmount
  
//   // Refs for Orders (DOM markers)
//   const markersRef = useRef({});          

//   // State
//   const [showDelivered, setShowDelivered] = useState(true);
//   const [showDelivering, setShowDelivering] = useState(true);
//   const [assignments, setAssignments] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [saving, setSaving] = useState(false); 
//   const [optimizationMetrics, setOptimizationMetrics] = useState({});
//   const [errorMessage, setErrorMessage] = useState(null);

//   const isDispatchMode = !showDelivered && !showDelivering;
//   const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');
//   const mapContainerRef = useRef(null);
//   const latestOrdersRef = useRef(orders);
//   const latestAgentsRef = useRef(agents);



//   useEffect(() => {
//     const styleId = 'popup-z-index-fix';
//     if (!document.getElementById(styleId)) {
//       const style = document.createElement('style');
//       style.id = styleId;
//       style.innerHTML = `
//         .maplibregl-popup {
//           z-index: 2000 !important; /* Forces popup above markers (z-10) and highlights (z-50) */
//         }
//       `;
//       document.head.appendChild(style);
//     }
//   }, []);
//   useEffect(() => {
//       latestOrdersRef.current = orders;
//       latestAgentsRef.current = agents;
//   }, [orders, agents]);

//   const getAgentColor = (agentId) => {
//     if (!agentId) return '#64748b'; 
//     const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
//     return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
//   };

//   // --- 1. MAP INIT & LAYER SETUP ---
// // --- 1. MAP INIT & LAYER SETUP ---
//   useEffect(() => {
//     let isMounted = true;

//     async function initializeMap() {
//       if (mapInstance.current) return;

//       try {
//         const map = await createMap({
//           container: mapContainerRef.current,
//           center: [restaurantLocation?.longitude || 50.5, restaurantLocation?.latitude || 26.2],
//           zoom: 12,
//           attributionControl: false 
//         });
        
//         if (!isMounted) return;
//         mapInstance.current = map;
//         map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

//         // Wait for style load to add layers
//         map.on('load', () => {
//             if (!isMounted) return;

//             // A. Add GeoJSON Source for Agents
//             // This single source feeds both the Glow and the Dot
//             if (!map.getSource('agents-source')) {
//                 map.addSource('agents-source', {
//                     type: 'geojson',
//                     data: { type: 'FeatureCollection', features: [] }
//                 });
//             }

//             // ✅ B. Add GLOW Layer (Background)
//             // This creates the large, fuzzy halo effect behind the agent
//             if (!map.getLayer('agents-glow-layer')) {
//                 map.addLayer({
//                     id: 'agents-glow-layer',
//                     type: 'circle',
//                     source: 'agents-source',
//                     paint: {
//                         'circle-radius': 15,       // Large radius
//                         'circle-color': '#3b82f6', // Same blue
//                         'circle-opacity': 0.4,     // Semi-transparent
//                         'circle-blur': 0.5         // 🌟 The Blur makes it "Glow"
//                     }
//                 });
//             }

//             // ✅ C. Add CORE Layer (Foreground)
//             // This is the sharp, solid dot representing the actual agent
//             if (!map.getLayer('agents-layer')) {
//                 map.addLayer({
//                     id: 'agents-layer',
//                     type: 'circle',
//                     source: 'agents-source',
//                     paint: {
//                         'circle-radius': 6,        // Smaller, sharp dot
//                         'circle-color': '#3b82f6',
//                         'circle-stroke-width': 2,  // White border
//                         'circle-stroke-color': '#ffffff', 
//                         'circle-pitch-alignment': 'map'
//                     }
//                 });
//             }
//         map.on('click', 'agents-layer', async (e) => {
//                 if (!e.features || !e.features.length) return;
                
//                 const coordinates = e.features[0].geometry.coordinates.slice();
//                 const props = e.features[0].properties; 
//                 const cleanTrackerId = getCleanPhone(props.id);

//                 // 1. Resolve Agent Info
//                 const agentProfile = latestAgentsRef.current.find(a => getCleanPhone(a.id || a.sk) === cleanTrackerId);
//                 const agentName = agentProfile ? agentProfile.name : (props.name || 'Unknown Agent');
//                 const agentPhone = agentProfile ? (agentProfile.phone || cleanTrackerId) : cleanTrackerId;

//                 // 2. Identify Relevant Orders
//                 const relevantOrders = latestOrdersRef.current.filter(o => {
//                     const orderAgentId = getCleanPhone(o.gsi1pk || o.deliveryAgentId);
//                     if (orderAgentId !== cleanTrackerId) return false;
//                     return ['DELIVERING', 'DELIVERED'].includes(o.orderStatus);
//                 });

//                 // 3. Initialize Popup (Loading State)
//                 const popup = new maplibregl.Popup({ maxWidth: '280px' })
//                     .setLngLat(coordinates)
//                     .setHTML(`
//                         <div style="font-family: sans-serif; padding: 10px; color: #64748b; font-size: 12px; text-align: center;">
//                             <div style="margin-bottom:4px;"><strong>${agentName}</strong></div>
//                             <div class="animate-pulse">Loading order details...</div>
//                         </div>
//                     `)
//                     .addTo(map);

//                 // 4. FETCH ITEMS for all relevant orders (Parallel)
//                 try {
//                     const enrichedOrders = await Promise.all(relevantOrders.map(async (order) => {
//                         try {
//                             // 🔍 YOUR SPECIFIC QUERY LOGIC
//                             // Extract Business Phone from Order PK: "BUSINESS#+973..." -> "+973..."
//                             // ORDER#+15556337947#2026-01-14T13:17:16.050Z , BUSINESS#+15556337947
//                             const phoneNbr = order.pk.split('#')[1];
//                             const orderIdPart = order.sk.split('#')[1]; // "2026-01-..."
                            
//                             // Construct the Item Partition Key
//                             const itemPk = `ORDER#${phoneNbr}#${orderIdPart}`;

//                             const { data: lineItems } = await client.models.BusinessData.listByBusiness({
//                                 pk: itemPk,
//                                 sk: { beginsWith: 'ITEM#' },
//                                 sortDirection: 'DESC'
//                             });

//                             return { ...order, itemsList: lineItems };
//                         } catch (err) {
//                             console.error("Failed to fetch items for", order.sk, err);
//                             return { ...order, itemsList: [] }; // Fallback to empty items
//                         }
//                     }));

//                     // 5. Build Final HTML
//                     let contentHtml = '';
//                     console.log("Enriched Orders:", enrichedOrders);
//                     if (enrichedOrders.length > 0) {
//                         contentHtml = enrichedOrders.map(o => {
//                             const isDelivering = o.orderStatus === 'DELIVERING';
//                             const icon = isDelivering ? '🚚' : '✅';
//                             const shortId = (o.sk || "").replace('ORDER#', '').slice(0, 10);
//                             const phone = `+${o.customer || 'N/A'}`;
//                             const statusColor = isDelivering ? '#3b82f6' : '#22c55e';
//                             const bg = isDelivering ? '#eff6ff' : '#f0fdf4';

//                             // Generate Detail Rows from FETCHED Data
//                             const itemsToRender = o.itemsList.length > 0 ? o.itemsList : [{ name: 'No items found', quantity: 0, unitPrice: 0 }];
//                             const detailsHtml = itemsToRender.map(item => `
//                                 <div style="display: flex; justify-content: space-between; font-size: 10px; color: #475569; padding: 4px 0; border-bottom: 1px dashed #cbd5e1;">
//                                     <span style="flex: 1; margin-right: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
//                                         ${item.name  || 'Item'}
//                                     </span>
//                                     <span style="font-weight: 600; margin-right: 8px;">x${item.quantity || 1}</span>
//                                     <span>${(item.unitPrice || 0).toFixed(3)}</span>
//                                 </div>
//                             `).join('');

//                             // Render Expandable Row
//                             return `
//                             <details style="background: ${bg}; margin-bottom: 4px; border-radius: 4px; border-left: 3px solid ${statusColor}; overflow: hidden;">
//                                 <summary style="display: flex; align-items: center; font-size: 11px; padding: 8px 6px; cursor: pointer; outline: none; list-style: none;">
//                                     <span style="font-weight: 700; color: #334155; margin-right: 6px;">${icon} ${shortId}</span>
//                                     <span style="color: #64748b; font-size: 10px;">(${o.itemsNbr || o.itemsList.length})</span>
//                                     <span style="margin-left: auto; font-weight: 600; color: ${statusColor}; font-size: 12px;">${phone}</span>
//                                 </summary>
//                                 <div style="padding: 2px 8px 8px 8px; background: rgba(255,255,255,0.5); border-top: 1px solid rgba(0,0,0,0.05);">
//                                     ${detailsHtml}
//                                 </div>
//                             </details>`;
//                         }).join('');
//                     } else {
//                         contentHtml = `<div style="font-size:11px; color:#94a3b8; font-style:italic; padding: 6px;">No active deliveries (24h).</div>`;
//                     }

//                     // 6. Update Popup Content
//                     popup.setHTML(`
//                         <div style="font-family: sans-serif; min-width: 220px;">
//                             <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
//                                 <div style="font-weight: bold; font-size: 14px; color: #0f172a;">${agentName}</div>
//                                 <div style="font-size: 12px; color: #64748b;">📞 +${agentPhone}</div>
//                             </div>
//                             <div style="max-height: 200px; overflow-y: auto; padding-right: 2px;">
//                                 ${contentHtml}
//                             </div>
//                         </div>
//                     `);

//                 } catch (err) {
//                     // console.error("Popup Error:", err);
//                     popup.setHTML(`<div style="color:red; font-size:11px; padding:5px;">Error loading details.</div>`);
//                 }
//             });

//             // Change cursor on hover
//             map.on('mouseenter', 'agents-layer', () => {
//                 map.getCanvas().style.cursor = 'pointer';
//             });
//             map.on('mouseleave', 'agents-layer', () => {
//                 map.getCanvas().style.cursor = '';
//             });

//             // E. Start Tracking Loop
//             startTrackingLoop(map);
//         });

//         // Plot Restaurant
//         if (restaurantLocation) {
//           const el = document.createElement('div');
//           el.style.backgroundColor = '#ef4444'; 
//           el.style.width = '32px'; el.style.height = '32px';
//           el.style.borderRadius = '50%'; el.style.border = '3px solid white';
//           el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
//           el.style.display = 'flex'; el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//           el.innerHTML = '<span style="font-size:16px;">🏠</span>';

//           new maplibregl.Marker({ element: el })
//             .setLngLat([restaurantLocation.longitude, restaurantLocation.latitude])
//             .addTo(map);
//         }

//         // Initial Order Plot
//         plotOrdersOnMap(orders, map, assignments);

//       } catch (error) { console.error("Error creating map:", error); }
//     }
    
//     initializeMap();

//     // CLEANUP
//     return () => {
//       isMounted = false;
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     };
//   }, []);

//   // --- 2. TRACKING LOGIC (WebGL Strategy) ---
//   const startTrackingLoop = (map) => {
    
//     const fetchPositions = async () => {
//       try {
//         const session = await fetchAuthSession();
//         const client = new LocationClient({
//           region: outputs.geo.aws_region,
//           credentials: session.credentials
//         });

//         const allFeatures = [];
//         let token = undefined;

//         // PAGINATION: Retrieve ALL agents (even if > 100)
//         do {
//           const response = await client.send(new ListDevicePositionsCommand({
//             TrackerName: outputs.custom.amazon_location_service.trackers.default,
//             NextToken: token,
//             MaxResults: 100 
//           }));

//           if (response.Entries) {
//             response.Entries.forEach(entry => {
//                 if (entry.Position && entry.DeviceId) {
//                     // Create GeoJSON Feature
//                     allFeatures.push({
//                         type: 'Feature',
//                         geometry: {
//                             type: 'Point',
//                             coordinates: entry.Position // [Long, Lat]
//                         },
//                         properties: {
//                             id: entry.DeviceId,
//                             name: `Agent ${entry.DeviceId.slice(-4)}` 
//                         }
//                     });
//                 }
//             });
//           }
//           token = response.NextToken;
//         } while (token);

//         // UPDATE SOURCE (Triggers efficient GPU render)
//         if (map && map.getSource('agents-source')) {
//             map.getSource('agents-source').setData({
//                 type: 'FeatureCollection',
//                 features: allFeatures
//             });
//         }

//       } catch (error) { console.error("Error fetching positions:", error); }
//     };

//     // Initial Fetch & Interval
//     fetchPositions();
//     intervalRef.current = setInterval(fetchPositions, REFRESH_RATE_MS);
//   };

//   // --- 3. ORDER PLOTTING (Legacy DOM Markers) ---
//   useEffect(() => { 
//       if (mapInstance.current) plotOrdersOnMap(orders, mapInstance.current, assignments); 
//   }, [assignments, orders, showDelivered, showDelivering]);

// // --- 3. ORDER PLOTTING (Legacy DOM Markers) ---
//   // Updated to show detailed Popup Info
//   const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
//       if (!map) return;
      
//       // Clear old order markers
//       Object.values(markersRef.current).forEach(m => m.remove());
//       markersRef.current = {};

//       ordersToPlot.forEach((order, index) => {
//           const status = order.orderStatus || 'PREPARED'; 
          
//           // Filter Logic
//           if (status === 'DELIVERED' && !showDelivered) return;
//           if (status === 'DELIVERING' && !showDelivering) return;
          
//           const loc = parseLocation(order.location);
//           if (loc) {
//               // 1. Get Details
//               const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
//               // Find agent object to get the Name
//               const assignedAgent = agents.find(a => (a.id || a.sk) === assignedAgentId);
//               const agentName = assignedAgent ? assignedAgent.name : 'Unassigned';
//               const markerColor = getAgentColor(assignedAgentId);
              
//               // 2. Format Data for Display
//               const cleanId = (order.sk || "").split('#')[1] || order.sk;
//               const itemsNbr = order.itemsNbr || 1;
//               const phone = order.customer || order.phone || 'Unknown';

//               // 3. Status Styling
//               let statusLabel = `<span style="color:#fbbf24; font-weight:bold;">PREPARED</span>`;
//               let iconContent = index + 1;
              
//               if (status === 'DELIVERED') {
//                   statusLabel = `<span style="color:#22c55e; font-weight:bold;">DELIVERED</span>`;
//                   iconContent = '✓';
//               } else if (status === 'DELIVERING') {
//                   statusLabel = `<span style="color:#3b82f6; font-weight:bold;">ON WAY</span>`;
//                   iconContent = '🚚';
//               }

//               // 4. Create Marker Element
//               const el = document.createElement('div');
//               el.className = 'marker-order';
//               el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${iconContent}</span>`;
//               Object.assign(el.style, {
//                   backgroundColor: markerColor,
//                   width: '24px', height: '24px', borderRadius: '50%',
//                   display: 'flex', justifyContent: 'center', alignItems: 'center',
//                   border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: '10'
//               });

//               // 5. Construct Rich Popup HTML
//               const popupContent = `
//                 <div style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1e293b; padding: 4px; min-width: 180px;">
//                   <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
//                     <span style="font-weight: bold; font-size: 14px;">Order ${index + 1}</span>
//                     <span style="font-size: 12px; background: #f1f5f9; padding: 2px 6px; rounded: 4px;">${itemsNbr} Items</span>
//                   </div>
                  
//                   <div style="font-size: 12px; line-height: 1.6;">
//                     <div style="display:flex; justify-content:space-between;">
//                         <span style="color:#64748b;">Status:</span> ${statusLabel}
//                     </div>
                    
//                     ${assignedAgent ? `
//                     <div style="display:flex; justify-content:space-between;">
//                         <span style="color:#64748b;">By:</span> 
//                         <span style="font-weight:600;">${agentName}</span>
//                     </div>` : ''}
                    
//                     <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0;">
//                         <span style="color:#64748b;">Cust:</span> <b>${phone}</b>
//                     </div>
//                     <div style="color:#94a3b8; font-size: 10px; margin-top: 2px; font-family: monospace;">
//                         ID: ${cleanId}
//                     </div>
//                   </div>
//                 </div>
//               `;

//               // 6. Add to Map
//               const marker = new maplibregl.Marker({ element: el })
//                   .setLngLat([loc.longitude, loc.latitude])
//                   .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
//                   .addTo(map);

//               markersRef.current[order.sk] = marker;
//           }
//       });
//   };

//   // --- 4. DISPATCH LOGIC ---
//   const handleDispatch = async () => {
//     if (Object.keys(assignments).length === 0) return;
//     setSaving(true); 
//     try {
//       const session = await fetchAuthSession();
//       const geoClient = new GeoRoutesClient({
//           region: outputs.geo.aws_region,
//           credentials: session.credentials
//       });

//       const updateTasks = Object.entries(assignments).map(async ([orderSk, rawAgentId]) => {
//           const order = orders.find(o => o.sk === orderSk);
//           if (!order || order.orderStatus !== 'PREPARED') return;

//           const cleanPhone = getCleanPhone(rawAgentId);
//           const dbAgentId = `AGENT#+${cleanPhone}`; 

//           let dist = 0;
//           let dur = 0;
//           const custLoc = parseLocation(order.location);
          
//           if (restaurantLocation && custLoc) {
//              try {
//                  const res = await geoClient.send(new CalculateRoutesCommand({
//                      Origin: [restaurantLocation.longitude, restaurantLocation.latitude],
//                      Destination: [custLoc.longitude, custLoc.latitude],
//                      TravelMode: "Car",
//                  }));
//                  if (res.Routes?.length > 0) {
//                      const summary = res.Routes[0].Summary;
//                      dist = parseFloat((summary.Distance / 1000).toFixed(2)); 
//                      dur = Math.round(summary.Duration); 
//                  }
//              } catch (e) { console.warn(`Route calc error`, e.message); }
//           }

//           await client.models.BusinessData.update({
//               pk: order.pk, sk: orderSk,
//               gsi1pk: dbAgentId, deliveryAgentId: dbAgentId,  
//               orderStatus: 'DELIVERING', deliveryDistance: dist, deliveryDuration: dur   
//           });
//       });

//       await Promise.all(updateTasks);
//       if (onAssignmentSaved) onAssignmentSaved();
//     } catch (error) { console.error("Dispatch Error", error); } finally { setSaving(false); }
//   };

//   const runOptimization = async () => {
//     setLoading(true);
//     try {
//       const validAgents = agents.filter(a => parseLocation(a.location)).map(a => ({
//          id: a.id || a.sk, name: a.name, location: parseLocation(a.location),
//          maxCapacity: 10, currentLoad: 0
//       }));

//       const response = await client.queries.optimizeDelivery({
//         orders: JSON.stringify(orders),
//         agents: JSON.stringify(validAgents), 
//         restaurantLocation: JSON.stringify(restaurantLocation)
//       });

//       let raw = response.data;
//       if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) {} }
      
//       let proposal = raw.proposal;
//       if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

//       let metrics = raw.routeMetrics;
//       if (typeof metrics === 'string') { try { metrics = JSON.parse(metrics); } catch (e) { metrics = []; } }
      
//       const metricsMap = {}; 
//       if (Array.isArray(metrics)) {
//           metrics.forEach(m => { metricsMap[m.orderId] = { dist: parseFloat(m.distanceKm), dur: parseInt(m.durationSeconds) }; });
//       }
//       setOptimizationMetrics(metricsMap); 

//       const newAssignments = {};
//       if (Array.isArray(proposal)) {
//           proposal.forEach(p => {
//               if (p.assignedOrders) {
//                  p.assignedOrders.forEach(orderSk => { newAssignments[orderSk] = p.agentId; });
//               }
//           });
//       }
//       setAssignments(newAssignments);
//     } catch (err) { console.error("Optimization failed:", err); } finally { setLoading(false); }
//   };

//   const handleOrderClick = (orderSk) => {
//     const marker = markersRef.current[orderSk];
//     if (marker) {
//       marker.togglePopup(); 
//       mapInstance.current.flyTo({ center: marker.getLngLat(), zoom: 14 });
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
//       <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
//         <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
//         {/* Legend */}
//         {/* ✅ Vertical Stacked Legend (Transparent & Bottom Right) */}
//         <div 
//           className="absolute bottom-24 right-4 z-[60] flex flex-col items-center gap-4 bg-white/60 p-3 rounded-full shadow-xl border border-white/40 backdrop-blur-md pointer-events-auto transition-all hover:bg-white/50"
//           onClick={(e) => e.stopPropagation()}
//         >
//            {/* Toggle 1: Delivering (Truck) */}
//            <label className={`
//               cursor-pointer transition-all duration-300 transform active:scale-90
//               ${showDelivering ? 'opacity-100 scale-110 grayscale-0' : 'opacity-50 grayscale scale-100'}
//            `}>
//              <input 
//                type="checkbox" 
//                className="hidden" 
//                checked={showDelivering} 
//                onChange={(e) => setShowDelivering(e.target.checked)} 
//              />
//              <span className="text-2xl filter drop-shadow-sm">🚚</span>
//            </label>

//            {/* Horizontal Divider (Optional separator) */}
//            <div className="w-6 h-px bg-slate-500/30"></div>

//            {/* Toggle 2: Delivered (Check) */}
//            <label className={`
//               cursor-pointer transition-all duration-300 transform active:scale-50
//               ${showDelivered ? 'opacity-100 scale-110 grayscale-0' : 'opacity-50 grayscale scale-100'}
//            `}>
//              <input 
//                type="checkbox" 
//                className="hidden" 
//                checked={showDelivered} 
//                onChange={(e) => setShowDelivered(e.target.checked)} 
//              />
//              <span className="text-2xl filter drop-shadow-sm">✅</span>
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
//                 <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center disabled:opacity-50 text-sm">
//                     {saving ? "..." : "📦 Confirm"}
//                 </button>
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
//     </div>
//   );
// };

// export default DeliveryOptimizer;

import React, { useEffect, useRef, useState } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import outputs from '../../amplify_outputs.json'; 
import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";
import { fetchAuthSession } from 'aws-amplify/auth';

// --- CONFIG ---
const REFRESH_RATE_MS = 10000; 
// Duration matches fetch rate to create continuous movement
const ANIMATION_DURATION_MS = REFRESH_RATE_MS; 

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
  
  // Animation State Refs
  const animationFrameId = useRef(null);
  const agentAnimationState = useRef({}); // { id: { start: [lng,lat], end: [lng,lat], startTime: ms } }
  
  // Data Refs (Bridge React State to Map)
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

  // ✅ CSS Fix for Z-Index (Popup on Top)
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
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      // 2. Destroy the Map Instance (Free up WebGL Context)
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

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

            // A. Sources & Layers
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
                        'circle-radius': 15,
                        'circle-color': '#3b82f6',
                        'circle-opacity': 0.4,
                        'circle-blur': 0.5
                    }
                });
            }

            // Core Dot Layer
            if (!map.getLayer('agents-layer')) {
                map.addLayer({
                    id: 'agents-layer',
                    type: 'circle',
                    source: 'agents-source',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#3b82f6',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff', 
                        'circle-pitch-alignment': 'map'
                    }
                });
            }

            // B. Map Background Click (Reset Focus)
            map.on('click', () => setFocusedAgentId(null));

            // C. Agent Click (Popup Logic)
            map.on('click', 'agents-layer', async (e) => {
                if (!e.features || !e.features.length) return;
                e.originalEvent.stopPropagation(); // Stop background click

                const coordinates = e.features[0].geometry.coordinates.slice();
                const props = e.features[0].properties; 
                const cleanTrackerId = getCleanPhone(props.id);
                
                setFocusedAgentId(cleanTrackerId); // Highlight Orders

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

                // Init Popup (Loading)
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
                    // Fetch Items for each order
                    const enrichedOrders = await Promise.all(relevantOrders.map(async (order) => {
                        try {
                            const phoneNbr = order.pk.split('#')[1];
                            const orderIdPart = order.sk.split('#')[1];
                            // Query Pattern: ORDER#<Phone>#<ID>
                            const itemPk = `ORDER#${phoneNbr}#${orderIdPart}`;
                            
                            const { data: lineItems } = await client.models.BusinessData.listByBusiness({
                                pk: itemPk, sk: { beginsWith: 'ITEM#' }, sortDirection: 'DESC'
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
                            const phone = `+${o.customer || 'N/A'}`;
                            
                            const itemsToRender = o.itemsList.length > 0 ? o.itemsList : [{name:'Item', quantity:1, unitPrice:0}];
                            const detailsHtml = itemsToRender.map(i => `
                                <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;padding:4px 0;border-bottom:1px dashed #cbd5e1;">
                                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:4px;">${i.name || 'Item'}</span>
                                    <span style="font-weight:600;margin-right:8px;">x${i.quantity||1}</span>
                                    <span>${(i.unitPrice||0).toFixed(2)}</span>
                                </div>
                            `).join('');

                            return `<details style="background:${bg};margin-bottom:4px;border-radius:4px;border-left:3px solid ${statusColor};overflow:hidden;">
                                <summary style="display:flex;align-items:center;font-size:11px;padding:8px 6px;cursor:pointer;outline:none;list-style:none;">
                                    <span style="font-weight:700;color:#334155;margin-right:6px;">${icon} ${shortId}</span>
                                    <span style="color:#64748b;font-size:10px;">(${o.itemsNbr||o.itemsList.length})</span>
                                    <span style="margin-left:auto;font-weight:600;color:${statusColor};font-size:12px;">${phone}</span>
                                </summary>
                                <div style="padding:2px 8px 8px 8px;background:rgba(255,255,255,0.5);">${detailsHtml}</div>
                            </details>`;
                        }).join('');
                    } else {
                        contentHtml = `<div style="font-size:11px;color:#94a3b8;padding:6px;">No recent history.</div>`;
                    }

                    // Update Popup
                    popup.setHTML(`
                        <div style="font-family:sans-serif;min-width:220px;">
                            <div style="border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px;">
                                <div style="font-weight:bold;font-size:14px;color:#0f172a;">${agentName}</div>
                                <div style="font-size:12px;color:#64748b;">📞 +${agentPhone}</div>
                            </div>
                            <div style="max-height:200px;overflow-y:auto;padding-right:2px;">${contentHtml}</div>
                        </div>
                    `);
                } catch (err) { popup.setHTML(`<div style="color:red;font-size:11px;padding:5px;">Error loading.</div>`); }
            });

            // Hover Cursor
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

  // --- 2. FETCH LOOP (Gets Data, updates animation targets) ---
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
                    const newPos = entry.Position; // [lng, lat]
                    
                    // UPDATE ANIMATION STATE
                    const current = agentAnimationState.current[id];
                    
                    if (!current) {
                        // First time seeing agent: Jump to position
                        agentAnimationState.current[id] = {
                            start: newPos,
                            end: newPos,
                            startTime: Date.now()
                        };
                    } else {
                        // Smooth transition: Start from "current target" -> "new target"
                        // We use the previous 'end' as 'start' to ensure continuity
                        agentAnimationState.current[id] = {
                            start: current.end, 
                            end: newPos,        
                            startTime: Date.now()
                        };
                    }
                }
            });
          }
          token = response.NextToken;
        } while (token);
      } catch (error) { console.error("Fetch Error:", error); }
      
      // Schedule Next Fetch
      setTimeout(fetchPositions, REFRESH_RATE_MS);
    };
    fetchPositions();
  };

  // --- 3. ANIMATION LOOP (Interpolates 60fps) ---
  const startAnimationLoop = (map) => {
      const animate = () => {
          const now = Date.now();
          const features = [];

          Object.entries(agentAnimationState.current).forEach(([id, state]) => {
              // Interpolation Factor (0.0 to 1.0)
              const elapsed = now - state.startTime;
              let t = elapsed / ANIMATION_DURATION_MS;
              if (t > 1) t = 1; // Clamp at destination

              // Linear Interpolation (Lerp)
              const currentLng = state.start[0] + (state.end[0] - state.start[0]) * t;
              const currentLat = state.start[1] + (state.end[1] - state.start[1]) * t;

              features.push({
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [currentLng, currentLat] },
                  properties: { id: id, name: `Agent ${id.slice(-4)}` }
              });
          });

          // Update Map Source (Efficient GPU Render)
          const source = map.getSource('agents-source');
          if (source && features.length > 0) {
              source.setData({ type: 'FeatureCollection', features: features });
          }

          animationFrameId.current = requestAnimationFrame(animate);
      };
      animate();
  };

  // --- 4. ORDER PLOTTING (With Highlight Logic) ---
  useEffect(() => { 
      if (mapInstance.current) plotOrdersOnMap(orders, mapInstance.current, assignments, focusedAgentId); 
  }, [assignments, orders, showDelivered, showDelivering, focusedAgentId]);

  const plotOrdersOnMap = (ordersToPlot, map, currentAssignments, activeAgentId) => {
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
              
              // Highlight Logic
              const isHighlighted = activeAgentId && getCleanPhone(assignedAgentId) === getCleanPhone(activeAgentId);
              const isDimmed = activeAgentId && !isHighlighted;

              const markerColor = getAgentColor(assignedAgentId);
              let icon = index + 1;
              if (status === 'DELIVERED') icon = '✓';
              if (status === 'DELIVERING') icon = '🚚';

              const el = document.createElement('div');
              el.className = 'marker-order';
              el.innerHTML = `<span style="color:white;font-weight:bold;font-size:12px;">${icon}</span>`;
              
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

              const marker = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.longitude, loc.latitude])
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

  const runOptimization = async () => { /* ... existing optimization logic ... */ };
  const handleDispatch = async () => { /* ... existing dispatch logic ... */ };

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
                <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center text-sm">{loading ? "..." : "⚡️ Auto-Assign"}</button>
                <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg h-10 flex items-center justify-center disabled:opacity-50 text-sm">
                    {saving ? "..." : "📦 Confirm"}
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
    </div>
  );
};

export default DeliveryOptimizer;
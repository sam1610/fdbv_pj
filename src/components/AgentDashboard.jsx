
// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import { createMap } from 'maplibre-gl-js-amplify';
// import maplibregl from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
// import { client } from '../DataHook/amplifyClient';
// import outputs from '../../amplify_outputs.json'; 


// // --- 📏 HELPER: Haversine Distance (Local Fallback) ---
// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     if (!lat1 || !lon1 || !lat2 || !lon2) return null;
//     const R = 6371; // Earth radius in km
//     const dLat = (lat2 - lat1) * Math.PI / 180;
//     const dLon = (lon2 - lon1) * Math.PI / 180;
//     const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
//               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return (R * c).toFixed(1);
// };

// // --- 🛠 HELPER: Robust Coordinate Parsing (FIXED) ---
// const getCoordinates = (loc) => {
//     if (!loc) return null;
//     try {
//         const data = typeof loc === 'string' ? JSON.parse(loc) : loc;
        
//         // Handle DynamoDB { N: "..." } or standard { latitude: ... }
//         const extract = (v) => (v && v.N ? parseFloat(v.N) : parseFloat(v));
        
//         const lat = extract(data.latitude || data.lat);
//         const lng = extract(data.longitude || data.lng || data.long);

//         if (isNaN(lat) || isNaN(lng)) return null;
//         return { lat, lng };
//     } catch (e) {
//         return null;
//     }
// };

// // --- 🎨 HELPER: Generate Distinct Color ---
// const getRestaurantColor = (str) => {
//     let hash = 0;
//     for (let i = 0; i < str.length; i++) {
//         hash = str.charCodeAt(i) + ((hash << 5) - hash);
//     }
//     const hue = Math.abs(hash % 360);
//     return `hsl(${hue}, 70%, 45%)`; 
// };

// const formatTime = (sec) => sec ? `${Math.round(sec / 60)} min` : '--';

// const AgentDashboard = ({ agentPhone,  businessLocation }) => {
//     const mapContainerRef = useRef(null);
//     const mapInstance = useRef(null);
//     const markersRef = useRef({});            
//     const restaurantMarkersRef = useRef({});  

//     const [agentLocation, setAgentLocation] = useState(null); 
//     const [orders, setOrders] = useState([]); // Now contains 7 days of data
//     const [restaurants, setRestaurants] = useState({}); 
    
//     const [selectedOrder, setSelectedOrder] = useState(null);
//     const [selectedRestaurant, setSelectedRestaurant] = useState(null);
//     const [focusedRestaurant, setFocusedRestaurant] = useState(null);
    
//     const [isGridOpen, setIsGridOpen] = useState(false);
//     const [gridOrders, setGridOrders] = useState([]);
//     const [loadingGrid, setLoadingGrid] = useState(false);
//     const [isMapReady, setIsMapReady] = useState(false);
//     const [showDelivered, setShowDelivered] = useState(true);

//     const todayStr = new Date().toISOString().split('T')[0];
//     const [dateRange, setDateRange] = useState({ start: todayStr, end: todayStr });
//     const [agentProfileLoc, setAgentProfileLoc] = useState(null);

//     // 0. HELPER: Load Configs
//     const loadRestaurantConfigs = useCallback(async (pks) => {
//         const missingPks = pks.filter(pk => !restaurants[pk]);
//         if (missingPks.length === 0) return;

//         const newCache = { ...restaurants }; 

//         await Promise.all(missingPks.map(async (pk) => {
//             try {
//                 const { data } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
//                 const coords = getCoordinates(data?.location);
//                 if (coords) {
//                     newCache[pk] = { lat: coords.lat, lng: coords.lng, name: data.name || 'Restaurant' };
//                 }
//             } catch (e) { console.error("Failed to load restaurant config", pk); }
//         }));

//         setRestaurants(prev => ({ ...prev, ...newCache }));
//     }, [restaurants]);

//     // 1. INITIALIZE MAP
//     useEffect(() => {
//         if (mapInstance.current || !mapContainerRef.current) return;

//         const startLoc = getCoordinates(businessLocation) || { lat: 26.0935, lng: 50.4880 };

//         async function initMap() {
//             try {
//                 const map = await createMap({
//                     container: mapContainerRef.current,
//                     center: [startLoc.lng, startLoc.lat],
//                     zoom: 12,
//                     attributionControl: false,
//                     ...outputs.geo
//                 });
//                 mapInstance.current = map;

//                 const geolocate = new maplibregl.GeolocateControl({
//                     positionOptions: { enableHighAccuracy: true },
//                     trackUserLocation: true,
//                     showUserLocation: true
//                 });

//                 map.addControl(geolocate, 'bottom-right');
//                 map.on('click', () => {
//                     setFocusedRestaurant(null);
//                     setSelectedRestaurant(null);
//                     setSelectedOrder(null);
//                 });
//                 geolocate.on('geolocate', (e) => setAgentLocation({ lat: e.coords.latitude, lng: e.coords.longitude }));
                
//                 map.on('load', () => {
//                     console.log("✅ Map Fully Loaded");
//                     geolocate.trigger();
//                     setIsMapReady(true);
//                 });

//             } catch (e) { console.error("Map Init Error:", e); }
//         }
//         initMap();
//     }, [businessLocation]);

//     // 2. FETCH DATA (UPDATED: FETCH 7 DAYS, FILTER MAP LATER)
//     useEffect(() => {
//         if (!agentPhone) return;

//         const fetchData = async () => {
//             try {
//                 const { data } = await client.models.BusinessData.ByAgent({
//                     gsi1pk: `AGENT#${agentPhone}`,
//                     sk: { beginsWith: 'ORDER#' }
//                 });

//                 // ✅ FETCH STRATEGY: Get last 7 days of data for the Grid
//                 // We will filter strictly for the Map in step 3
//                 const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                
//                 const activeAndHistory = data.filter(o => {
//                     // Always keep delivering
//                     if (o.orderStatus === 'DELIVERING') return true;
//                     // Keep history if recent enough
//                     const t = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
//                     return o.orderStatus === 'DELIVERED' && t > sevenDaysAgo;
//                 });

//                 setOrders(activeAndHistory);

//                 const initialPks = [...new Set(activeAndHistory.map(o => o.pk))];
//                 loadRestaurantConfigs(initialPks);

//                 // Fetch Agent Profile
//                 const { data: agentRecord } = await client.models.BusinessData.listByBusiness({
//                     pk: `AGENT#${agentPhone}`,
//                     sk: { eq: `AGENT#${agentPhone}` }
//                 });

//                 if (agentRecord.length > 0 && agentRecord[0].location) {
//                     const profLoc = getCoordinates(agentRecord[0].location);
//                     if (profLoc) setAgentProfileLoc(profLoc);
//                 }

//             } catch (e) { console.error("Map Fetch Error:", e); }
//         };

//         fetchData();

//         const subFilter = { gsi1pk: { eq: `AGENT#${agentPhone}` } };
        
//         const handleLiveEvent = (item) => {
//             if (!item || !item.sk || !item.sk.startsWith('ORDER#')) return;

//             setOrders(prev => {
//                 const existingOrder = prev.find(o => o.pk === item.pk && o.sk === item.sk);
//                 const others = prev.filter(o => o.pk !== item.pk || o.sk !== item.sk);
                
//                 const mergedOrder = existingOrder ? { ...existingOrder, ...item } : item;

//                 if (['DELIVERING', 'DELIVERED'].includes(mergedOrder.orderStatus)) {
//                     loadRestaurantConfigs([mergedOrder.pk]);
//                     return [...others, mergedOrder];
//                 }
//                 return others;
//             });
//         };

//         const createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({ next: handleLiveEvent });
//         const updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({ next: handleLiveEvent });

//         return () => { createSub.unsubscribe(); updateSub.unsubscribe(); };
//     }, [agentPhone, loadRestaurantConfigs]);

//     // 3. PLOT MARKERS (UPDATED: MAP STRICTLY 24H)
//     useEffect(() => {
//         if (!isMapReady || !mapInstance.current) return;
//         const map = mapInstance.current;

//         console.log(`📍 Plotting: ${orders.length} total loaded orders`);

//         // --- A. Filter Orders for Map (24h Rule) ---
//         const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
//         const mapOrders = orders.filter(o => {
//             // 1. CheckBox Filter
//             if (o.orderStatus === 'DELIVERED' && !showDelivered) return false;
            
//             // 2. 24h Time Filter (Map Only)
//             // If Delivering -> Always Show
//             // If Delivered -> Only show if < 24h
//             if (o.orderStatus === 'DELIVERING') return true;
//             const t = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
//             return t > oneDayAgo;
//         });

//         // --- B. Plot Restaurants ---
//         const uniqueRestaurants = new Map();
//         Object.entries(restaurants).forEach(([pk, info]) => uniqueRestaurants.set(pk, info));

//         mapOrders.forEach(order => {
//             const loc = getCoordinates(order.pickupLocation);
//             if (loc && !uniqueRestaurants.has(order.pk)) {
//                 uniqueRestaurants.set(order.pk, { lat: loc.lat, lng: loc.lng, name: 'Restaurant' });
//             }
//         });

//         Object.values(restaurantMarkersRef.current).forEach(m => m.remove());
//         restaurantMarkersRef.current = {};

//         uniqueRestaurants.forEach((info, pk) => {
//             const color = getRestaurantColor(pk); 
//             const el = document.createElement('div');
//             el.innerHTML = `🏪`; 
//             el.className = 'marker-restaurant';
            
//             el.style.width = '40px'; el.style.height = '40px';
//             el.style.borderRadius = '50%'; el.style.display = 'flex';
//             el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//             el.style.backgroundColor = 'white'; el.style.border = `3px solid ${color}`;
//             el.style.fontSize = '24px'; el.style.cursor = 'pointer';
//             el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
//             el.style.transition = 'all 0.3s ease';

//             el.addEventListener('click', (e) => {
//                 e.stopPropagation();
//                 setFocusedRestaurant(prev => (prev === pk ? null : pk));
//                 setSelectedOrder(null);
//             });

//             el.addEventListener('dblclick', (e) => {
//                 e.stopPropagation();
//                 setSelectedRestaurant({ pk, ...info });
//                 setSelectedOrder(null);
//                 setFocusedRestaurant(pk); 
//                 map.flyTo({ center: [info.lng, info.lat], zoom: 15 });
//             });

//             if (focusedRestaurant === pk) {
//                 el.style.transform = 'scale(1.3)';
//                 el.style.filter = `drop-shadow(0 0 15px ${color})`;
//             }

//             const marker = new maplibregl.Marker({ element: el }).setLngLat([info.lng, info.lat]).addTo(map);
//             restaurantMarkersRef.current[pk] = marker;
//         });

//         // --- C. Plot Orders ---
//         Object.values(markersRef.current).forEach(m => m.remove());
//         markersRef.current = {};

//         mapOrders.forEach(order => {
//             const coords = getCoordinates(order.location);
//             if (!coords) {
//                 // Now robust, but if still null, we skip
//                 return;
//             }

//             const isRelated = focusedRestaurant && order.pk === focusedRestaurant;
//             const restColor = getRestaurantColor(order.pk);

//             const el = document.createElement('div');
//             const isDelivered = order.orderStatus === 'DELIVERED';
//             el.innerHTML = isDelivered ? `📦` : `🚚`;
//             el.className = isDelivered ? 'Order-delivered' : 'Order-delivering';
//             el.style.width = '32px'; el.style.height = '32px';
//             el.style.borderRadius = '50%'; el.style.display = 'flex';
//             el.style.justifyContent = 'center'; el.style.alignItems = 'center';
//             el.style.fontWeight = 'bold'; el.style.color = 'white'; el.style.cursor = 'pointer';
//             el.style.transition = 'all 0.3s ease';
//             el.style.backgroundColor = isDelivered ? '#22c55e' : '#fbbf24';
            
//             if (isRelated) {
//                 el.style.border = `3px solid ${restColor}`;
//                 el.style.transform = 'scale(1.3)'; 
//                 el.style.zIndex = '50';
//             } else {
//                 el.style.border = '3px solid white';
//                 el.style.transform = 'scale(1)';
//             }
            
//             el.style.opacity = '1'; 
//             el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

//             const marker = new maplibregl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
//             el.addEventListener('click', (e) => {
//                  e.stopPropagation();
//                  setSelectedOrder(order);
//                  setSelectedRestaurant(null);
//                  map.flyTo({ center: [coords.lng, coords.lat], zoom: 15 });
//             });
//             markersRef.current[order.sk] = marker;
//         });

//     }, [orders, focusedRestaurant, isMapReady, restaurants, showDelivered]);

//     // 4. GRID DATA (Uses Date Picker)
//     useEffect(() => {
//         if (!isGridOpen) return;
//         setLoadingGrid(true);

//         let origin = agentLocation || agentProfileLoc || { lat: 26.0935, lng: 50.4880 };
//         if (isNaN(Number(origin.lat))) origin = { lat: 26.0935, lng: 50.4880 };

//         const startTs = new Date(dateRange.start).setHours(0,0,0,0);
//         const endTs = new Date(dateRange.end).setHours(23,59,59,999);

//         // Grid Filters based on Date Picker (can show 7 days of history if selected)
//         const processed = orders.filter(o => {
//             const t = new Date(o.createdAt).getTime();
//             return (t >= startTs && t <= endTs) && (showDelivered || o.orderStatus !== 'DELIVERED');
//         }).map(order => {
//             const dbDist = order.deliveryDistance ? `${order.deliveryDistance.toFixed(1)} km` : '--';
//             const dbTime = order.deliveryDuration;
//             const dest = getCoordinates(order.location);
//             const sortDist = dest ? calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng) : 999;

//             return { 
//                 ...order, 
//                 _dist: dbDist,      
//                 _time: dbTime,      
//                 _sortDist: sortDist 
//             }; 
//         }).sort((a,b) => parseFloat(a._sortDist) - parseFloat(b._sortDist));
        
//         setGridOrders(processed);
//         setLoadingGrid(false);

//     }, [isGridOpen, dateRange, orders, agentLocation, agentProfileLoc, showDelivered]);

//     const markAsDelivered = async (order) => {
//         try {
//             await client.models.BusinessData.update({
//                 pk: order.pk, sk: order.sk, orderStatus: 'DELIVERED', deliveryAgentId: `AGENT#${agentPhone}`
//             });
//             await client.models.BusinessData.update({
//                 pk: `AGENT#${agentPhone}`,
//                 sk: `AGENT#${agentPhone}`,
//                 location: order.location
//             });
//             const newLoc = getCoordinates(order.location);
//             if (newLoc) setAgentProfileLoc(newLoc);
//             setSelectedOrder(null);
//         } catch (e) { alert(e.message); }
//     };

//     const openGoogleMaps = (lat, lng) => {
//         if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
//     };

//     return (
//         <div className="h-screen flex flex-col bg-slate-900 relative overflow-hidden">
//             <div className="p-3 bg-slate-800 shadow-md z-[60] flex justify-between items-center shrink-0 border-b border-slate-700">
//                 <div className="flex flex-col">
//                     <h1 className="text-lg font-bold text-white flex items-center gap-2">
//                         {focusedRestaurant ? '📍 Related Orders' : '🚀 All Deliveries'}
//                     </h1>
//                     {agentLocation && <span className="text-[10px] text-green-400 font-mono">● GPS Active</span>}
//                 </div>
//                 <div className="flex gap-2 items-center">
//                     {focusedRestaurant && <button onClick={() => setFocusedRestaurant(null)} className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-bold">Reset View</button>}
//                     <button onClick={() => setIsGridOpen(!isGridOpen)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold shadow-lg">{isGridOpen ? 'Map View' : 'Order List'}</button>
//                 </div>
//             </div>

//             <div className="flex-1 relative w-full h-full">
//                 <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
                
//                 <div className="absolute bottom-8 left-4 z-[50]">
//                     <div className="bg-white p-1 rounded-lg shadow-lg border border-slate-200 min-w-[140px]">
//                         <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
//                             <input 
//                                 type="checkbox" 
//                                 checked={showDelivered} 
//                                 onChange={(e) => setShowDelivered(e.target.checked)}
//                                 className="w-3 h-3 rounded text-green-500 focus:ring-green-500 border-slate-300"
//                             />
//                             <span className="text-lg">✅</span>
//                             <span className="text-[10px] font-bold text-slate-700">DELIVERED</span>
//                         </label>
//                     </div>
//                 </div>

//                 {!isGridOpen && selectedRestaurant && (
//                     <div className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-xl shadow-2xl z-[60] animate-slide-up border-t-4 border-yellow-400">
//                         <button onClick={() => openGoogleMaps(selectedRestaurant.lat, selectedRestaurant.lng)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"><span>🗺️ Navigate</span></button>
//                     </div>
//                 )}
//                 {!isGridOpen && selectedOrder && (
//                     <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-xl shadow-2xl z-[60] animate-slide-up">
//                         <div className="flex justify-between mb-3">
//                             <div>
//                                 <div className="flex items-center gap-2 mt-1">
//                                     <span className="text-sm text-slate-500">Customer:</span>
//                                     <a href={`tel:${selectedOrder.phone}`} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
//                                         📞 +{selectedOrder.phone || 'Unknown'}
//                                     </a>
//                                 </div>
//                                 <h3 className="font-bold text-slate-400">
//                                     Order: {selectedOrder.sk.split('#')[1]} - [{selectedOrder.itemsNbr} Item(s)]
//                                 </h3>
//                             </div>
//                             <button onClick={() => setSelectedOrder(null)} className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center text-slate-500 font-bold">✕</button>
//                         </div>
//                         <div className="grid grid-cols-2 gap-3">
//                             <button onClick={() => { const c = getCoordinates(selectedOrder.location); openGoogleMaps(c?.lat, c?.lng); }} className="bg-blue-100 text-blue-700 py-3 rounded-lg font-bold">🗺️ Go</button>
//                             {selectedOrder.orderStatus === 'DELIVERING' ? <button onClick={() => markAsDelivered(selectedOrder)} className="bg-green-600 text-white py-3 rounded-lg font-bold">📦 Delivered</button> : <button disabled className="bg-slate-100 text-slate-400 py-3 rounded-lg font-bold">✓ Done</button>}
//                         </div>
//                     </div>
//                 )}
//                 <div className={`absolute inset-0 bg-slate-900/95 z-[60] transition-transform duration-300 flex flex-col ${isGridOpen ? 'translate-y-0' : 'translate-y-full'}`}>
//                     <div className="p-4 bg-slate-800 border-b border-slate-700 shadow-lg shrink-0">
//                          <div className="flex justify-between items-center mb-3">
//                              <h2 className="text-white font-bold text-lg">Daily Manifest</h2>
//                              <div className="text-xs text-slate-400">{gridOrders.length} Orders</div>
//                          </div>
//                          <div className="flex gap-2">
//                             <input type="date" value={dateRange.start} onChange={e => setDateRange(p=>({...p, start:e.target.value}))} className="bg-slate-900 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none" />
//                             <input type="date" value={dateRange.end} onChange={e => setDateRange(p=>({...p, end:e.target.value}))} className="bg-slate-900 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none" />
//                         </div>
//                     </div>
//                     <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
//                         {loadingGrid && <div className="text-center text-slate-400 mt-10">Calculating Routes...</div>}
//                         {!loadingGrid && gridOrders.length === 0 && <div className="text-center text-slate-500 mt-10">No orders found.</div>}
//                         {!loadingGrid && gridOrders.map(order => (
//                             <div key={order.sk} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm">
//                                 <div className="flex items-center gap-3 overflow-hidden">
//                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
//                                         order.orderStatus === 'DELIVERED' 
//                                         ? 'bg-green-900/40 text-green-400' 
//                                         : 'bg-amber-900/40 text-amber-400'
//                                     }`}>
//                                         {order.orderStatus === 'DELIVERED' ? '✓' : '🚚'}
//                                     </div>
//                                     <div className="min-w-0">
//                                         <h4 className="text-white font-bold whitespace-nowrap truncate">
//                                             #{order.sk.split('#')[1]}
//                                         </h4>
//                                         <div className={`text-xs mt-0.5 font-bold ${
//                                             order.orderStatus === 'DELIVERED' ? 'text-green-500' : 'text-amber-500'
//                                         }`}>
//                                             {order.orderStatus}
//                                         </div>
//                                     </div>
//                                 </div>
//                                 <div className="text-right min-w-[70px] shrink-0">
//                                     {order._dist ? (
//                                         <>
//                                             <div className="text-indigo-400 font-bold text-sm">{order._dist} km</div>
//                                             <div className="text-slate-500 text-xs font-mono mt-1">{formatTime(order._time)}</div>
//                                         </>
//                                     ) : (
//                                         <div className="text-slate-600 text-xs italic">--</div>
//                                     )}
//                                 </div>
//                             </div>
//                         ))}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default AgentDashboard;

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import outputs from '../../amplify_outputs.json'; 

// --- 📏 HELPER: Haversine Distance ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
};

// --- 🛠 HELPER: Robust Coordinate Parsing ---
const getCoordinates = (loc) => {
    if (!loc) return null;
    try {
        const data = typeof loc === 'string' ? JSON.parse(loc) : loc;
        const extract = (v) => (v && v.N ? parseFloat(v.N) : parseFloat(v));
        const lat = extract(data.latitude || data.lat);
        const lng = extract(data.longitude || data.lng || data.long);
        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    } catch (e) { return null; }
};

// --- 🎨 HELPER: Colors ---
const getRestaurantColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`; 
};

const formatTime = (sec) => sec ? `${Math.round(sec / 60)} min` : '--';

const AgentDashboard = ({ agentPhone, businessLocation }) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});            
    const restaurantMarkersRef = useRef({});  

    const [agentLocation, setAgentLocation] = useState(null); 
    const [rawOrders, setRawOrders] = useState([]); 
    const [restaurants, setRestaurants] = useState({}); 
    
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [focusedRestaurant, setFocusedRestaurant] = useState(null);
    
    const [isGridOpen, setIsGridOpen] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [showDelivered, setShowDelivered] = useState(true);

    const [isCustomDate, setIsCustomDate] = useState(false);
    
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1); 
        return { 
            start: yesterday.toISOString().split('T')[0], 
            end: today.toISOString().split('T')[0] 
        };
    });
    
    const [agentProfileLoc, setAgentProfileLoc] = useState(null);

    // 0. HELPER: Load Configs
    const loadRestaurantConfigs = useCallback(async (pks) => {
        const missingPks = pks.filter(pk => !restaurants[pk]);
        if (missingPks.length === 0) return;

        const newCache = { ...restaurants }; 
        await Promise.all(missingPks.map(async (pk) => {
            try {
                const { data } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
                const coords = getCoordinates(data?.location);
                if (coords) {
                    newCache[pk] = { lat: coords.lat, lng: coords.lng, name: data.name || 'Restaurant' };
                }
            } catch (e) { console.error("Failed to load config", pk); }
        }));
        setRestaurants(prev => ({ ...prev, ...newCache }));
    }, [restaurants]);

    // 1. INITIALIZE MAP
    useEffect(() => {
        if (mapInstance.current || !mapContainerRef.current) return;
        const startLoc = getCoordinates(businessLocation) || { lat: 26.0935, lng: 50.4880 };

        async function initMap() {
            try {
                const map = await createMap({
                    container: mapContainerRef.current,
                    center: [startLoc.lng, startLoc.lat],
                    zoom: 12,
                    attributionControl: false,
                    ...outputs.geo
                });
                mapInstance.current = map;

                const geolocate = new maplibregl.GeolocateControl({
                    positionOptions: { enableHighAccuracy: true },
                    trackUserLocation: true,
                    showUserLocation: true
                });

                map.addControl(geolocate, 'bottom-right');
                map.on('click', () => {
                    setFocusedRestaurant(null);
                    setSelectedRestaurant(null);
                    setSelectedOrder(null);
                });
                geolocate.on('geolocate', (e) => setAgentLocation({ lat: e.coords.latitude, lng: e.coords.longitude }));
                
                map.on('load', () => {
                    geolocate.trigger();
                    setIsMapReady(true);
                });
            } catch (e) { console.error("Map Init Error:", e); }
        }
        initMap();
    }, [businessLocation]);

    // 2. FETCH DATA 
    useEffect(() => {
        if (!agentPhone) return;

        const fetchData = async () => {
            try {
                const { data } = await client.models.BusinessData.ByAgent({
                    gsi1pk: `AGENT#${agentPhone}`,
                    sk: { beginsWith: 'ORDER#' }
                });

                const validOrders = data.filter(o => ['DELIVERING', 'DELIVERED'].includes(o.orderStatus));
                setRawOrders(validOrders);

                const initialPks = [...new Set(validOrders.map(o => o.pk))];
                loadRestaurantConfigs(initialPks);

                const { data: agentRecord } = await client.models.BusinessData.listByBusiness({
                    pk: `AGENT#${agentPhone}`, sk: { eq: `AGENT#${agentPhone}` }
                });
                if (agentRecord[0]?.location) {
                    const profLoc = getCoordinates(agentRecord[0].location);
                    if (profLoc) setAgentProfileLoc(profLoc);
                }
            } catch (e) { console.error("Fetch Error:", e); }
        };

        fetchData();

        const subFilter = { gsi1pk: { eq: `AGENT#${agentPhone}` } };
        const handleLiveEvent = (item) => {
            if (!item || !item.sk || !item.sk.startsWith('ORDER#')) return;
            setRawOrders(prev => {
                const existing = prev.find(o => o.pk === item.pk && o.sk === item.sk);
                const others = prev.filter(o => o.pk !== item.pk || o.sk !== item.sk);
                const merged = existing ? { ...existing, ...item } : item;
                
                if (['DELIVERING', 'DELIVERED'].includes(merged.orderStatus)) {
                    loadRestaurantConfigs([merged.pk]);
                    return [...others, merged];
                }
                return others; 
            });
        };

        const createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({ next: handleLiveEvent });
        const updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({ next: handleLiveEvent });
        return () => { createSub.unsubscribe(); updateSub.unsubscribe(); };
    }, [agentPhone, loadRestaurantConfigs]);


    // 3. UNIFIED FILTER LOGIC
    const visibleOrders = useMemo(() => {
        return rawOrders.filter(o => {
            // A. Hide Delivered if checkbox unchecked
            if (o.orderStatus === 'DELIVERED' && !showDelivered) return false;

            const t = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();

            if (!isCustomDate) {
                 // MODE 1: DEFAULT (Last 24 Hours)
                 const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
                 return t > twentyFourHoursAgo;
            } else {
                 // MODE 2: CUSTOM RANGE (Strict Date Picker)
                 const startTs = new Date(dateRange.start).setHours(0,0,0,0);
                 const endTs = new Date(dateRange.end).setHours(23,59,59,999);
                 return t >= startTs && t <= endTs;
            }
        });
    }, [rawOrders, dateRange, showDelivered, isCustomDate]);


    // ✅ 4. PLOT MARKERS (Fixed Ghost Restaurants)
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;
        const map = mapInstance.current;

        // --- A. Restaurants (DERIVED STRICTLY FROM VISIBLE ORDERS) ---
        const uniqueRestaurants = new Map();
        
        // ❌ Removed: Object.entries(restaurants).forEach(...) which added everyone
        // ✅ Added: Loop through visibleOrders to find active restaurants only
        visibleOrders.forEach(order => {
            const loc = getCoordinates(order.pickupLocation);
            // Try to find config in cache, otherwise use order location
            const config = restaurants[order.pk];
            
            if (!uniqueRestaurants.has(order.pk)) {
                if (config) {
                    // Use Cached Config (Preferred)
                    uniqueRestaurants.set(order.pk, config);
                } else if (loc) {
                    // Fallback to Order Location
                    uniqueRestaurants.set(order.pk, { lat: loc.lat, lng: loc.lng, name: 'Restaurant' });
                }
            }
        });

        Object.values(restaurantMarkersRef.current).forEach(m => m.remove());
        restaurantMarkersRef.current = {};

        uniqueRestaurants.forEach((info, pk) => {
            const color = getRestaurantColor(pk); 
            const el = document.createElement('div');
            el.innerHTML = `🏪`; el.className = 'marker-restaurant';
            el.style.width = '40px'; el.style.height = '40px';
            el.style.borderRadius = '50%'; el.style.display = 'flex';
            el.style.justifyContent = 'center'; el.style.alignItems = 'center';
            el.style.backgroundColor = 'white'; el.style.border = `3px solid ${color}`;
            el.style.fontSize = '24px'; el.style.cursor = 'pointer';
            el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            el.style.transition = 'all 0.3s ease';

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                setFocusedRestaurant(prev => (prev === pk ? null : pk));
                setSelectedOrder(null);
            });
            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                setSelectedRestaurant({ pk, ...info });
                setSelectedOrder(null);
                setFocusedRestaurant(pk); 
                map.flyTo({ center: [info.lng, info.lat], zoom: 15 });
            });

            if (focusedRestaurant === pk) {
                el.style.transform = 'scale(1.3)';
                el.style.filter = `drop-shadow(0 0 15px ${color})`;
            }

            const marker = new maplibregl.Marker({ element: el }).setLngLat([info.lng, info.lat]).addTo(map);
            restaurantMarkersRef.current[pk] = marker;
        });

        // --- B. Orders ---
        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};

        visibleOrders.forEach(order => {
            const coords = getCoordinates(order.location);
            if (!coords) return;

            const isRelated = focusedRestaurant && order.pk === focusedRestaurant;
            const restColor = getRestaurantColor(order.pk);
            const isDelivered = order.orderStatus === 'DELIVERED';

            const el = document.createElement('div');
            el.innerHTML = isDelivered ? `📦` : `🚚`;
            el.className = isDelivered ? 'Order-delivered' : 'Order-delivering';
            el.style.width = '32px'; el.style.height = '32px';
            el.style.borderRadius = '50%'; el.style.display = 'flex';
            el.style.justifyContent = 'center'; el.style.alignItems = 'center';
            el.style.fontWeight = 'bold'; el.style.color = 'white'; el.style.cursor = 'pointer';
            el.style.transition = 'all 0.3s ease';
            el.style.backgroundColor = isDelivered ? '#22c55e' : '#fbbf24';
            
            if (isRelated) {
                el.style.border = `3px solid ${restColor}`;
                el.style.transform = 'scale(1.3)'; 
                el.style.zIndex = '50';
            } else {
                el.style.border = '3px solid white';
                el.style.transform = 'scale(1)';
            }
            el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

            const marker = new maplibregl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
            el.addEventListener('click', (e) => {
                 e.stopPropagation();
                 setSelectedOrder(order);
                 setSelectedRestaurant(null);
                 map.flyTo({ center: [coords.lng, coords.lat], zoom: 15 });
            });
            markersRef.current[order.sk] = marker;
        });

    }, [visibleOrders, focusedRestaurant, isMapReady, restaurants]); 

    // 5. GRID LIST
    const gridList = useMemo(() => {
        let origin = agentLocation || agentProfileLoc || { lat: 26.0935, lng: 50.4880 };
        if (isNaN(Number(origin.lat))) origin = { lat: 26.0935, lng: 50.4880 };

        return visibleOrders.map(order => {
            const dbDist = order.deliveryDistance ? `${order.deliveryDistance.toFixed(1)} km` : '--';
            const dbTime = order.deliveryDuration;
            const dest = getCoordinates(order.location);
            const sortDist = dest ? calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng) : 999;
            return { ...order, _dist: dbDist, _time: dbTime, _sortDist: sortDist }; 
        }).sort((a,b) => parseFloat(a._sortDist) - parseFloat(b._sortDist));
    }, [visibleOrders, agentLocation, agentProfileLoc]);

    // ... Actions ...
    const markAsDelivered = async (order) => {
        try {
            await client.models.BusinessData.update({ pk: order.pk, sk: order.sk, orderStatus: 'DELIVERED', deliveryAgentId: `AGENT#${agentPhone}` });
            await client.models.BusinessData.update({ pk: `AGENT#${agentPhone}`, sk: `AGENT#${agentPhone}`, location: order.location });
            const newLoc = getCoordinates(order.location);
            if (newLoc) setAgentProfileLoc(newLoc);
            setSelectedOrder(null);
        } catch (e) { alert(e.message); }
    };

    const openGoogleMaps = (lat, lng) => {
        if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    // HANDLE DATE CHANGE
    const handleDateChange = (field, value) => {
        setIsCustomDate(true); 
        setDateRange(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="h-screen flex flex-col bg-slate-900 relative overflow-hidden">
            {/* Header */}
            <div className="p-3 bg-slate-800 shadow-md z-[60] flex justify-between items-center shrink-0 border-b border-slate-700">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        {focusedRestaurant ? '📍 Related Orders' : '🚀 All Deliveries'}
                    </h1>
                    {agentLocation && <span className="text-[10px] text-green-400 font-mono">● GPS Active</span>}
                </div>
                <div className="flex gap-2 items-center">
                    {focusedRestaurant && <button onClick={() => setFocusedRestaurant(null)} className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-bold">Reset View</button>}
                    <button onClick={() => setIsGridOpen(!isGridOpen)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold shadow-lg">{isGridOpen ? 'Map View' : 'Order List'}</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative w-full h-full">
                <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
                
                {/* Checkbox Legend */}
                <div className="absolute bottom-8 left-4 z-[50]">
                    <div className="bg-white p-1 rounded-lg shadow-lg border border-slate-200 min-w-[140px]">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} className="w-3 h-3 rounded text-green-500 focus:ring-green-500 border-slate-300" />
                            <span className="text-lg">✅</span><span className="text-[10px] font-bold text-slate-700">DELIVERED</span>
                        </label>
                    </div>
                </div>

                {!isGridOpen && selectedRestaurant && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-xl shadow-2xl z-[60] animate-slide-up border-t-4 border-yellow-400">
                        <button onClick={() => openGoogleMaps(selectedRestaurant.lat, selectedRestaurant.lng)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"><span>🗺️ Navigate</span></button>
                    </div>
                )}
                {!isGridOpen && selectedOrder && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-xl shadow-2xl z-[60] animate-slide-up">
                        <div className="flex justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-slate-500">Customer:</span>
                                    <a href={`tel:${selectedOrder.phone}`} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">📞 +{selectedOrder.phone || 'Unknown'}</a>
                                </div>
                                <h3 className="font-bold text-slate-400">Order: {selectedOrder.sk.split('#')[1]} - [{selectedOrder.itemsNbr} Items]</h3>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center text-slate-500 font-bold">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { const c = getCoordinates(selectedOrder.location); openGoogleMaps(c?.lat, c?.lng); }} className="bg-blue-100 text-blue-700 py-3 rounded-lg font-bold">🗺️ Go</button>
                            {selectedOrder.orderStatus === 'DELIVERING' ? <button onClick={() => markAsDelivered(selectedOrder)} className="bg-green-600 text-white py-3 rounded-lg font-bold">📦 Delivered</button> : <button disabled className="bg-slate-100 text-slate-400 py-3 rounded-lg font-bold">✓ Done</button>}
                        </div>
                    </div>
                )}

                {/* Grid / Order List */}
                <div className={`absolute inset-0 bg-slate-900/95 z-[60] transition-transform duration-300 flex flex-col ${isGridOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="p-4 bg-slate-800 border-b border-slate-700 shadow-lg shrink-0">
                         <div className="flex justify-between items-center mb-3">
                             <h2 className="text-white font-bold text-lg">Daily Manifest</h2>
                             <div className="text-xs text-slate-400">{gridList.length} Orders</div>
                         </div>
                         <div className="flex gap-2">
                            <input 
                                type="date" 
                                value={dateRange.start} 
                                onChange={e => handleDateChange('start', e.target.value)} 
                                className="bg-slate-900 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500" 
                            />
                            <span className="text-white self-center">-</span>
                            <input 
                                type="date" 
                                value={dateRange.end} 
                                onChange={e => handleDateChange('end', e.target.value)} 
                                className="bg-slate-900 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500" 
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                        {gridList.length === 0 && <div className="text-center text-slate-500 mt-10">No orders found.</div>}
                        {gridList.map(order => (
                            <div key={order.sk} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${order.orderStatus === 'DELIVERED' ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
                                        {order.orderStatus === 'DELIVERED' ? '✓' : '🚚'}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-white font-bold whitespace-nowrap truncate">#{order.sk.split('#')[1]}</h4>
                                        <div className={`text-xs mt-0.5 font-bold ${order.orderStatus === 'DELIVERED' ? 'text-green-500' : 'text-amber-500'}`}>{order.orderStatus}</div>
                                    </div>
                                </div>
                                <div className="text-right min-w-[70px] shrink-0">
                                    {order._dist ? (<><div className="text-indigo-400 font-bold text-sm">{order._dist} km</div><div className="text-slate-500 text-xs font-mono mt-1">{formatTime(order._time)}</div></>) : (<div className="text-slate-600 text-xs italic">--</div>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
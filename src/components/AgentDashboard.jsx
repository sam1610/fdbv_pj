

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
// 🔥 Import outputs to force map config if needed
import outputs from '../../amplify_outputs.json'; 

// --- 🛠 HELPER: Robust Coordinate Parsing ---
const getCoordinates = (locationObj) => {
    if (!locationObj) return null;
    let data = locationObj;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return null; }
    }
    if (data.M) data = data.M;

    const extract = (val) => {
        if (val === undefined || val === null) return null;
        if (typeof val === 'object' && val.N) return parseFloat(val.N);
        return parseFloat(val);
    };

    const lat = extract(data.latitude || data.lat);
    const lng = extract(data.longitude || data.lng || data.long);

    if (isNaN(lat) || isNaN(lng) || !lat || !lng) return null;
    return { lat, lng };
};

// --- 🎨 HELPER: Generate Distinct Color ---
const getRestaurantColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`; 
};

const formatTime = (sec) => sec ? `${Math.round(sec / 60)} min` : '--';

const AgentDashboard = ({ agentPhone, initialLocation }) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});            
    const restaurantMarkersRef = useRef({});  

    const [agentLocation, setAgentLocation] = useState(null); 
    const [orders, setOrders] = useState([]);
    const [restaurants, setRestaurants] = useState({}); 
    
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [focusedRestaurant, setFocusedRestaurant] = useState(null);
    
    const [isGridOpen, setIsGridOpen] = useState(false);
    const [gridOrders, setGridOrders] = useState([]);
    const [loadingGrid, setLoadingGrid] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    const todayStr = new Date().toISOString().split('T')[0];
    const [dateRange, setDateRange] = useState({ start: todayStr, end: todayStr });

    // 0. HELPER: Load Restaurant Configs
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
            } catch (e) { console.error("Failed to load restaurant config", pk); }
        }));

        setRestaurants(prev => ({ ...prev, ...newCache }));
    }, [restaurants]);

    // 1. INITIALIZE MAP (With Explicit Config)
    useEffect(() => {
        if (mapInstance.current || !mapContainerRef.current) return;

        const startLoc = getCoordinates(initialLocation) || { lat: 26.0935, lng: 50.4880 };

        async function initMap() {
            try {
                const map = await createMap({
                    container: mapContainerRef.current,
                    center: [startLoc.lng, startLoc.lat],
                    zoom: 12,
                    attributionControl: false,
                    ...outputs.geo // 🔥 FORCE CONFIG INJECTION
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
                    console.log("✅ Map Fully Loaded");
                    geolocate.trigger();
                    setIsMapReady(true);
                });

            } catch (e) { console.error("Map Init Error:", e); }
        }
        initMap();
    }, [initialLocation]);

    // 2. FETCH DATA (Consolidated Logic)
    useEffect(() => {
        if (!agentPhone) return;

        const fetchData = async () => {
            try {
                // ✅ Fetch ALL orders first (just like the Grid) to avoid filter issues
                const { data } = await client.models.BusinessData.ByAgent({
                    gsi1pk: `AGENT#${agentPhone}`,
                    sk: { beginsWith: 'ORDER#' }
                });

                const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                
                // ✅ Client-Side Filter (Matches your Grid logic)
                const active = data.filter(o => {
                    const t = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
                    return ['DELIVERING', 'DELIVERED'].includes(o.orderStatus) && t > oneDayAgo;
                });

                console.log(`📥 Map Data: Fetched ${data.length}, Filtered to ${active.length} active orders`);
                setOrders(active);
                
                const initialPks = [...new Set(active.map(o => o.pk))];
                loadRestaurantConfigs(initialPks);

            } catch (e) { console.error("Map Fetch Error:", e); }
        };

        fetchData();

        // Subscription Handler
        const subFilter = { gsi1pk: { eq: `AGENT#${agentPhone}` } };
        
        const handleLiveEvent = (item) => {
            if (!item || !item.sk || !item.sk.startsWith('ORDER#')) return;

            setOrders(prev => {
                const existingOrder = prev.find(o => o.pk === item.pk && o.sk === item.sk);
                const others = prev.filter(o => o.pk !== item.pk || o.sk !== item.sk);
                
                // 🔥 MERGE FIX: Keep existing location/pickupLocation
                const mergedOrder = existingOrder ? { ...existingOrder, ...item } : item;

                if (['DELIVERING', 'DELIVERED'].includes(mergedOrder.orderStatus)) {
                    loadRestaurantConfigs([mergedOrder.pk]);
                    return [...others, mergedOrder];
                }
                return others;
            });
        };

        const createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({ next: handleLiveEvent });
        const updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({ next: handleLiveEvent });

        return () => { createSub.unsubscribe(); updateSub.unsubscribe(); };
    }, [agentPhone, loadRestaurantConfigs]);

    // 3. PLOT MARKERS
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;
        const map = mapInstance.current;

        console.log(`📍 Plotting: ${orders.length} orders`);

        // --- A. Plot Restaurants ---
        const uniqueRestaurants = new Map();
        
        // Priority 1: Config Cache
        Object.entries(restaurants).forEach(([pk, info]) => uniqueRestaurants.set(pk, info));

        // Priority 2: Order Pickup Location
        orders.forEach(order => {
            const loc = getCoordinates(order.pickupLocation);
            if (loc && !uniqueRestaurants.has(order.pk)) {
                uniqueRestaurants.set(order.pk, { lat: loc.lat, lng: loc.lng, name: 'Restaurant' });
            }
        });

        Object.values(restaurantMarkersRef.current).forEach(m => m.remove());
        restaurantMarkersRef.current = {};

        uniqueRestaurants.forEach((info, pk) => {
            const color = getRestaurantColor(pk); 
            const el = document.createElement('div');
            el.innerHTML = `<div style="font-size: 28px; filter: drop-shadow(0 0 2px ${color});">🏪</div>`; 
            el.className = 'marker-restaurant';
            el.style.width = '40px'; 
            el.style.height = '40px';
            el.style.borderRadius = '50%'; 
            el.style.display = 'flex';
            el.style.justifyContent = 'center'; 
            el.style.alignItems = 'center';
            el.style.backgroundColor = 'white'; 
            el.style.border = `3px solid ${color}`; // Always unique color
            el.style.fontSize = '24px';
            el.style.cursor = 'pointer';
            el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            el.style.transition = 'all 0.3s ease';

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                setFocusedRestaurant(prev => (prev === pk ? null : pk));
                setSelectedRestaurant(null);
                setSelectedOrder(null);
                map.flyTo({ center: [info.lng, info.lat], zoom: 13 });
            });

            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                setSelectedRestaurant({ pk, ...info });
                setSelectedOrder(null);
            });

            if (focusedRestaurant === pk) {
                el.style.transform = 'scale(1.3)';
                el.style.filter = `drop-shadow(0 0 15px ${color})`;
            }

            const marker = new maplibregl.Marker({ element: el }).setLngLat([info.lng, info.lat]).addTo(map);
            restaurantMarkersRef.current[pk] = marker;
        });

        // --- B. Plot Orders ---
        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};

        orders.forEach(order => {
            const coords = getCoordinates(order.location);
            if (!coords) {
                console.warn("⚠️ Order missing coords:", order.sk);
                return;
            }

            const isRelated = focusedRestaurant && order.pk === focusedRestaurant;
            // const isDimmed = focusedRestaurant && !isRelated;
            const restColor = getRestaurantColor(order.pk);

            const el = document.createElement('div');
            const isDelivered = order.orderStatus === 'DELIVERED';
            el.innerHTML = isDelivered ? `📦` : `🚚`;
            el.className = isDelivered ? 'Order-delivered' : 'Order-delivering';
            el.style.width = '32px'; el.style.height = '32px';
            el.style.borderRadius = '50%'; el.style.display = 'flex';
            el.style.justifyContent = 'center'; el.style.alignItems = 'center';
            el.style.fontWeight = 'bold'; el.style.color = 'white'; el.style.cursor = 'pointer';
            el.style.transition = 'all 0.3s ease';
            el.style.backgroundColor = isDelivered ? '#22c55e' : '#fbbf24';
            if (isRelated) {
                // If this order belongs to the clicked restaurant -> Match Restaurant Color
                el.style.border = `3px solid ${restColor}`;
                el.style.transform = 'scale(1.3)';
                el.style.zIndex = '50';
            } else {
                // Default -> White Border
                el.style.border = '3px solid white';
                el.style.transform = 'scale(1)';
            }

           
        el.style.opacity = '1'; // Never dim
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

    }, [orders, focusedRestaurant, isMapReady, restaurants]);

    // 4. GRID DATA
    useEffect(() => {
        if (!isGridOpen || !agentPhone) return;
        const fetchGridData = async () => {
            setLoadingGrid(true);
            try {
                const { data } = await client.models.BusinessData.ByAgent({
                    gsi1pk: `AGENT#${agentPhone}`,
                    sk: { beginsWith: 'ORDER#' }
                }); 

                const startTs = new Date(dateRange.start).setHours(0,0,0,0);
                const endTs = new Date(dateRange.end).setHours(23,59,59,999);
                const filtered = data.filter(o => {
                    const t = new Date(o.createdAt).getTime();
                    return t >= startTs && t <= endTs;
                }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                setGridOrders(filtered);

                if (filtered.length > 0 && client.queries?.optimizeDelivery) {
                    try {
                        const currentAgentLoc = agentLocation || (getCoordinates(initialLocation) || { lat: 0, lng: 0 });
                        const ordersPayload = filtered.map(o => ({
                            ...o, 
                            restaurantLocation: restaurants[o.pk] 
                                ? { latitude: restaurants[o.pk].lat, longitude: restaurants[o.pk].lng } 
                                : getCoordinates(o.pickupLocation) 
                        }));
                        const response = await client.queries.optimizeDelivery({
                            orders: JSON.stringify(ordersPayload),
                            agents: JSON.stringify([]), 
                            restaurantLocation: JSON.stringify({}),
                            agentLocation: JSON.stringify({ latitude: currentAgentLoc.lat, longitude: currentAgentLoc.lng })
                        });
                        const result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                        const metrics = result?.routeMetrics || [];
                        const ordersWithMetrics = filtered.map(order => {
                            const metric = metrics.find(m => m.orderId === order.sk);
                            return {
                                ...order,
                                _dist: metric?.distanceKm || order.deliveryDistance,
                                _time: metric?.durationSeconds || order.deliveryDuration
                            };
                        });
                        setGridOrders(ordersWithMetrics);
                    } catch (err) { console.warn("Route calc skipped", err); }
                }
            } catch(e) { console.error("Grid Fetch Error:", e); } 
            finally { setLoadingGrid(false); }
        };
        fetchGridData();
    }, [isGridOpen, dateRange, agentPhone, agentLocation, restaurants]);

    const markAsDelivered = async (order) => {
        try {
            await client.models.BusinessData.update({
                pk: order.pk, sk: order.sk, orderStatus: 'DELIVERED', deliveryAgentId: `AGENT#${agentPhone}`
            });
            setSelectedOrder(null);
        } catch (e) { alert(e.message); }
    };

    const openGoogleMaps = (lat, lng) => {
        if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    return (
        <div className="h-screen flex flex-col bg-slate-900 relative overflow-hidden">
            <style>{`
                @keyframes bounce-custom {
                    0%, 100% { transform: translateY(0) scale(1.3); }
                    50% { transform: translateY(-10px) scale(1.3); }
                }
                .animate-bounce-custom { animation: bounce-custom 1.5s infinite; }
            `}</style>
            
            {/* Header */}
            <div className="p-3 bg-slate-800 shadow-md z-[60] flex justify-between items-center shrink-0 border-b border-slate-700">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        {focusedRestaurant ? '📍 Related Orders' : '🚀 All Deliveries'}
                    </h1>
                    {agentLocation && <span className="text-[10px] text-green-400 font-mono">● GPS Active</span>}
                </div>
                <div className="flex gap-2">
                    {focusedRestaurant && <button onClick={() => setFocusedRestaurant(null)} className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-bold">Reset View</button>}
                    <button onClick={() => setIsGridOpen(!isGridOpen)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold shadow-lg">{isGridOpen ? 'Map View' : 'Order List'}</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative w-full h-full">
                <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
                {!isGridOpen && selectedRestaurant && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-xl shadow-2xl z-[60] animate-slide-up border-t-4 border-yellow-400">
                        <div className="flex justify-between items-center mb-4">
                            <div><h3 className="text-xl font-bold text-slate-900">🏪 {selectedRestaurant.name}</h3><p className="text-sm text-slate-500">Pickup Location</p></div>
                            <button onClick={() => setSelectedRestaurant(null)} className="bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center text-slate-500 font-bold hover:bg-slate-200">✕</button>
                        </div>
                        <button onClick={() => openGoogleMaps(selectedRestaurant.lat, selectedRestaurant.lng)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"><span>🗺️ Navigate</span></button>
                    </div>
                )}
               {/* 2. ORDER SHEET */}
                {!isGridOpen && selectedOrder && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-xl shadow-2xl z-[60] animate-slide-up">
                        <div className="flex justify-between mb-3">
                            <div>
                                
                                {/* ✅ ADDED CUSTOMER PHONE HERE */}
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-slate-500">Customer:</span>
                                    <a href={`tel:${selectedOrder.phone}`} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
                                        📞 +{selectedOrder.phone || 'Unknown'}
                                    </a>
                                </div>
                                <h3 className="font-bold text-slate-400">
                                    Order: {selectedOrder.sk.split('#')[1]} - [{selectedOrder.itemsNbr} Item(s)]
                                </h3>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center text-slate-500 font-bold">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { const c = getCoordinates(selectedOrder.location); openGoogleMaps(c?.lat, c?.lng); }} className="bg-blue-100 text-blue-700 py-3 rounded-lg font-bold">🗺️ Go</button>
                            {selectedOrder.orderStatus === 'DELIVERING' ? <button onClick={() => markAsDelivered(selectedOrder)} className="bg-green-600 text-white py-3 rounded-lg font-bold">📦 Delivered</button> : <button disabled className="bg-slate-100 text-slate-400 py-3 rounded-lg font-bold">✓ Done</button>}
                        </div>
                    </div>
                )}
                <div className={`absolute inset-0 bg-slate-900/95 z-[60] transition-transform duration-300 flex flex-col ${isGridOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="p-4 bg-slate-800 border-b border-slate-700 shadow-lg shrink-0">
                         <div className="flex justify-between items-center mb-3">
                             <h2 className="text-white font-bold text-lg">Daily Manifest</h2>
                             <div className="text-xs text-slate-400">{gridOrders.length} Orders</div>
                         </div>
                         <div className="flex gap-2">
                            <input type="date" value={dateRange.start} onChange={e => setDateRange(p=>({...p, start:e.target.value}))} className="bg-slate-900 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none" />
                            <input type="date" value={dateRange.end} onChange={e => setDateRange(p=>({...p, end:e.target.value}))} className="bg-slate-900 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                        {loadingGrid && <div className="text-center text-slate-400 mt-10">Calculating Routes...</div>}
                        {!loadingGrid && gridOrders.length === 0 && <div className="text-center text-slate-500 mt-10">No orders found.</div>}
                        {!loadingGrid && gridOrders.map(order => (
                            <div key={order.sk} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${order.orderStatus === 'DELIVERED' ? 'bg-green-900/40 text-green-400' : 'bg-blue-900/40 text-blue-400'}`}>
                                        {order.orderStatus === 'DELIVERED' ? '✓' : '🚚'}
                                    </div>
                                    <div><div className="flex items-center gap-2"><h4 className="text-white font-bold">#{order.sk.split('#')[1]}</h4></div><div className="text-xs text-slate-400 mt-0.5">{order.orderStatus}</div></div>
                                </div>
                                <div className="text-right min-w-[70px]">
                                    {order._dist ? <><div className="text-indigo-400 font-bold text-sm">{order._dist} km</div><div className="text-slate-500 text-xs font-mono mt-1">{formatTime(order._time)}</div></> : <div className="text-slate-600 text-xs italic">--</div>}
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


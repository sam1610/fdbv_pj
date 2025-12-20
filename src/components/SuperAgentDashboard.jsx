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
        const extract = (v) => {
            if (v && typeof v === 'object' && v.N) return parseFloat(v.N);
            return parseFloat(v);
        };
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

const SuperAgentDashboard = ({ agentPhone, businessLocation }) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});            
    const restaurantMarkersRef = useRef({});  

    const [agentLocation, setAgentLocation] = useState(null); 
    
    // ✅ DATA STATE
    const [rawOrders, setRawOrders] = useState([]); 
    const [restaurants, setRestaurants] = useState({}); 
    const [isLoading, setIsLoading] = useState(true);
    
    // ✅ VIEW STATE
    const [isHistoryMode, setIsHistoryMode] = useState(false); 
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [focusedRestaurant, setFocusedRestaurant] = useState(null);
    
    const [isGridOpen, setIsGridOpen] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [showDelivered, setShowDelivered] = useState(true);
    
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
                    zoom: 11, 
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

    // 2. ✅ FETCH & SUBSCRIBE (The Brute Force Reliable Method)
    useEffect(() => {
        if (!agentPhone) return;
        setIsLoading(true);

        const agentPk = `AGENT#${agentPhone}`;

        // A. INITIAL FETCH (Get everything right now)
        const fetchInitialData = async () => {
            try {
                // High limit (1000) to find orders buried in history
                const { data } = await client.models.BusinessData.list({
                    filter: {
                        or: [
                            { gsi1pk: { eq: agentPk } },        // My Assignments
                            { orderStatus: { eq: 'PREPARED' } } // Available Global
                        ]
                    },
                    limit: 1000 
                });
                
                // Safe Sort
                const validItems = data.filter(o => o && o.sk && o.sk.startsWith('ORDER#'));
                validItems.sort((a, b) => {
                    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return tB - tA;
                });

                setRawOrders(validItems);
                
                const uniquePks = [...new Set(validItems.map(o => o.pk))];
                loadRestaurantConfigs(uniquePks);
                setIsLoading(false);
            } catch (e) {
                console.error("Fetch Error:", e);
                setIsLoading(false);
            }
        };

        fetchInitialData();

        // B. REAL-TIME SUBSCRIPTION (Listen to EVERYTHING and filter locally)
        // This avoids "missed events" due to complex AppSync filters.
        const handleLiveEvent = (item) => {
            if (!item || !item.sk || !item.sk.startsWith('ORDER#')) return;

            setRawOrders(prev => {
                // 1. Does this item match my interest?
                const isMine = item.gsi1pk === agentPk;
                const isAvailable = item.orderStatus === 'PREPARED';
                const isRelevant = isMine || isAvailable;

                // 2. Remove existing version (if any)
                const others = prev.filter(o => o.pk !== item.pk || o.sk !== item.sk);

                // 3. Add new version (ONLY if relevant)
                if (isRelevant) {
                    // Lazy load config if it's a new restaurant
                    loadRestaurantConfigs([item.pk]);
                    // Add to top
                    const newList = [item, ...others];
                    // Re-sort to be safe
                    newList.sort((a, b) => {
                        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return tB - tA;
                    });
                    return newList;
                } else {
                    // If it WAS relevant but isn't anymore (e.g., someone else claimed it)
                    // We just return 'others', effectively removing it from the list.
                    return others;
                }
            });
        };

        const createSub = client.models.BusinessData.onCreate().subscribe({ 
            next: handleLiveEvent,
            error: (e) => console.error("Create Sub Error:", e)
        });
        const updateSub = client.models.BusinessData.onUpdate().subscribe({ 
            next: handleLiveEvent,
            error: (e) => console.error("Update Sub Error:", e)
        });

        // Fetch Agent Profile once
        const fetchProfile = async () => {
            try {
                const { data } = await client.models.BusinessData.listByBusiness({
                    pk: agentPk, sk: { eq: agentPk }
                });
                if (data[0]?.location) setAgentProfileLoc(getCoordinates(data[0].location));
            } catch(e) {}
        };
        fetchProfile();

        return () => { createSub.unsubscribe(); updateSub.unsubscribe(); };
    }, [agentPhone, loadRestaurantConfigs]);


    // 3. CLAIM ACTION (Updates GSI1PK -> Removes from "Global", Adds to "My")
    const claimOrder = async (order) => {
        if (!window.confirm("Claim this delivery?")) return;

        try {
            await client.models.BusinessData.update({
                pk: order.pk,
                sk: order.sk,
                gsi1pk: `AGENT#${agentPhone}`, 
                deliveryAgentId: `AGENT#${agentPhone}`,
                orderStatus: 'DELIVERING'
            }, {
                condition: { orderStatus: { eq: 'PREPARED' } }
            });
            alert("Order Claim Accepted! 🚀");
            setSelectedOrder(null);
        } catch (e) {
            console.error("Claim Failed", e);
            alert("⚠️ This order is no longer available.");
        }
    };

    const markAsDelivered = async (order) => {
        try {
            await client.models.BusinessData.update({ 
                pk: order.pk, sk: order.sk, 
                orderStatus: 'DELIVERED', 
                deliveryAgentId: `AGENT#${agentPhone}` 
            });
            // Update agent location
            await client.models.BusinessData.update({ 
                pk: `AGENT#${agentPhone}`, sk: `AGENT#${agentPhone}`, 
                location: order.location 
            });
            setSelectedOrder(null);
        } catch (e) { alert(e.message); }
    };

    // 4. UNIFIED FILTER (24h Window)
    const visibleOrders = useMemo(() => {
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        return rawOrders.filter(o => {
            // Safety Check for bad data
            if (!o) return false;

            // A. Checkbox Filter
            if (o.orderStatus === 'DELIVERED' && !showDelivered) return false;

            // B. Always show active/available (Critical)
            if (['DELIVERING', 'PREPARED'].includes(o.orderStatus)) return true;

            // C. 24h Filter (Unless History Mode is ON)
            if (!isHistoryMode) {
                const t = o.createdAt ? new Date(o.createdAt).getTime() : now;
                return t > twentyFourHoursAgo;
            }
            return true; 
        });
    }, [rawOrders, isHistoryMode, showDelivered]);


    // 5. PLOT MARKERS
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;
        const map = mapInstance.current;

        // A. Restaurants
        const uniqueRestaurants = new Map();
        visibleOrders.forEach(order => {
            const loc = getCoordinates(order.pickupLocation);
            const config = restaurants[order.pk];
            if (!uniqueRestaurants.has(order.pk)) {
                if (config) uniqueRestaurants.set(order.pk, config);
                else if (loc) uniqueRestaurants.set(order.pk, { lat: loc.lat, lng: loc.lng, name: 'Restaurant' });
            }
        });

        Object.values(restaurantMarkersRef.current).forEach(m => m.remove());
        restaurantMarkersRef.current = {};

        uniqueRestaurants.forEach((info, pk) => {
            const color = getRestaurantColor(pk); 
            const el = document.createElement('div');
            el.innerHTML = `🏪`; el.className = 'marker-restaurant';
            el.style.cssText = `width:40px;height:40px;border-radius:50%;display:flex;justify-content:center;align-items:center;background:white;border:3px solid ${color};font-size:24px;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,0.3);transition:all 0.3s ease;`;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                setFocusedRestaurant(prev => (prev === pk ? null : pk));
                setSelectedOrder(null);
            });
            
            const marker = new maplibregl.Marker({ element: el }).setLngLat([info.lng, info.lat]).addTo(map);
            restaurantMarkersRef.current[pk] = marker;
        });

        // B. Orders
        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};

        visibleOrders.forEach(order => {
            const coords = getCoordinates(order.location);
            if (!coords) return;

            const isRelated = focusedRestaurant && order.pk === focusedRestaurant;
            const restColor = getRestaurantColor(order.pk);
            
            const el = document.createElement('div');
            el.className = 'Order-Marker';
            el.style.cssText = `width:32px;height:32px;border-radius:50%;display:flex;justify-content:center;align-items:center;font-weight:bold;color:white;cursor:pointer;transition:all 0.3s ease;box-shadow:0 2px 4px rgba(0,0,0,0.3);`;
            
            if (order.orderStatus === 'PREPARED') {
                el.innerHTML = `👋`; 
                el.style.backgroundColor = '#3b82f6'; // Blue
            } else if (order.orderStatus === 'DELIVERING') {
                el.innerHTML = `🚚`; 
                el.style.backgroundColor = '#fbbf24'; // Orange
            } else {
                el.innerHTML = `📦`; 
                el.style.backgroundColor = '#22c55e'; // Green
            }

            if (isRelated) {
                el.style.border = `3px solid ${restColor}`;
                el.style.transform = 'scale(1.3)'; 
                el.style.zIndex = '50';
            } else {
                el.style.border = '3px solid white';
                el.style.transform = 'scale(1)';
            }

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

    // 6. GRID LIST
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

    const openGoogleMaps = (lat, lng) => {
        if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    return (
        <div className="h-screen flex flex-col bg-slate-900 relative overflow-hidden">
            {/* Header */}
            <div className="p-3 bg-slate-800 shadow-md z-[60] flex justify-between items-center shrink-0 border-b border-slate-700">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-2">
                        {focusedRestaurant ? '📍 Related Orders' : '🚀 Super Agent Portal'}
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
                
                {/* Legend */}
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
                            
                            {selectedOrder.orderStatus === 'DELIVERING' ? (
                                <button onClick={() => markAsDelivered(selectedOrder)} className="bg-green-600 text-white py-3 rounded-lg font-bold">📦 Delivered</button>
                            ) : selectedOrder.orderStatus === 'PREPARED' ? (
                                <button onClick={() => claimOrder(selectedOrder)} className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold shadow-lg animate-pulse">✋ Claim IT</button>
                            ) : (
                                <button disabled className="bg-slate-100 text-slate-400 py-3 rounded-lg font-bold">✓ Done</button>
                            )}
                        </div>
                    </div>
                )}

                {/* Grid / Order List */}
                <div className={`absolute inset-0 bg-slate-900/95 z-[60] transition-transform duration-300 flex flex-col ${isGridOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="p-4 bg-slate-800 border-b border-slate-700 shadow-lg shrink-0">
                         <div className="flex justify-between items-center mb-3">
                             <h2 className="text-white font-bold text-lg">Available Jobs</h2>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsHistoryMode(!isHistoryMode)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded border flex items-center gap-1 transition active:scale-95 ${isHistoryMode ? 'bg-indigo-900 border-indigo-700 text-indigo-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                                >
                                    {isHistoryMode ? 'Show Less (24h)' : 'Show All History'}
                                </button>
                                <div className="text-xs text-slate-400">{gridList.length} Orders</div>
                             </div>
                         </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                        {gridList.length === 0 && <div className="text-center text-slate-500 mt-10">No jobs found nearby.</div>}
                        
                        {gridList.map(order => (
                            <div key={order.sk} className={`bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm ${order.orderStatus === 'PREPARED' ? 'border-blue-500/50 bg-blue-900/10' : ''}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                                        order.orderStatus === 'DELIVERED' ? 'bg-green-900/40 text-green-400' : 
                                        order.orderStatus === 'PREPARED' ? 'bg-blue-600 text-white animate-bounce-slow' : 'bg-amber-900/40 text-amber-400'
                                    }`}>
                                        {order.orderStatus === 'DELIVERED' ? '✓' : order.orderStatus === 'PREPARED' ? '👋' : '🚚'}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-white font-bold whitespace-nowrap truncate">#{order.sk.split('#')[1]}</h4>
                                        <div className={`text-xs mt-0.5 font-bold ${
                                            order.orderStatus === 'DELIVERED' ? 'text-green-500' : 
                                            order.orderStatus === 'PREPARED' ? 'text-blue-400 uppercase tracking-wider' : 'text-amber-500'
                                        }`}>
                                            {order.orderStatus === 'PREPARED' ? 'AVAILABLE' : order.orderStatus}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right min-w-[70px] shrink-0">
                                    {order.orderStatus === 'PREPARED' ? (
                                        <button onClick={() => claimOrder(order)} className="text-xs bg-indigo-600 px-3 py-1 rounded text-white font-bold hover:bg-indigo-500">Claim it</button>
                                    ) : (
                                        order._dist ? (<><div className="text-indigo-400 font-bold text-sm">{order._dist} km</div><div className="text-slate-500 text-xs font-mono mt-1">{formatTime(order._time)}</div></>) : (<div className="text-slate-600 text-xs italic">--</div>)
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAgentDashboard;
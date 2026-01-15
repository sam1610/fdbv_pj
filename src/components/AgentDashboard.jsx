// AgentDashboard.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import outputs from '../../amplify_outputs.json'; 
// ✅ ADDED: AWS Location SDK Imports
import { LocationClient, BatchUpdateDevicePositionCommand } from "@aws-sdk/client-location";
import { fetchAuthSession } from 'aws-amplify/auth';

/* ------------------------------------------------------------------
   CONFIG
-------------------------------------------------------------------*/
const TRACKING_INTERVAL_MS = 20000;          
const MIN_MOVE_METERS = 15;                  

// --- 📏 HELPER: Haversine Distance (Display - KM) ---
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

// --- 📏 HELPER: Haversine Meters (Logic - Tracking) ---
// ✅ ADDED: Required for deciding when to push updates to AWS
const haversineMeters = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const c = s1 * s1 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
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

/* ------------------------------------------------------------------
   COMPONENT
-------------------------------------------------------------------*/
const AgentDashboard = ({ agentPhone, businessLocation , agentName}) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    
    const markersRef = useRef({});            
    const restaurantMarkersRef = useRef({});  
    const latestLocationRef = useRef(null);
    
    // ✅ ADDED: Refs for Tracking
    const agentMarkerRef = useRef(null); 
    const lastSentRef = useRef(null);    

    const [agentLocation, setAgentLocation] = useState(null); 
    
    // ✅ DATA STATE
    const [rawOrders, setRawOrders] = useState([]); 
    const [restaurants, setRestaurants] = useState({}); 
    
    // ✅ PAGINATION & VIEW STATE
    const [nextToken, setNextToken] = useState(null);
    const [isHistoryMode, setIsHistoryMode] = useState(false); 
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [focusedRestaurant, setFocusedRestaurant] = useState(null);
    
    const [isGridOpen, setIsGridOpen] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [showDelivered, setShowDelivered] = useState(true);
    
    const [agentProfileLoc, setAgentProfileLoc] = useState(null);
   
        console.log( "user Name :", agentName);
    
    // ------------------------------------------------------------
    // ✅ 1. TRACKER ID CONFIGURATION
    // ------------------------------------------------------------
    const trackerDeviceId = useMemo(() => {
        if (!agentPhone) return null;
        const clean = agentPhone.replace(/[^0-9]/g, '');
        return `AGENT_${clean}`;
    }, [agentPhone]);

    // ------------------------------------------------------------
    // ✅ 2. CSS INJECTION (For the Blue Dot Pulse)
    // ------------------------------------------------------------
    useEffect(() => {
        if (!document.getElementById('agent-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'agent-pulse-style';
            style.innerHTML = `
                @keyframes pulse-ring {
                    0% { transform: scale(0.5); opacity: 0.8; }
                    80% { transform: scale(2.5); opacity: 0; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .pulse-container { position: relative; display: flex; justify-content: center; align-items: center; }
                .pulse-ring {
                    position: absolute; width: 20px; height: 20px; border-radius: 50%;
                    background-color: rgba(59, 130, 246, 0.6); z-index: -1;
                    animation: pulse-ring 2s infinite cubic-bezier(0.455, 0.03, 0.515, 0.955);
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // ------------------------------------------------------------
    // 3. LOAD CONFIGS
    // ------------------------------------------------------------
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

    // ------------------------------------------------------------
    // 4. MAP INITIALIZATION & GPS
    // ------------------------------------------------------------
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
                    showUserLocation: false // We render our own marker
                });

                map.addControl(geolocate, 'bottom-right');
                map.on('click', () => {
                    setFocusedRestaurant(null);
                    setSelectedRestaurant(null);
                    setSelectedOrder(null);
                });
                
                // ✅ Update State when Geolocation fires
                geolocate.on('geolocate', (e) => {
                    setAgentLocation({ lat: e.coords.latitude, lng: e.coords.longitude });
                });
                
                map.on('load', () => {
                    geolocate.trigger(); // Start finding location immediately
                    setIsMapReady(true);
                });
            } catch (e) { console.error("Map Init Error:", e); }
        }
        initMap();
    }, [businessLocation]);

    // ------------------------------------------------------------
    // ✅ 5. VISUAL AGENT MARKER (The Blue Dot)
    // ------------------------------------------------------------
    useEffect(() => {
        if (!isMapReady || !agentLocation) return;
        const map = mapInstance.current;
        const markerHTML = `
            <div class="pulse-ring"></div>
            <div style="width:16px; height:16px; background:#3b82f6; border:2px solid white; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.3); z-index:2; position:relative;"></div>
        `;
        if (!agentMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'pulse-container';
            el.innerHTML = markerHTML;
            agentMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([agentLocation.lng, agentLocation.lat])
                .addTo(map);
            return;
        }
        // Smoothly animate to new position
        const marker = agentMarkerRef.current;
        const start = marker.getLngLat();
        const end = { lng: agentLocation.lng, lat: agentLocation.lat };
        let t = 0;
        const animate = () => {
            t += 0.05; 
            const lng = start.lng + (end.lng - start.lng) * t;
            const lat = start.lat + (end.lat - start.lat) * t;
            marker.setLngLat([lng, lat]);
            if (t < 1) requestAnimationFrame(animate);
        };
        animate();
    }, [agentLocation, isMapReady]);

     useEffect(() => {
        latestLocationRef.current = agentLocation;
    }, [agentLocation]);

    // ------------------------------------------------------------
    // ✅ 6. AWS TRACKER LOOP (Send Data to DeliveryOptimizer)
    // ------------------------------------------------------------
    useEffect(() => {
        if (!trackerDeviceId) return;
        
        const timer = setInterval(async () => {
            // Read from REF, not State
            const currentLoc = latestLocationRef.current;
            
            if (!currentLoc) return;
            
            // Jitter check using REF data
            if (lastSentRef.current && haversineMeters(lastSentRef.current, currentLoc) < MIN_MOVE_METERS) return;

            try {
                const session = await fetchAuthSession();
                const locClient = new LocationClient({
                    region: outputs.geo.aws_region,
                    credentials: session.credentials,
                });
                
                await locClient.send(new BatchUpdateDevicePositionCommand({
                    TrackerName: outputs.custom.amazon_location_service.trackers.default,
                    Updates: [{
                        DeviceId: trackerDeviceId,
                        Position: [currentLoc.lng, currentLoc.lat],
                        SampleTime: new Date(),
                    }],
                }));
                
                console.log(`📡 Tracker Sent: ${trackerDeviceId}`);
                lastSentRef.current = currentLoc; 
            } catch (e) { console.warn('Tracker update skipped', e); }
        }, TRACKING_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [trackerDeviceId]); // 🚨 REMOVED agentLocation from dependency

    // ------------------------------------------------------------
    // 7. FETCH DATA & SUBSCRIPTIONS
    // ------------------------------------------------------------
    const fetchOrders = async (token = null) => {
        if (!agentPhone) return;
        setIsLoadingMore(true);
        try {
            const { data, nextToken: newNextToken } = await client.models.BusinessData.ByAgent({
                gsi1pk: `AGENT#${agentPhone}`,
                sk: { beginsWith: 'ORDER#' },
                sortDirection: 'DESC',
                limit: token ? 10 : 20, 
                nextToken: token
            });

            const validOrders = data.filter(o => ['DELIVERING', 'DELIVERED'].includes(o.orderStatus));
            
            setRawOrders(prev => token ? [...prev, ...validOrders] : validOrders); 
            setNextToken(newNextToken);

            const initialPks = [...new Set(validOrders.map(o => o.pk))];
            loadRestaurantConfigs(initialPks);

            if (!token) {
                const { data: agentRecord } = await client.models.BusinessData.listByBusiness({
                    pk: `AGENT#${agentPhone}`, sk: { eq: `AGENT#${agentPhone}` }
                });
                if (agentRecord[0]?.location) {
                    const profLoc = getCoordinates(agentRecord[0].location);
                    if (profLoc) setAgentProfileLoc(profLoc);
                }
            }
        } catch (e) { console.error("Fetch Error:", e); }
        finally { setIsLoadingMore(false); }
    };

    useEffect(() => {
        fetchOrders(null); 

        const subFilter = { gsi1pk: { eq: `AGENT#${agentPhone}` } };
        const handleLiveEvent = (item) => {
            if (!item || !item.sk || !item.sk.startsWith('ORDER#')) return;
            setRawOrders(prev => {
                const existing = prev.find(o => o.pk === item.pk && o.sk === item.sk);
                const others = prev.filter(o => o.pk !== item.pk || o.sk !== item.sk);
                const merged = existing ? { ...existing, ...item } : item;
                
                if (['DELIVERING', 'DELIVERED'].includes(merged.orderStatus)) {
                    loadRestaurantConfigs([merged.pk]);
                    return [merged, ...others]; 
                }
                return others; 
            });
        };

        const createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({ next: handleLiveEvent });
        const updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({ next: handleLiveEvent });
        return () => { createSub.unsubscribe(); updateSub.unsubscribe(); };
    }, [agentPhone, loadRestaurantConfigs]);


    // 8. DATA HANDLERS
    const handleReset = () => {
        setIsHistoryMode(false);
        setNextToken(null);
        setRawOrders([]); 
        fetchOrders(null); 
    };

    const visibleOrders = useMemo(() => {
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        return rawOrders.filter(o => {
            if (o.orderStatus === 'DELIVERED' && !showDelivered) return false;
            if (!isHistoryMode) {
                const t = o.createdAt ? new Date(o.createdAt).getTime() : now;
                return t > twentyFourHoursAgo;
            }
            return true; 
        });
    }, [rawOrders, isHistoryMode, showDelivered]);


    // 9. PLOT ORDER & RESTAURANT MARKERS
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;
        const map = mapInstance.current;

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

    // 10. GRID LIST CALCULATION
    const gridList = useMemo(() => {
        let origin = agentLocation || agentProfileLoc || { lat: 26.0935, lng: 50.4880 };
        if (isNaN(Number(origin.lat))) origin = { lat: 26.0935, lng: 50.4880 };

        return visibleOrders.map(order => {
            const dbDist = order.deliveryDistance ? `${order.deliveryDistance.toFixed(1)}` : '--';
            const dbTime = order.deliveryDuration;
            const dest = getCoordinates(order.location);
            const sortDist = dest ? calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng) : 999;
            return { ...order, _dist: dbDist, _time: dbTime, _sortDist: sortDist }; 
        }).sort((a,b) => parseFloat(a._sortDist) - parseFloat(b._sortDist));
    }, [visibleOrders, agentLocation, agentProfileLoc]);

    // 11. ACTIONS
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

    const handleLoadMore = () => {
        setIsHistoryMode(true); 
        if (nextToken) fetchOrders(nextToken); 
    };

    return (
        <div className="h-screen flex flex-col bg-slate-900 relative overflow-hidden">
            {/* Header */}
            <div className="p-3 bg-slate-800 shadow-md z-[60] flex justify-between items-center shrink-0 border-b border-slate-700">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">
                        {agentName} <span className="text-sky-500">Live</span>
                    </h1>
                    {/* ✅ Visual Feedback for GPS */}
                    {agentLocation && <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> GPS Active
                    </span>}
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
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleReset}
                                    className="bg-red-900/50 hover:bg-red-800 text-red-300 text-xs font-bold px-3 py-1.5 rounded border border-red-800 flex items-center gap-1 transition active:scale-95"
                                >
                                    ↻ RESET (24h)
                                </button>
                                <div className="text-xs text-slate-400">{gridList.length} Orders</div>
                             </div>
                         </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                        {gridList.length === 0 && !isLoadingMore && <div className="text-center text-slate-500 mt-10">No recent orders found.</div>}
                        
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

                        <div className="pt-4 pb-8 flex justify-center">
                            {(nextToken || (!isHistoryMode && rawOrders.length > gridList.length)) && (
                                <button 
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-6 rounded-full border border-slate-600 text-sm flex items-center gap-2 transition-all active:scale-95 shadow-lg"
                                >
                                    {isLoadingMore ? <>Loading...</> : <>👇 MORE HISTORY (+10)</>}
                                </button>
                            )}
                            {isHistoryMode && !nextToken && gridList.length > 0 && (
                                <div className="text-slate-500 text-xs italic">All history loaded.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
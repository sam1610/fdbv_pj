// AgentDashboard.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import outputs from '../../amplify_outputs.json'; 
import { LocationClient, BatchUpdateDevicePositionCommand } from "@aws-sdk/client-location";
import { fetchAuthSession } from 'aws-amplify/auth';

/* ------------------------------------------------------------------
   CONFIG & HELPERS
-------------------------------------------------------------------*/
const TRACKING_INTERVAL_MS = 20000;          
const MIN_MOVE_METERS = 15;                  

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

const getRestaurantColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`; 
};

const formatTime = (sec) => sec ? `${Math.round(sec / 60)} min` : '--';

const formatPhone = (phone) => {
    if (!phone) return "Unknown";
    const clean = phone.replace(/\D/g, '');
    if (clean.length > 8) {
        return clean.replace(/(\d{3,4})(\d{4})(\d+)/, '+$1 $2 $3');
    }
    return '+' + clean;
};

const getTodayString = () => new Date().toISOString().split('T')[0];
const getPastDateString = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
};

/* ------------------------------------------------------------------
   CUSTOM COMPONENT: Range Calendar
-------------------------------------------------------------------*/
const RangeCalendar = ({ startDate, endDate, onChange }) => {
    const [viewDate, setViewDate] = useState(new Date(startDate || new Date()));

    useEffect(() => { if(startDate) setViewDate(new Date(startDate)); }, [startDate]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); 

    const handleDayClick = (day) => {
        const dateObj = new Date(year, month, day);
        const selectedStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        
        if (startDate && endDate && startDate !== endDate) {
            onChange(selectedStr, selectedStr); 
        } else if (startDate && !endDate) {
            if (selectedStr < startDate) onChange(selectedStr, startDate); 
            else onChange(startDate, selectedStr); 
        } else if (startDate && endDate === startDate) {
             if (selectedStr < startDate) onChange(selectedStr, startDate);
             else onChange(startDate, selectedStr);
        } else {
            onChange(selectedStr, selectedStr);
        }
    };

    const changeMonth = (delta) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-600 p-3 select-none">
            <div className="flex justify-between items-center mb-3">
                <button onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} className="text-slate-400 hover:text-white p-1">◀</button>
                <span className="text-white text-xs font-bold font-mono">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={(e) => { e.stopPropagation(); changeMonth(1); }} className="text-slate-400 hover:text-white p-1">▶</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[9px] text-slate-500 font-bold">{d}</div>)}
                {days.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isStart = currentStr === startDate;
                    const isEnd = currentStr === endDate;
                    const isInRange = startDate && endDate && currentStr > startDate && currentStr < endDate;
                    let bgClass = "hover:bg-slate-700 text-slate-300";
                    if (isStart || isEnd) bgClass = "bg-indigo-600 text-white font-bold shadow-md transform scale-110";
                    else if (isInRange) bgClass = "bg-indigo-900/50 text-indigo-200";
                    return (<button key={i} onClick={(e) => { e.stopPropagation(); handleDayClick(d); }} className={`h-7 w-7 rounded-full text-xs flex items-center justify-center transition-all ${bgClass}`}>{d}</button>);
                })}
            </div>
            <div className="mt-2 text-[9px] text-slate-500 text-center">{startDate === endDate ? "Select end date" : `${startDate} ➝ ${endDate}`}</div>
        </div>
    );
};

/* ------------------------------------------------------------------
   COMPONENT: AgentDashboard
-------------------------------------------------------------------*/
const AgentDashboard = ({ agentPhone, businessLocation , agentName}) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});            
    const restaurantMarkersRef = useRef({});  
    const latestLocationRef = useRef(null);
    const agentMarkerRef = useRef(null); 
    const lastSentRef = useRef(null);    

    const [agentLocation, setAgentLocation] = useState(null); 
    const [rawOrders, setRawOrders] = useState([]); 
    const [restaurants, setRestaurants] = useState({}); 
    const [dateFilter, setDateFilter] = useState({ start: getTodayString(), end: getTodayString(), label: 'Today' });
    const [isCalendarOpen, setIsCalendarOpen] = useState(false); 
    const [nextToken, setNextToken] = useState(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [focusedRestaurant, setFocusedRestaurant] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const [agentProfileLoc, setAgentProfileLoc] = useState(null);
    const [activeTooltipId, setActiveTooltipId] = useState(null); 
    const [orderItemsCache, setOrderItemsCache] = useState({}); 

    const trackerDeviceId = useMemo(() => {
        if (!agentPhone) return null;
        const clean = agentPhone.replace(/[^0-9]/g, '');
        return `AGENT_${clean}`;
    }, [agentPhone]);

    // CSS
    useEffect(() => {
        const styleId = 'agent-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `.maplibregl-popup { z-index: 2000 !important; max-width: 260px !important; } .maplibregl-popup-content { padding: 0 !important; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); } @keyframes pulse-ring { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } } .pulse-container { position: relative; } .pulse-ring { position: absolute; width: 20px; height: 20px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.6); animation: pulse-ring 2s infinite; }`;
            document.head.appendChild(style);
        }
    }, []);

    // Load Configs
    const loadRestaurantConfigs = useCallback(async (pks) => {
        const missingPks = pks.filter(pk => !restaurants[pk]);
        if (missingPks.length === 0) return;
        const newCache = { ...restaurants }; 
        await Promise.all(missingPks.map(async (pk) => {
            try {
                const { data } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
                const coords = getCoordinates(data?.location);
                if (coords) newCache[pk] = { lat: coords.lat, lng: coords.lng, name: data.name || 'Restaurant' };
            } catch (e) {}
        }));
        setRestaurants(prev => ({ ...prev, ...newCache }));
    }, [restaurants]);

    // Fetch Orders
    const fetchOrders = async (token = null, reset = false) => {
        if (!agentPhone) return;
        setIsLoadingMore(true);
        const startSK = `ORDER#${dateFilter.start}T00:00:00.000Z`;
        const endSK = `ORDER#${dateFilter.end}T23:59:59.999Z`;

        try {
            const { data, nextToken: newNextToken } = await client.models.BusinessData.ByAgent({
                gsi1pk: `AGENT#${agentPhone}`,
                sk: { between: [startSK, endSK] }, 
                sortDirection: 'DESC',
                limit: token ? 20 : 50, 
                nextToken: token
            });
            const validOrders = data.filter(o => ['DELIVERING', 'DELIVERED'].includes(o.orderStatus));
            setRawOrders(prev => (token && !reset) ? [...prev, ...validOrders] : validOrders); 
            setNextToken(newNextToken);
            loadRestaurantConfigs([...new Set(validOrders.map(o => o.pk))]);
            if (!token && !reset) {
                const { data: agentRecord } = await client.models.BusinessData.listByBusiness({ pk: `AGENT#${agentPhone}`, sk: { eq: `AGENT#${agentPhone}` } });
                if (agentRecord[0]?.location) setAgentProfileLoc(getCoordinates(agentRecord[0].location));
            }
        } catch (e) { console.error(e); } finally { setIsLoadingMore(false); }
    };

    useEffect(() => { fetchOrders(null, true); }, [dateFilter]); 

    // Live Sub
    useEffect(() => {
        const today = getTodayString();
        if (dateFilter.end < today || dateFilter.start > today) return;
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
    }, [agentPhone, dateFilter, loadRestaurantConfigs]);

    // Presets
    const setPreset = (type) => {
        const today = getTodayString();
        if (type === 'Today') setDateFilter({ start: today, end: today, label: 'Today' });
        if (type === 'Yesterday') { const y = getPastDateString(1); setDateFilter({ start: y, end: y, label: 'Yesterday' }); }
        if (type === 'Week') setDateFilter({ start: getPastDateString(6), end: today, label: 'Week' });
        setIsCalendarOpen(false); 
    };

    const handleCalendarChange = (s, e) => {
        setDateFilter({ start: s, end: e || s, label: 'Custom' });
    };

   
   // Item Fetcher
   const fetchOrderItems = async (order) => {
        if (orderItemsCache[order.sk]) return orderItemsCache[order.sk];
        try {
            const phoneNbrPk = order.pk.split('#')[1]; // Perfectly extracts +97317620635
            const orderIdPart = order.sk.replace('ORDER#', ''); // Keeps Timestamp AND UUID

            const { data: lineItems } = await client.models.BusinessData.listByBusiness({
                pk: `ORDER#${phoneNbrPk}#${orderIdPart}`,
                sk: { beginsWith: 'ITEM#' },
            });
            
            setOrderItemsCache(prev => ({ ...prev, [order.sk]: lineItems }));
            return lineItems;
        } catch (err) { 
            console.error("Item fetch error", err); 
            return []; 
        }
    };

    const handleOrderClick = async (e, order) => {
        e.stopPropagation(); 
        if (activeTooltipId === order.sk) { setActiveTooltipId(null); return; }
        setActiveTooltipId(order.sk);
        await fetchOrderItems(order);
    };

    // Map Init
    useEffect(() => {
        if (mapInstance.current || !mapContainerRef.current) return;
        const startLoc = getCoordinates(businessLocation) || { lat: 26.0935, lng: 50.4880 };
        createMap({
            container: mapContainerRef.current, center: [startLoc.lng, startLoc.lat], zoom: 12, attributionControl: false, ...outputs.geo
        }).then(map => {
            mapInstance.current = map;
            const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: false });
            map.addControl(geo, 'bottom-right');
            // ✅ GLOBAL CLICK HANDLER on Map
            map.on('click', () => { 
                setFocusedRestaurant(null); 
                setSelectedOrder(null); 
                setActiveTooltipId(null); 
                setIsMenuOpen(false); // Close menu
            });
            geo.on('geolocate', (e) => setAgentLocation({ lat: e.coords.latitude, lng: e.coords.longitude }));
            map.on('load', () => { geo.trigger(); setIsMapReady(true); });
        });
    }, [businessLocation]);

    // Agent Marker
    useEffect(() => {
        if (!isMapReady || !agentLocation) return;
        const map = mapInstance.current;
        if (!agentMarkerRef.current) {
            const el = document.createElement('div'); el.className = 'pulse-container';
            el.innerHTML = `<div class="pulse-ring"></div><div style="width:16px;height:16px;background:#3b82f6;border:2px solid white;border-radius:50%;"></div>`;
            agentMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([agentLocation.lng, agentLocation.lat]).addTo(map);
        } else agentMarkerRef.current.setLngLat([agentLocation.lng, agentLocation.lat]);
        latestLocationRef.current = agentLocation;
    }, [agentLocation, isMapReady]);

    // Tracking
    useEffect(() => {
        if (!trackerDeviceId) return;
        const interval = setInterval(async () => {
            const loc = latestLocationRef.current;
            if (loc && (!lastSentRef.current || haversineMeters(lastSentRef.current, loc) > MIN_MOVE_METERS)) {
                try {
                    const session = await fetchAuthSession();
                    const client = new LocationClient({ region: outputs.geo.aws_region, credentials: session.credentials });
                    await client.send(new BatchUpdateDevicePositionCommand({ TrackerName: outputs.custom.amazon_location_service.trackers.default, Updates: [{ DeviceId: trackerDeviceId, Position: [loc.lng, loc.lat], SampleTime: new Date() }] }));
                    lastSentRef.current = { ...loc, timestamp: Date.now() };
                } catch(e){}
            }
        }, TRACKING_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [trackerDeviceId]);

    // Render Markers
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;
        const map = mapInstance.current;
        
        Object.values(restaurantMarkersRef.current).forEach(m => m.remove());
        Object.values(markersRef.current).forEach(m => m.remove());
        
        const uniqueRest = new Map();
        rawOrders.forEach(o => {
            const loc = getCoordinates(o.pickupLocation);
            if (!uniqueRest.has(o.pk) && (restaurants[o.pk] || loc)) {
                uniqueRest.set(o.pk, restaurants[o.pk] || { lat: loc.lat, lng: loc.lng });
            }
        });
        
        uniqueRest.forEach((inf, pk) => {
            const color = getRestaurantColor(pk);
            const el = document.createElement('div');
            el.innerHTML = `🏪`; el.style.cssText = `width:36px;height:36px;background:white;border:3px solid ${color};border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:20px;cursor:pointer;`;
            if(focusedRestaurant === pk) el.style.transform = 'scale(1.2)';
            el.onclick = (e) => { e.stopPropagation(); setFocusedRestaurant(prev => prev===pk ? null : pk); };
            restaurantMarkersRef.current[pk] = new maplibregl.Marker({ element: el }).setLngLat([inf.lng, inf.lat]).addTo(map);
        });

        rawOrders.forEach(o => {
            const c = getCoordinates(o.location);
            if (!c) return;
            const isDelivered = o.orderStatus === 'DELIVERED';
            const el = document.createElement('div');
            el.innerHTML = isDelivered ? `📦` : `🚚`;
            el.style.cssText = `width:28px;height:28px;background:${isDelivered?'#22c55e':'#fbbf24'};border:2px solid white;border-radius:50%;display:flex;justify-content:center;align-items:center;cursor:pointer;`;
            if(focusedRestaurant && o.pk === focusedRestaurant) { el.style.border = `2px solid ${getRestaurantColor(o.pk)}`; el.style.transform = 'scale(1.2)'; }
            
            const shortId = (o.sk || "").replace('ORDER#', '').split('-').slice(0, 3).join('-');
            const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`<div class="p-2 text-xs">Loading...</div>`);
            
            const marker = new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).setPopup(popup).addTo(map);

            el.onclick = async (e) => {
                e.stopPropagation(); 
                setSelectedOrder(o); 
                setFocusedRestaurant(null);
                setActiveTooltipId(null);
                
                map.flyTo({ center: [c.lng, c.lat], zoom: 15 });
                marker.togglePopup(); 

                const items = await fetchOrderItems(o);
                const itemsHtml = items.length ? items.map(i => `
                    <div style="display:flex;justify-content:space-between;border-bottom:1px dashed #e2e8f0;padding:4px 0;font-size:11px;">
                        <span style="color:#334155; max-width:80%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i.name}</span>
                        <strong style="color:#0f172a;">x${i.quantity || 1}</strong>
                    </div>
                `).join('') : '<div style="color:#94a3b8;font-style:italic;font-size:10px;">No items found</div>';

                popup.setHTML(`
                    <div style="font-family:sans-serif; min-width:200px; background:white; padding:0;">
                        <div style="background:${isDelivered?'#f0fdf4':'#eff6ff'}; padding:8px 10px; border-bottom:1px solid ${isDelivered?'#bbf7d0':'#bfdbfe'}; display:flex; justify-content:space-between; align-items:center;">
                            <b style="color:#1e293b; font-size:13px;">${shortId}</b> 
                            <span style="font-size:14px;">${isDelivered?'✅':'🚚'}</span>
                        </div>
                        <div style="padding: 8px 10px; max-height:160px; overflow-y:auto;">${itemsHtml}</div>
                    </div>
                `);
            };
            markersRef.current[o.sk] = marker;
        });
    }, [rawOrders, focusedRestaurant, isMapReady, restaurants]);

    const gridList = useMemo(() => {
        const origin = agentLocation || agentProfileLoc || { lat: 26.0, lng: 50.5 };
        return rawOrders.map(o => ({
            ...o, _dist: o.deliveryDistance ? `${o.deliveryDistance.toFixed(1)} km` : '--', _time: o.deliveryDuration,
            _sort: getCoordinates(o.location) ? calculateDistance(origin.lat, origin.lng, getCoordinates(o.location).lat, getCoordinates(o.location).lng) : 999
        })).sort((a,b) => a._sort - b._sort);
    }, [rawOrders, agentLocation, agentProfileLoc]);

    // Actions
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

    const handleLoadMore = () => { if (nextToken) fetchOrders(nextToken); };

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-900 relative overflow-hidden">
            {/* FLOATING HEADER */}
            <div className="absolute top-4 left-4 right-4 z-[3000] flex justify-between pointer-events-none">
                <button onClick={() => setIsMenuOpen(prev => !prev)} className="pointer-events-auto bg-slate-800/90 text-white p-3 rounded-full shadow-xl border border-slate-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                {agentLocation && <div className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 shadow-lg flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="text-[10px] text-green-400 font-bold">LIVE</span></div>}
            </div>

            {/* MAP CONTAINER */}
            <div className="flex-1 relative w-full h-full">
                <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
                
                {/* ACTION CARD - Boosted Z-Index & Padding for Phone Edge */}
                {selectedOrder && (
                    <div className="absolute bottom-10 md:bottom-12 left-4 right-4 z-[3000] animate-slide-up flex justify-center pointer-events-auto">
                        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 flex items-stretch w-full max-w-md">
                            <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
                                <div className="flex justify-between mb-2">
                                    <h3 className="font-black text-slate-800 text-xl">#{selectedOrder.sk.split('#')[1].slice(-4)}</h3>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedOrder.orderStatus === 'DELIVERING' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{selectedOrder.orderStatus}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <a href={`tel:${formatPhone(selectedOrder.phone)}`} className="bg-slate-50 hover:bg-blue-50 p-2 rounded-xl flex items-center gap-2 border border-transparent hover:border-blue-100">
                                        <span className="text-lg">📞</span>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Customer</span>
                                            <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{formatPhone(selectedOrder.phone)}</span>
                                        </div>
                                    </a>
                                    <div className="bg-slate-50 p-2 rounded-xl flex items-center gap-2">
                                        <span className="text-lg">🍔</span><div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400">ITEMS</span><span className="text-xs font-bold text-slate-700">{selectedOrder.itemsNbr || 1} Total</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-px bg-slate-100 my-4"></div>
                            <div className="w-20 flex flex-col shrink-0">
                                <button onClick={() => window.open(`http://maps.google.com/maps?daddr=${getCoordinates(selectedOrder.location)?.lat},${getCoordinates(selectedOrder.location)?.lng}`)} className="flex-1 flex flex-col items-center justify-center hover:bg-blue-50 border-b border-slate-100">
                                    <span className="text-2xl">🗺️</span><span className="text-[9px] font-black text-slate-400">GO</span>
                                </button>
                                {selectedOrder.orderStatus === 'DELIVERING' ? (
                                    <button onClick={async () => {
                                        try {
                                            await client.models.BusinessData.update({ pk: selectedOrder.pk, sk: selectedOrder.sk, orderStatus: 'DELIVERED', deliveryAgentId: `AGENT#${agentPhone}` });
                                            await client.models.BusinessData.update({ pk: `AGENT#${agentPhone}`, sk: `AGENT#${agentPhone}`, location: selectedOrder.location });
                                            setSelectedOrder(null);
                                        } catch(e){ alert("Error"); }
                                    }} className="flex-1 flex flex-col items-center justify-center hover:bg-green-50 text-green-600"><span className="text-2xl">🎁</span><span className="text-[9px] font-black">DONE</span></button>
                                ) : (<div className="flex-1 flex flex-col items-center justify-center opacity-40"><span className="text-2xl">✅</span><span className="text-[9px]">SENT</span></div>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SIDE MENU - Z-Index 4000 (Over map popups) */}
            <div className={`fixed inset-0 z-[4000] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
                <div className={`absolute top-0 bottom-0 left-0 w-80 bg-slate-900 border-r border-slate-700 shadow-2xl transform transition-transform duration-300 flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 border-b border-slate-700 bg-slate-800">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{agentName || 'Agent'}</h2>
                        <div className="flex gap-4 mt-6">
                            <div className="flex-1 bg-slate-700/50 p-3 rounded-xl border border-slate-600"><div className="text-[10px] text-slate-400 font-bold uppercase">Orders</div><div className="text-xl font-bold text-white">{rawOrders.length}</div></div>
                            <div className="flex-1 bg-slate-700/50 p-3 rounded-xl border border-slate-600"><div className="text-[10px] text-slate-400 font-bold uppercase">Status</div><div className="text-xl font-bold text-emerald-400">Online</div></div>
                        </div>
                    </div>

                    <div className="p-4 border-b border-slate-700 bg-slate-800/50 space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date Filter</h3>
                        <div className="flex gap-2">
                            {['Today', 'Yesterday', 'Week'].map(l => (
                                <button key={l} onClick={() => setPreset(l)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase border ${dateFilter.label === l ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>{l}</button>
                            ))}
                        </div>
                        
                        <div onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center justify-between bg-slate-900 rounded-xl border border-slate-600 p-3 cursor-pointer hover:border-indigo-500 transition-colors">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📅</span>
                                <div className="flex flex-col"><span className="text-[9px] text-slate-400 font-bold uppercase">Selected Range</span><span className="text-xs text-white font-bold font-mono">{dateFilter.start === dateFilter.end ? dateFilter.start : `${dateFilter.start} ➝ ${dateFilter.end}`}</span></div>
                            </div>
                            <span className={`text-slate-400 transform transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCalendarOpen ? 'max-h-80 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                            <RangeCalendar startDate={dateFilter.start} endDate={dateFilter.end} onChange={handleCalendarChange} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Manifest</h3>
                        {gridList.length === 0 && !isLoadingMore && <div className="text-center text-slate-600 italic text-sm py-8">No orders found.</div>}
                        {gridList.map(o => (
                            <div key={o.sk} onClick={(e) => handleOrderClick(e, o)} className="relative bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all active:bg-slate-700">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${o.orderStatus === 'DELIVERED' ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>{o.orderStatus === 'DELIVERED' ? '✓' : '🚚'}</div>
                                        <div className="flex flex-col">
                                            <h4 className="text-white font-bold text-sm">#{o.sk.split('#')[1].slice(-4)}</h4>
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatPhone(o.phone)}</div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="text-indigo-400 font-bold text-sm">{o._dist}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">{formatTime(o._time)}</div>
                                    </div>
                                </div>
                                {/* Tooltip Z-Index 5000 */}
                                {activeTooltipId === o.sk && (
                                    <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-slate-700 p-3 rounded-lg shadow-2xl border border-slate-600 z-[5000] animate-fade-in cursor-default">
                                        <div className="absolute -top-1.5 left-6 w-3 h-3 bg-slate-700 border-l border-t border-slate-600 transform rotate-45"></div>
                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Order Items</h5>
                                        {orderItemsCache[o.sk] ? (
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                {orderItemsCache[o.sk].length > 0 ? orderItemsCache[o.sk].map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs text-slate-300 border-b border-slate-600/50 pb-1 last:border-0"><span>{item.name}</span><span className="font-bold text-white">x{item.quantity || 1}</span></div>
                                                )) : <div className="text-[10px] text-slate-500 italic">No items found</div>}
                                            </div>
                                        ) : <div className="text-[10px] text-slate-400 animate-pulse">Loading details...</div>}
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); setIsMenuOpen(false); const c=getCoordinates(o.location); if(mapInstance.current && c) mapInstance.current.flyTo({center:[c.lng, c.lat],zoom:15}); }} className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-2 rounded uppercase tracking-wide">View on Map</button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {nextToken && <div className="pt-4 flex justify-center"><button onClick={handleLoadMore} disabled={isLoadingMore} className="text-slate-400 hover:text-white text-xs font-bold py-2 border-b border-slate-600">Load More</button></div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
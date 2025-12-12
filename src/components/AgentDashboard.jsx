import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import { getCurrentUser } from 'aws-amplify/auth';

const AgentDashboard = ({ agentPhone, agentEmail }) => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});

    // --- Original State ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // --- NEW: History State ---
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // Default: Last 7 days
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    console.log("Agent Phone:", agentPhone);

    // --- 1. EXISTING: Real-time Logic (Untouched) ---
    // --- 2. Map Logic (Real-time + 24h Filter) ---
  useEffect(() => {
    if (!agentPhone) return;

    // Filter to listen only to events for THIS agent
    const subFilter = { gsi1pk: { eq: `AGENT#${agentPhone}` } };

    let createSub, updateSub;

    const fetchAndSubscribe = async () => {
      setLoading(true);
      try {
        // A. QUERY: Fetch orders assigned to this agent
        const { data } = await client.models.BusinessData.ByAgent({
           gsi1pk: `AGENT#${agentPhone}`,
           sk: { beginsWith: 'ORDER#' },
        });

        // Define 24-hour cutoff
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        // B. FILTER: Keep only Active/Delivered AND within last 24h
        const recentOrders = data.filter(o => {
            const isRelevantStatus = o.orderStatus === 'DELIVERING' || o.orderStatus === 'DELIVERED';
            
            // Safety check: ensure createdAt exists, otherwise assume it's new
            const orderDate = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
            const isRecent = orderDate > oneDayAgo;

            return isRelevantStatus && isRecent;
        });

        setOrders(recentOrders);
        setLoading(false);

        // C. SUBSCRIPTION: Handle real-time updates
        const handleEvent = (item) => {
            if (!item.sk.startsWith('ORDER#')) return;

            setOrders(prev => {
                // 1. Always remove the item first (to avoid duplicates or update stale data)
                const others = prev.filter(o => !(o.pk === item.pk && o.sk === item.sk));
                
                // 2. Check if we should add it back
                const itemDate = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
                const isRecent = itemDate > (Date.now() - (24 * 60 * 60 * 1000));
                const isRelevantStatus = ['DELIVERING', 'DELIVERED'].includes(item.orderStatus);

                // 3. Only add if it meets criteria
                if (isRecent && isRelevantStatus) {
                    return [...others, item];
                }
                
                // If it's old or cancelled, it stays removed
                return others; 
            });
        };

        // Subscribe to Create (New assignments)
        createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
            next: handleEvent,
            error: (e) => console.error("Create Sub Error", e)
        });

        // Subscribe to Update (Status changes)
        updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
            next: handleEvent,
            error: (e) => console.error("Update Sub Error", e)
        });

      } catch (error) {
        console.error("Agent Dashboard Error:", error);
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
        if (createSub) createSub.unsubscribe();
        if (updateSub) updateSub.unsubscribe();
    };
  }, [agentPhone]);

    // --- 2. EXISTING: Map Logic (Untouched) ---
    useEffect(() => {
        async function initMap() {
            if (mapInstance.current) return;
            try {
                const map = await createMap({
                    container: mapContainerRef.current,
                    center: [50.5860, 26.2285],
                    zoom: 11,
                    attributionControl: false
                });
                mapInstance.current = map;
                map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
                map.addControl(new maplibregl.GeolocateControl({
                    positionOptions: { enableHighAccuracy: true },
                    trackUserLocation: true
                }), 'bottom-right');
            } catch (e) { console.error(e); }
        }
        initMap();
    }, []);

    // --- 3. EXISTING: Plot Orders (Untouched) ---
    useEffect(() => {
        if (!mapInstance.current || orders.length === 0) return;

        const map = mapInstance.current;
        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};

        orders.forEach((order) => {
            let loc = order.location;
            if (typeof loc === 'string') loc = JSON.parse(loc);
            const lat = parseFloat(loc.latitude?.N || loc.latitude);
            const lng = parseFloat(loc.longitude?.N || loc.longitude);

            if (!lat || !lng) return;

            const isDelivered = order.orderStatus === 'DELIVERED';
            const el = document.createElement('div');
            el.className = isDelivered ? 'Order-delivered' : 'Order-delivering';

            el.innerHTML = isDelivered
                ? `<span style="font-size:20px; color:white;">✓</span>`
                : `<span style="font-size:20px;">📦</span>`;

            el.style.backgroundColor = isDelivered ? '#22c55e' : '#fbbf24';
            el.style.width = '36px';
            el.style.height = '36px';
            el.style.borderRadius = '50%';
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
            el.style.border = '3px solid white';
            el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            el.style.cursor = 'pointer';
            el.style.transition = 'all 0.3s ease';

            const cleanId = order.sk.split('#')[1] || order.sk;
            const customerPhone = order.gsi2pk?.split('#')[2] || 'Unknown';
            const itemCount = order.itemsNbr || 0;

            const popupContent = `
            <div style="font-family: sans-serif; padding: 5px; min-width: 140px;">
                <h3 style="margin: 0 0 5px 0; color: #1e293b; font-size: 14px;">Order #${cleanId}</h3>
                <div style="font-size: 12px; color: #475569; line-height: 1.4;">
                    <div>👤 <strong>Customer:</strong> ${order.name || 'Guest'}</div>
                    <div>📞 <strong>Phone:</strong> ${customerPhone}</div>
                    <div>📦 <strong>Items:</strong> ${itemCount}</div>
                </div>
            </div>
        `;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(
                    new maplibregl.Popup({ offset: 25, closeButton: false })
                        .setHTML(popupContent)
                )
                .addTo(map);

            el.addEventListener('click', () => {
                setSelectedOrder(order);
                marker.togglePopup();
                map.flyTo({ center: [lng, lat], zoom: 15 });
            });

            markersRef.current[order.sk] = marker;
        });
    }, [orders]);

    // --- 4. EXISTING: Actions ---
    const markAsDelivered = async (order) => {
        if (order.orderStatus === 'DELIVERED') return;
        try {
            await client.models.BusinessData.update({
                pk: order.pk,
                sk: order.sk,
                orderStatus: 'DELIVERED',
                deliveryAgentId: `AGENT#${agentPhone}`
            });
            setSelectedOrder(null);
        } catch (e) {
            alert("Error updating order: " + e.message);
        }
    };

    const openGoogleMaps = (order) => {
        let loc = order.location;
        if (typeof loc === 'string') loc = JSON.parse(loc);
        const lat = parseFloat(loc.latitude?.N || loc.latitude);
        const lng = parseFloat(loc.longitude?.N || loc.longitude);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    // --- NEW: History Fetcher ---
    const fetchHistory = async () => {
        if (!agentPhone) return;
        setLoadingHistory(true);
        try {
            // Fetch all orders for agent (we filter by date in memory for simplicity 
            // unless your SK allows 'between' queries directly)
            const { data } = await client.models.BusinessData.ByAgent({
                gsi1pk: `AGENT#${agentPhone}`,
                sk: { beginsWith: 'ORDER#' }
            });
            
            // Client-side date filtering
            const start = new Date(dateRange.start).getTime();
            const end = new Date(dateRange.end).getTime() + (86400000); // Include the full end day

            const filtered = data.filter(item => {
                const itemDate = new Date(item.createdAt).getTime(); // Ensure your model has createdAt
                return itemDate >= start && itemDate <= end;
            });

            // Sort by newest first
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setHistoryOrders(filtered);
        } catch (e) {
            console.error("History Fetch Error", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Trigger fetch when view opens
    useEffect(() => {
        if (isHistoryOpen) {
            fetchHistory();
        }
    }, [isHistoryOpen, dateRange]);


    return (
        <div className="h-screen flex flex-col bg-slate-900 overflow-hidden relative">
            {/* Header */}
            <div className="p-2 bg-slate-800 shadow-md z-10 flex justify-between items-center shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-white">🚀 Deliveries</h1>
                    <span className="text-xs text-slate-400 font-mono tracking-wide">
                        {agentPhone || 'Unknown Phone'}
                    </span>
                </div>

                <div className="flex gap-2 items-center">
                    {/* NEW: History Toggle Button */}
                    <button
                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                        className={`px-3 py-1 rounded-full text-sm font-bold border transition ${
                            isHistoryOpen 
                            ? 'bg-indigo-500 text-white border-indigo-500' 
                            : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                        }`}
                    >
                        {isHistoryOpen ? 'Close History' : 'History 📅'}
                    </button>

                    <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold hidden sm:block">
                        {orders.filter(o => o.orderStatus === 'DELIVERED').length} Done
                    </div>
                    <div className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold hidden sm:block">
                        {orders.filter(o => o.orderStatus === 'DELIVERING').length} Active
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative w-full h-full">
                
                {/* 1. Map Layer (Always rendered, hidden visually if History is opaque) */}
                <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

                {/* 2. Current Order Bottom Sheet (Only shows if NOT in history mode) */}
                {!isHistoryOpen && selectedOrder && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-5 rounded-t-2xl shadow-2xl animate-slide-up z-20">
                         <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <a
                                        href={`tel:${selectedOrder.gsi2pk?.split('#')[2]}`}
                                        className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-bold text-sm hover:bg-blue-200 transition shadow-sm"
                                    >
                                        Customer:📞  {selectedOrder.gsi2pk?.split('#')[2] || 'No Phone'}
                                    </a>
                                    <span className="text-slate-600 font-medium">
                                        [{selectedOrder.itemsNbr || 0} item(s)]
                                    </span>
                                </div>
                                {selectedOrder.orderStatus === 'DELIVERED' && (
                                    <span className="inline-block bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-full font-bold w-fit">
                                        COMPLETED
                                    </span>
                                )}
                                <p className="text-slate-500 text-sm">
                                    Order {selectedOrder.sk.split('#')[1]}
                                </p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 text-2xl p-2">×</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => openGoogleMaps(selectedOrder)} className="bg-blue-100 text-blue-700 py-3 rounded-lg font-bold flex justify-center items-center hover:bg-blue-200 transition">
                                <span>🗺️ Go</span>
                            </button>
                            {selectedOrder.orderStatus === 'DELIVERING' ? (
                                <button onClick={() => markAsDelivered(selectedOrder)} className="bg-green-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-green-500 transition flex justify-center items-center">
                                    <span>📦 Delivered</span>
                                </button>
                            ) : (
                                <button disabled className="bg-slate-200 text-slate-400 py-3 rounded-lg font-bold cursor-not-allowed flex justify-center items-center">
                                    <span>✓ Completed</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. NEW: History Overlay (Absolute Grid - No Tables!) */}
                {isHistoryOpen && (
                    <div className="absolute inset-0 bg-slate-900/95 z-50 overflow-y-auto p-4 backdrop-blur-sm">
                        
                        {/* Date Controls */}
                        <div className="flex flex-wrap gap-4 mb-6 bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 sticky top-0 z-10">
                            <div className="flex flex-col">
                                <label className="text-slate-400 text-xs mb-1 uppercase font-bold">Start Date</label>
                                <input 
                                    type="date" 
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                                    className="bg-slate-900 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-slate-400 text-xs mb-1 uppercase font-bold">End Date</label>
                                <input 
                                    type="date" 
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                                    className="bg-slate-900 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={fetchHistory}
                                    disabled={loadingHistory}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded font-bold text-sm h-[38px] flex items-center gap-2 transition shadow-lg"
                                >
                                    {loadingHistory ? 'Loading...' : 'Refresh List'}
                                </button>
                            </div>
                        </div>

                        {/* The Grid Table (Using CSS Grid, NOT HTML Table to avoid flying bugs) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                            {historyOrders.length === 0 ? (
                                <div className="col-span-full text-center py-10 text-slate-500">
                                    {loadingHistory ? "Loading data..." : "No orders found in this period."}
                                </div>
                            ) : (
                                historyOrders.map((order) => (
                                    <div key={order.sk} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-md hover:border-slate-500 transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {new Date(order.createdAt).toLocaleDateString()}
                                                </span>
                                                <span className="text-white font-bold text-lg">
                                                    #{order.sk.split('#')[1]}
                                                </span>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                order.orderStatus === 'DELIVERED' 
                                                ? 'bg-green-900/50 text-green-400 border border-green-800' 
                                                : 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                                            }`}>
                                                {order.orderStatus}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-2 text-sm text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-700 p-1.5 rounded-full text-xs">👤</span>
                                                <span>{order.gsi2pk?.split('#')[2] || 'Unknown Customer'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-700 p-1.5 rounded-full text-xs">📦</span>
                                                <span>{order.itemsNbr} Item(s)</span>
                                            </div>
                                        </div>

                                        {/* Optional: Add action buttons inside the history card if needed */}
                                        {/* <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end">
                                            <button className="text-indigo-400 text-sm hover:text-indigo-300 font-bold">View Details →</button>
                                        </div> */}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentDashboard;
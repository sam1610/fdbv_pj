import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import { getCurrentUser } from 'aws-amplify/auth';

const AgentDashboard = ({ agentPhone , agentEmail}) => { 
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);


const queryParam = useMemo(() => ({
  filter: {
    gsi1pk: { eq: `AGENT#${agentPhone}` },
    orderStatus: { in: ['DELIVERING', 'DELIVERED'] }
  }
}), [agentPhone]);

useEffect(() => {
  if (!agentPhone) return;

  const subscription = client.models.BusinessData.observeQuery(
    client.models.BusinessData.ByAgentByStatus,      // 🔥 Uses GSI (no scans)
    {
      gsi1pk: `AGENT#${agentPhone}`                  // partition key ONLY
      // DO NOT FILTER STATUS HERE → Dynamo adds a SCAN, trust me.
    },
    {
      sort: s => s.sk(SortDirection.ASC)             // ORDER#timestamp
    }
  ).subscribe({
    next: ({ items }) => {
      // Filter locally — items list is small, cheap, consistent
      const filtered = items.filter(o =>
        o.orderStatus === 'DELIVERING' ||
        o.orderStatus === 'DELIVERED'
      );

      setOrders(filtered);
      setLoading(false);
    },
    error: (error) => {
      console.error("observeQuery error:", error);
      setLoading(false);
    }
  });

  return () => subscription.unsubscribe();
}, [agentPhone]);



  // --- 2. Map Logic ---
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

  // --- 3. Plot Orders (UPDATED) ---
  useEffect(() => {
    if (!mapInstance.current || orders.length === 0) return;
    
    const map = mapInstance.current;
    
    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    orders.forEach((order) => {
        let loc = order.location;
        if (typeof loc === 'string') loc = JSON.parse(loc);
        const lat = parseFloat(loc.latitude?.N || loc.latitude);
        const lng = parseFloat(loc.longitude?.N || loc.longitude);

        if (!lat || !lng) return;

        // Check Status
        const isDelivered = order.orderStatus === 'DELIVERED';

        const el = document.createElement('div');
        el.className = isDelivered ? 'Order-delivered' : 'Order-delivering';
        
        // Change Icon based on status
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

        // Extract Clean Data for Tooltip
        const cleanId = order.sk.split('#')[1] || order.sk;
        const customerPhone = order.gsi2pk?.split('#')[2] || 'Unknown'; 
        const itemCount = order.itemsNbr  || 0;
        // Create Tooltip Content
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

  // --- 4. Deliver Action ---
  const markAsDelivered = async (order) => {
    if (order.orderStatus === 'DELIVERED') return;

    // if (!window.confirm("Confirm delivery?")) return;
    
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

  // --- 5. Google Maps Link ---
  const openGoogleMaps = (order) => {
    let loc = order.location;
    if (typeof loc === 'string') loc = JSON.parse(loc);
    const lat = parseFloat(loc.latitude?.N || loc.latitude);
    const lng = parseFloat(loc.longitude?.N || loc.longitude);
    
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
        {/* Header */}
        <div className="p-2 bg-slate-800 shadow-md z-10 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">🚀 Deliveries</h1>
            <div className="flex flex-col mt-1">
                        <span className="text-xs text-slate-400 font-mono tracking-wide">
                            {agentPhone || 'Unknown Phone'}
                        </span>
                        {agentEmail && (
                            <span className="text-[10px] text-sky-400 italic">
                                {agentEmail}
                            </span>
                        )}
                    </div>
            <div className="flex gap-2">
                <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {orders.filter(o => o.orderStatus === 'DELIVERED').length} Done
                </div>
                <div className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    {orders.filter(o => o.orderStatus === 'DELIVERING').length} Active
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
            
            {/* Bottom Sheet */}
            {selectedOrder && (
                <div className="absolute bottom-0 left-0 right-0 bg-white p-5 rounded-t-2xl shadow-2xl animate-slide-up z-20">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            {/* <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-800">
                                    Customer:📞 {selectedOrder.gsi2pk.split('#')[2] || 'Customer'} -[{selectedOrder.itemsNbr} items]

                                    
                                </h2>
                                {selectedOrder.orderStatus === 'DELIVERED' && (
                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">
                                        COMPLETED
                                    </span>
                                )}
                            </div> */}
<div className="flex flex-col gap-2">
  <div className="flex items-center gap-3 flex-wrap">
    {/* <h2 className="text-xl font-bold text-slate-800">
      {selectedOrder.gsi2pk?.split('#')[2] || 'Customer'}
    </h2> */}

    {/* Clickable Phone Number */}
    <a
      href={`tel:${selectedOrder.gsi2pk?.split('#')[2]}`}
      className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-bold text-sm hover:bg-blue-200 transition shadow-sm"
    >
      Customer:📞  {selectedOrder.gsi2pk?.split('#')[2] || 'No Phone'}
    </a>

    {/* Items count */}
    <span className="text-slate-600 font-medium">
      [{selectedOrder.itemsNbr || 0} item(s)]
    </span>
  </div>

  {/* Status badge */}
  {selectedOrder.orderStatus === 'DELIVERED' && (
    <span className="inline-block bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-full font-bold">
      COMPLETED
    </span>
  )}
</div>




                            <p className="text-slate-500 text-sm">
                                Order {selectedOrder.sk.split('#')[1]}
                            </p>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="text-slate-400 text-2xl">&times;</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => openGoogleMaps(selectedOrder)}
                            className="bg-blue-100 text-blue-700 py-3 rounded-lg font-bold flex justify-center items-center hover:bg-blue-200 transition"
                        >
                            <span>🗺️ Go</span>
                        </button>
                        
                        {selectedOrder.orderStatus === 'DELIVERING' ? (
                            <button 
                                onClick={() => markAsDelivered(selectedOrder)}
                                className="bg-green-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-green-500 transition flex justify-center items-center"
                            >
                                <span>📦 Order Delivered</span>
                            </button>
                        ) : (
                            <button 
                                disabled
                                className="bg-slate-200 text-slate-400 py-3 rounded-lg font-bold cursor-not-allowed flex justify-center items-center"
                            >
                                <span>✓ Completed</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AgentDashboard;
import React, { useEffect, useRef, useState } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient'; 
import { updateRec } from '../DataHook/UpdateRec'; 

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

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Estimates drive time based on distance (e.g., 3 mins per km + 2 mins parking)
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
  const markersRef = useRef({}); 

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [metricsCache, setMetricsCache] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);

  // ✅ Updated Defaults: Show ALL (including Delivered/Delivering) by default
  const [showDelivered, setShowDelivered] = useState(true);
  const [showDelivering, setShowDelivering] = useState(true);

  // Helper to determine if we are in "Dispatch Mode" (Only Prepared visible)
  const isDispatchMode = !showDelivered && !showDelivering;

  // ✅ Check if there are actually any PREPARED orders to work with
  const hasPreparedOrders = orders.some(o => o.orderStatus === 'PREPARED');
  
  console.log("DeliveryOptimizer Props:", { orders, agents, restaurantLocation });
  // --- Helper: Get Color for Agent ---
  const getAgentColor = (agentId) => {
    if (!agentId) return '#64748b'; // Slate-500 for Unassigned (Grey)
    const index = agents.findIndex(a => a.id === agentId);
    if (index === -1) return '#64748b';
    return AGENT_COLORS[index % AGENT_COLORS.length];
  };

  const parseLocation = (loc) => {
    if (!loc) return null;
    try {
      const parsed = typeof loc === 'string' ? JSON.parse(loc) : loc;
      const lat = parseFloat(parsed.latitude?.N || parsed.latitude || 0);
      const lng = parseFloat(parsed.longitude?.N || parsed.longitude || 0);
      if (lat === 0 && lng === 0) return null;
      return { latitude: lat, longitude: lng };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    async function initializeMap() {
      if (mapInstance.current) return;

      try {
        const map = await createMap({
          container: mapContainerRef.current,
          center: [
            restaurantLocation?.longitude || 2.3522,
            restaurantLocation?.latitude || 48.8566
          ],
          zoom: 12,
          attributionControl: false 
        });

        mapInstance.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');

        // Plot Restaurant
        if (restaurantLocation) {
          const el = document.createElement('div');
          el.style.backgroundColor = '#ef4444'; 
          el.style.width = '32px';
          el.style.height = '32px';
          el.style.borderRadius = '50%';
          el.style.border = '3px solid white';
          el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
          el.style.display = 'flex';
          el.style.justifyContent = 'center';
          el.style.alignItems = 'center';
          el.innerHTML = '<span style="font-size:16px;">🏠</span>';

          new maplibregl.Marker({ element: el })
            .setLngLat([restaurantLocation.longitude, restaurantLocation.latitude])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML("<b>HQ / Restaurant</b>"))
            .addTo(map);
        }

        plotOrdersOnMap(orders, map, assignments);

      } catch (error) {
        console.error("Error creating map:", error);
      }
    }

    initializeMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // ✅ Trigger replot when filters or data change
  useEffect(() => {
    if (mapInstance.current) {
        plotOrdersOnMap(orders, mapInstance.current, assignments);
    }
  }, [assignments, orders, showDelivered, showDelivering]); 


  // --- Plot Orders (Updated with Filter Logic) ---
  const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
      if (!map) return;
      
      // Clear old markers
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      ordersToPlot.forEach((order, index) => {
          // ✅ Filter Logic: 
          const status = order.orderStatus || 'PREPARED'; 
          
          // 1. If it's DELIVERED, show only if checkbox checked
          if (status === 'DELIVERED' && !showDelivered) return;
          
          // 2. If it's DELIVERING, show only if checkbox checked
          if (status === 'DELIVERING' && !showDelivering) return;
          
          // 3. PREPARED orders (or any other status) are always shown
          
          const loc = parseLocation(order.location);
          if (loc) {
              const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; // Fallback to order.gsi1pk if not in local assignment state yet
              const assignedAgent = agents.find(a => a.id === assignedAgentId);
              const agentName = assignedAgent ? assignedAgent.name : 'Unassigned';
              
              const markerColor = getAgentColor(assignedAgentId);

              const el = document.createElement('div');
              el.className = 'marker-order';
              
              // Optional: Change icon based on status for better visual cue
              let iconContent = index + 1;
              if (status === 'DELIVERED') iconContent = '✓';
              else if (status === 'DELIVERING') iconContent = '🚚';

              el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${iconContent}</span>`;
              
              el.style.backgroundColor = markerColor;
              el.style.width = '24px';
              el.style.height = '24px';
              el.style.borderRadius = '50%';
              el.style.display = 'flex';
              el.style.justifyContent = 'center';
              el.style.alignItems = 'center';
              el.style.border = '2px solid white';
              el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
              el.style.cursor = 'pointer';
              el.style.transition = 'background-color 0.3s ease';

              const cleanId = order.sk.split('#')[1] || order.sk;
              const phone = order.customer || 'No Phone';

              // ✅ Updated Popup Content Logic
              let headerText = `ORDER ${index + 1}`;
              if (status === 'DELIVERED') {
                  headerText = `✅ DELIVERED by: ${agentName}`;
              } else if (status === 'DELIVERING') {
                  headerText = `🚚 by: ${agentName}`;
              }

              const popupContent = `
                <div style="color: black; font-family: sans-serif; min-width: 180px; padding: 5px;">
                  <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                    <span style="display:inline-block; width:10px; height:10px; background-color:${markerColor}; border-radius:50%; margin-right:6px;"></span>
                    ${headerText}
                  </div>
                  <div style="font-size: 13px; margin-bottom: 4px;">
                    <span style="color: #444;">Customer:</span> 📞 <b>${phone}</b>
                  </div>
                  <div style="font-size: 12px;">
                    <span style="color: #666;">ID:</span> <span style="font-family: monospace;">${cleanId}</span>
                  </div>
                </div>
              `;

              const marker = new maplibregl.Marker({ element: el })
                  .setLngLat([loc.longitude, loc.latitude])
                  .setPopup(
                    new maplibregl.Popup({ offset: 25, closeButton: false })
                      .setHTML(popupContent)
                  )
                  .addTo(map);

              markersRef.current[order.sk] = marker;
          }
      });
  };

  const handleOrderClick = (orderSk) => {
    const marker = markersRef.current[orderSk];
    if (marker) {
      marker.togglePopup(); 
      mapInstance.current.flyTo({
        center: marker.getLngLat(),
        zoom: 14,
        speed: 1.5
      });
    }
  };


const runOptimization = async () => {
    setLoading(true);
    setErrorMessage(null); 

    try {
      // 1. Validation (Keep existing validation logic)
      if (!restaurantLocation || !restaurantLocation.latitude) throw new Error("Restaurant Location missing.");

      const validAgents = agents.filter(a => {
         if (!a.location) return false;
         const lat = parseFloat(a.location.latitude);
         const lng = parseFloat(a.location.longitude);
         return !isNaN(lat) && !isNaN(lng);
      }).map(a => ({
         id: a.id,
         name: a.name,
         location: a.location,
         maxCapacity: a.maxCapacity || 10,
         currentLoad: a.currentLoad || 0
      }));

      if (validAgents.length === 0) throw new Error("No active agents found.");

      // 2. Call API
      const response = await client.queries.optimizeDelivery({
        orders: JSON.stringify(orders),
        agents: JSON.stringify(validAgents), 
        restaurantLocation: JSON.stringify(restaurantLocation),
        agentLocation: JSON.stringify(restaurantLocation) 
      });

      // 1. Parse the main body first
      let raw = response.data;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) { /* ignore */ }
      }

      console.log("🚀 Raw Response:", raw);

      // 🚨 FIX: Parse the inner fields if they are strings
      let proposal = raw.proposal;
      if (typeof proposal === 'string') {
          try { proposal = JSON.parse(proposal); } catch (e) { console.error("Failed to parse proposal", e); proposal = []; }
      }

      let routeMetrics = raw.routeMetrics;
      if (typeof routeMetrics === 'string') {
          try { routeMetrics = JSON.parse(routeMetrics); } catch (e) { console.error("Failed to parse metrics", e); routeMetrics = []; }
      }

      // 2. Validate Proposal is now an Array
      if (!Array.isArray(proposal)) {
          console.warn("⚠️ Proposal is still not an array:", proposal);
          proposal = [];
      }

      // 3. Process Assignments
      const newAssignments = {};
      proposal.forEach(p => {
          if (p.assignedOrders) {
             p.assignedOrders.forEach(orderSk => {
                 newAssignments[orderSk] = p.agentId;
             });
          }
      });
      setAssignments(newAssignments);

      // 4. Process Metrics
      const newMetrics = {};
      if (Array.isArray(routeMetrics)) {
          routeMetrics.forEach(m => {
              newMetrics[m.orderId] = {
                  deliveryDistance: parseFloat(m.distanceKm || 0),
                  deliveryDuration: parseInt(m.durationSeconds || 0)
              };
          });
      }
      setMetricsCache(newMetrics);
      console.log("📊 Metrics processed:", Object.keys(newMetrics).length);

    } catch (err) {
      console.error("Optimization failed:", err);
      setErrorMessage(err.message || "Optimization Failed");
    } finally {
      setLoading(false);
    }
  };

// ... inside DeliveryOptimizer.jsx

const handleDispatch = async () => {
    if (Object.keys(assignments).length === 0) return;
    setSaving(true);

    try {
      const updatesByAgent = {};

      // 1. Group orders by Agent
      Object.entries(assignments).forEach(([orderSk, agentId]) => {
          const order = orders.find(o => o.sk === orderSk);
          if (order && order.orderStatus === 'PREPARED' && order.location) {
              if (!updatesByAgent[agentId]) updatesByAgent[agentId] = [];
              updatesByAgent[agentId].push(orderSk);
          }
      });

      if (Object.keys(updatesByAgent).length === 0) {
          console.warn("No valid PREPARED orders to dispatch.");
          setSaving(false);
          return;
      }

      // 2. Perform Updates
      const updatePromises = Object.entries(updatesByAgent).map(async ([agentId, skList]) => {
          
          // A. Calculate Load to add (Optional, for Capacity tracking)
          let addedLoad = 0;
          skList.forEach(sk => {
             const o = orders.find(x => x.sk === sk);
             // Simple logic: Big=4, Med=2, Regular=1
             addedLoad += (o.size === 'BIG' ? 4 : (o.size === 'MEDIUM' ? 2 : 1));
          });

          // B. Update Agent Capacity (Optional but recommended)
          try {
             const agent = agents.find(a => a.id === agentId);
             if (agent) {
                 await client.models.BusinessData.update({
                    pk: agentId, // AGENT#phone
                    sk: agentId, 
                    // Increment current load
                    currentLoad: (agent.currentLoad || 0) + addedLoad
                 });
             }
          } catch(e) { console.warn("Capacity update failed", e); }

          // C. Update Each Order (CRITICAL PART)
          for (const sk of skList) {
             const order = orders.find(o => o.sk === sk);
             const pk = order.pk; // Ensure we have the PK
             const orderLoc = parseLocation(order.location);

             // Calculate Dist/Time
             let deliveryDist = 0;
             if (orderLoc && restaurantLocation) {
                 deliveryDist = getDistanceFromLatLonInKm(
                     restaurantLocation.latitude,
                     restaurantLocation.longitude,
                     orderLoc.latitude,
                     orderLoc.longitude
                 );
             }
             const deliveryDur = estimateDurationSeconds(deliveryDist);

             console.log(`📦 Dispatching ${sk} to ${agentId}`);

             // ✅ DIRECT AMPLIFY UPDATE (Replaces updateRec)
             await client.models.BusinessData.update({
                pk: pk,
                sk: sk,
                gsi1pk: agentId,           // This assigns it to the Agent for the Dashboard Query
                deliveryAgentId: agentId,  // Redundant but good for backup
                orderStatus: 'DELIVERING', // Required for AgentDashboard filter
                deliveryDistance: parseFloat(deliveryDist.toFixed(2)),
                deliveryDuration: deliveryDur
             });
          }
      });

      await Promise.all(updatePromises);
      
      console.log("✅ All assignments saved successfully.");
      if (onAssignmentSaved) onAssignmentSaved();

    } catch (error) {
      console.error("Dispatch Error", error);
      setErrorMessage("Failed to save assignments: " + error.message);
    } finally {
      setSaving(false);
    }
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
      
      {/* 1. MAP PANEL */}
      <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
        {/* ✅ Updated Legend with Checkboxes */}
        <div 
          className="absolute bottom-6 left-4 bg-white/95 p-3 rounded-lg shadow-xl text-sm pointer-events-auto backdrop-blur-sm border border-gray-200"
          onClick={(e) => e.stopPropagation()} 
        >
           
           {/* <div className="flex items-center mb-2">
             <span className="w-3 h-3 bg-red-500 rounded-full mr-2 shadow-sm"></span> 
             <span className="font-semibold text-gray-700">HQ</span>
           </div> */}

           {/* <div className="border-t border-gray-200 my-2"></div> */}

           <label className="flex items-center mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition">
             <input 
               type="checkbox" 
               checked={showDelivering} 
               onChange={(e) => setShowDelivering(e.target.checked)}
               className="mr-2 cursor-pointer accent-orange-500 h-4 w-4"
             />
             <span className="mr-2">🚚</span>
             <span className="text-gray-700">DELIVERING</span>
           </label>

           <label className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition">
             <input 
               type="checkbox" 
               checked={showDelivered} 
               onChange={(e) => setShowDelivered(e.target.checked)}
               className="mr-2 cursor-pointer accent-green-600 h-4 w-4"
             />
             <span className="mr-2">✅</span>
             <span className="text-gray-700">DELIVERED</span>
           </label>

        </div>
        
        {/* Close button only when sidebar is hidden (Review Mode) */}
        {!isDispatchMode && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-gray-100 z-10"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 2. SIDEBAR PANEL - Visible ONLY in Dispatch Mode */}
      {isDispatchMode && (
        <div className="h-full bg-slate-900 text-white shadow-2xl flex flex-col order-2 transition-all duration-300 w-[80px] md:w-64">
          
          <div className="p-4 flex flex-col items-center md:items-stretch border-b border-slate-800">
            <div className="flex justify-between items-center w-full mb-4">
              <h2 className="hidden md:block text-xl font-bold text-yellow-400">Dispatch</h2>
              <button onClick={onClose} className="text-3xl text-slate-400 hover:text-white mx-auto md:mx-0">&times;</button>
            </div>
            
            {/* ✅ Logic for Button Activation */}
            {hasPreparedOrders ? (
              <div className="flex gap-2 w-full flex-col">
                <button 
                    onClick={runOptimization} 
                    disabled={loading || saving}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition-all h-10 flex items-center justify-center text-sm"
                    title="Run Auto-Assign"
                >
                    {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 
                      <><span className="text-lg mr-2">⚡️</span> <span className="hidden md:inline">Auto-Assign</span></>
                    }
                </button>

                <button 
                    onClick={handleDispatch}
                    // ✅ Only active if assignments exist AND are not saving/loading
                    disabled={loading || saving || Object.keys(assignments).length === 0}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all h-10 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    title="Confirm & Save"
                >
                    {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 
                      <><span className="text-lg mr-2">📦</span> <span className="hidden md:inline">Confirm</span></>
                    }
                </button>
              </div>
            ) : (
              <div className="text-center py-2 text-slate-400 text-sm bg-slate-800 rounded border border-slate-700">
                No new orders to assign.
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {orders.map((o, i) => {
                  // In Dispatch Mode, we ONLY show PREPARED orders in the list to avoid clutter
                  // (since the others are hidden from map anyway via isDispatchMode logic)
                  if (o.orderStatus === 'DELIVERED' || o.orderStatus === 'DELIVERING') return null;

                  const agentId = assignments[o.sk];
                  const color = getAgentColor(agentId);

                  return (
                  <div 
                      key={o.sk} 
                      onClick={() => handleOrderClick(o.sk)} 
                      className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 transition-all flex items-center group justify-center md:justify-between p-2"
                      style={{ borderLeft: `3px solid ${color}` }} 
                  >
                      <span 
                        className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {i+1}
                      </span>

                      <div className="hidden md:block flex-1 ml-2 min-w-0">
                        <p className="font-bold text-xs truncate text-left mb-1">
                          {o.customer || 'Unknown'}
                        </p>
                        
                        <select
                          value={assignments[o.sk] || ''}
                          onClick={(e) => e.stopPropagation()} 
                          onChange={(e) => setAssignments(prev => ({
                              ...prev,
                              [o.sk]: e.target.value
                          }))}
                          className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1 focus:border-yellow-400 outline-none"
                        >
                          <option value="" disabled>Select Agent</option>
                          {agents.map(agent => (
                              <option key={agent.id} value={agent.id}>
                                  {agent.name}
                              </option>
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
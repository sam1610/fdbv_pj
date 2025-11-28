import React, { useEffect, useRef, useState } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient'; 
import { updateRec } from '../DataHook/UpdateRec'; 

// ✅ 1. Distinct Color Palette for Agents


const DeliveryOptimizer = ({
  orders,
  agents,AGENT_COLORS,
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

  useEffect(() => {
    if (mapInstance.current) {
        plotOrdersOnMap(orders, mapInstance.current, assignments);
    }
  }, [assignments, orders]); 


  // --- Plot Orders (Now with Dynamic Coloring) ---
  const plotOrdersOnMap = (ordersToPlot, map, currentAssignments) => {
      if (!map) return;
      
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      ordersToPlot.forEach((order, index) => {
          const loc = parseLocation(order.location);
          if (loc) {
              const assignedAgentId = currentAssignments[order.sk];
              const assignedAgent = agents.find(a => a.id === assignedAgentId);
              const agentName = assignedAgent ? assignedAgent.name : null;
              
              // ✅ 2. Get Color Based on Agent
              const markerColor = getAgentColor(assignedAgentId);

              const el = document.createElement('div');
              el.className = 'marker-order';
              el.innerHTML = `<span style="color:white; font-weight:bold; font-size:12px;">${index + 1}</span>`;
              
              // ✅ 3. Apply Color
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
              el.style.transition = 'background-color 0.3s ease'; // Smooth transition

              const cleanId = order.sk.split('#')[1] || order.sk;
              const phone = order.customer || 'No Phone';

              const popupContent = `
                <div style="color: black; font-family: sans-serif; min-width: 160px; padding: 5px;">
                  <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center;">
                    <span style="display:inline-block; width:10px; height:10px; background-color:${markerColor}; border-radius:50%; margin-right:6px;"></span>
                    ORDER ${index + 1} 
                  </div>
                  ${agentName ? `<div style="color: ${markerColor}; font-weight:bold; font-size: 13px; margin-bottom:4px;">👤 ${agentName}</div>` : ''}
                  <div style="font-size: 14px; margin-bottom: 2px;">
                    <span style="color: #444;">ID:</span> <b>${cleanId}</b>
                  </div>
                  <div style="font-size: 14px;">
                    <span style="color: #444;">📞</span> <b>${phone}</b>
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
    try {
      const response = await client.graphql({
        query: `
          query CalculateRoutePlan($orders: AWSJSON!, $agents: AWSJSON!, $restaurantLocation: AWSJSON!) {
            calculateRoutePlan(orders: $orders, agents: $agents, restaurantLocation: $restaurantLocation)
          }
        `,
        variables: {
          orders: JSON.stringify(orders),
          agents: JSON.stringify(agents),
          restaurantLocation: JSON.stringify(restaurantLocation)
        }
      });

      let raw = response.data?.calculateRoutePlan;
      if (typeof raw === 'string') raw = JSON.parse(raw);

      const proposal = raw.proposal || [];
      const newAssignments = {};
      
      proposal.forEach(p => {
          p.assignedOrders.forEach(orderSk => {
              newAssignments[orderSk] = p.agentId;
          });
      });
      
      setAssignments(newAssignments);

    } catch (err) {
      console.error(err);
      alert("Optimization failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (Object.keys(assignments).length === 0) return;
    setSaving(true);

    try {
      const updatesByAgent = {};
      
      Object.entries(assignments).forEach(([orderSk, agentId]) => {
          if (!updatesByAgent[agentId]) {
              updatesByAgent[agentId] = [];
          }
          updatesByAgent[agentId].push(orderSk);
      });

      const pk = orders[0]?.pk; 
      if (!pk) throw new Error("Missing PK");

      const updatePromises = Object.entries(updatesByAgent).map(([agentId, skList]) => {
          return updateRec(pk, skList, {
              gsi1pk: agentId,          
              deliveryAgentId: agentId, 
              orderStatus: 'DELIVERING'
          });
      });

      await Promise.all(updatePromises);

      alert("All orders dispatched successfully!");
      if (onAssignmentSaved) onAssignmentSaved();

    } catch (error) {
      console.error("Dispatch Error", error);
      alert("Failed to save assignments: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden">
      
      {/* 1. MAP PANEL */}
      <div className="flex-1 relative bg-gray-100 h-full border-r border-slate-700 order-1">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        
        {/* Legend */}
        <div className="absolute bottom-6 left-4 bg-white/90 p-2 rounded shadow text-xs pointer-events-none">
           <div className="flex items-center mb-1">
             <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span> HQ
           </div>
           <div className="flex items-center">
             <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span> Unassigned
           </div>
        </div>
      </div>

      {/* 2. SIDEBAR PANEL */}
      <div className="h-full bg-slate-900 text-white shadow-2xl flex flex-col order-2 transition-all duration-300 w-[80px] md:w-96">
        
        <div className="p-4 flex flex-col items-center md:items-stretch border-b border-slate-800">
          <div className="flex justify-between items-center w-full mb-4">
            <h2 className="hidden md:block text-2xl font-bold text-yellow-400">Dispatch</h2>
            <button onClick={onClose} className="text-3xl text-slate-400 hover:text-white mx-auto md:mx-0">&times;</button>
          </div>
          
          <div className="flex gap-2 w-full flex-col md:flex-row">
            <button 
                onClick={runOptimization} 
                disabled={loading || saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition-all h-12 flex-1 flex items-center justify-center"
                title="Run Auto-Assign"
            >
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <span className="text-xl">⚡️</span>}
            </button>

            <button 
                onClick={handleDispatch}
                disabled={loading || saving || Object.keys(assignments).length === 0}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all h-12 flex-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Confirm & Save"
            >
                {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <span className="text-xl">📦</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
             {orders.map((o, i) => {
                 // Get color for list item too
                 const agentId = assignments[o.sk];
                 const color = getAgentColor(agentId);

                 return (
                 <div 
                    key={o.sk} 
                    onClick={() => handleOrderClick(o.sk)} 
                    className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-400 transition-all flex items-center group justify-center md:justify-between p-2 md:p-4"
                    style={{ borderLeft: `4px solid ${color}` }} // Color indicator on the list item
                 >
                    <span 
                      className="text-white text-sm font-bold w-8 h-8 md:w-6 md:h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: color }} // Circle color matches agent
                    >
                      {i+1}
                    </span>

                    <div className="hidden md:block flex-1 ml-3 min-w-0">
                      <p className="font-bold text-sm truncate text-left mb-1">
                        {o.customer || 'Unknown'}
                      </p>
                      
                      <select
                        value={assignments[o.sk] || ''}
                        onClick={(e) => e.stopPropagation()} 
                        onChange={(e) => setAssignments(prev => ({
                            ...prev,
                            [o.sk]: e.target.value
                        }))}
                        className="w-full bg-slate-900 border border-slate-600 text-xs text-white rounded p-1 focus:border-yellow-400 outline-none"
                      >
                        <option value="" disabled>Select Agent</option>
                        {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name}
                            </option>
                        ))}
                      </select>

                      <p className="text-[10px] text-slate-500 text-left mt-1 font-mono">
                        {o.sk.split('#')[1]}
                      </p>
                    </div>
                 </div>
                 );
             })}
        </div>
      </div>
    </div>
  );
};

export default DeliveryOptimizer;
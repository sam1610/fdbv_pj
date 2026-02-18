import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createMap } from 'maplibre-gl-js-amplify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-js-amplify/dist/public/amplify-map.css';
import { client } from '../DataHook/amplifyClient';
import outputs from '../../amplify_outputs.json'; 
import { GeoRoutesClient, CalculateRoutesCommand } from "@aws-sdk/client-geo-routes"; 
import { fetchAuthSession } from 'aws-amplify/auth';
import { LocationClient, ListDevicePositionsCommand } from "@aws-sdk/client-location";

// --- CONFIG ---
const REFRESH_RATE_MS = 5000; 
const ANIMATION_DURATION_MS = REFRESH_RATE_MS; 
const STALE_THRESHOLD_MS = 5 * 60 * 1000; 

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
        <div className="bg-slate-900 rounded-xl border border-slate-600 p-3 select-none mt-2">
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
                    const isSelected = currentStr === startDate || (startDate && endDate && currentStr >= startDate && currentStr <= endDate);
                    let bgClass = "hover:bg-slate-700 text-slate-300";
                    if (isSelected) bgClass = "bg-indigo-600 text-white font-bold shadow-md transform scale-110";
                    return (<button key={i} onClick={(e) => { e.stopPropagation(); handleDayClick(d); }} className={`h-7 w-7 rounded-full text-xs flex items-center justify-center transition-all ${bgClass}`}>{d}</button>);
                })}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------------------*/
const DeliveryOptimizer = ({
  orders, 
  agents,
  AGENT_COLORS,
  restaurantLocation,
  onClose,
  onAssignmentSaved,
  phoneNbr 
}) => {
  // Refs
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const animationFrameId = useRef(null);
  
  // State
  const agentAnimationState = useRef({}); 
  const latestAgentsRef = useRef(agents);
  const markersRef = useRef({});          

  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(true); 
  const [showDelivered, setShowDelivered] = useState(false); 
  const [showDelivering, setShowDelivering] = useState(true);
  
  // Date & History State
  const [dateFilter, setDateFilter] = useState({ start: getTodayString(), end: getTodayString(), label: 'Today' });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [fetchedHistory, setFetchedHistory] = useState([]); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Logic State
  const [assignments, setAssignments] = useState({}); // { orderSk: agentPk }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); 
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [optimizationMetrics, setOptimizationMetrics] = useState({});
  const [activeTooltipId, setActiveTooltipId] = useState(null); 
  const [orderItemsCache, setOrderItemsCache] = useState({}); 

  // Sync Props
  useEffect(() => { latestAgentsRef.current = agents; }, [agents]);

  // Merge Data
  const displayedOrders = useMemo(() => {
      const today = getTodayString();
      const isToday = dateFilter.start === today && dateFilter.end === today;
      const sourceData = isToday ? orders : fetchedHistory;
      
      return sourceData.filter(o => {
          if (o.orderStatus === 'DELIVERED' && !showDelivered) return false;
          if (o.orderStatus === 'DELIVERING' && !showDelivering) return false;
          return true;
      });
  }, [orders, fetchedHistory, dateFilter, showDelivered, showDelivering]);

  const hasPreparedOrders = displayedOrders.some(o => o.orderStatus === 'PREPARED');

  // History Fetch
  useEffect(() => {
      const today = getTodayString();
      if (dateFilter.start !== today || dateFilter.end !== today) {
          const fetchHistory = async () => {
              const pkToUse = phoneNbr ? `BUSINESS#${phoneNbr}` : (orders[0]?.pk); 
              if (!pkToUse) return;
              setIsLoadingHistory(true);
              const startSK = `ORDER#${dateFilter.start}T00:00:00.000Z`;
              const endSK = `ORDER#${dateFilter.end}T23:59:59.999Z`;
              try {
                  const { data } = await client.models.BusinessData.listByBusiness({
                      pk: pkToUse,
                      sk: { between: [startSK, endSK] }
                  });
                  setFetchedHistory(data);
              } catch (e) { console.error("History Fetch Error", e); } 
              finally { setIsLoadingHistory(false); }
          };
          fetchHistory();
      }
  }, [dateFilter, phoneNbr, orders]);

  const getAgentColor = (agentId) => {
    if (!agentId) return '#64748b'; 
    const index = agents.findIndex(a => (a.id || a.sk) === agentId); 
    return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
  };

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

  const fetchOrderItems = async (order) => {
      if (orderItemsCache[order.sk]) return orderItemsCache[order.sk];
      try {
          const phoneNbr = order.pk.split('#')[1];
          const orderIdPart = order.sk.split('#')[1];
          const { data: lineItems } = await client.models.BusinessData.listByBusiness({
              pk: `ORDER#${phoneNbr}#${orderIdPart}`,
              sk: { beginsWith: 'ITEM#' },
          });
          setOrderItemsCache(prev => ({ ...prev, [order.sk]: lineItems }));
          return lineItems;
      } catch (err) { return []; }
  };

  const handleOrderClick = async (e, order) => {
      e.stopPropagation(); 
      if (activeTooltipId === order.sk) { setActiveTooltipId(null); return; }
      setActiveTooltipId(order.sk);
      await fetchOrderItems(order);
  };

  // Fix Z-Index
  useEffect(() => {
    const styleId = 'popup-z-index-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `.maplibregl-popup { z-index: 2000 !important; } summary { list-style: none; } summary::-webkit-details-marker { display: none; }`;
      document.head.appendChild(style);
    }
  }, []);

  // --- MAP INIT ---
  useEffect(() => {
    let isMounted = true;
    async function initializeMap() {
      if (mapInstance.current) return;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

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

        map.on('click', () => {
            setFocusedAgentId(null);
            setIsMenuOpen(false);
            setActiveTooltipId(null);
        });

        map.on('load', () => {
            if (!isMounted) return;
            if (!map.getSource('agents-source')) map.addSource('agents-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            if (!map.getLayer('agents-glow-layer')) map.addLayer({ id: 'agents-glow-layer', type: 'circle', source: 'agents-source', paint: { 'circle-radius': 20, 'circle-color': ['case', ['get', 'isStale'], '#94a3b8', '#3b82f6'], 'circle-opacity': 0.3, 'circle-blur': 0.5 } });
            if (!map.getLayer('agents-layer')) map.addLayer({ id: 'agents-layer', type: 'circle', source: 'agents-source', paint: { 'circle-radius': 8, 'circle-color': ['case', ['get', 'isStale'], '#64748b', '#3b82f6'], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });

            map.on('click', 'agents-layer', (e) => handleAgentClick(e, map));
            map.on('mouseenter', 'agents-layer', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'agents-layer', () => map.getCanvas().style.cursor = '');

            startFetchLoop();
            startAnimationLoop(map);
        });

        if (restaurantLocation) {
          const el = document.createElement('div');
          Object.assign(el.style, { backgroundColor: '#ef4444', width: '32px', height: '32px', borderRadius: '50%', border: '3px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center' });
          el.innerHTML = '<span style="font-size:16px;">🏠</span>';
          new maplibregl.Marker({ element: el }).setLngLat([restaurantLocation.longitude, restaurantLocation.latitude]).addTo(map);
        }

        plotOrdersOnMap(displayedOrders, map, assignments, focusedAgentId);

      } catch (error) { console.error("Map Error:", error); }
    }
    
    initializeMap();

    return () => {
      isMounted = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  const handleAgentClick = async (e, map) => {
      if (!e.features || !e.features.length) return;
      e.originalEvent.stopPropagation(); 
      const props = e.features[0].properties; 
      const cleanTrackerId = getCleanPhone(props.id);
      const agentProfile = latestAgentsRef.current.find(a => getCleanPhone(a.id || a.sk) === cleanTrackerId);
      const agentName = agentProfile ? agentProfile.name : (props.name || 'Unknown');
      
      new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(e.features[0].geometry.coordinates.slice())
          .setHTML(`<div style="font-family:sans-serif;padding:8px;"><strong>${agentName}</strong><br/><span style="font-size:10px;color:#64748b;">ID: ${cleanTrackerId}</span></div>`)
          .addTo(map);
  };

  const startFetchLoop = () => { /* ... */ };
  const startAnimationLoop = (map) => { /* ... */ };

  // --- ORDER PLOTTING ---
  useEffect(() => { 
      if (mapInstance.current) plotOrdersOnMap(displayedOrders, mapInstance.current, assignments, focusedAgentId); 
  }, [assignments, displayedOrders, focusedAgentId]); 

  const plotOrdersOnMap = (ordersToPlot, map, currentAssignments, activeAgentId) => {
      if (!map) return;
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      ordersToPlot.forEach((order) => {
          const status = order.orderStatus || 'PREPARED'; 
          const loc = parseLocation(order.location);
          if (loc) {
              // Current assignment priority: 1. Pending Selection, 2. Saved Assignment
              const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
              const markerColor = getAgentColor(assignedAgentId); 
              let iconContent = status === 'DELIVERING' ? '🚚' : status === 'DELIVERED' ? '✅' : '📦';

              const el = document.createElement('div');
              el.className = 'marker-order';
              el.innerHTML = `<span style="color:white;font-weight:bold;font-size:12px;">${iconContent}</span>`;
              Object.assign(el.style, {
                  backgroundColor: markerColor, width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', cursor: 'pointer'
              });

              // Popup
              const shortId = (order.sk || "").replace('ORDER#', '').split('-').slice(0, 3).join('-');
              const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`<div>Loading...</div>`);
              const marker = new maplibregl.Marker({ element: el }).setLngLat([loc.longitude, loc.latitude]).setPopup(popup).addTo(map);

              el.addEventListener('click', async (e) => {
                  e.stopPropagation(); 
                  map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15 });
                  marker.togglePopup();

                  const items = await fetchOrderItems(order);
                  const itemsHtml = items.length ? items.map(i => `<div style="display:flex;justify-content:space-between;border-bottom:1px dashed #eee;padding:4px 0;"><span style="color:#334155;">${i.name}</span><strong style="color:#0f172a;">x${i.quantity || 1}</strong></div>`).join('') : 'No items';
                  
                  // ✅ AGENT NAME IN MAP POPUP
                  const agentName = agents.find(a => getCleanPhone(a.id || a.sk) === getCleanPhone(assignedAgentId))?.name || "Unassigned";
                  const custPhone = formatPhone(order.phone);

                  popup.setHTML(`
                    <div style="font-family: sans-serif; font-size: 12px; min-width: 180px; color: #334155;">
                        <div style="background:${status === 'DELIVERING' ? '#eff6ff' : '#f0fdf4'}; padding:6px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <b style="color:#1e293b;">${shortId}</b> <span style="font-size:14px;">${iconContent}</span>
                        </div>
                        <div style="margin-bottom:8px; font-weight:600; color:#475569;">📞 ${custPhone}</div>
                        <div style="margin-bottom:8px; color:#64748b; font-size:11px;">Agent: <strong>${agentName}</strong></div>
                        <div style="max-height:150px; overflow-y:auto; margin-bottom:8px;">${itemsHtml}</div>
                    </div>
                  `);
              });
              markersRef.current[order.sk] = marker;
          }
      });
  };

  // --- 6. AUTO-ASSIGN LOGIC ---
  const runOptimization = async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const geoClient = new GeoRoutesClient({ region: outputs.geo.aws_region, credentials: session.credentials });
      const validAgents = agents.filter(a => parseLocation(a.location));
      const orderMetrics = {};
      
      const orderPromises = displayedOrders.filter(o => o.orderStatus === 'PREPARED').map(async (order) => {
            const custLoc = parseLocation(order.location);
            if (restaurantLocation && custLoc) {
                try {
                    const res = await geoClient.send(new CalculateRoutesCommand({ Origin: [restaurantLocation.longitude, restaurantLocation.latitude], Destination: [custLoc.longitude, custLoc.latitude], TravelMode: "Car" }));
                    if (res.Routes?.length) { const s = res.Routes[0].Summary; orderMetrics[order.sk] = { dist: parseFloat((s.Distance / 1000).toFixed(2)), dur: Math.round(s.Duration) }; }
                } catch (e) {}
            }
        });
      
      await Promise.all([...orderPromises]); 

      const enrichedAgents = validAgents.map(a => ({ id: a.id || a.sk, name: a.name, location: parseLocation(a.location), maxCapacity: 10, currentLoad: 0 }));
      const enrichedOrders = displayedOrders.filter(o => o.orderStatus === 'PREPARED').map(o => ({ ...o, distFromRest: orderMetrics[o.sk]?.dist || 0 }));

      const response = await client.queries.optimizeDelivery({
        orders: JSON.stringify(enrichedOrders),
        agents: JSON.stringify(enrichedAgents), 
        restaurantLocation: JSON.stringify(restaurantLocation)
      });

      let proposal = response.data;
      if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal).proposal || []; } catch (e) { proposal = []; } }
      if (typeof proposal === 'string') { try { proposal = JSON.parse(proposal); } catch (e) { proposal = []; } }

      setOptimizationMetrics(orderMetrics); 
      
      // ✅ APPLY PROPOSAL TO ASSIGNMENTS STATE
      const newAssignments = {};
      if (Array.isArray(proposal)) {
          proposal.forEach(p => { 
              if (p.assignedOrders) { 
                  p.assignedOrders.forEach(orderSk => { newAssignments[orderSk] = p.agentId; }); 
              } 
          });
      }
      // Merge with any existing manual assignments
      setAssignments(prev => ({ ...prev, ...newAssignments }));

    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleDispatch = async () => {
    if (Object.keys(assignments).length === 0) return;
    setSaving(true); 
    try {
      const updateTasks = Object.entries(assignments).map(async ([orderSk, rawAgentId]) => {
          const order = displayedOrders.find(o => o.sk === orderSk);
          if (!order) return;
          
          const cleanPhone = String(rawAgentId).replace(/[^0-9]/g, '');
          const formattedAgentId = `AGENT#${cleanPhone}`; 
          
          await client.models.BusinessData.update({
              pk: order.pk, sk: orderSk, 
              gsi1pk: formattedAgentId,           
              deliveryAgentId: formattedAgentId, 
              orderStatus: 'DELIVERING', 
              deliveryDistance: 0, 
              deliveryDuration: 0   
          });
      });
      await Promise.all(updateTasks);
      setAssignments({}); // Clear processed assignments
      if (onAssignmentSaved) onAssignmentSaved();
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden h-[100dvh]">
      
      {/* 1. HEADER (Hamburger + Close) */}
      <div className="absolute top-4 left-4 right-4 z-[5000] flex justify-between pointer-events-none">
          {/* Hamburger Toggle */}
          <button onClick={() => setIsMenuOpen(prev => !prev)} className="pointer-events-auto bg-slate-800/90 text-white p-3 rounded-full shadow-xl border border-slate-700 hover:bg-slate-700 transition-transform active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button onClick={onClose} className="pointer-events-auto bg-slate-800/90 text-slate-300 p-3 rounded-full shadow-xl border border-slate-700 hover:text-white hover:bg-red-900/50 transition-colors">✕</button>
      </div>

      {/* 2. MAP */}
      <div className="flex-1 relative w-full h-full">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
        {/* Status Toggles */}
        <div className="absolute bottom-10 right-4 z-[2500] flex flex-col items-center gap-4 bg-white/60 p-3 rounded-full shadow-xl pointer-events-auto">
           <label className={`cursor-pointer ${showDelivering ? '' : 'grayscale opacity-50'}`}><input type="checkbox" className="hidden" checked={showDelivering} onChange={(e) => setShowDelivering(e.target.checked)} /><span className="text-2xl">🚚</span></label>
           <div className="w-6 h-px bg-slate-500/30"></div>
           <label className={`cursor-pointer ${showDelivered ? '' : 'grayscale opacity-50'}`}><input type="checkbox" className="hidden" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} /><span className="text-2xl">✅</span></label>
        </div>
      </div>
      
      {/* 3. SLIDING DRAWER */}
      <div className={`fixed inset-0 z-[4000] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
        
        <div className={`absolute top-0 bottom-0 left-0 w-80 bg-slate-900 border-r border-slate-700 shadow-2xl transform transition-transform duration-300 flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            
            {/* Header: Dispatch Buttons */}
            <div className="p-6 border-b border-slate-700 bg-slate-800">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Dispatch</h2>
                {hasPreparedOrders ? (
                  <div className="flex gap-2 w-full flex-col">
                    <button onClick={runOptimization} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg h-10 flex items-center justify-center text-sm transition-all">{loading ? "Calculating..." : "⚡️ Auto-Assign"}</button>
                    <button onClick={handleDispatch} disabled={loading || saving || Object.keys(assignments).length === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg h-10 flex items-center justify-center text-sm transition-all">{saving ? "Processing..." : "📦 Confirm"}</button>
                  </div>
                ) : <div className="text-center py-2 text-slate-400 text-sm bg-slate-700/30 rounded border border-slate-600">No new orders.</div>}
            </div>

            {/* ✅ CALENDAR SECTION */}
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

            {/* Order List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Orders ({displayedOrders.length})</h3>
              {isLoadingHistory ? <div className="text-center text-slate-500 text-xs py-4 animate-pulse">Fetching history...</div> : displayedOrders.length === 0 && <div className="text-slate-500 text-center text-sm py-4">No orders in range</div>}
              
              {displayedOrders.map((o, i) => {
                  // Determine State
                  // 1. Pending Assignment (from Dropdown or Auto-Assign)
                  // 2. Saved Assignment (from DB)
                  const assignedAgentId = assignments[o.sk] || o.gsi1pk;
                  const color = assignedAgentId ? getAgentColor(assignedAgentId) : '#475569'; 
                  const isDelivered = o.orderStatus === 'DELIVERED';
                  const isPending = assignments[o.sk] !== undefined; // Is actively being changed?

                  return (
                  <div 
                    key={o.sk || i} 
                    onClick={() => { handleOrderClick(o.sk); setIsMenuOpen(false); }} 
                    className={`bg-slate-800 rounded-lg border p-3 cursor-pointer shadow-sm group relative transition-colors ${isPending ? 'border-yellow-500/50 bg-slate-800/80' : 'border-slate-700 hover:border-blue-400'}`} 
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color }}>{i+1}</span>
                          {optimizationMetrics[o.sk] && (<span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/30 px-2 py-0.5 rounded">{optimizationMetrics[o.sk].dist}km</span>)}
                      </div>
                      <div className="mb-2">
                            <p className="font-bold text-xs truncate text-slate-200">{o.customer || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-500">{o.sk.split('#')[1].slice(0, 8)}...</p>
                      </div>
                      
                      {/* ✅ RESTORED DROPDOWN (Visible Directly in Card) */}
                      {isDelivered ? (
                          <div className="text-[10px] font-bold text-slate-400 bg-slate-900 p-2 rounded border border-slate-600">
                              Agent: {agents.find(a => getCleanPhone(a.id || a.sk) === getCleanPhone(assignedAgentId))?.name || "Unknown"}
                          </div>
                      ) : (
                          <select 
                            value={assignedAgentId || ""} 
                            onClick={(e) => e.stopPropagation()} 
                            onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} 
                            className="w-full bg-slate-900 border border-slate-600 text-[10px] text-white rounded p-1.5 outline-none focus:border-blue-500 hover:bg-slate-700 transition-colors"
                          >
                              <option value="" disabled>Select Agent</option>
                              {agents.map((agent, aIndex) => (<option key={agent.id || aIndex} value={agent.id || agent.sk}>{agent.name}</option>))}
                          </select>
                      )}

                      {/* Tooltip (Items & Phone) */}
                      {activeTooltipId === o.sk && (
                          <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-slate-700 p-3 rounded-lg shadow-2xl border border-slate-600 z-[5000] animate-fade-in cursor-default">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Order Details</h5>
                              <div className="text-[10px] text-slate-300 mb-2 font-mono">Phone: {formatPhone(o.phone)}</div>
                              {orderItemsCache[o.sk] ? (
                                  <div className="space-y-1 max-h-24 overflow-y-auto border-t border-slate-600 pt-2">
                                      {orderItemsCache[o.sk].map((item, idx) => (
                                          <div key={idx} className="flex justify-between text-xs text-slate-300"><span>{item.name}</span><span className="font-bold">x{item.quantity||1}</span></div>
                                      ))}
                                  </div>
                              ) : <div className="text-xs text-slate-500">Loading items...</div>}
                          </div>
                      )}
                  </div>
                  );
              })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryOptimizer;
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

const getCustName = (order) => {
    try {
        let n = order.name || order.customerName || order.customer;
        if (n?.S) n = n.S;
        if (n && n !== 'unknown' && n !== '_._' && !String(n).includes('undefined')) return String(n);
    } catch(e) {}
    return "Customer";
};

const getCustPhone = (order) => {
    try {
        let p = order.phone || order.customerPhone || order.customer_phone;
        if (p?.S) p = p.S;
        if (p && String(p).replace(/\D/g, '').length > 5) return String(p);

        let gsi = order.gsi2pk;
        if (gsi?.S) gsi = gsi.S;
        if (gsi && typeof gsi === 'string') {
            const parts = gsi.split('#');
            const last = parts[parts.length - 1];
            if (last && last.replace(/\D/g, '').length > 5) return last;
        }
    } catch(e) {}
    return "Unknown";
};

const formatPhone = (phoneStr) => {
    if (!phoneStr || phoneStr === "Unknown" || String(phoneStr).includes("undefined")) return "Unknown";
    const clean = String(phoneStr).replace(/\D/g, '');
    if (clean.length > 8) return clean.replace(/(\d{3,4})(\d{4})(\d+)/, '+$1 $2 $3');
    return clean.length > 5 ? '+' + clean : "Unknown";
};

const getTodayString = () => new Date().toISOString().split('T')[0];
const getPastDateString = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
};

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
        if (!startDate || (startDate && endDate)) { onChange(selectedStr, null); } 
        else { selectedStr < startDate ? onChange(selectedStr, startDate) : onChange(startDate, selectedStr); }
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
                {['S','M','T','W','T','F','S'].map((d, i) => <div key={`h-${i}`} className="text-[9px] text-slate-500 font-bold">{d}</div>)}
                {days.map((d, i) => {
                    if (!d) return <div key={`empty-${i}`} />;
                    const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isStart = currentStr === startDate;
                    const isEnd = currentStr === endDate;
                    const isInRange = startDate && endDate && currentStr > startDate && currentStr < endDate;
                    let bgClass = "hover:bg-slate-700 text-slate-300";
                    if (isStart || isEnd) bgClass = "bg-indigo-600 text-white font-bold shadow-md transform scale-110 z-10 relative";
                    else if (isInRange) bgClass = "bg-indigo-900/50 text-indigo-200 rounded-none";
                    
                    return (
                        <button key={`day-${i}`} onClick={(e) => { e.stopPropagation(); handleDayClick(d); }} className={`h-7 w-7 ${isInRange ? '' : 'rounded-full'} text-xs flex items-center justify-center transition-all ${bgClass}`}>
                            {d}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 text-[9px] text-slate-500 text-center font-mono">
                {!startDate ? "Select Start Date" : !endDate ? "Select End Date" : `${startDate} ➝ ${endDate}`}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------
   MAIN COMPONENT: DeliveryOptimizer
-------------------------------------------------------------------*/
const DeliveryOptimizer = ({
  orders, 
  AGENT_COLORS,
  restaurantLocation,
  onClose,
  onAssignmentSaved,
  phoneNbr 
}) => {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const animationFrameId = useRef(null);
  const isMountedRef = useRef(true); 

  const [liveAgents, setLiveAgents] = useState([]);
  const [isFetchingAgents, setIsFetchingAgents] = useState(true);

  const agentAnimationState = useRef({}); 
  const latestAgentsRef = useRef(liveAgents);
  const markersRef = useRef({});          
  
  const persistentInfo = useRef({});

  const [isMenuOpen, setIsMenuOpen] = useState(true); 
  const [showDelivered, setShowDelivered] = useState(false); 
  const [showDelivering, setShowDelivering] = useState(true);
  
  const [dateFilter, setDateFilter] = useState({ start: getTodayString(), end: getTodayString(), label: 'Today' });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [fetchedHistory, setFetchedHistory] = useState([]); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [assignments, setAssignments] = useState({}); 
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); 
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [optimizationMetrics, setOptimizationMetrics] = useState({});
  const [activeTooltipId, setActiveTooltipId] = useState(null); 
  const [orderItemsCache, setOrderItemsCache] = useState({}); 

  // Fetch agents on mount with STRICT SHIELD
  useEffect(() => {
      let isMounted = true;
      const fetchFreshAgents = async () => {
          setIsFetchingAgents(true);
          try {
              const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
              const { data: allProfiles } = await client.models.BusinessData.listByBusiness(
                  { pk: `BUSINESS#${formattedPhone}`, sk: { beginsWith: 'AGENT#' } },
                  { authMode: 'apiKey' } 
              );

              const parsedAgents = allProfiles
                .filter(profile => String(profile.sk).startsWith('AGENT#') && profile.stockStatus !== false) 
                .map(profile => ({
                  id: profile.sk, 
                  name: profile.name || `Agent ${profile.sk.slice(-4)}`,
                  maxCapacity: profile.maxCapacityUnit ? parseInt(profile.maxCapacityUnit) : 10,
                  currentLoad: profile.capacityLeft ? parseInt(profile.capacityLeft) : 0,
                  location: parseLocation(profile.location),
                  phone: profile.phone || profile.sk.replace('AGENT#', '')
              }));
              
              if (isMounted) setLiveAgents(parsedAgents);
          } catch (e) {
              console.error("Error fetching live agents for Map:", e);
          } finally {
              if (isMounted) setIsFetchingAgents(false);
          }
      };

      if (phoneNbr) fetchFreshAgents();
      return () => { isMounted = false; };
  }, [phoneNbr]);

  useEffect(() => { 
      latestAgentsRef.current = liveAgents; 
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
  }, [liveAgents]);

  const findAgent = (idToFind) => {
      if (!idToFind) return null;
      const cleanToFind = getCleanPhone(idToFind);
      return liveAgents.find(a => getCleanPhone(a.id) === cleanToFind);
  };

  const getAgentColor = (agentId) => {
    if (!agentId) return '#64748b'; 
    const index = liveAgents.findIndex(a => getCleanPhone(a.id) === getCleanPhone(agentId)); 
    return AGENT_COLORS[index % AGENT_COLORS.length] || '#64748b';
  };

  const displayedOrders = useMemo(() => {
      const today = getTodayString();
      const isToday = dateFilter.start === today && dateFilter.end === today;
      const sourceData = isToday ? orders : fetchedHistory;
      
      return sourceData.map(o => {
          const currentName = getCustName(o);
          const currentPhone = getCustPhone(o);
          if (!persistentInfo.current[o.sk]) persistentInfo.current[o.sk] = { name: "Customer", phone: "Unknown" };
          if (currentName !== "Customer") persistentInfo.current[o.sk].name = currentName;
          if (currentPhone !== "Unknown") persistentInfo.current[o.sk].phone = currentPhone;

          return { ...o, _shieldedName: persistentInfo.current[o.sk].name, _shieldedPhone: persistentInfo.current[o.sk].phone };
      }).filter(o => {
          if (o.orderStatus === 'DELIVERED' && !showDelivered) return false;
          if (o.orderStatus === 'DELIVERING' && !showDelivering) return false;
          return true;
      });
  }, [orders, fetchedHistory, dateFilter, showDelivered, showDelivering]);

  // 🟢 ADDED MISSING VARIABLE BACK IN
  const hasActiveOrders = displayedOrders.some(o => ['ORDERED', 'PREPARED', 'DELIVERING'].includes(o.orderStatus));

  // 🟢 AUTOMATIC AI ROUTING ENGINE TRIGGER
  useEffect(() => {
      if (!isFetchingAgents && liveAgents.length > 0 && displayedOrders.length > 0) {
          const hasUnassignedActiveOrders = displayedOrders.some(o => ['ORDERED', 'PREPARED'].includes(o.orderStatus));
          if (hasUnassignedActiveOrders && !loading) {
              console.log("🤖 Dispatch Center Active: Calculating optimized fleets...");
              runOptimization();
          }
      }
  }, [isFetchingAgents, liveAgents.length, orders]);

  useEffect(() => {
      const today = getTodayString();
      if (dateFilter.start !== today || dateFilter.end !== today) {
          if (!dateFilter.end) return; 

          const fetchHistory = async () => {
              const pkToUse = phoneNbr ? (String(phoneNbr).startsWith('+') ? `BUSINESS#${phoneNbr}` : `BUSINESS#+${phoneNbr}`) : (orders[0]?.pk); 
              if (!pkToUse) return;
              setIsLoadingHistory(true);
              const startSK = `ORDER#${dateFilter.start}T00:00:00.000Z`;
              const endSK = `ORDER#${dateFilter.end}T23:59:59.999Z`;
              try {
                  const { data } = await client.models.BusinessData.listByBusiness(
                    { pk: pkToUse, sk: { between: [startSK, endSK] } },
                    { authMode: 'apiKey'}
                  );
                  setFetchedHistory(data);
              } catch (e) { console.error("History Fetch Error", e); } 
              finally { setIsLoadingHistory(false); }
          };
          fetchHistory();
      }
  }, [dateFilter, phoneNbr, orders]);

  const setPreset = (type) => {
      const today = getTodayString();
      if (type === 'Today') setDateFilter({ start: today, end: today, label: 'Today' });
      if (type === 'Yesterday') { const y = getPastDateString(1); setDateFilter({ start: y, end: y, label: 'Yesterday' }); }
      if (type === 'Week') setDateFilter({ start: getPastDateString(6), end: today, label: 'Week' });
      setIsCalendarOpen(false); 
  };

  const handleCalendarChange = (s, e) => { setDateFilter({ start: s, end: e, label: 'Custom' }); };

  const fetchOrderItems = async (order) => {
      if (orderItemsCache[order.sk]) return orderItemsCache[order.sk];
      try {
          const phoneNbrPk = String(order.pk).replace('BUSINESS#', '');
          const orderIdPart = String(order.sk).replace('ORDER#', '');
          const targetPk = `ORDER#${phoneNbrPk}#${orderIdPart}`;

          const { data: lineItems } = await client.models.BusinessData.listByBusiness(
              { pk: targetPk, sk: { beginsWith: 'ITEM#' } },
              { authMode: 'apiKey' }
          );
          
          setOrderItemsCache(prev => ({ ...prev, [order.sk]: lineItems }));
          return lineItems;
      } catch (err) { return []; }
  };

  const handleOrderClick = async (e, order) => {
      if (e && e.stopPropagation) e.stopPropagation(); 
      if (!order) return;
      if (activeTooltipId === order.sk) { setActiveTooltipId(null); return; }
      setActiveTooltipId(order.sk);
      await fetchOrderItems(order);
  };

  useEffect(() => {
    const styleId = 'popup-z-index-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .maplibregl-popup { z-index: 2000 !important; } 
        summary { list-style: none; } 
        summary::-webkit-details-marker { display: none; }
        .sliding-content { max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out, padding 0.3s ease-in-out; padding: 0 8px; background: rgba(255,255,255,0.6); }
        .sliding-content.open { max-height: 200px; opacity: 1; padding: 8px; border-top: 1px dashed #e2e8f0; }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
            
            if (!map.getLayer('agents-glow-layer')) map.addLayer({ id: 'agents-glow-layer', type: 'circle', source: 'agents-source', paint: { 'circle-radius': 20, 'circle-color': ['case', ['get', 'isStale'], '#94a3b8', ['get', 'color']], 'circle-opacity': 0.3, 'circle-blur': 0.5 } });
            if (!map.getLayer('agents-layer')) map.addLayer({ id: 'agents-layer', type: 'circle', source: 'agents-source', paint: { 'circle-radius': 8, 'circle-color': ['case', ['get', 'isStale'], '#64748b', ['get', 'color']], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });

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

        plotOrdersOnMap(displayedOrders, mapInstance.current, assignments, focusedAgentId);

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
      
      const lastSeenMins = props.lastSeen ? Math.floor((Date.now() - props.lastSeen) / 60000) : 0;
      const statusText = props.isStale ? `🕒 Offline` : `⚡ Live Now`;
      const statusColor = props.isStale ? '#64748b' : '#22c55e';

      setFocusedAgentId(cleanTrackerId); 
      const agentProfile = findAgent(cleanTrackerId);
      const agentName = agentProfile ? agentProfile.name : (props.name || 'Unknown');
      const agentPhoneStr = agentProfile ? (agentProfile.phone || cleanTrackerId) : cleanTrackerId;

      const popup = new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(e.features[0].geometry.coordinates.slice())
          .setHTML(`<div style="font-family:sans-serif;padding:10px;text-align:center;"><strong>${agentName}</strong><div class="animate-pulse text-xs text-slate-500 mt-1">Loading orders...</div></div>`)
          .addTo(map);

       try {
            const relevantOrders = displayedOrders.filter(o => {
                const orderAgentId = getCleanPhone(o.gsi1pk || o.deliveryAgentId);
                return orderAgentId === cleanTrackerId && o.orderStatus === 'DELIVERING';
            });

            const enrichedOrders = await Promise.all(relevantOrders.map(async (order) => {
                try {
                    const items = await fetchOrderItems(order);
                    return { ...order, itemsList: items };
                } catch { return { ...order, itemsList: [] }; }
            }));

            let contentHtml = '';
            if (enrichedOrders.length > 0) {
                contentHtml = enrichedOrders.map(o => {
                    const icon = '🚚';
                    const shortId = String(o.sk || "").replace('ORDER#', '').split('#')[0].split('.')[0];
                    const boxColor = '#3b82f6';
                    const bg = '#eff6ff';
                    
                    const detailsHtml = (o.itemsList || []).map(i => `
                        <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;padding:4px 0;border-bottom:1px dashed #cbd5e1;">
                            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:4px;">${i.name}</span>
                            <span style="font-weight:600;">x${i.quantity || 1}</span>
                        </div>
                    `).join('');

                    return `
                    <div style="background:${bg};margin-bottom:4px;border-radius:4px;border-left:3px solid ${boxColor};overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                        <div onclick="this.nextElementSibling.classList.toggle('open')" style="display:flex;align-items:center;font-size:11px;padding:8px 6px;cursor:pointer; transition: background 0.2s;">
                            <span style="font-weight:700;color:#334155;margin-right:6px;">${icon} ${shortId}</span>
                            <span style="color:#64748b;font-size:10px;">(${o.itemsNbr||o.itemsList.length} items)</span>
                        </div>
                        <div class="sliding-content">
                            ${detailsHtml || '<div style="font-size:10px;color:#64748b;padding-bottom:4px;">No Items</div>'}
                        </div>
                    </div>`;
                }).join('');
            } else { 
                contentHtml = `<div style="font-size:11px;color:#94a3b8;padding:6px;text-align:center;">No DELIVERING orders assigned.</div>`; 
            }
            
            popup.setHTML(`
                <div style="font-family:sans-serif;min-width:220px;max-width:260px;">
                    <div style="border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold;font-size:13px;color:#0f172a;">${agentName}</div>
                            <div style="font-size:11px;color:#64748b;">${formatPhone(agentPhoneStr)}</div>
                        </div>
                        <span style="font-size:9px; font-weight:bold; color:${statusColor}; background:${props.isStale?'#f1f5f9':'#dcfce7'}; padding:2px 5px; border-radius:99px;">${statusText}</span>
                    </div>
                    <div style="max-height:220px;overflow-y:auto;padding-right:2px;">${contentHtml}</div>
                </div>
            `);
       } catch (err) { popup.setHTML('<div style="padding:5px;color:red;font-size:10px;">Failed to load data</div>'); }
  };

  const startFetchLoop = () => {
    const fetchPositions = async () => {
      if (!isMountedRef.current) return;
      try {
        const session = await fetchAuthSession();
        const locClient = new LocationClient({ region: outputs.geo.aws_region, credentials: session.credentials });
        let token = undefined;
        do {
          const response = await locClient.send(new ListDevicePositionsCommand({ 
              TrackerName: outputs.custom.amazon_location_service.trackers.default, 
              NextToken: token, MaxResults: 100 
          }));
          
          if (response.Entries) {
            response.Entries.forEach(entry => {
                if (entry.Position && entry.DeviceId) {
                    const id = entry.DeviceId;
                    const newPos = entry.Position; 
                    const sampleTime = entry.SampleTime ? new Date(entry.SampleTime).getTime() : Date.now();
                    const current = agentAnimationState.current[id];
                    
                    if (!current) { 
                        agentAnimationState.current[id] = { start: newPos, end: newPos, startTime: Date.now(), lastSeen: sampleTime }; 
                    } else if (sampleTime >= current.lastSeen) { 
                        agentAnimationState.current[id] = { start: current.end, end: newPos, startTime: Date.now(), lastSeen: sampleTime }; 
                    }
                }
            });
          }
          token = response.NextToken;
        } while (token);
      } catch (error) { }
      if (isMountedRef.current) setTimeout(fetchPositions, REFRESH_RATE_MS);
    };
    fetchPositions();
  };
  
  const startAnimationLoop = (map) => {
      const animate = () => {
          if (!isMountedRef.current) return;
          const now = Date.now();
          const features = [];
          
          const validAgents = latestAgentsRef.current || [];
          const validAgentPhones = validAgents.map(a => getCleanPhone(a.id));

          Object.entries(agentAnimationState.current).forEach(([id, state]) => {
              const cleanId = getCleanPhone(id);
              if (!validAgentPhones.includes(cleanId)) return; 

              const elapsed = now - state.startTime;
              let t = elapsed / ANIMATION_DURATION_MS;
              if (t > 1) t = 1;
              const currentLng = state.start[0] + (state.end[0] - state.start[0]) * t;
              const currentLat = state.start[1] + (state.end[1] - state.start[1]) * t;
              const isStale = (now - state.lastSeen) > STALE_THRESHOLD_MS;

              const agentObj = findAgent(cleanId);
              const agentColor = getAgentColor(agentObj ? agentObj.id : null);

              features.push({ 
                  type: 'Feature', 
                  geometry: { type: 'Point', coordinates: [currentLng, currentLat] }, 
                  properties: { 
                      id: id, 
                      name: agentObj ? agentObj.name : `Agent ${id.slice(-4)}`, 
                      isStale: isStale, 
                      lastSeen: state.lastSeen,
                      color: agentColor 
                  } 
              });
          });

          const source = map.getSource('agents-source');
          if (source) {
              source.setData({ type: 'FeatureCollection', features: features });
          }
          animationFrameId.current = requestAnimationFrame(animate);
      };
      animate();
  };

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
              const assignedAgentId = currentAssignments[order.sk] || order.gsi1pk; 
              const agentObj = findAgent(assignedAgentId);
              const strictAgentId = agentObj ? agentObj.id : null;
              
              const markerColor = getAgentColor(strictAgentId); 
              let iconContent = status === 'DELIVERING' ? '🚚' : status === 'DELIVERED' ? '✅' : '📦';

              const el = document.createElement('div');
              el.className = 'marker-order';
              el.innerHTML = `<span style="color:white;font-weight:bold;font-size:12px;">${iconContent}</span>`;
              Object.assign(el.style, {
                  backgroundColor: markerColor, 
                  width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', cursor: 'pointer'
              });

              const shortId = String(order.sk || "").replace('ORDER#', '').split('#')[0].split('.')[0];
              const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`<div>Loading...</div>`);
              const marker = new maplibregl.Marker({ element: el }).setLngLat([loc.longitude, loc.latitude]).setPopup(popup).addTo(map);

              el.addEventListener('click', async (e) => {
                  e.stopPropagation(); 
                  map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 15 });
                  marker.togglePopup();

                  const items = await fetchOrderItems(order);
                  const itemsHtml = items.length ? items.map(i => `<div style="display:flex;justify-content:space-between;border-bottom:1px dashed #eee;padding:4px 0;"><span style="color:#334155;">${i.name}</span><strong style="color:#0f172a;">x${i.quantity || 1}</strong></div>`).join('') : 'No items';
                  
                  const custPhone = formatPhone(order._shieldedPhone);
                  const custName = order._shieldedName;
                  const agentName = agentObj ? agentObj.name : "Unassigned";

                  popup.setHTML(`
                    <div style="font-family: sans-serif; font-size: 12px; min-width: 180px; color: #334155;">
                        <div style="background:${status === 'DELIVERING' ? '#eff6ff' : '#f0fdf4'}; padding:6px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <b style="color:#1e293b;">ORD: ${shortId}</b> <span style="font-size:14px;">${iconContent}</span>
                        </div>
                        
                        <div style="margin-bottom:8px; font-weight:600; color:#1e293b; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 110px;">${custName}</span>
                            <span style="font-size:11px; color:#475569; font-weight:normal; margin-left:8px;">📞 ${custPhone}</span>
                        </div>

                        <div style="margin-bottom:8px; color:#64748b; font-size:11px;">
                            Agent: <strong style="color:${markerColor}; font-size:12px;">${agentName}</strong>
                        </div>
                        
                        <div style="max-height:150px; overflow-y:auto; margin-bottom:8px; border-top:1px solid #e2e8f0; padding-top:4px;">${itemsHtml}</div>
                    </div>
                  `);
              });
              markersRef.current[order.sk] = marker;
          }
      });
  };

  const runOptimization = async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const geoClient = new GeoRoutesClient({ region: outputs.geo.aws_region, credentials: session.credentials });
      const validAgents = latestAgentsRef.current.filter(a => parseLocation(a.location));
      const orderMetrics = {};
      
      const activeOrders = displayedOrders.filter(o => ['ORDERED', 'PREPARED'].includes(o.orderStatus));

      const orderPromises = activeOrders.map(async (order) => {
            const custLoc = parseLocation(order.location);
            if (restaurantLocation && custLoc) {
                try {
                    const res = await geoClient.send(new CalculateRoutesCommand({ Origin: [restaurantLocation.longitude, restaurantLocation.latitude], Destination: [custLoc.longitude, custLoc.latitude], TravelMode: "Car" }));
                    if (res.Routes?.length) { const s = res.Routes[0].Summary; orderMetrics[order.sk] = { dist: parseFloat((s.Distance / 1000).toFixed(2)), dur: Math.round(s.Duration) }; }
                } catch (e) {}
            }
        });
      
      await Promise.all([...orderPromises]); 

      const enrichedAgents = validAgents.map(a => ({ id: a.id, name: a.name, location: parseLocation(a.location), maxCapacity: 10, currentLoad: 0 }));
      const enrichedOrders = activeOrders.map(o => ({ ...o, distFromRest: orderMetrics[o.sk]?.dist || 0 }));

      const response = await client.queries.optimizeDelivery({
        orders: JSON.stringify(enrichedOrders),
        agents: JSON.stringify(enrichedAgents), 
        restaurantLocation: JSON.stringify(restaurantLocation)
      });

      let proposal = [];
      try {
          if (response.data && response.data.proposal) {
              proposal = typeof response.data.proposal === 'string' 
                ? JSON.parse(response.data.proposal) 
                : response.data.proposal;
          }
      } catch(e) {}

      setOptimizationMetrics(orderMetrics); 
      
      const newAssignments = {};
      if (Array.isArray(proposal)) {
          proposal.forEach(p => { 
              if (p.assignedOrders) { 
                  p.assignedOrders.forEach(orderSk => { 
                      const fullAgentObj = latestAgentsRef.current.find(a => getCleanPhone(a.id) === getCleanPhone(p.agentId));
                      if (fullAgentObj) {
                          newAssignments[orderSk] = fullAgentObj.id; 
                      }
                  }); 
              } 
          });
      }
      setAssignments(prev => ({ ...prev, ...newAssignments }));

    } catch (err) { console.error("Optimization Error:", err); } finally { setLoading(false); }
  };

  const handleDispatch = async () => {
    if (Object.keys(assignments).length === 0) return;
    setSaving(true); 
    try {
      const updateTasks = Object.entries(assignments).map(async ([orderSk, finalAgentId]) => {
          const order = displayedOrders.find(o => o.sk === orderSk);
          if (!order) return;
          
          await client.models.BusinessData.update({
              pk: order.pk, 
              sk: orderSk, 
              gsi1pk: finalAgentId,           
              deliveryAgentId: finalAgentId, 
              orderStatus: 'DELIVERING'  
          });
      });
      await Promise.all(updateTasks);
      setAssignments({}); 
      if (onAssignmentSaved) onAssignmentSaved();
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex z-50 overflow-hidden h-[100dvh]">
      
      {/* 1. HEADER */}
      <div className="absolute top-4 left-4 right-4 z-[5000] flex justify-between pointer-events-none">
          <button onClick={() => setIsMenuOpen(prev => !prev)} className="pointer-events-auto bg-slate-800/90 text-white p-3 rounded-full shadow-xl border border-slate-700 hover:bg-slate-700 transition-transform active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button onClick={onClose} className="pointer-events-auto bg-slate-800/90 text-slate-300 p-3 rounded-full shadow-xl border border-slate-700 hover:text-white hover:bg-red-900/50 transition-colors">✕</button>
      </div>

      {/* 2. MAP */}
      <div className="flex-1 relative w-full h-full">
        <div ref={mapContainerRef} id="map" style={{ width: '100%', height: '100%' }} />
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
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 text-center ">Dispatch</h2>
                {hasActiveOrders ? (
                  <div className="w-full">
                    {loading ? (
                        <div className="text-emerald-400 text-xs font-bold text-center py-2 animate-pulse bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                            🤖 AI Route Matrix Calculating...
                        </div>
                    ) : (
                        <button onClick={handleDispatch} disabled={saving || Object.keys(assignments).length === 0} className={`text-white font-bold rounded-lg h-12 w-full flex items-center justify-center text-sm transition-all ${Object.keys(assignments).length > 0 ? 'bg-blue-600 hover:bg-blue-500 shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                            {saving ? "Deploying Fleet..." : "📦 Confirm Fleet Assignments"}
                        </button>
                    )}
                  </div>
                ) : <div className="text-center py-2 text-slate-400 text-sm bg-slate-700/30 rounded border border-slate-600">No active orders.</div>}
            </div>

            {/* Calendar */}
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
                  const assignedAgentId = assignments[o.sk] || o.gsi1pk;
                  const agentObj = findAgent(assignedAgentId);
                  const strictSelectValue = agentObj ? agentObj.id : "";

                  const isDelivered = o.orderStatus === 'DELIVERED';
                  const isPending = assignments[o.sk] !== undefined;

                  const shortId = String(o.sk || "").replace('ORDER#', '').split('#')[0].split('.')[0];
                  
                  const custPhone = formatPhone(o._shieldedPhone);
                  const agentPhoneStr = formatPhone(agentObj?.phone || getCleanPhone(assignedAgentId));
                  const custName = o._shieldedName;
                  
                  // Color lookup
                  const activeColorHex = agentObj ? getAgentColor(strictSelectValue) : '#ffffff'; 

                  if (isDelivered) {
                      return (
                          <div 
                              key={o.sk || i} 
                              onClick={(e) => { handleOrderClick(e, o); setIsMenuOpen(false); }} 
                              className="bg-slate-800/60 rounded-lg border border-slate-700/50 p-3 cursor-pointer shadow-sm relative transition-colors hover:border-green-500/50" 
                              style={{ borderLeft: `4px solid #22c55e` }} 
                          >
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-green-500/20 text-green-400">✓</span>
                                  <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold tracking-widest">DELIVERED</span>
                              </div>
                              <div className="mb-2 space-y-1">
                                  <p className="font-bold text-xs text-slate-200">ID: {shortId}</p>
                                  <p className="font-bold text-xs text-slate-200 truncate">
                                      {custName} <span className="text-slate-400 font-normal ml-1">({custPhone})</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">Agent: <span style={{color: activeColorHex, fontWeight: 'bold'}}>{agentPhoneStr}</span></p>
                              </div>
                              
                              {activeTooltipId === o.sk && (
                                  <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-slate-700 p-3 rounded-lg shadow-2xl border border-slate-600 z-[5000] animate-fade-in cursor-default">
                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Order Items</h5>
                                      {orderItemsCache[o.sk] ? (
                                          <div className="space-y-1 max-h-24 overflow-y-auto border-t border-slate-600 pt-2">
                                              {orderItemsCache[o.sk].map((item, idx) => (
                                                  <div key={`itm-${idx}`} className="flex justify-between text-xs text-slate-300"><span>{item.name}</span><span className="font-bold">x{item.quantity||1}</span></div>
                                              ))}
                                          </div>
                                      ) : <div className="text-xs text-slate-500">Loading items...</div>}
                                  </div>
                              )}
                          </div>
                      );
                  }

                  return (
                  <div 
                    key={o.sk || i} 
                    onClick={(e) => { handleOrderClick(e, o); setIsMenuOpen(false); }} 
                    className={`bg-slate-800 rounded-lg border p-3 cursor-pointer shadow-sm group relative transition-colors ${isPending ? 'bg-slate-800 border-l-4' : 'border-slate-700 hover:border-blue-400 border-l-4'}`} 
                    style={{ borderLeftColor: activeColorHex }} 
                  >
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: activeColorHex }}>{i+1}</span>
                          {optimizationMetrics[o.sk] && (<span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/30 px-2 py-0.5 rounded">{optimizationMetrics[o.sk].dist}km</span>)}
                      </div>
                      
                      <div className="mb-2">
                            <p className="font-bold text-xs truncate text-slate-200">
                                {custName} <span className="text-slate-400 font-normal ml-1">({custPhone})</span>
                            </p>
                            <p className="text-[10px] text-slate-500">{shortId}</p>
                      </div>
                      
                      {/* 🟢 FIXED DROPDOWN SELECTION ARRAY */}
                      <select 
                        value={strictSelectValue} 
                        style={{ color: activeColorHex }}
                        onClick={(e) => e.stopPropagation()} 
                        onChange={(e) => setAssignments(prev => ({...prev, [o.sk]: e.target.value}))} 
                        className="w-full bg-slate-900 border border-slate-600 text-xs font-black rounded-lg p-2.5 outline-none focus:border-blue-500 transition-colors"
                      >
                          <option value="" className="text-slate-500 font-bold">Unassigned</option>
                          {liveAgents.map((agent, aIndex) => {
                              const optionColorHex = getAgentColor(agent.id);
                              return (
                                <option 
                                  key={`ag-${aIndex}`} 
                                  value={agent.id}
                                  style={{ color: optionColorHex }}
                                  className="bg-slate-900 font-bold text-xs"
                                >
                                    {agent.name}
                                </option>
                              );
                          })}
                      </select>

                      {activeTooltipId === o.sk && (
                          <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-slate-700 p-3 rounded-lg shadow-2xl border border-slate-600 z-[5000] animate-fade-in cursor-default">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Order Items</h5>
                              {orderItemsCache[o.sk] ? (
                                  <div className="space-y-1 max-h-24 overflow-y-auto border-t border-slate-600 pt-2">
                                      {orderItemsCache[o.sk].map((item, idx) => (
                                          <div key={`itm-${idx}`} className="flex justify-between text-xs text-slate-300">
                                              <span>{item.name}</span>
                                              <span className="font-bold">x{item.quantity||1}</span>
                                          </div>
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
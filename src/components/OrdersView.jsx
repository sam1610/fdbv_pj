

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { client } from '../DataHook/amplifyClient';
import { useVirtualizer } from '@tanstack/react-virtual';
import DeliveryOptimizer from './DeliveryOptimizer';

// --- Config & Helpers ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');
const ALL_STATUSES = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'];
const statusColors = {
  ORDERED: 'bg-blue-500',
  IN_PREPARATION: 'bg-yellow-500',
  PREPARED: 'bg-green-500',
  DELIVERING: 'bg-orange-500',
  DELIVERED: 'bg-gray-500'
};

// ✅ Robust Location Parser (Handles Raw DynamoDB & Clean JSON)
const parseLocation = (loc) => {
  if (!loc) return null;
  try {
    let data = loc;
    if (typeof data === 'string') data = JSON.parse(data);
    if (data.M) data = data.M; // Handle DynamoDB format

    const extract = (v) => (v && v.N ? parseFloat(v.N) : parseFloat(v));
    const lat = extract(data.latitude || data.lat);
    const lng = extract(data.longitude || data.lng || data.long);

    if (isNaN(lat) || isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  } catch (e) {
    return null;
  }
};

// PickUp Badge
const PickUpBadge = () => (
  <div className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-900 text-indigo-200 border border-indigo-500/30">
    <svg className="mr-1 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
      <path d="M16 21c0-1.1-2-2-4-2s-4 .9-4 2" />
    </svg>
    Pick-Up
  </div>
);

// ✅ UPDATED FILTERS: Accepts 'onDispatch' and 'loadingMap'
const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'Prepared', label: 'Prepared' },
  { id: 'all', label: 'All History' }
];

const OrderFilters = ({ currentFilter, setFilter, hasPrepared, readyForDispatch, onDispatch, loadingMap }) => (
  <div className="flex flex-col space-y-4 mb-6">
    <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-inner">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setFilter(tab.id)}
          className={classNames(
            'flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200',
            currentFilter === tab.id 
              ? 'bg-sky-600 text-white shadow-lg' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          )}
        >
          {tab.label} {tab.id === 'Prepared' && hasPrepared > 0 ? `(${hasPrepared})` : ''}
        </button>
      ))}
    </div>

    {/* Dispatch Action Button */}
    <button
      onClick={onDispatch}
      disabled={loadingMap}
      className={classNames(
        "w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-[0.98]",
        loadingMap 
          ? "bg-slate-700 text-slate-500 cursor-not-allowed" 
          : "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:brightness-110"
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {loadingMap ? (
          <>
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span>Locating Agents...</span>
          </>
        ) : (
          <>
            <span>📍 Dispatch Center</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px]">
              {readyForDispatch.length} Ready
            </span>
          </>
        )}
      </div>
    </button>
  </div>
);

// Status Editor
const OrderStatusEditor = ({ order, isEditing, onEdit, onStatusChange }) => {
  if (isEditing) {
    return (
      <select
        value={order.orderStatus}
        onChange={(e) => onStatusChange(order, e.target.value)}
        onBlur={() => onEdit(null)}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-600 text-white text-xs rounded p-1"
        autoFocus
      >
        {ALL_STATUSES.map(status => (
          <option key={status} value={status}>{status.replace('_', ' ').toLowerCase()}</option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); onEdit(order.sk); }}
      className={classNames(statusColors[order.orderStatus] || 'bg-gray-400', 'text-xs font-semibold px-2 py-0.5 rounded-full text-white cursor-pointer')}
    >
      {order.orderStatus?.replace('_', ' ').toLowerCase() || 'unknown'}
    </span>
  );
};

// Memoized Order Card
const OrderCard = React.memo(({ order, isEditing, setEditingId, onStatusChange, onClick, getAgentName, updatingId }) => {

  const isActuallyPickup = order.isPickUp === true || 
                         order.isPickUp === 1 || 
                         String(order.isPickUp).toLowerCase() === 'true';
  return (
    <div
      onClick={onClick}
      className={classNames(
        "bg-slate-800 p-3 rounded-lg flex items-center transition h-full",
        updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700',
        !isEditing && 'cursor-pointer'
      )}
    >
      <div className="flex-grow min-w-0">
        <div className="flex items-center">
          <p className="font-bold text-white truncate">
            ORD: {order.sk.replace('ORDER#', '').split('.')[0]}
          </p>
          {isActuallyPickup && (
            <div className="flex-shrink-0">
              <PickUpBadge />
            </div>
          )}
        </div>
        <p className="text-sm text-slate-400 truncate">
          Customer: {order.gsi2pk?.split('#')[2] || 'N/A'}
        </p>
      </div>

      {['DELIVERING', 'DELIVERED'].includes(order.orderStatus) && (
        <div className="flex flex-col items-center justify-center mx-4 min-w-[120px]">
          <span className={classNames(
            "text-[10px] font-bold uppercase tracking-wider mb-0.5",
            order.orderStatus === 'DELIVERING' ? "text-orange-400" : "text-green-400"
          )}>
            {order.orderStatus === 'DELIVERING' ? 'Out for Delivery' : 'Delivered By'}
          </span>
          <div className="flex flex-col items-center">
            <span className="text-white font-bold text-sm">
              {getAgentName(order.gsi1pk)}
            </span>
            <span className="text-slate-400 text-xs font-mono">
              {order.gsi1pk?.split('#')[1] || ''}
            </span>
          </div>
        </div>
      )}

      <div className="text-right flex-shrink-0 ml-4">
        <p className="font-bold text-white">BD {order.totalAmount?.toFixed(2) || '0.00'}</p>
        <OrderStatusEditor
          order={order}
          isEditing={isEditing}
          onEdit={setEditingId}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
});

const generateDistinctColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.floor((360 / count) * i);
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
};

// --- MAIN COMPONENT ---
const OrdersView = ({ phoneNbr, setModal, deliveryAgents = [], businessLocation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');
  const [editingId, setEditingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [nextToken, setNextToken] = useState(null); // ✅ NEW: Tracks DynamoDB cursor
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false); // ✅ NEW: Pagination loader
  // ✅ New States for Map/Agents
  const [liveAgents, setLiveAgents] = useState([]); 
  const [loadingMap, setLoadingMap] = useState(false);
  const [dispatchProposal, setDispatchProposal] = useState(null); // ✅ Stores the AI optimization result

  // 1. Fetch Orders
 // 1. Fetch Orders & Subscribe
  useEffect(() => {
    if (!phoneNbr) return;
    setLoading(true);

    // ✅ Track mounting to prevent updates after unmount
    let isMounted = true;
    const subscriptions = []; // Store subs in an array for safe cleanup

    const businessPk = `BUSINESS#${phoneNbr}`;
    const orderPrefix = 'ORDER#';
    const subFilter = { pk: { eq: businessPk }, sk: { beginsWith: orderPrefix } };

    const fetchAndSubscribe = async () => {
      try {
        // A. Initial Fetch
        const { data , nextToken: initialToken} = await client.models.BusinessData.listByBusiness({
          pk: businessPk,
          sk: { beginsWith: orderPrefix },
          sortDirection: 'DESC',
          limit: 20 // Fetch a small initial chunk
        });
        
        if (isMounted) {
            setOrders(data);
            setNextToken(initialToken);
            setLoading(false);
        }

        // B. Start Subscriptions (Inside async, but safe now)
        if (!isMounted) return;

        // 1. On Create
        const createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
            next: (newItem) => { 
                if (newItem && isMounted) {
                    setOrders(prev => {
                        // 🚨 CRITICAL FIX: DEDUPLICATION CHECK
                        // If an order with this SK already exists, do not add it again.
                        console.log("📥 Subscription Payload:", newItem);
                        if (prev.some(order => order.sk === newItem.sk)) {
                            console.warn("Duplicate prevented:", newItem.sk);
                            return prev;
                        }
                        return [newItem, ...prev];
                    }); 
                }
            }
        });
        subscriptions.push(createSub);

        // 2. On Update
        const updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
            next: (updatedItem) => {
                if (updatedItem && updatedItem.pk && isMounted) {
                    setOrders(prev => prev.map(item => 
                        (item.pk === updatedItem.pk && item.sk === updatedItem.sk) ? updatedItem : item
                    ));
                }
            }
        });
        subscriptions.push(updateSub);

        // 3. On Delete
        const deleteSub = client.models.BusinessData.onDelete({ filter: subFilter }).subscribe({
            next: (deletedItem) => {
                if (deletedItem && deletedItem.pk && isMounted) {
                    setOrders(prev => prev.filter(item => 
                        !(item.pk === deletedItem.pk && item.sk === deletedItem.sk)
                    ));
                }
            }
        });
        subscriptions.push(deleteSub);

      } catch (err) { 
          if (isMounted) {
              setError(err.message); 
              setLoading(false);
          }
      } 
    };

    fetchAndSubscribe();

    // ✅ ROBUST CLEANUP
    // This runs when the component unmounts or re-runs
    return () => { 
        isMounted = false;
        subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [phoneNbr]);

  // 2. Computed Values
  const sortedOrders = useMemo(() => [...orders].sort((a, b) => b.sk.localeCompare(a.sk)), [orders]);

  const filteredOrders = useMemo(() => {
    if (!sortedOrders.length) return [];
    if (filter === 'active') return sortedOrders.filter(o => ['ORDERED', 'IN_PREPARATION'].includes(o.orderStatus));
    if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
    if (filter === 'all') return sortedOrders;
    return [];
  }, [sortedOrders, filter]);

  const readyForDispatch = useMemo(() => {
    return sortedOrders
      .filter(o => o.orderStatus === 'PREPARED')
      .map(order => ({
        sk: order.sk,
        pk: order.pk,
        location: parseLocation(order.location),
        customer: order.gsi2pk?.split('#')[2] || 'Unknown',
        orderStatus: order.orderStatus
      }))
      .filter(o => o.location !== null);
  }, [sortedOrders]);

  // ✅ 3. All Map Orders (LAST 24 HOURS ONLY)
  // This filters the data *before* sending it to DeliveryOptimizer
  const allMapOrders = useMemo(() => {
    // Calculate cutoff time (24 hours ago)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    return sortedOrders
      .filter(o => {
          const isValidStatus = ['PREPARED', 'DELIVERING', 'DELIVERED'].includes(o.orderStatus);
          const isNotPickup = !o.isPickUp;
          // ✅ Time Filter: Only include orders created after the cutoff
          // (Assuming 'createdAt' exists. If it's missing, we default to true to avoid hiding data)
          const isRecent = o.createdAt ? o.createdAt >= cutoffTime : true; 
          
          return isValidStatus && isNotPickup && isRecent;
      })
      .map(order => ({
        sk: order.sk,
        pk: order.pk,
        location: parseLocation(order.location),
        customer: order.gsi2pk?.split('#')[2] || 'Unknown',
        orderStatus: order.orderStatus,
        gsi1pk: order.gsi1pk,
        pickupLocation: parseLocation(order.pickupLocation), // Important for optimization
        restaurantLocation: parseLocation(businessLocation), // Fallback,
        itemsNbr: order.itemsNbr || 1 ,
        totalAmount: order.totalAmount || 0

      }))
      .filter(o => o.location !== null);
  }, [sortedOrders, businessLocation]);

  // ✅ NEW: Calls the Backend Optimization Algorithm
  const handleDispatch = async (currentAgents) => {
    try {
      console.log("🤖 Calculating Optimal Routes...");
      
      // 1. Format Agents (Must match handler.ts expectations)
      const formattedAgents = currentAgents.map(a => ({
        id: a.id,
        location: a.location,
        currentLoad: a.currentLoad || 0,
        maxCapacity: a.maxCapacity || 10,
        deliveryDurationRemaining: 0 // You can update this if you have live tracking data
      }));

      // 2. Format Orders (Only send what needs to be dispatched)
      const formattedOrders = readyForDispatch.map(o => ({
        sk: o.sk,
        restaurantLocation: parseLocation(businessLocation),
        pickupLocation: parseLocation(o.pickupLocation), // If available
        size: 'REGULAR' // You can map this from your DB if you have order size
      }));

      // 3. Call AppSync Query
      const { data } = await client.queries.optimizeDelivery({
        agents: JSON.stringify(formattedAgents),
        orders: JSON.stringify(formattedOrders),
        restaurantLocation: JSON.stringify(parseLocation(businessLocation))
      });

      if (data) {
        console.log("✅ Optimization Result:", data);
        setDispatchProposal(data); // Store result to pass to DeliveryOptimizer
      }
      
    } catch (err) {
      console.error("❌ Dispatch Error:", err);
    }
  };

  // ✅ 4. FETCH LIVE AGENTS FUNCTION
  // const fetchLiveAgentLocations = async () => {
  //   setLoadingMap(true);
  //   try {
  //       console.log("📍 Locating Agents via Profile...");
  //       const promises = deliveryAgents.map(async (agent) => {
  //           try {
  //               // Agent.sk is usually "AGENT#+973..."
  //               const agentPhonePk = agent.sk; 
                
  //               // Fetch the PROFILE record (which has the real live location)
  //               const { data } = await client.models.BusinessData.listByBusiness({
  //                   pk: agentPhonePk,       
  //                   sk: { eq: agentPhonePk } 
  //               });

  //               const profile = data[0]; 
                
  //               return {
  //                   id: agent.sk,
  //                   name: agent.name,
  //                   // PRIORITY: Profile Location > Business Record Location > null
  //                   maxCapacity: profile?.maxCapacityUnit ? parseInt(profile.maxCapacityUnit) : 10,
  //                   currentLoad: profile?.capacityLeft ? parseInt(profile.capacityLeft) : 0,
  //                   location: profile?.location ? parseLocation(profile.location) : parseLocation(agent.location)
  //               };
  //           } catch (e) {
  //               console.warn(`Failed to fetch profile for ${agent.name}`, e);
  //               return { id: agent.sk, name: agent.name, location: parseLocation(agent.location), maxCapacity: 10, currentLoad: 0 };
  //           }
  //       });

  //       const results = await Promise.all(promises);
  //       setLiveAgents(results); 
        
  //       // After fetching, open the map
  //       setFilter('Auto-Assign');

  //   } catch (e) {
  //       console.error("Error fetching live agents", e);
  //   } finally {
  //       setLoadingMap(false);
  //   }
  // };

  // ✅ UPDATED: Fetches Agents AND Triggers Optimization
  const fetchLiveAgentLocations = async () => {
    setLoadingMap(true);
    try {
        console.log("📍 Locating Agents via Profile...");
        const promises = deliveryAgents.map(async (agent) => {
            // ... (Your existing agent fetching logic remains exactly the same) ...
            try {
                const agentPhonePk = agent.sk; 
                const { data } = await client.models.BusinessData.listByBusiness({
                    pk: agentPhonePk,       
                    sk: { eq: agentPhonePk } 
                });
                const profile = data[0]; 
                return {
                    id: agent.sk,
                    name: agent.name,
                    maxCapacity: profile?.maxCapacityUnit ? parseInt(profile.maxCapacityUnit) : 10,
                    currentLoad: profile?.capacityLeft ? parseInt(profile.capacityLeft) : 0,
                    location: profile?.location ? parseLocation(profile.location) : parseLocation(agent.location)
                };
            } catch (e) {
                return { id: agent.sk, name: agent.name, location: parseLocation(agent.location), maxCapacity: 10, currentLoad: 0 };
            }
        });

        const results = await Promise.all(promises);
        setLiveAgents(results); 
        
        // 🚀 TRIGGER OPTIMIZATION HERE with the fresh 'results'
        await handleDispatch(results);
        
        // Open the map view
        setFilter('Auto-Assign');

    } catch (e) {
        console.error("Error fetching live agents", e);
    } finally {
        setLoadingMap(false);
    }
  };
// ✅ 5. DEEP DIVE PAGINATION FUNCTION
const fetchNextPage = useCallback(async () => {
  // Guard: Don't fetch if there's no cursor or we are already loading
  if (!nextToken || isFetchingNextPage) return;

  setIsFetchingNextPage(true);
  try {
    console.log("🔍 Fetching next page of history...");
    const { data, nextToken: newNextToken } = await client.models.BusinessData.listByBusiness({
      pk: `BUSINESS#${phoneNbr}`,
      sk: { beginsWith: 'ORDER#' },
      sortDirection: 'DESC', // ✅ Newest first
      nextToken: nextToken,  // ✅ Use cursor to dig deeper
      limit: 20
    });

    // Append older orders to the end of the existing list
    setOrders(prev => [...prev, ...data]); 
    setNextToken(newNextToken);
  } catch (err) {
    console.error("Pagination error:", err);
  } finally {
    setIsFetchingNextPage(false);
  }
}, [nextToken, isFetchingNextPage, phoneNbr]);


  const parentRef = useRef();
  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 5,
  });

  const agentColors = useMemo(() => generateDistinctColors(deliveryAgents.length), [deliveryAgents.length]);
  const virtualItems = rowVirtualizer.getVirtualItems();
// ✅ 6. INFINITE SCROLL TRIGGER
useEffect(() => {
  const lastItem = virtualItems[virtualItems.length - 1];
  
  if (!lastItem) return;

  // Trigger fetch when user is 5 items away from the bottom of currently loaded orders
  if (lastItem.index >= filteredOrders.length - 5 && nextToken && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [virtualItems, filteredOrders.length, nextToken, isFetchingNextPage, fetchNextPage]);


  const handleStatusChange = useCallback(async (order, newStatus) => {
    if (order.orderStatus === newStatus) return setEditingId(null);
    setUpdatingId(order.sk);
    try {
      await client.models.BusinessData.update({ pk: order.pk, sk: order.sk, orderStatus: newStatus });
    } catch (err) { alert('Update failed'); console.error(err); } 
    finally { setUpdatingId(null); setEditingId(null); }
  }, []);

  const getAgentName = useCallback((gsi1pk) => {
    if (!gsi1pk) return 'Unknown';
    const agent = deliveryAgents.find(a => a.sk === gsi1pk);
    return agent ? agent.name : 'Unknown Agent';
  }, [deliveryAgents]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading orders...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
            Orders <span className="text-sky-500">Live</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Real-time Logistics Manager
          </p>
        </div>
        <div className="text-right">
            <span className="text-xs font-mono text-sky-400 bg-sky-400/10 px-2 py-1 rounded border border-sky-400/20">
                ● {filteredOrders.length} {filter}
            </span>
        </div>
      </header>

      <OrderFilters 
        currentFilter={filter} 
        setFilter={setFilter} 
        hasPrepared={readyForDispatch.length} 
        readyForDispatch={readyForDispatch}
        onDispatch={fetchLiveAgentLocations} 
        loadingMap={loadingMap} 
      />

      {filter !== 'Auto-Assign' ? (
        <div ref={parentRef} className="overflow-y-auto h-[600px] pr-2">
          {filteredOrders.length > 0 ? (
            <div style={{ height: rowVirtualizer.getTotalSize() + 'px', position: 'relative', width: '100%' }}>
              {virtualItems.map((virtualItem) => {
                const order = filteredOrders[virtualItem.index];
                return (
                  <div key={order.sk} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualItem.size + 'px', transform: `translateY(${virtualItem.start}px)` }}>
                    <OrderCard
                        order={order}
                        isEditing={editingId === order.sk}
                        setEditingId={setEditingId}
                        updatingId={updatingId}
                        onStatusChange={handleStatusChange}
                        getAgentName={getAgentName}
                        onClick={() => !editingId && setModal({ type: 'orderDetail', Id: order.sk, orderStatus: order.orderStatus, totalAmount: order.totalAmount, customerId: order.gsi2pk?.split('#')[2] || 'N/A' })}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-center mt-8">No {filter} orders found.</p>
          )}
        </div>
      ) : (
        /* ✅ Map View with Live Agents */
        <DeliveryOptimizer
          orders={allMapOrders}
          agents={liveAgents} // Use the Hydrated Agents
          proposal={dispatchProposal} // 👈 PASS THE OPTIMIZATION RESULT HERE
          AGENT_COLORS={agentColors}
          restaurantLocation={parseLocation(businessLocation)}
          onClose={() => setFilter('Prepared')}
          onAssignmentSaved={() => { /* optional refresh */ }}
          phoneNbr={phoneNbr}
        />
      )}
    </div>
  );
};

export default OrdersView;
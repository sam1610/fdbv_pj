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

const parseLocation = (loc) => {
  if (!loc) return null;
  try {
    let data = loc;
    if (typeof data === 'string') data = JSON.parse(data);
    if (data.M) data = data.M; 

    const extract = (v) => (v && v.N ? parseFloat(v.N) : parseFloat(v));
    const lat = extract(data.latitude || data.lat);
    const lng = extract(data.longitude || data.lng || data.long);

    if (isNaN(lat) || isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  } catch (e) {
    return null;
  }
};

// 🟢 OMNI-EXTRACTORS FOR CUSTOMER DATA
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

const OrderCard = React.memo(({ order, isEditing, setEditingId, onStatusChange, onClick, getAgentName, updatingId }) => {
  const isActuallyPickup = order.isPickUp === true || order.isPickUp === 1 || String(order.isPickUp).toLowerCase() === 'true';
  
  const displayName = getCustName(order);
  const displayPhone = formatPhone(getCustPhone(order));

  return (
    <div
      onClick={onClick}
      className={classNames(
        "bg-slate-800 p-3 rounded-lg flex items-center transition h-full border border-transparent",
        updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700 hover:border-slate-600',
        !isEditing && 'cursor-pointer'
      )}
    >
      <div className="flex-grow min-w-0">
        <div className="flex items-center mb-1">
          <p className="font-bold text-cyan-500 truncate text-sm">
            ORD: {order.sk.replace('ORDER#', '').split('.')[0]}
          </p>
          {isActuallyPickup && (
            <div className="flex-shrink-0">
              <PickUpBadge />
            </div>
          )}
        </div>
        
        <p className="text-sm truncate flex items-center">
            <span className="font-bold text-slate-300">{displayName}</span>
            {displayPhone !== "Unknown" && (
                <span className="ml-2 font-mono text-orange-500 text-[12px]  bg-slate-900/50 px-1.5 py-0.5 rounded">
                    📞 {displayPhone}
                </span>
            )}
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
            <span className="text-white font-bold text-sm bg-black/20 px-2 rounded">
              {getAgentName(order.gsi1pk)}
            </span>
          </div>
        </div>
      )}

      <div className="text-right flex-shrink-0 ml-4 flex flex-col items-end gap-2">
        <p className="font-black text-orange-400">BD {order.totalAmount?.toFixed(3) || '0.000'}</p>
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
    colors.push(`hsl(${Math.floor((360 / count) * i)}, 70%, 50%)`);
  }
  return colors;
};

// --- MAIN COMPONENT ---
export default function OrdersView({ phoneNbr, setModal, deliveryAgents = [], businessLocation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');
  const [editingId, setEditingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  
  const [nextToken, setNextToken] = useState(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  
  const [liveAgents, setLiveAgents] = useState([]); 
  const [loadingMap, setLoadingMap] = useState(false);
  const [dispatchProposal, setDispatchProposal] = useState(null);

  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 1. Fetch Orders & Subscribe (🔥 WEBSOCKET FIX APPLIED HERE)
  useEffect(() => {
    if (!phoneNbr) return;
    setLoading(true);

    const subscriptions = []; 
    
    // 🟢 BULLETPROOF PHONE: Guarantees it exactly matches DynamoDB (with '+')
    const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
    const businessPk = `BUSINESS#${formattedPhone}`;
    const orderPrefix = 'ORDER#';

    const fetchAndSubscribe = async () => {
      try {
        // Initial Fetch
        const { data, nextToken: initialToken } = await client.models.BusinessData.listByBusiness({
          pk: businessPk,
          sk: { beginsWith: orderPrefix },
          sortDirection: 'DESC',
          limit: 20 
        });
        
        if (isMounted.current) {
            setOrders(data);
            setNextToken(initialToken);
            setLoading(false);
        }

        // 🟢 SHIELDED WEBSOCKETS
        const handleNewItem = (item) => {
          if (!isMounted.current) return;
          if (item && item.pk === businessPk && String(item.sk).startsWith(orderPrefix)) {
              console.log("⚡ REAL-TIME: New Order Arrived!", item.sk);
              setOrders(prev => {
                  if (prev.some(o => o.sk === item.sk)) return prev;
                  return [item, ...prev];
              }); 
          }
        };

        const handleUpdateItem = (item) => {
          if (!isMounted.current) return;
          if (item && item.pk === businessPk && String(item.sk).startsWith(orderPrefix)) {
              console.log("⚡ REAL-TIME: Order Updated!", item.sk);
              setOrders(prev => prev.map(o => (o.sk === item.sk ? item : o)));
          }
        };

        const handleDeleteItem = (item) => {
          if (!isMounted.current) return;
          if (item && item.pk === businessPk && String(item.sk).startsWith(orderPrefix)) {
              console.log("⚡ REAL-TIME: Order Deleted!", item.sk);
              setOrders(prev => prev.filter(o => o.sk !== item.sk));
          }
        };

        subscriptions.push(client.models.BusinessData.onCreate().subscribe({ next: handleNewItem }));
        subscriptions.push(client.models.BusinessData.onUpdate().subscribe({ next: handleUpdateItem }));
        subscriptions.push(client.models.BusinessData.onDelete().subscribe({ next: handleDeleteItem }));

      } catch (err) { 
          if (isMounted.current) {
              setError(err.message); 
              setLoading(false);
          }
      } 
    };

    fetchAndSubscribe();
    
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [phoneNbr]);

  // Computed Values
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.orderDate || 0).getTime();
      const dateB = new Date(b.orderDate || 0).getTime();
      return dateB - dateA;
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!sortedOrders.length) return [];
    if (filter === 'active') return sortedOrders.filter(o => ['ORDERED', 'IN_PREPARATION'].includes(o.orderStatus));
    if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
    if (filter === 'all') return sortedOrders;
    return [];
  }, [sortedOrders, filter]);

  const readyForDispatch = useMemo(() => {
    return sortedOrders
      .filter(o => o.orderStatus === 'PREPARED' && o.location !== null)
      .map(order => ({
        ...order, 
        location: parseLocation(order.location),
        customer: getCustName(order),
      }));
  }, [sortedOrders]);

  const allMapOrders = useMemo(() => {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return sortedOrders
      .filter(o => ['PREPARED', 'DELIVERING', 'DELIVERED'].includes(o.orderStatus) && !o.isPickUp && (o.createdAt ? o.createdAt >= cutoffTime : true) && o.location !== null)
      .map(order => ({
        ...order, 
        location: parseLocation(order.location),
        customer: getCustName(order),
        pickupLocation: parseLocation(order.pickupLocation), 
        restaurantLocation: parseLocation(businessLocation), 
        itemsNbr: order.itemsNbr || 1,
        totalAmount: order.totalAmount || 0
      }));
  }, [sortedOrders, businessLocation]);

  const handleDispatch = async (currentAgents) => {
    try {
      console.log("🤖 Calculating Optimal Routes...");
      const formattedAgents = currentAgents.map(a => ({
        id: a.id, location: a.location, currentLoad: a.currentLoad || 0, maxCapacity: a.maxCapacity || 10, deliveryDurationRemaining: 0 
      }));
      const formattedOrders = readyForDispatch.map(o => ({
        sk: o.sk, restaurantLocation: parseLocation(businessLocation), pickupLocation: parseLocation(o.pickupLocation), size: 'REGULAR' 
      }));

      const { data } = await client.queries.optimizeDelivery({
        agents: JSON.stringify(formattedAgents),
        orders: JSON.stringify(formattedOrders),
        restaurantLocation: JSON.stringify(parseLocation(businessLocation))
      });

      if (data && isMounted.current) {
        setDispatchProposal(data); 
      }
    } catch (err) {
      console.error("❌ Dispatch Error:", err);
    }
  };

  const fetchLiveAgentLocations = async () => {
    setLoadingMap(true);
    try {
        const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
        const { data: allProfiles } = await client.models.BusinessData.listByBusiness({
            pk: `BUSINESS#${formattedPhone}`,
            sk: { beginsWith: 'AGENT#' }
        });

        const results = deliveryAgents.map(agent => {
            const profile = allProfiles.find(p => p.sk === agent.sk);
            return {
                id: agent.sk,
                name: agent.name,
                maxCapacity: profile?.maxCapacityUnit ? parseInt(profile.maxCapacityUnit) : 10,
                currentLoad: profile?.capacityLeft ? parseInt(profile.capacityLeft) : 0,
                location: profile?.location ? parseLocation(profile.location) : parseLocation(agent.location)
            };
        });

        if (isMounted.current) {
            setLiveAgents(results); 
            await handleDispatch(results);
            setFilter('Auto-Assign');
        }
    } catch (e) {
        console.error("Error fetching live agents", e);
    } finally {
        if (isMounted.current) setLoadingMap(false);
    }
  };

  const fetchNextPage = useCallback(async () => {
    if (!nextToken || isFetchingNextPage) return;
    setIsFetchingNextPage(true);
    try {
      const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
      const { data, nextToken: newNextToken } = await client.models.BusinessData.listByBusiness({
        pk: `BUSINESS#${formattedPhone}`,
        sk: { beginsWith: 'ORDER#' },
        sortDirection: 'DESC', 
        nextToken: nextToken,  
        limit: 20
      });

      if (isMounted.current) {
         setOrders(prev => {
             const newItems = data.filter(d => !prev.some(p => p.sk === d.sk));
             return [...prev, ...newItems];
         }); 
         setNextToken(newNextToken);
      }
    } catch (err) {
      console.error("Pagination error:", err);
    } finally {
      if (isMounted.current) setIsFetchingNextPage(false);
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

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
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
    finally { if (isMounted.current) { setUpdatingId(null); setEditingId(null); } }
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
                        onClick={() => !editingId && setModal({ 
                            type: 'orderDetail', 
                            Id: order.sk, 
                            orderStatus: order.orderStatus, 
                            totalAmount: order.totalAmount, 
                            customerId: order.gsi2pk || order.phone, 
                            customerName: getCustName(order) 
                        })}
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
        <DeliveryOptimizer
          orders={allMapOrders}
          agents={liveAgents} 
          proposal={dispatchProposal} 
          AGENT_COLORS={agentColors}
          restaurantLocation={parseLocation(businessLocation)}
          onClose={() => setFilter('Prepared')}
          onAssignmentSaved={() => { /* optional refresh */ }}
          phoneNbr={phoneNbr}
        />
      )}
    </div>
  );
}
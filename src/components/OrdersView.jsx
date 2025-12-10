
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

// Parse DynamoDB Number location format
const parseLocation = (loc) => {
  if (!loc) return null;
  try {
    if (typeof loc === 'string') loc = JSON.parse(loc);
    return {
      latitude: parseFloat(loc.latitude?.N || loc.lat?.N || loc.latitude || 0),
      longitude: parseFloat(loc.longitude?.N || loc.long?.N || loc.longitude || 0)
    };
  } catch (e) {
    console.warn("Invalid location:", loc);
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

// Filters
const OrderFilters = ({ currentFilter, setFilter, hasPrepared, readyForDispatch }) => (
  <div className="flex flex-wrap gap-3 mb-6">
    <button onClick={() => setFilter('active')} className={classNames(currentFilter === 'active' ? 'bg-sky-600' : 'bg-slate-700', 'px-4 py-2 rounded-lg text-sm font-medium')}>
      Active
    </button>
    <button onClick={() => setFilter('Prepared')} className={classNames(currentFilter === 'Prepared' ? 'bg-sky-600' : 'bg-slate-700', 'px-4 py-2 rounded-lg text-sm font-medium')}>
      Prepared ({hasPrepared})
    </button>
    <button onClick={() => setFilter('all')} className={classNames(currentFilter === 'all' ? 'bg-sky-600' : 'bg-slate-700', 'px-4 py-2 rounded-lg text-sm font-medium')}>
      All
    </button>

    {/* Allow opening map even if 0 prepared orders, so Admin can track delivering ones */}
    <button
      onClick={() => setFilter('Auto-Assign')}
      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition"
    >
      {/* Show count of dispatchable orders, but text implies map view access */}
      Dispatch Map ({readyForDispatch.length} Ready)
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

// ✅ MEMOIZED COMPONENT to prevent full re-renders
const OrderCard = React.memo(({ order, isEditing, setEditingId, onStatusChange, onClick, getAgentName, updatingId }) => {
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
          {order.isPickUp && <PickUpBadge />}
        </div>
        <p className="text-sm text-slate-400 truncate">
          Customer: {order.gsi2pk?.split('#')[2] || 'N/A'}
        </p>
      </div>

      {/* ✅ UPDATED: Show Agent Info for both DELIVERING and DELIVERED */}
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

// Main Component
const OrdersView = ({ phoneNbr, setModal, deliveryAgents = [], businessLocation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');
  const [editingId, setEditingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  
  // ✅ 1. ZERO SCAN LOGIC: Query Index + Subscribe
  useEffect(() => {
    if (!phoneNbr) return;

    setLoading(true);
    let createSub, updateSub, deleteSub;
    const businessPk = `BUSINESS#${phoneNbr}`;
    const orderPrefix = 'ORDER#';

    const fetchAndSubscribe = async () => {
      try {
        // A. Initial Query (Zero Scan - uses Index)
        const { data } = await client.models.BusinessData.listByBusiness({
          pk: businessPk,
          sk: { beginsWith: orderPrefix },
          sortDirection: 'DESC'
        });
                                                                     
        setOrders(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }

      // B. Real-time Subscription (Zero Scan - filtered by AppSync)
      const subFilter = { 
        pk: { eq: businessPk }, 
        sk: { beginsWith: orderPrefix } 
      };

      createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
        next: (newItem) => {
            if (newItem) { // ✅ Added Null Check
                setOrders(prev => [...prev, newItem])
            }
        }
      });

      updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
        next: (updatedItem) => {
          // ✅ CRITICAL FIX: Guard against null/undefined updatedItem
          if (!updatedItem || !updatedItem.pk) return;

          setOrders(prev => prev.map(item => 
            (item.pk === updatedItem.pk && item.sk === updatedItem.sk) ? updatedItem : item
          ));
        }
      });

      deleteSub = client.models.BusinessData.onDelete({ filter: subFilter }).subscribe({
        next: (deletedItem) => {
          if (!deletedItem || !deletedItem.pk) return; // ✅ Added Null Check
          
          setOrders(prev => prev.filter(item => 
            !(item.pk === deletedItem.pk && item.sk === deletedItem.sk)
          ));
        }
      });
    };

    fetchAndSubscribe();

    return () => {
      if (createSub) createSub.unsubscribe();
      if (updateSub) updateSub.unsubscribe();
      if (deleteSub) deleteSub.unsubscribe();
    };
  }, [phoneNbr]);

  const sortedOrders = useMemo(() =>
    [...orders].sort((a, b) => b.sk.localeCompare(a.sk)), [orders]
  );

  const filteredOrders = useMemo(() => {
    if (!sortedOrders.length) return [];
    if (filter === 'active') return sortedOrders.filter(o => ['ORDERED', 'IN_PREPARATION'].includes(o.orderStatus));
    if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
    if (filter === 'all') return sortedOrders;
    return [];
  }, [sortedOrders, filter]);

  // 1. Ready for Dispatch (Only PREPARED) - Used for button count & auto-assign logic
  const readyForDispatch = useMemo(() => {
    return sortedOrders
      .filter(o => o.orderStatus === 'PREPARED')// && !o.isPickUp )
      .map(order => ({
        sk: order.sk,
        pk: order.pk,
        location: parseLocation(order.location),
        customer: order.gsi2pk?.split('#')[2] || 'Unknown',
        orderStatus: order.orderStatus // Keep status for logic downstream
      }))
      .filter(o => o.location !== null);
  }, [sortedOrders]);

  // ✅ 2. All Map Orders (PREPARED + DELIVERING + DELIVERED) - Used for Map Display
  const allMapOrders = useMemo(() => {
    return sortedOrders
      .filter(o =>
        ['PREPARED', 'DELIVERING', 'DELIVERED'].includes(o.orderStatus) &&
        !o.isPickUp
      )
      .map(order => ({
        sk: order.sk,
        pk: order.pk,
        location: parseLocation(order.location),
        customer: order.gsi2pk?.split('#')[2] || 'Unknown',
        orderStatus: order.orderStatus, // Critical for filtering in DeliveryOptimizer
        gsi1pk: order.gsi1pk // Critical for agent assignment lookup
      }))
      .filter(o => o.location !== null);
  }, [sortedOrders]);

  const preparedCount = readyForDispatch.length;

  const parentRef = useRef();
  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 5,
  });

  const agentColors = useMemo(() => {
    return generateDistinctColors(deliveryAgents.length);
  }, [deliveryAgents.length]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  // ✅ Stable Callback for Memoization
  const handleStatusChange = useCallback(async (order, newStatus) => {
    if (order.orderStatus === newStatus) return setEditingId(null);
    setUpdatingId(order.sk);
    try {
      await client.models.BusinessData.update({
        pk: order.pk,
        sk: order.sk,
        orderStatus: newStatus
      });
    } catch (err) {
      alert('Update failed');
      console.error(err);
    } finally {
      setUpdatingId(null);
      setEditingId(null);
    }
  }, []);

  const getAgentName = useCallback((gsi1pk) => {
    if (!gsi1pk) return 'Unknown';
    const agent = deliveryAgents.find(a => a.sk === gsi1pk);
    return agent ? agent.name : 'Unknown Agent';
  }, [deliveryAgents]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading orders...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-yellow-500 mb-4">Orders Dashboard</h1>

      <OrderFilters currentFilter={filter} setFilter={setFilter} hasPrepared={preparedCount} readyForDispatch={readyForDispatch} />

      {filter !== 'Auto-Assign' ? (
        <div ref={parentRef} className="overflow-y-auto h-[600px] pr-2">
          {filteredOrders.length > 0 ? (
            <div style={{ height: rowVirtualizer.getTotalSize() + 'px', position: 'relative', width: '100%' }}>
              {virtualItems.map((virtualItem) => {
                const order = filteredOrders[virtualItem.index];
                return (
                  <div
                    key={order.sk}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualItem.size + 'px',
                      transform: `translateY(${virtualItem.start}px)`
                    }}
                  >
                    {/* ✅ Uses Memoized Component */}
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
                            customerId: order.gsi2pk?.split('#')[2] || 'N/A'
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
        /* Map View */
        <DeliveryOptimizer
          orders={allMapOrders}
          agents={deliveryAgents
            .map(agent => ({
              id: agent.sk,
              name: agent.name,
              currentLocation: parseLocation(businessLocation)
            }))
            .filter(a => a.currentLocation)
          }
          AGENT_COLORS={agentColors}
          restaurantLocation={parseLocation(businessLocation)}
          onClose={() => setFilter('Prepared')}
          onAssignmentSaved={() => {
            alert('Orders updated!');
          }}
        />
      )}
    </div>
  );
};

export default OrdersView;
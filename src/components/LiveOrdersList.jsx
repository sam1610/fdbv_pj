// components/LiveOrdersList.jsx
import React, { useMemo, useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useEntityList } from '../DataHook/useEntityList';

const client = generateClient({ authMode: 'apiKey' });

const ALL_STATUSES = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'];
const statusColors = {
  ORDERED: 'bg-blue-500',
  IN_PREPARATION: 'bg-yellow-500',
  PREPARED: 'bg-green-500',
  DELIVERED: 'bg-gray-500',
  DELIVERING: 'bg-orange-500'
};

const classNames = (...classes) => classes.filter(Boolean).join(' ');

const OrderFilters = ({ currentFilter, setFilter }) => (
  <div className="flex space-x-2 mb-4">
    <button onClick={() => setFilter('active')} className={classNames(currentFilter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
    <button onClick={() => setFilter('Prepared')} className={classNames(currentFilter === 'Prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
    <button onClick={() => setFilter('all')} className={classNames(currentFilter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
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
      onClick={(e) => {
        e.stopPropagation();
        onEdit(order.sk);
      }}
      className={classNames(statusColors[order.orderStatus], 'text-xs font-semibold px-2 py-0.5 rounded-full text-white cursor-pointer')}
    >
      {order.orderStatus ? order.orderStatus.replace('_', ' ').toLowerCase() : 'unknown'}
    </span>
  );
};

const LiveOrdersList = ({ phoneNbr, setModal }) => {
  const { data: orders, forceUpdate } = useEntityList(
    { filter: { pk: { eq: `BUSINESS#${phoneNbr}` }, sk: { beginsWith: 'ORDER#' } } },
    "list"
  );

  const [filter, setFilter] = useState('active');
  const [editingId, setEditingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // 45s polling trigger
  useEffect(() => {
    const id = setInterval(() => forceUpdate(), 45_000);
    return () => clearInterval(id);
  }, [forceUpdate]);

  const handleStatusChange = async (order, newStatus) => {
    if (order.orderStatus === newStatus) {
      setEditingId(null);
      return;
    }

    setUpdatingId(order.sk);
    setEditingId(null);

    try {
      await client.models.BusinessData.update({
        pk: order.pk,
        sk: order.sk,
        orderStatus: newStatus
      });
    } catch (err) {
      console.error("Update failed:", err);
      alert(`Failed to update status for ${order.sk}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (filter === 'active') return orders.filter(o => o.orderStatus === 'ORDERED' || o.orderStatus === 'IN_PREPARATION');
    if (filter === 'Prepared') return orders.filter(o => o.orderStatus === 'PREPARED');
    if (filter === 'all') return orders;
    return [];
  }, [orders, filter]);

  return (
    <>
      <OrderFilters currentFilter={filter} setFilter={setFilter} />

      <div className="space-y-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <div
              key={order.sk}
              onClick={() => !editingId && setModal({ type: 'orderDetail', Id: order.sk, totalAmount: order.totalAmount })}
              className={classNames(
                "bg-slate-800 p-3 rounded-lg flex justify-between items-center transition",
                updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700',
                !editingId && 'cursor-pointer'
              )}
            >
              <div>
                <p className="font-bold text-white">Order ID: {order.sk.replace('ORDER#', '')}</p>
                <p className="text-sm text-slate-400">Customer: {order.gsi2pk?.split('#')[2] || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">${order.totalAmount?.toFixed(2) || '0.00'}</p>
                <OrderStatusEditor
                  order={order}
                  isEditing={editingId === order.sk}
                  onEdit={setEditingId}
                  onStatusChange={handleStatusChange}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-400 text-center mt-8">No {filter} orders found.</p>
        )}
      </div>
    </>
  );
};

export default React.memo(LiveOrdersList);
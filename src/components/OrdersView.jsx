import React, { useState, useMemo, useEffect, useRef } from 'react';
import { client } from '../DataHook/amplifyClient';
import { useVirtualizer } from '@tanstack/react-virtual';

// --- Configuration ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');

const ALL_STATUSES = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'];
const statusColors = {
    ORDERED: 'bg-blue-500',
    IN_PREPARATION: 'bg-yellow-500',
    PREPARED: 'bg-green-500',
    DELIVERED: 'bg-gray-500',
    DELIVERING: 'bg-orange-500'
};

// --- Sub-components ---
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
            className={classNames(statusColors[order.orderStatus] || 'bg-gray-400', 'text-xs font-semibold px-2 py-0.5 rounded-full text-white cursor-pointer')}
        >
            {order.orderStatus ? order.orderStatus.replace('_', ' ').toLowerCase() : 'unknown'}
        </span>
    );
};


// Main OrdersView Component
const OrdersView = ({ phoneNbr, setModal }) => {
    
    // --- 1. State for Real-Time Data (Fetches ALL orders) ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- 2. Simple queryParam for the subscription ---
    const queryParam = useMemo(() => {
        if (!phoneNbr) return null;
        return {
            filter: { 
                pk: { eq: `BUSINESS#${phoneNbr}` }, 
                sk: { beginsWith: 'ORDER#' } 
            }
        };
    }, [phoneNbr]);

    // --- 3. observeQuery subscription logic ---
    useEffect(() => {
        if (!queryParam) return;

        setLoading(true);
        const observer = client.models.BusinessData.observeQuery(queryParam);

        const subscription = observer.subscribe({
            next: (snapshot) => {
                setOrders([...snapshot.items]);
                setError(null);
                setLoading(false);
            },
            error: (err) => {
                setError(err.message || 'Subscription error');
                setLoading(false);
                console.error('OrdersView observeQuery error:', err);
            }
        });

        return () => subscription.unsubscribe();
    }, [queryParam]);

    // --- State for filters and editing ---
    const [filter, setFilter] = useState('active');
    const [editingId, setEditingId] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    // --- handleStatusChange ---
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
            console.error("Failed to update order status:", err);
            alert(`Failed to update status for Order ${order.sk.replace('ORDER#', '')}. Please try again.`);
        } finally {
            setUpdatingId(null);
        }
    };
    
    // --- 4. ✅ Sort ALL Orders ---
    // Renamed from 'todayOrders'. This now sorts all orders by SK descending.
    const sortedOrders = useMemo(() => {
        if (!orders || orders.length === 0) return [];
        
        // Sort all orders by SK (newest first)
        return [...orders].sort((a, b) => b.sk.localeCompare(a.sk));

    }, [orders]);

    // --- 5. ✅ Filters now use 'sortedOrders' ---
    // This hook filters the *entire* list based on your buttons.
    const filteredOrders = useMemo(() => {
        if (!sortedOrders) return [];
        
        if (filter === 'active') return sortedOrders.filter(o => o.orderStatus === 'ORDERED' || o.orderStatus === 'IN_PREPARATION');
        if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
        if (filter === 'all') return sortedOrders; // This is now ALL orders
        
        return [];
    }, [sortedOrders, filter]);

    // --- 6. Setup for Virtualization ---
    const parentRef = useRef();

    const rowVirtualizer = useVirtualizer({
        count: filteredOrders.length, // Virtualizer will use the filtered list
        getScrollElement: () => parentRef.current,
        estimateSize: () => 92,
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    // --- Render Logic ---
    if (loading) return <div className="p-4 text-center text-slate-400">Loading Orders...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-yellow-500 mb-4">Orders Dashboard</h1>
            <OrderFilters currentFilter={filter} setFilter={setFilter} />

            <div 
                ref={parentRef} 
                className="overflow-y-auto h-[600px] pr-2" // Fixed height scrolling window
            >
                {filteredOrders.length > 0 ? (
                    <div 
                        style={{ 
                            height: `${rowVirtualizer.getTotalSize()}px`, 
                            position: 'relative', 
                            width: '100%' 
                        }}
                    >
                        {virtualItems.map(virtualItem => {
                            const order = filteredOrders[virtualItem.index];

                            return (
                                <div 
                                    key={order.sk} 
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    {/* Your Original Order Component */}
                                    <div 
                                        onClick={() => !editingId && setModal({ type: 'orderDetail', Id: order.sk , totalAmount: order.totalAmount })} 
                                        className={classNames(
                                            "bg-slate-800 p-3 rounded-lg flex justify-between items-center transition h-full",
                                            updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700',
                                            !editingId && 'cursor-pointer'
                                        )}
                                    >
                                        <div>
                                            <p className="font-bold text-white">Order ID: {order.sk.replace('ORDER#', '')}</p>
                                            <p className="text-sm text-slate-400">Customer: {order.gsi2pk ? order.gsi2pk.split('#')[2] : 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-white">BD {order.totalAmount?.toFixed(2) || '0.S.00'}</p>
                                            <OrderStatusEditor 
                                                order={order}
                                                isEditing={editingId === order.sk}
                                                onEdit={setEditingId}
                                                onStatusChange={handleStatusChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-slate-400 text-center mt-8">No {filter} orders found.</p>
                )}
            </div>
        </div>
    );
};

export default OrdersView;
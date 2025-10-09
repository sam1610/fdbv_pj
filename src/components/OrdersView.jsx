
import React, { useState, useMemo } from 'react';
import * as Recharts from 'recharts';
import '../App.css';

const classNames = (...classes) => classes.filter(Boolean).join(' ');
const statusColors = { ordered: 'bg-blue-500', 'in preparation': 'bg-yellow-500', prepared: 'bg-green-500', delivered: 'bg-gray-500', cancelled: 'bg-red-500' };

const OrdersView = ({ allItems, setModal }) => {
    const [filter, setFilter] = useState('active');
    const orders = useMemo(() => allItems.filter(item => item.SortKey.startsWith('ORDER#') && !item.SortKey.includes('#ITEM#')), [allItems]);

    const filteredOrders = useMemo(() => {
        if (filter === 'active') return orders.filter(o => o.Status !== 'delivered' && o.Status !== 'cancelled');
        if (filter === 'all') return orders;
        return orders.filter(o => o.Status === filter);
    }, [orders, filter]);

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-white mb-4">Order Management</h1>
            <div className="flex space-x-2 mb-4">
                <button onClick={() => setFilter('active')} className={classNames(filter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
                <button onClick={() => setFilter('prepared')} className={classNames(filter === 'prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
                <button onClick={() => setFilter('all')} className={classNames(filter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
            </div>
            <div className="space-y-3">
                {filteredOrders.map(order => (
                    <div key={order.SortKey} onClick={() => setModal({ type: 'orderDetail', data: { order } })} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-700">
                        <div>
                            <p className="font-bold text-white">{order.OrderID}</p>
                            <p className="text-sm text-slate-400">{order.CustomerPhone}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-white">${order.TotalAmount.toFixed(2)}</p>
                            <span className={classNames(statusColors[order.Status], 'text-xs font-semibold px-2 py-0.5 rounded-full text-white')}>{order.Status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

import React, { useMemo } from 'react';
import * as Recharts from 'recharts';
import OrdersView from './Orders';

/**
 * A presentational component for the main business dashboard.
 * It receives all necessary data as props and is responsible for rendering the UI.
 * @param {object} props
 * @param {Array<object>} props.orders - The list of order records for the business.
 * @param {Function} props.setModal - A function to open a modal window.
 * @param {string} props.businessName - The name of the business to display.
 */
const DashboardView = ({ orders, setModal, businessName }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todaysOrders = useMemo(() => orders.filter(o => o.OrderDate.startsWith(today)), [orders, today]);


    const kpis = useMemo(() => ({
        totalOrders: todaysOrders.length,
        revenueToday: todaysOrders.reduce((acc, o) => o.Status === 'delivered' ? acc + o.TotalAmount : acc, 0),
        inProgress: todaysOrders.filter(o => o.Status === 'in preparation').length,
        readyForDelivery: todaysOrders.filter(o => o.Status === 'prepared').length,
    }), [todaysOrders]);
    
    const chartData = useMemo(() => {
        const statusCounts = todaysOrders.reduce((acc, o) => {
            acc[o.Status] = (acc[o.Status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({ name, orders: value }));
    }, [todaysOrders]);

    return (
        <div className="p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-white">Good Morning, {businessName}</h1>
                <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Total Orders</p><p className="text-3xl font-bold text-white">{kpis.totalOrders}</p></div>
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Revenue Today</p><p className="text-3xl font-bold text-white">${kpis.revenueToday.toFixed(2)}</p></div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center"><p className="text-yellow-300 text-sm">In Progress</p><p className="text-3xl font-bold text-white">{kpis.inProgress}</p></div>
                {/* Make the "Ready for Delivery" a button */}
                <button onClick={() => setModal({ type: 'assignDelivery' })} className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50">
                    <p className="text-green-300 text-sm">Ready for Delivery</p>
                    <p className="text-3xl font-bold text-white">{kpis.readyForDelivery}</p>
                </button>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg shadow-md">
                 <h2 className="text-lg font-semibold text-white mb-4">Today's Order Status</h2>
                 <div style={{ width: '100%', height: 300 }}>
                    <Recharts.ResponsiveContainer>
                        <Recharts.BarChart data={chartData}>
                            <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
                            <Recharts.YAxis stroke="#94a3b8" />
                            <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                            <Recharts.Bar dataKey="orders" fill="#38bdf8" />
                        </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                 </div>
            </div>
        </div>
    );
};

export default DashboardView;

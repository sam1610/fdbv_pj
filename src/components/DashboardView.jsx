import React, { useState, useEffect, useMemo } from 'react'; 
import * as Recharts from 'recharts';
import { client } from '../DataHook/amplifyClient';
// 1. ✅ Import the new Intelligence Component
import { InventoryIntelligence } from './InventoryIntelligence'; 

const DashboardView = ({ phoneNbr, filterDays = 1, setModal }) => {
    // --- State & Data Fetching (Unchanged) ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24*filterDays); // Go back exactly 24 hours
    const minSk = `ORDER#${cutoffDate.toISOString()}`;

    useEffect(() => {
        if (!phoneNbr) return;
        const subFilter = { pk: { eq: `BUSINESS#${phoneNbr}` } };
        let createSub, updateSub;

        const fetchAndSubscribe = async () => {
            setLoading(true);
            try {
                // Fetch ALL history so the AI has data to work with
                const { data: initialOrders } = await client.models.BusinessData.listByBusiness({
                    pk: `BUSINESS#${phoneNbr}`,
                    sk: {gt: minSk },
                    sortDirection: 'DESC'
                });
                setOrders(initialOrders);
                setLoading(false);

                // Subscriptions...
                createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
                    next: (event) => {
                        if (event.sk?.startsWith('ORDER#')) setOrders(prev => [event, ...prev]); 
                    },
                    error: (err) => console.error("Create Sub Error:", err)
                });

                updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
                    next: (event) => {
                        if (event.sk?.startsWith('ORDER#')) {
                            setOrders(prev => prev.map(order => 
                                (order.pk === event.pk && order.sk === event.sk) ? event : order
                            ));
                        }
                    },
                    error: (err) => console.error("Update Sub Error:", err)
                });

            } catch (err) {
                console.error("Fetch error:", err);
                setError(err?.message || JSON.stringify(err));
                setLoading(false);
            }
        };

        fetchAndSubscribe();
        return () => {
            if (createSub) createSub.unsubscribe();
            if (updateSub) updateSub.unsubscribe();
        };
    }, [phoneNbr]);
    console.log("DashboardView Orders Loaded:", orders.length);
    // --- Filtering & KPIs (Unchanged) ---
    const filteredOrders = useMemo(() => {
        if (!orders || orders.length === 0) return [];
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (filterDays - 1));
        startDate.setHours(0, 0, 0, 0); 

        return orders.filter(order => {
            if (!order.orderDate) return false;
            const orderDate = new Date(order.orderDate);
            return !isNaN(orderDate) && orderDate >= startDate && orderDate <= now;
        });
    }, [orders, filterDays]);

    const kpis = useMemo(() => {
        if (!filteredOrders || filteredOrders.length === 0) {
            return { totalOrders: 0, revenue: 0, inProgress: 0, readyForDelivery: 0 };
        }
        return {
            totalOrders: filteredOrders.length,
            revenue: filteredOrders.reduce((acc, o) => o.totalAmount ? acc + o.totalAmount : acc, 0),
            inProgress: filteredOrders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
            readyForDelivery: filteredOrders.filter(o => o.orderStatus === 'PREPARED').length,
        };
    }, [filteredOrders]);

    const chartData = useMemo(() => {
        if (!filteredOrders || filteredOrders.length === 0) return [];
        const statusCounts = filteredOrders.reduce((acc, o) => {
            const status = o.orderStatus || 'UNKNOWN';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({
            name: name.replace('_', ' ').toLowerCase(),
            orders: value
        }));
    }, [filteredOrders]);

    const readyForDeliveryOrders = useMemo(() => {
        return filteredOrders.filter((o) => o.orderStatus === 'PREPARED');
    }, [filteredOrders]);

    if (loading) return <div className="p-4 text-center text-slate-400">Loading Dashboard Data...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-white">Cloud Order</h1>
                <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
                    <p className="text-slate-400 text-sm">Total Orders</p>
                    <p className="text-3xl font-bold text-white">{kpis.totalOrders}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
                    <p className="text-slate-400 text-sm">Today's Revenue</p>
                    <p className="text-3xl font-bold text-white"><span className="text-slate-400 text-sm">BD</span> {kpis.revenue.toFixed(2)}</p>
                </div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center">
                    <p className="text-yellow-300 text-sm">In Progress</p>
                    <p className="text-3xl font-bold text-white">{kpis.inProgress}</p>
                </div>
                <button 
                    onClick={() => setModal({ type: 'assignDelivery' , PreparedOrders: readyForDeliveryOrders })} 
                    className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50"
                >
                    <p className="text-green-300 text-sm">Ready for Delivery</p>
                    <p className="text-3xl font-bold text-white">{kpis.readyForDelivery}</p>
                </button>
            </div>

            {/* Charts */}
            <div className="bg-slate-800 p-4 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-white mb-4">Today's Order Status</h2>
                <div style={{ width: '100%', height: 300 }}>
                    <Recharts.ResponsiveContainer>
                        <Recharts.BarChart data={chartData}>
                            <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
                            <Recharts.YAxis stroke="#94a3b8" allowDecimals={false} />
                            <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                            <Recharts.Bar dataKey="orders" fill="#38bdf8" />
                        </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                </div>
            </div>

            {/* 2. ✅ Pass the FULL orders list to the AI (It needs history, not just today) */}
            <InventoryIntelligence />
        </div>
    );
};

export default DashboardView;
import React, { useState, useEffect, useMemo } from 'react'; // ✅ Import new hooks
import * as Recharts from 'recharts';
import { client } from '../DataHook/amplifyClient';          // ✅ Import the shared client

const DashboardView = ({ phoneNbr, filterDays = 1, setModal }) => {
    // --- ✅ 1. State for Real-Time Data ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- ✅ 2. The Simple Query for observeQuery ---
    // We fetch ALL orders, because 'between' is not supported by subscriptions.
    const queryParam = useMemo(() => {
        if (!phoneNbr) return null;
        return {
            filter: {
                pk: { eq: `BUSINESS#${phoneNbr}` }
                // sk: { beginsWith: 'ORDER#' }
            }
        };
    }, [phoneNbr]);

    // --- ✅ 3. The observeQuery Subscription Logic ---
    useEffect(() => {
        if (!queryParam) return;

        setLoading(true);
        const observer = client.models.BusinessData.observeQuery(queryParam);

        const subscription = observer.subscribe({
            next: (snapshot) => {
                // We use the spread operator to force a re-render
                setOrders([...snapshot.items]);
                setError(null);
                setLoading(false);
            },
            error: (err) => {
                setError(err.message || 'Subscription error');
                setLoading(false);
                console.error('observeQuery error:', err);
            }
        });

        return () => subscription.unsubscribe();
    }, [queryParam]);

    // --- ✅ 4. Client-Side Filtering ---
    // This new hook filters the 'all orders' list by your 'filterDays' prop.
    const filteredOrders = useMemo(() => {
        if (!orders || orders.length === 0) return [];

        const now = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (filterDays - 1));
        startDate.setHours(startDate.getHours() - 24);
        // startDate.setHours(0, 0, 0, 0);

        return orders.filter(o => {
            if (!o.orderDate) return false;
            const orderDate = new Date(o.orderDate);
            return orderDate >= startDate && orderDate <= now;
        });
    }, [orders, filterDays]);


    // --- ✅ 5. All KPIs now use 'filteredOrders' ---
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
    }, [filteredOrders]); // Depends on filteredOrders

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
    }, [filteredOrders]); // Depends on filteredOrders

    const readyForDeliveryOrders = useMemo(() => {
        return filteredOrders.filter((o) => o.orderStatus === 'PREPARED');
    }, [filteredOrders]); // Depends on filteredOrders

    // --- Loading/Error states ---
    if (loading) return <div className="p-4 text-center text-slate-400">Loading Dashboard Data...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4 space-y-6">
            <header>
                {/* As businessName is not passed, you might want to fetch it or pass it as a prop */}
                <h1 className="text-2xl font-bold text-white">Good Morning!</h1>
                <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Total Orders</p><p className="text-3xl font-bold text-white">{kpis.totalOrders}</p></div>
<div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
  <p className="text-slate-400 text-sm">Today's Revenue</p>
  <p className="text-3xl font-bold text-white">
    <span className="text-slate-400 text-sm">BD</span> {kpis.revenue.toFixed(3)}
  </p>
</div>                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center"><p className="text-yellow-300 text-sm">In Progress</p><p className="text-3xl font-bold text-white">{kpis.inProgress}</p></div>
                <button onClick={() => setModal({ 
                    type: 'assignDelivery' , 
                    PreparedOrders: readyForDeliveryOrders,
                    // onSuccess:  refetch
                })} 
                    className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50">
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
                <Recharts.YAxis 
                    stroke="#94a3b8"
                    allowDecimals={false} 
                    domain={[0, dataMax => dataMax + 2]}
                />
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


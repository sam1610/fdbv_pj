import React, { useMemo } from 'react';
import * as Recharts from 'recharts';
import { useEntityList } from '../DataHook/useEntityList';

/**
 * A dashboard component that uses the generic useEntityList hook to fetch
 * today's orders for a business and displays KPIs and a chart.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 * @param {number} [props.filterDays=1] - The number of days to look back for orders.
 */
const DashboardView = ({ phoneNbr, filterDays = 1 , setModal}) => {
    // --- Data Fetching Logic ---
    const queryName = 'list';

    // ✅ FIX: The queryParam object is now memoized with useMemo.
    // This object will only be re-created if phoneNbr or filterDays changes,
    // which breaks the infinite loop in the useEntityList hook.
    const queryParam = useMemo(() => {
        if (!phoneNbr) return null; // Don't create params if phoneNbr isn't ready

        const now = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (filterDays - 1));
        startDate.setHours(0, 0, 0, 0);

        return {
            filter : {pk: { eq: `BUSINESS#${phoneNbr}` }, 
            sk: { between: [`ORDER#${startDate.toISOString()}`, `ORDER#${now.toISOString()}`] }}
        };
    }, [phoneNbr, filterDays]);

    // Call the generic hook with the stable query method and parameters.
    const { data: orders, loading, error } = useEntityList(queryParam, queryName);


    // --- Client-Side Calculations for the Dashboard (unchanged) ---
    const kpis = useMemo(() => {
        if (!orders || orders.length === 0) {
            return { totalOrders: 0, revenue: 0, inProgress: 0, readyForDelivery: 0 };
        }
        return {
            totalOrders: orders.length,
            revenue: orders.reduce((acc, o) => o.totalAmount ? acc + o.totalAmount : acc, 0),
            inProgress: orders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
            readyForDelivery: orders.filter(o => o.orderStatus === 'PREPARED').length,
        };
    }, [orders]);
    
    const chartData = useMemo(() => {
        if (!orders || orders.length === 0) return [];
        const statusCounts = orders.reduce((acc, o) => {
            const status = o.orderStatus || 'UNKNOWN';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({ 
            name: name.replace('_', ' ').toLowerCase(), 
            orders: value 
        }));
    }, [orders]);

    const readyForDeliveryOrders = useMemo(() => {
    return orders.filter((o) => o.orderStatus === 'PREPARED');
  }, [orders]);
    // console.log("Kpis Data:", readyForDeliveryOrders);

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
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Revenue Today</p><p className="text-3xl font-bold text-white">${kpis.revenue.toFixed(2)}</p></div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center"><p className="text-yellow-300 text-sm">In Progress</p><p className="text-3xl font-bold text-white">{kpis.inProgress}</p></div>
                <button onClick={() => setModal({ type: 'assignDelivery' , PreparedOrders: readyForDeliveryOrders})} className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50">
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


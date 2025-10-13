import React, { useState, useMemo, useEffect } from 'react';
import { useEntityList } from '../DataHook/useEntityList';

import { generateClient } from 'aws-amplify/data';
import * as Recharts from 'recharts';

// --- Component Setup ---
const client = generateClient({ authMode: 'userPool' });

/**
 * A dashboard component that fetches orders for a business within a configurable
 * date range and displays KPIs and a chart.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 * @param {number} [props.filterDays=1] - The number of days to look back for orders. Defaults to 1 (Today).
 */
const Dashboard = ({ phoneNbr, filterDays = 1 }) => {
    // const [loading, setLoading] = useState(true);
    // const [error, setError] = useState(null);

    // --- Data Fetching Logic ---
const now = new Date();
const startDate = new Date();
// Set the start date to midnight, 'filterDays' ago, using local time.
startDate.setDate(startDate.getDate() - (filterDays - 1));
startDate.setHours(0, 0, 0, 0); // Use setHours for local timezone adjustment instead of setUTCHours
const { data: orders, loading, error } = useEntityList(
    {
        pk: `BUSINESS#${phoneNbr}`, 
        sk: { between: [`ORDER#${startDate.toISOString()}`, `ORDER#${now.toISOString()}`] }
    }, "listBusinessDataByPkAndSk"
);
    console.log("Dashboard Orders:", orders);
    // --- Client-Side Calculations for the Dashboard ---
    const kpis = useMemo(() => {
        if (!orders || orders.length === 0) {
            return { totalOrders: 0, revenue: 0, inProgress: 0, readyForDelivery: 0 };
        }
        return {
            totalOrders: orders.length,
            revenue: orders.reduce((acc, o) => o.orderStatus === 'DELIVERED' ? acc + (o.totalAmount || 0) : acc, 0),
            inProgress: orders.filter(o => o.orderStatus === 'IN-PREPARATION').length,
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

    if (loading) return <div className="p-4 text-center text-slate-400">Loading Dashboard Data...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4 space-y-6 bg-slate-900">
            {/* Header and KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
                    <p className="text-slate-400 text-sm">Total Orders</p>
                    <p className="text-3xl font-bold text-white">{kpis.totalOrders}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
                    <p className="text-slate-400 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-white">${kpis.revenue.toFixed(2)}</p>
                </div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center">
                    <p className="text-yellow-300 text-sm">In Progress</p>
                    <p className="text-3xl font-bold text-white">{kpis.inProgress}</p>
                </div>
                <div className="bg-green-800/50 p-4 rounded-lg shadow-md text-center">
                    <p className="text-green-300 text-sm">Ready for Delivery</p>
                    <p className="text-3xl font-bold text-white">{kpis.readyForDelivery}</p>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-slate-800 p-4 rounded-lg shadow-md">
                 <h2 className="text-lg font-semibold text-white mb-4">
                    Order Status (Last {filterDays} {filterDays > 1 ? 'Days' : 'Day'})
                 </h2>
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
        </div>
    );
};

export default Dashboard;


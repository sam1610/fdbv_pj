import React, { useState, useMemo, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import * as Recharts from 'recharts';

// --- Component Setup ---
const client = generateClient({ authMode: 'userPool' });

/**
 * A dashboard component that fetches all of today's orders for a business
 * and displays KPIs and a chart based on that data.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 */
const Dashboard = ({ phoneNbr }) => {
    const [todaysOrders, setTodaysOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Logic ---
    useEffect(() => {
        // Don't fetch if the business phone number isn't available yet
        if (!phoneNbr) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Calculate the start and end of the current day in UTC
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const startOfDay = today.toISOString();
                
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const endOfDay = tomorrow.toISOString();

                // 2. Construct the keys for a targeted 'between' query
                const pk = `BUSINESS#${phoneNbr}`;
                const startKey = `ORDER#${startOfDay}`;
                const endKey = `ORDER#${endOfDay}`;

                const allRecords = [];
                let nextToken = null;

                // 3. Loop to fetch all pages of today's orders
                do {
                    const response = await client.models.BusinessData.listBusinessDataByPkAndSk({
                        pk: pk,
                        sk: { between: [startKey, endKey] },
                        nextToken: nextToken,
                    });
                    // The response for a queryField is nested, so we extract the items
                    const items = response.data?.listBusinessDataByPkAndSk?.items || [];
                    allRecords.push(...items);
                    nextToken = response.nextToken;
                } while (nextToken);
                
                console.log("Fetched today's orders:", allRecords);
                setTodaysOrders(allRecords);

            } catch (err) {
                const msg = err.errors ? err.errors[0].message : err.message;
                setError(`Failed to fetch dashboard data: ${msg}`);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [phoneNbr]); // Re-run if the phoneNbr changes

    // --- Client-Side Calculations for the Dashboard ---
    const kpis = useMemo(() => {
        if (!todaysOrders || todaysOrders.length === 0) {
            return { totalOrders: 0, revenueToday: 0, inProgress: 0, readyForDelivery: 0 };
        }
        return {
            totalOrders: todaysOrders.length,
            revenueToday: todaysOrders.reduce((acc, o) => o.orderStatus === 'DELIVERED' ? acc + (o.totalAmount || 0) : acc, 0),
            inProgress: todaysOrders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
            readyForDelivery: todaysOrders.filter(o => o.orderStatus === 'PREPARED').length,
        };
    }, [todaysOrders]);
    
    const chartData = useMemo(() => {
        if (!todaysOrders || todaysOrders.length === 0) return [];
        const statusCounts = todaysOrders.reduce((acc, o) => {
            const status = o.orderStatus || 'UNKNOWN';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({ 
            name: name.replace('_', ' ').toLowerCase(), 
            orders: value 
        }));
    }, [todaysOrders]);

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
                    <p className="text-slate-400 text-sm">Revenue Today</p>
                    <p className="text-3xl font-bold text-white">${kpis.revenueToday.toFixed(2)}</p>
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
        </div>
    );
};

export default Dashboard;


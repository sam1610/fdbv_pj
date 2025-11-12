import React, { useMemo } from 'react';
import * as Recharts from 'recharts';

/**
 * A "presentational" dashboard component that receives its data via props.
 * @param {object} props
 * @param {object} props.stats - The dashboard data object from the parent.
 * @param {Function} props.setModal - A function to open a modal window.
 */
const DashboardView = ({ stats, setModal }) => {
    
    // We get loading and error directly from props
    if (stats.loading) return <div className="p-4 text-center text-slate-400">Loading Dashboard Data...</div>;
    if (stats.error) return <div className="p-4 text-center text-red-400">{stats.error}</div>;

    // KPIs are derived directly from the 'stats' prop
    const kpis = {
        totalOrders: stats.totalOrders,
        revenue: stats.revenue || 0,
        inProgress: stats.statusCounts['IN_PREPARATION'] || 0,
        readyForDelivery: stats.readyForDeliveryOrders.length || 0,
    };

    // Chart data is derived from 'stats.statusCounts'
    const chartData = useMemo(() => {
        if (!stats.statusCounts) return [];
        
        return Object.entries(stats.statusCounts).map(([name, value]) => ({ 
            name: name.replace('_', ' ').toLowerCase(), 
            orders: value 
        }));
    }, [stats.statusCounts]);

    return (
        <div className="p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-white">Good Morning!</h1>
                <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Total Orders</p><p className="text-3xl font-bold text-white">{kpis.totalOrders}</p></div>
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Revenue Today</p><p className="text-3xl font-bold text-white">${kpis.revenue.toFixed(2)}</p></div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center"><p className="text-yellow-300 text-sm">In Progress</p><p className="text-3xl font-bold text-white">{kpis.inProgress}</p></div>
                
                <button 
                    onClick={() => setModal({ type: 'assignDelivery' , PreparedOrders: stats.readyForDeliveryOrders })} 
                    className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50"
                >
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
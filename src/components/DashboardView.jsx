import React, { useState, useEffect, useMemo } from 'react'; 
import * as Recharts from 'recharts';
import { client } from '../DataHook/amplifyClient';

// Defined Critical Categories for Daily Prep
const PREP_CATEGORIES = [
    'SANDWICHES_WRAPS',
    'MAIN_COURSE',
    'SALADS',
    'PIZZA_PASTA'
];

const DashboardView = ({ phoneNbr, filterDays = 1, setModal }) => {
    // --- Existing State ---
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // --- Forecast State ---
    const [forecasts, setForecasts] = useState({});
    const [isForecasting, setIsForecasting] = useState(false);
    const [isForecastOpen, setIsForecastOpen] = useState(false); 

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24 * filterDays);
    const minSk = `ORDER#${cutoffDate.toISOString()}`;

    // --- 1. Fetch & Subscribe (Unchanged) ---
    useEffect(() => {
        if (!phoneNbr) return;
        const subFilter = { pk: { eq: `BUSINESS#${phoneNbr}` } };
        let createSub, updateSub;

        const fetchAndSubscribe = async () => {
            setLoading(true);
            try {
                const { data: initialOrders } = await client.models.BusinessData.listByBusiness({
                    pk: `BUSINESS#${phoneNbr}`,
                    sk: { gt: minSk },
                    sortDirection: 'DESC'
                });
                setOrders(initialOrders);
                setLoading(false);

                createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
                    next: (event) => {
                        if (!event || !event.sk) return;
                        if (event.sk.startsWith('ORDER#')) {
                            setOrders(prev => [event, ...prev]); 
                        }
                    },
                    error: (err) => console.error("Create Sub Error:", err)
                });

                updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
                    next: (event) => {
                        if (!event || !event.sk) return;
                        if (event.sk.startsWith('ORDER#')) {
                            setOrders(prev => prev.map(order => 
                                (order.pk === event.pk && order.sk === event.sk) ? { ...order, ...event } : order
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

    // --- 2. KPIs & Chart Data (Unchanged) ---
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
        if (!filteredOrders.length) return { totalOrders: 0, revenue: 0, inProgress: 0, ready: 0 };
        return {
            totalOrders: filteredOrders.length,
            revenue: filteredOrders.reduce((acc, o) => o.totalAmount ? acc + o.totalAmount : acc, 0),
            inProgress: filteredOrders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
            ready: filteredOrders.filter(o => o.orderStatus === 'PREPARED').length,
        };
    }, [filteredOrders]);

    const chartData = useMemo(() => {
        if (!filteredOrders.length) return [];
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

    const readyForDeliveryOrders = useMemo(() => 
        filteredOrders.filter((o) => o.orderStatus === 'PREPARED'), 
    [filteredOrders]);

    // =========================================================
    // 🚀 3. THE FIXED FORECAST LOGIC
    // We removed all the manual data fetching.
    // We simply call the new Backend Query: client.queries.generateKitchenPlan
    // =========================================================
  const generateForecasts = async () => {
    setIsForecasting(true);
    const newForecasts = {};
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDateStr = tomorrow.toISOString().split('T')[0];

    try {
        const promiseList = PREP_CATEGORIES.map(async (category) => {
            // ✅ Standardize phone format for the GSI query
            const formattedPhone = phoneNbr.startsWith('+') ? phoneNbr : `+${phoneNbr}`;
            
            const response = await client.queries.generateKitchenPlan({
                businessPhone: formattedPhone, 
                targetDate: targetDateStr,
                category: category
            });

            // The heuristic handler returns a ForecastResult object
            return { category, data: response.data };
        });

        const results = await Promise.all(promiseList);

        results.forEach(res => {
            if (res.data) {
                newForecasts[res.category] = res.data;
            }
        });

        setForecasts(newForecasts);
    } catch (e) {
        console.error("❌ Heuristic Forecast failed:", e);
    } finally {
        setIsForecasting(false);
    }
};
    if (loading) return <div className="p-4 text-center text-slate-400">Loading Dashboard...</div>;
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
                    <p className="text-slate-400 text-sm">Revenue</p>
                    <p className="text-3xl font-bold text-white"><span className="text-slate-400 text-sm">BD</span> {kpis.revenue.toFixed(2)}</p>
                </div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center">
                    <p className="text-yellow-300 text-sm">In Progress</p>
                    <p className="text-3xl font-bold text-white">{kpis.inProgress}</p>
                </div>
                <button 
                    onClick={() => setModal({ type: 'assignDelivery', PreparedOrders: readyForDeliveryOrders })} 
                    className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50"
                >
                    <p className="text-green-300 text-sm">Ready for Delivery</p>
                    <p className="text-3xl font-bold text-white">{kpis.ready}</p>
                </button>
            </div>

            {/* Main Chart */}
            <div className="bg-slate-800 p-4 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-white mb-4">Order Status</h2>
                <div style={{ width: '100%', height: 300 }}>
                    <Recharts.ResponsiveContainer>
                        <Recharts.BarChart data={chartData}>
                            <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
                            <Recharts.YAxis stroke="#94a3b8" allowDecimals={false} />
                            <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
                            <Recharts.Bar dataKey="orders" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                </div>
            </div>

            {/* --- COLLAPSIBLE KITCHEN INTELLIGENCE --- */}
            <div className="border border-slate-700 rounded-lg overflow-hidden transition-all duration-300">
                <button 
                    onClick={() => setIsForecastOpen(!isForecastOpen)}
                    className="w-full flex items-center justify-between bg-slate-800 p-4 hover:bg-slate-750 transition"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">👨‍🍳</span>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">Kitchen Prep Forecast</h2>
                            <p className="text-xs text-slate-400">AI predictions for tomorrow's prep</p>
                        </div>
                    </div>
                    <div className={`transform transition-transform duration-300 ${isForecastOpen ? 'rotate-180' : ''}`}>
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                <div className={`bg-slate-800/50 transition-all duration-500 ease-in-out ${isForecastOpen ? 'max-h-[1000px] opacity-100 p-4 border-t border-slate-700' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    
                    <div className="flex justify-end mb-4">
                        <button 
                            onClick={generateForecasts}
                            disabled={isForecasting}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                        >
                            {isForecasting ? (
                                <><span>Thinking...</span><div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div></>
                            ) : (
                                "Generate Plan for Tomorrow"
                            )}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                        {PREP_CATEGORIES.map(cat => {
    const f = forecasts[cat];
    return (
        <div key={cat} className="bg-slate-900/80 p-4 rounded-lg border border-slate-700">
            <h3 className="text-slate-300 font-semibold mb-3 border-b border-slate-700 pb-2">
                {cat.replace(/_/g, ' ')}
            </h3>
            {f ? (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="text-center">
                            <p className="text-[10px] text-slate-500 mb-1">PREP TARGET</p>
                            <span className="text-2xl font-bold text-white">
                                {f.predictedQuantity} <span className="text-xs text-slate-400">units</span>
                            </span>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                            f.confidence === 'HIGH' ? 'bg-green-900/50 text-green-400 border border-green-800' : 
                            f.confidence === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' : 
                            'bg-red-900/50 text-red-400 border border-red-800'
                        }`}>
                            {f.confidence} DATA
                        </span>
                    </div>
                    
                    {/* ✅ Emphasis on the High-Demand Meal Action */}
                    <div className="flex items-start gap-2 bg-blue-500/10 p-2 rounded border border-blue-500/20">
                        <span className="text-lg">🎯</span>
                        <p className="text-sm text-blue-300 font-bold leading-tight">
                            {f.suggestedAction}
                        </p>
                    </div>
                    
                    <p className="text-[11px] text-slate-500 leading-relaxed italic">
                        {f.reasoning}
                    </p>
                </div>
            ) : (
                <div className="h-24 flex items-center justify-center text-slate-600 text-xs text-center px-4">
                    Click "Generate Plan" to calculate demand for this category
                </div>
            )}
        </div>
    );
})}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;

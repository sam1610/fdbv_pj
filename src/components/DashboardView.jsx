
// // export default DashboardView;
// import React, { useState, useEffect, useMemo } from 'react'; 
// import * as Recharts from 'recharts';
// import { client } from '../DataHook/amplifyClient';

// // Defined Critical Categories for Daily Prep
// const PREP_CATEGORIES = [
//     'SANDWICHES_WRAPS',
//     'MAIN_COURSE',
//     'SALADS',
//     'PIZZA_PASTA'
// ];

// const DashboardView = ({ phoneNbr, filterDays = 1, setModal }) => {
//     // --- Existing State ---
//     const [orders, setOrders] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
    
//     // --- Forecast State ---
//     const [forecasts, setForecasts] = useState({});
//     const [isForecasting, setIsForecasting] = useState(false);
//     const [isForecastOpen, setIsForecastOpen] = useState(false); // Controls collapse

//     const cutoffDate = new Date();
//     cutoffDate.setHours(cutoffDate.getHours() - 24 * filterDays);
//     const minSk = `ORDER#${cutoffDate.toISOString()}`;

//     // --- 1. Fetch & Subscribe (Unchanged) ---
//     useEffect(() => {
//         if (!phoneNbr) return;
//         const subFilter = { pk: { eq: `BUSINESS#${phoneNbr}` } };
//         let createSub, updateSub;

//         const fetchAndSubscribe = async () => {
//             setLoading(true);
//             try {
//                 // Fetch History
//                 const { data: initialOrders } = await client.models.BusinessData.listByBusiness({
//                     pk: `BUSINESS#${phoneNbr}`,
//                     sk: { gt: minSk },
//                     sortDirection: 'DESC'
//                 });
//                 setOrders(initialOrders);
//                 setLoading(false);

//                 // Create Subscription
//                 createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
//                     next: (event) => {
//                         if (!event || !event.sk) return;
//                         if (event.sk.startsWith('ORDER#')) {
//                             setOrders(prev => [event, ...prev]); 
//                         }
//                     },
//                     error: (err) => console.error("Create Sub Error:", err)
//                 });

//                 // Update Subscription (Location/Status)
//                 updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
//                     next: (event) => {
//                         if (!event || !event.sk) return;
//                         if (event.sk.startsWith('ORDER#')) {
//                             setOrders(prev => prev.map(order => 
//                                 (order.pk === event.pk && order.sk === event.sk) 
//                                 ? { ...order, ...event } // Merge update
//                                 : order
//                             ));
//                         }
//                     },
//                     error: (err) => console.error("Update Sub Error:", err)
//                 });

//             } catch (err) {
//                 console.error("Fetch error:", err);
//                 setError(err?.message || JSON.stringify(err));
//                 setLoading(false);
//             }
//         };

//         fetchAndSubscribe();
//         return () => {
//             if (createSub) createSub.unsubscribe();
//             if (updateSub) updateSub.unsubscribe();
//         };
//     }, [phoneNbr]);

//     // --- 2. KPIs & Chart Data (Unchanged) ---
//     const filteredOrders = useMemo(() => {
//         if (!orders || orders.length === 0) return [];
//         const now = new Date();
//         const startDate = new Date(now);
//         startDate.setDate(now.getDate() - (filterDays - 1));
//         startDate.setHours(0, 0, 0, 0); 

//         return orders.filter(order => {
//             if (!order.orderDate) return false;
//             const orderDate = new Date(order.orderDate);
//             return !isNaN(orderDate) && orderDate >= startDate && orderDate <= now;
//         });
//     }, [orders, filterDays]);

//     const kpis = useMemo(() => {
//         if (!filteredOrders.length) return { totalOrders: 0, revenue: 0, inProgress: 0, ready: 0 };
//         return {
//             totalOrders: filteredOrders.length,
//             revenue: filteredOrders.reduce((acc, o) => o.totalAmount ? acc + o.totalAmount : acc, 0),
//             inProgress: filteredOrders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
//             ready: filteredOrders.filter(o => o.orderStatus === 'PREPARED').length,
//         };
//     }, [filteredOrders]);

//     const chartData = useMemo(() => {
//         if (!filteredOrders.length) return [];
//         const statusCounts = filteredOrders.reduce((acc, o) => {
//             const status = o.orderStatus || 'UNKNOWN';
//             acc[status] = (acc[status] || 0) + 1;
//             return acc;
//         }, {});
//         return Object.entries(statusCounts).map(([name, value]) => ({
//             name: name.replace('_', ' ').toLowerCase(),
//             orders: value
//         }));
//     }, [filteredOrders]);

//     const readyForDeliveryOrders = useMemo(() => 
//         filteredOrders.filter((o) => o.orderStatus === 'PREPARED'), 
//     [filteredOrders]);

//     // --- 3. Forecast Logic (New) ---
//     const generateForecasts = async () => {
//         setIsForecasting(true);
//         const newForecasts = {};
//         const today = new Date();
//         const thirtyDaysAgo = new Date();
//         thirtyDaysAgo.setDate(today.getDate() - 30);

//         try {
//             for (const category of PREP_CATEGORIES) {
//                 // Fetch using 'ByAgent' (mapped to gsi1pk)
//                 const { data: history } = await client.models.BusinessData.ByAgent({
//                     gsi1pk: `CAT#${category}`,
//                     limit: 1000 
//                 });

//                 // Client-side date filter
//                 const recentHistory = history.filter(item => {
//                     const itemDate = new Date(item.orderDate);
//                     return itemDate >= thirtyDaysAgo;
//                 });

//                 // Prepare lightweight summary for AI
//                 const historySummary = recentHistory.map(h => ({
//                     date: h.orderDate,
//                     name: h.name,
//                     qty: h.quantity
//                 }));

//                 // Call Amplify Generation
//                 const result = await client.generations.predictInventory({
//                     targetDate: new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0],
//                     category: category,
//                     timeSegment: "All Day",
//                     historySummary: JSON.stringify(historySummary)
//                 });

//                 if (result.data) newForecasts[category] = result.data;
//             }
//             setForecasts(newForecasts);
//         } catch (e) {
//             console.error("Forecast failed:", e);
//         } finally {
//             setIsForecasting(false);
//         }
//     };

//     if (loading) return <div className="p-4 text-center text-slate-400">Loading Dashboard...</div>;
//     if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

//     return (
//         <div className="p-4 space-y-6">
//             {/* Header */}
//             <header>
//                 <h1 className="text-2xl font-bold text-white">Cloud Order</h1>
//                 <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
//             </header>

//             {/* KPI Cards */}
//             <div className="grid grid-cols-2 gap-4">
//                 <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
//                     <p className="text-slate-400 text-sm">Total Orders</p>
//                     <p className="text-3xl font-bold text-white">{kpis.totalOrders}</p>
//                 </div>
//                 <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center">
//                     <p className="text-slate-400 text-sm">Revenue</p>
//                     <p className="text-3xl font-bold text-white"><span className="text-slate-400 text-sm">BD</span> {kpis.revenue.toFixed(2)}</p>
//                 </div>
//                 <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center">
//                     <p className="text-yellow-300 text-sm">In Progress</p>
//                     <p className="text-3xl font-bold text-white">{kpis.inProgress}</p>
//                 </div>
//                 <button 
//                     onClick={() => setModal({ type: 'assignDelivery', PreparedOrders: readyForDeliveryOrders })} 
//                     className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50"
//                 >
//                     <p className="text-green-300 text-sm">Ready for Delivery</p>
//                     <p className="text-3xl font-bold text-white">{kpis.ready}</p>
//                 </button>
//             </div>

//             {/* Main Chart */}
//             <div className="bg-slate-800 p-4 rounded-lg shadow-md">
//                 <h2 className="text-lg font-semibold text-white mb-4">Order Status</h2>
//                 <div style={{ width: '100%', height: 300 }}>
//                     <Recharts.ResponsiveContainer>
//                         <Recharts.BarChart data={chartData}>
//                             <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
//                             <Recharts.YAxis stroke="#94a3b8" allowDecimals={false} />
//                             <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
//                             <Recharts.Bar dataKey="orders" fill="#38bdf8" radius={[4, 4, 0, 0]} />
//                         </Recharts.BarChart>
//                     </Recharts.ResponsiveContainer>
//                 </div>
//             </div>

//             {/* --- COLLAPSIBLE KITCHEN INTELLIGENCE --- */}
//             <div className="border border-slate-700 rounded-lg overflow-hidden transition-all duration-300">
//                 {/* Toggle Header */}
//                 <button 
//                     onClick={() => setIsForecastOpen(!isForecastOpen)}
//                     className="w-full flex items-center justify-between bg-slate-800 p-4 hover:bg-slate-750 transition"
//                 >
//                     <div className="flex items-center gap-3">
//                         <span className="text-xl">👨‍🍳</span>
//                         <div className="text-left">
//                             <h2 className="text-lg font-bold text-white">Kitchen Prep Forecast</h2>
//                             <p className="text-xs text-slate-400">AI predictions for tomorrow's prep</p>
//                         </div>
//                     </div>
//                     {/* Chevron Icon */}
//                     <div className={`transform transition-transform duration-300 ${isForecastOpen ? 'rotate-180' : ''}`}>
//                         <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//                         </svg>
//                     </div>
//                 </button>

//                 {/* Collapsible Content */}
//                 <div className={`bg-slate-800/50 transition-all duration-500 ease-in-out ${isForecastOpen ? 'max-h-[1000px] opacity-100 p-4 border-t border-slate-700' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    
//                     {/* Action Button */}
//                     <div className="flex justify-end mb-4">
//                         <button 
//                             onClick={generateForecasts}
//                             disabled={isForecasting}
//                             className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
//                         >
//                             {isForecasting ? (
//                                 <><span>Thinking...</span><div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div></>
//                             ) : (
//                                 "Generate Plan for Tomorrow"
//                             )}
//                         </button>
//                     </div>

//                     {/* Forecast Cards Grid */}
//                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
//                         {PREP_CATEGORIES.map(cat => {
//                             const f = forecasts[cat];
//                             return (
//                                 <div key={cat} className="bg-slate-900/80 p-4 rounded-lg border border-slate-700">
//                                     <h3 className="text-slate-300 font-semibold mb-3 border-b border-slate-700 pb-2">
//                                         {cat.replace(/_/g, ' ')}
//                                     </h3>
//                                     {f ? (
//                                         <div className="space-y-3">
//                                             <div className="flex justify-between items-center">
//                                                 <div className="text-center">
//                                                     <p className="text-xs text-slate-500 mb-1">PREDICTED QTY</p>
//                                                     <span className="text-2xl font-bold text-white">{f.predictedQuantity}</span>
//                                                 </div>
//                                                 <span className={`text-xs px-2 py-1 rounded font-bold ${
//                                                     f.confidence === 'HIGH' ? 'bg-green-900/50 text-green-400 border border-green-800' : 
//                                                     f.confidence === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' : 'bg-red-900/50 text-red-400 border border-red-800'
//                                                 }`}>
//                                                     {f.confidence}
//                                                 </span>
//                                             </div>
                                            
//                                             <div className="flex items-start gap-2 bg-indigo-500/10 p-2 rounded border border-indigo-500/20">
//                                                 <span className="text-lg">💡</span>
//                                                 <p className="text-sm text-indigo-300 font-medium">{f.suggestedAction}</p>
//                                             </div>
                                            
//                                             <p className="text-xs text-slate-500 leading-relaxed italic">
//                                                 "{f.reasoning}"
//                                             </p>
//                                         </div>
//                                     ) : (
//                                         <div className="h-20 flex items-center justify-center text-slate-600 text-xs">
//                                             Waiting to generate...
//                                         </div>
//                                     )}
//                                 </div>
//                             );
//                         })}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default DashboardView;

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
        
        // Calculate Target Date (Tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const targetDateStr = tomorrow.toISOString().split('T')[0];

        try {
            // We can run these requests in parallel for speed!
            const promiseList = PREP_CATEGORIES.map(async (category) => {
                console.log(`📡 Asking AI for ${category}...`);
                
                // ✅ This matches the arguments in your amplify/data/resource.ts
                const response = await client.queries.generateKitchenPlan({
                    businessPhone: `+${phoneNbr.replace('+','')}`, // Ensure strict format
                    targetDate: targetDateStr,
                    category: category
                });

                // The response.data IS the ForecastResult object
                return { category, data: response.data };
            });

            const results = await Promise.all(promiseList);

            // Map results back to state object
            results.forEach(res => {
                if (res.data) {
                    newForecasts[res.category] = res.data;
                }
            });

            setForecasts(newForecasts);

        } catch (e) {
            console.error("❌ Forecast failed:", e);
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
                                                    <p className="text-xs text-slate-500 mb-1">PREDICTED QTY</p>
                                                    <span className="text-2xl font-bold text-white">{f.predictedQuantity}</span>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded font-bold ${
                                                    f.confidence === 'HIGH' ? 'bg-green-900/50 text-green-400 border border-green-800' : 
                                                    f.confidence === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' : 'bg-red-900/50 text-red-400 border border-red-800'
                                                }`}>
                                                    {f.confidence}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-start gap-2 bg-indigo-500/10 p-2 rounded border border-indigo-500/20">
                                                <span className="text-lg">💡</span>
                                                <p className="text-sm text-indigo-300 font-medium">{f.suggestedAction}</p>
                                            </div>
                                            
                                            <p className="text-xs text-slate-500 leading-relaxed italic">
                                                "{f.reasoning}"
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="h-20 flex items-center justify-center text-slate-600 text-xs">
                                            Waiting to generate...
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

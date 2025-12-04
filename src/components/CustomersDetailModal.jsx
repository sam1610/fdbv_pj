

import React, { useMemo, useState } from 'react';
import { useEntityList } from '../DataHook/useEntityList';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CustomersDetailModal = ({ IdCustomer, customerName, onClose }) => {
    const [activeTab, setActiveTab] = useState('table'); 
    const [chartType, setChartType] = useState('bar');   
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // 1. Fetch ORDERS for this customer (sk begins with ORDER#)
    const { data: lineItems, loading } = useEntityList(
        {
            gsi2pk: IdCustomer,
            sk: { beginsWith: 'ORDER#' }, // Matches the Order Entity
            sortDirection: 'DESC'
        },
        "listBusinessDataByGsi2pkAndSk"
    );

    // --- Helper: Extract Date from 'orderDate' field ---
    const getDateFromItem = (item) => {
        if (item.orderDate) {
            return item.orderDate.split('T')[0]; // Extract YYYY-MM-DD
        }
        // Fallback to SK if orderDate is missing
        const parts = item.sk.split('#');
        if (parts.length > 1 && parts[1].includes('T')) {
            return parts[1].split('T')[0];
        }
        return 'Unknown';
    };

    // --- 2. Filter Data by Date Picker ---
    const filteredItems = useMemo(() => {
        if (!lineItems) return [];
        let res = lineItems;

        if (startDate) {
            res = res.filter(item => getDateFromItem(item) >= startDate);
        }
        if (endDate) {
            res = res.filter(item => getDateFromItem(item) <= endDate);
        }
        return res;
    }, [lineItems, startDate, endDate]);

    // --- 3. Aggregate Data for Charts ---
    const chartData = useMemo(() => {
        const dayMap = {};
        
        filteredItems.forEach(item => {
            const dateStr = getDateFromItem(item);
            if (dateStr === 'Unknown') return;

            if (!dayMap[dateStr]) dayMap[dateStr] = 0;
            
            // ✅ USE 'itemsNbr' from the Order Entity
            const qty = item.itemsNbr !== undefined ? Number(item.itemsNbr) : 1;
            dayMap[dateStr] += qty;
        });

        // Convert to array and SORT BY DATE ASCENDING (Oldest -> Newest) for the graph
        return Object.entries(dayMap)
            .map(([date, items]) => ({ date, items }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredItems]);

    // --- 4. Calculate Total Revenue ---
    const orderTotal = useMemo(() => {
        return filteredItems.reduce((acc, item) => {
            // ✅ USE 'totalAmount' from the Order Entity
            return acc + (Number(item.totalAmount) || 0);
        }, 0);
    }, [filteredItems]);

    // Format Date for Chart Labels (YYYY-MM-DD -> DD-MM-YY)
    const formatXAxisDate = (dateStr) => {
        if (!dateStr || dateStr === 'Unknown') return dateStr;
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year.slice(2)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-5xl shadow-xl animate-fade-in-up flex flex-col max-h-[90vh]">
                
                {/* --- Header --- */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-orange-400">Customer Orders</h2>
                        <span className="text-amber-400 text-sm">+({IdCustomer.split('#')[2].substring(0, 3)})-{IdCustomer.split('#')[2].substring(3, 5)} {IdCustomer.split('#')[2].substring(5, 11)}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>

                {/* --- Controls --- */}
                <div className="p-3 bg-slate-900/50 border-b border-slate-700 flex flex-wrap gap-4 items-center justify-between shrink-0">
                    <div className="flex gap-2 items-center">
                        <div className="flex flex-col">
                            <label className="text-xs text-slate-400 mb-1">Start Date</label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none"
                            />
                        </div>
                        <span className="text-slate-500 mt-4">-</span>
                        <div className="flex flex-col">
                            <label className="text-xs text-slate-400 mb-1">End Date</label>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sky-500 outline-none"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button 
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="mt-5 text-xs text-red-400 hover:text-red-300 underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {activeTab === 'analytics' && (
                        <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
                            <button 
                                onClick={() => setChartType('bar')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${chartType === 'bar' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Bar
                            </button>
                            <button 
                                onClick={() => setChartType('line')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${chartType === 'line' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Line
                            </button>
                        </div>
                    )}
                </div>

                {/* --- Tab Bar --- */}
                <div className="flex border-b border-slate-700 bg-slate-800 shrink-0">
                    <button onClick={() => setActiveTab('table')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'table' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200 bg-slate-900/30'}`}>📄 Grid Table</button>
                    <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'analytics' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200 bg-slate-900/30'}`}>📊 Visual Plot</button>
                </div>

                {/* --- Content Area --- */}
                <div className="overflow-y-auto flex-1 relative bg-slate-800">
                    
                    {/* TABLE VIEW */}
                    {activeTab === 'table' && (
                        <div className="h-full">
                            {/* Sticky Header Fix: added 'bg-slate-800', 'z-50', 'sticky' */}
                            <div className="grid grid-cols-4 font-semibold text-sm sticky top-0 bg-slate-800 py-3 z-50 border-b border-slate-700 shadow-md px-4">
                                <h3 className="text-sky-400 text-center">Order Date</h3>
                                <h3 className="text-amber-400 text-center">#Items</h3>
                                <h3 className="text-amber-400 text-center">Status</h3>
                                <h3 className="text-amber-400 text-center">T.Amount(BD)</h3>
                            </div>
                            
                            {loading ? <div className="text-center text-slate-500 py-10">Loading...</div> : 
                             filteredItems.length === 0 ? <div className="text-center text-slate-500 py-10">No orders found.</div> : (
                                <ul className="space-y-1 mt-1 text-slate-300 pb-4 px-4">
                                    {filteredItems.map(item => (
                                        <li key={item.sk} className="grid grid-cols-4 text-sm hover:bg-slate-700/50 p-2 rounded border-b border-slate-700/30">
                                            {/* 1. Date */}
                                            <span className="text-center">{getDateFromItem(item)}</span>
                                            
                                            {/* 2. Items Number (from itemsNbr) */}
                                            <span className="text-center font-mono">{item.itemsNbr || 1}</span>
                                            
                                            {/* 3. Status */}
                                            <span className="text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.orderStatus === 'DELIVERED' ? 'bg-green-900 text-green-300' : 
                                                    item.orderStatus === 'IN_PREPARATION' ? 'bg-yellow-900 text-yellow-300' : 'bg-slate-700 text-slate-300'
                                                }`}>{item.orderStatus}</span>
                                            </span>
                                            
                                            {/* 4. Amount (from totalAmount) */}
                                            <span className="text-center">{item.totalAmount ? Number(item.totalAmount).toFixed(3) : '0.000'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* ANALYTICS VIEW */}
                    {activeTab === 'analytics' && (
                        <div className="p-4 flex flex-col items-center">
                            {/* Fixed Height Container for Chart */}
                            <div className="h-96 w-full bg-slate-900/30 rounded-lg p-2 border border-slate-700/50">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        {chartType === 'bar' ? (
                                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    stroke="#94a3b8" 
                                                    fontSize={12} 
                                                    tickFormatter={formatXAxisDate} 
                                                    angle={-45} 
                                                    textAnchor="end" 
                                                    interval={0} 
                                                />
                                                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} labelFormatter={formatXAxisDate} />
                                                <Legend verticalAlign="top" />
                                                <Bar dataKey="items" name="Items Ordered" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        ) : (
                                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    stroke="#94a3b8" 
                                                    fontSize={12} 
                                                    tickFormatter={formatXAxisDate} 
                                                    angle={-45} 
                                                    textAnchor="end" 
                                                    interval={0} 
                                                />
                                                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} labelFormatter={formatXAxisDate} />
                                                <Legend verticalAlign="top" />
                                                <Line type="monotone" dataKey="items" name="Items Ordered" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} />
                                            </LineChart>
                                        )}
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                        <p>No data found for the selected range.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Footer --- */}
                <div className="border-t border-slate-700 p-4 bg-slate-900/50 rounded-b-lg shrink-0 flex justify-between font-bold text-white">
                    <span className="text-slate-400">Filtered Total Revenue</span>
                    <span className="text-emerald-400">BD {orderTotal.toFixed(3)}</span>
                </div>
            </div>
        </div>
    );
};

export default CustomersDetailModal;
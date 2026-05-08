// import React, { useMemo, useState, useEffect, useRef } from 'react';
// import { useEntityList } from '../DataHook/useEntityList';
// import {
//     BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
// } from 'recharts';

// /* ------------------------------------------------------------------
//    CUSTOM COMPONENT: Range Calendar
// -------------------------------------------------------------------*/
// const RangeCalendar = ({ startDate, endDate, onChange }) => {
//     const [viewDate, setViewDate] = useState(new Date(startDate || new Date()));

//     useEffect(() => { if(startDate) setViewDate(new Date(startDate)); }, [startDate]);

//     const year = viewDate.getFullYear();
//     const month = viewDate.getMonth();
//     const daysInMonth = new Date(year, month + 1, 0).getDate();
//     const firstDay = new Date(year, month, 1).getDay(); 

//     const handleDayClick = (day) => {
//         const dateObj = new Date(year, month, day);
//         const selectedStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        
//         if (!startDate || (startDate && endDate)) {
//             onChange(selectedStr, null); 
//         } else {
//             if (selectedStr < startDate) {
//                 onChange(selectedStr, startDate);
//             } else {
//                 onChange(startDate, selectedStr);
//             }
//         }
//     };

//     const changeMonth = (delta) => {
//         const newDate = new Date(viewDate);
//         newDate.setMonth(newDate.getMonth() + delta);
//         setViewDate(newDate);
//     };

//     const days = [];
//     for (let i = 0; i < firstDay; i++) days.push(null);
//     for (let i = 1; i <= daysInMonth; i++) days.push(i);

//     return (
//         <div className="bg-slate-900 rounded-xl border border-slate-600 p-3 select-none mt-2">
//             <div className="flex justify-between items-center mb-3">
//                 <button onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} className="text-slate-400 hover:text-white p-1">◀</button>
//                 <span className="text-white text-xs font-bold font-mono">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
//                 <button onClick={(e) => { e.stopPropagation(); changeMonth(1); }} className="text-slate-400 hover:text-white p-1">▶</button>
//             </div>
            
//             <div className="grid grid-cols-7 gap-1 text-center">
//                 {['S','M','T','W','T','F','S'].map((d, i) => (
//                     <div key={`h-${i}`} className="text-[9px] text-slate-500 font-bold">{d}</div>
//                 ))}
                
//                 {days.map((d, i) => {
//                     if (!d) return <div key={`empty-${i}`} />;
//                     const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
//                     const isStart = currentStr === startDate;
//                     const isEnd = currentStr === endDate;
//                     const isInRange = startDate && endDate && currentStr > startDate && currentStr < endDate;
                    
//                     let bgClass = "hover:bg-slate-700 text-slate-300";
//                     if (isStart || isEnd) bgClass = "bg-indigo-600 text-white font-bold shadow-md transform scale-110 z-10 relative";
//                     else if (isInRange) bgClass = "bg-indigo-900/50 text-indigo-200 rounded-none";
                    
//                     return (
//                         <button 
//                             key={`day-${i}`} 
//                             onClick={(e) => { e.stopPropagation(); handleDayClick(d); }} 
//                             className={`h-7 w-7 ${isInRange ? '' : 'rounded-full'} text-xs flex items-center justify-center transition-all ${bgClass}`}
//                         >
//                             {d}
//                         </button>
//                     );
//                 })}
//             </div>
//             <div className="mt-2 text-[9px] text-slate-500 text-center font-mono">
//                 {!startDate ? "Select Start Date" : !endDate ? "Select End Date" : `${startDate} ➝ ${endDate}`}
//             </div>
//         </div>
//     );
// };

// // --- HELPERS ---
// const getTodayString = () => new Date().toISOString().split('T')[0];
// const getPastDateString = (daysAgo) => {
//     const d = new Date();
//     d.setDate(d.getDate() - daysAgo);
//     return d.toISOString().split('T')[0];
// };

// /* ------------------------------------------------------------------
//    MAIN COMPONENT: CustomersDetailModal
// -------------------------------------------------------------------*/
// const CustomersDetailModal = ({ IdCustomer, customerName, onClose }) => {
//     const [activeTab, setActiveTab] = useState('table'); 
//     const [chartType, setChartType] = useState('bar');   
    
//     const [dateFilter, setDateFilter] = useState({ start: null, end: null, label: 'All Time' });
//     const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    
//     // 🟢 NEW: Ref to track the boundaries of the dropdown wrapper
//     const calendarWrapperRef = useRef(null);

//     // 🟢 NEW: Click-Outside Listener
//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             // If we click something that is NOT inside the calendar wrapper, close it
//             if (calendarWrapperRef.current && !calendarWrapperRef.current.contains(event.target)) {
//                 setIsCalendarOpen(false);
//             }
//         };

//         // Only attach the listener if the calendar is actually open
//         if (isCalendarOpen) {
//             document.addEventListener('mousedown', handleClickOutside);
//         }

//         // Cleanup listener on unmount or when calendar closes
//         return () => {
//             document.removeEventListener('mousedown', handleClickOutside);
//         };
//     }, [isCalendarOpen]);

//     // 1. Fetch ORDERS for this customer (sk begins with ORDER#)
//     const { data: lineItems, loading } = useEntityList(
//         {
//             gsi2pk: IdCustomer,
//             sk: { beginsWith: 'ORDER#' }, 
//             sortDirection: 'DESC'
//         },
//         "listBusinessDataByGsi2pkAndSk"
//     );

//     // --- Helper: Extract Date from 'orderDate' field ---
//     const getDateFromItem = (item) => {
//         if (item.orderDate) {
//             return item.orderDate.split('T')[0]; 
//         }
//         const parts = item.sk.split('#');
//         if (parts.length > 1 && parts[1].includes('T')) {
//             return parts[1].split('T')[0];
//         }
//         return 'Unknown';
//     };

//     // --- 2. Filter Data by Unified Date Picker ---
//     const filteredItems = useMemo(() => {
//         if (!lineItems) return [];
//         let res = lineItems;

//         if (dateFilter.start) {
//             res = res.filter(item => getDateFromItem(item) >= dateFilter.start);
//         }
//         if (dateFilter.end) {
//             res = res.filter(item => getDateFromItem(item) <= dateFilter.end);
//         }
//         return res;
//     }, [lineItems, dateFilter]);

//     // --- 3. Aggregate Data for Charts ---
//     const chartData = useMemo(() => {
//         const dayMap = {};
        
//         filteredItems.forEach(item => {
//             const dateStr = getDateFromItem(item);
//             if (dateStr === 'Unknown') return;

//             if (!dayMap[dateStr]) dayMap[dateStr] = 0;
            
//             const qty = item.itemsNbr !== undefined ? Number(item.itemsNbr) : 1;
//             dayMap[dateStr] += qty;
//         });

//         return Object.entries(dayMap)
//             .map(([date, items]) => ({ date, items }))
//             .sort((a, b) => a.date.localeCompare(b.date));
//     }, [filteredItems]);

//     // --- 4. Calculate Total Revenue ---
//     const orderTotal = useMemo(() => {
//         return filteredItems.reduce((acc, item) => {
//             return acc + (Number(item.totalAmount) || 0);
//         }, 0);
//     }, [filteredItems]);

//     // Format Date for Chart Labels
//     const formatXAxisDate = (dateStr) => {
//         if (!dateStr || dateStr === 'Unknown') return dateStr;
//         const [year, month, day] = dateStr.split('-');
//         return `${day}-${month}-${year.slice(2)}`;
//     };

//     // Preset Handlers
//     const setPreset = (type) => {
//         const today = getTodayString();
//         if (type === 'Today') setDateFilter({ start: today, end: today, label: 'Today' });
//         if (type === 'Week') setDateFilter({ start: getPastDateString(6), end: today, label: 'Week' });
//         if (type === 'All Time') setDateFilter({ start: null, end: null, label: 'All Time' });
//         setIsCalendarOpen(false); 
//     };

//     const handleCalendarChange = (s, e) => { 
//         setDateFilter({ start: s, end: e, label: 'Custom' }); 
//         // Optional: uncomment below to auto-close once both dates are picked
//         // if (s && e) setIsCalendarOpen(false);
//     };

//     return (
//         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
//             <div className="bg-slate-800 rounded-lg w-full max-w-5xl shadow-xl animate-fade-in-up flex flex-col max-h-[90vh]">
                
//                 {/* --- Header --- */}
//                 <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
//                     <div className="flex flex-col">
//                         <h2 className="text-lg font-bold text-orange-400">Customer Orders</h2>
//                         <span className="text-amber-400 text-sm">+({IdCustomer.split('#')[2].substring(0, 3)})-{IdCustomer.split('#')[2].substring(3, 5)} {IdCustomer.split('#')[2].substring(5, 11)}
//                         </span>
//                     </div>
//                     <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
//                 </div>

//                 {/* --- Controls (Unified Date Picker) --- */}
//                 <div className="p-3 bg-slate-900/50 border-b border-slate-700 flex flex-wrap gap-4 items-start justify-between shrink-0">
                    
//                     {/* 🟢 NEW: Attached ref to the wrapper boundary */}
//                     <div className="relative w-64" ref={calendarWrapperRef}>
//                         <div 
//                             onClick={() => setIsCalendarOpen(!isCalendarOpen)} 
//                             className="flex items-center justify-between bg-slate-800 rounded-xl border border-slate-600 p-2 cursor-pointer hover:border-indigo-500 transition-colors"
//                         >
//                             <div className="flex items-center gap-2">
//                                 <span className="text-base">📅</span>
//                                 <div className="flex flex-col">
//                                     <span className="text-[9px] text-slate-400 font-bold uppercase">{dateFilter.label}</span>
//                                     <span className="text-[10px] text-white font-bold font-mono">
//                                         {!dateFilter.start ? "All Time" : dateFilter.start === dateFilter.end ? dateFilter.start : `${dateFilter.start} ➝ ${dateFilter.end || '...'}`}
//                                     </span>
//                                 </div>
//                             </div>
//                             <span className={`text-slate-400 text-xs transform transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`}>▼</span>
//                         </div>

//                         {/* Calendar Dropdown Panel */}
//                         <div className={`absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-[6000] overflow-hidden transition-all duration-300 origin-top ${isCalendarOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}>
//                             <div className="p-2 border-b border-slate-700 bg-slate-900/50 flex gap-1">
//                                 {['All Time', 'Today', 'Week'].map(l => (
//                                     <button key={l} onClick={() => setPreset(l)} className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border ${dateFilter.label === l ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>{l}</button>
//                                 ))}
//                             </div>
//                             <RangeCalendar startDate={dateFilter.start} endDate={dateFilter.end} onChange={handleCalendarChange} />
//                         </div>
//                     </div>

//                     {/* Chart Toggles */}
//                     {activeTab === 'analytics' && (
//                         <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
//                             <button 
//                                 onClick={() => setChartType('bar')}
//                                 className={`px-3 py-1 rounded text-xs font-bold transition-all ${chartType === 'bar' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
//                             >
//                                 Bar
//                             </button>
//                             <button 
//                                 onClick={() => setChartType('line')}
//                                 className={`px-3 py-1 rounded text-xs font-bold transition-all ${chartType === 'line' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
//                             >
//                                 Line
//                             </button>
//                         </div>
//                     )}
//                 </div>

//                 {/* --- Tab Bar --- */}
//                 <div className="flex border-b border-slate-700 bg-slate-800 shrink-0">
//                     <button onClick={() => setActiveTab('table')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'table' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200 bg-slate-900/30'}`}>📄 Grid Table</button>
//                     <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'analytics' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200 bg-slate-900/30'}`}>📊 Visual Plot</button>
//                 </div>

//                 {/* --- Content Area --- */}
//                 <div className="overflow-y-auto flex-1 relative bg-slate-800">
                    
//                     {/* TABLE VIEW */}
//                     {activeTab === 'table' && (
//                         <div className="h-full">
//                             <div className="grid grid-cols-4 font-semibold text-sm sticky top-0 bg-slate-800 py-3 z-50 border-b border-slate-700 shadow-md px-4">
//                                 <h3 className="text-sky-400 text-center">Order Date</h3>
//                                 <h3 className="text-amber-400 text-center">#Items</h3>
//                                 <h3 className="text-amber-400 text-center">Status</h3>
//                                 <h3 className="text-amber-400 text-center">T.Amount(BD)</h3>
//                             </div>
                            
//                             {loading ? <div className="text-center text-slate-500 py-10">Loading...</div> : 
//                              filteredItems.length === 0 ? <div className="text-center text-slate-500 py-10">No orders found in range.</div> : (
//                                 <ul className="space-y-1 mt-1 text-slate-300 pb-4 px-4">
//                                     {filteredItems.map(item => (
//                                         <li key={item.sk} className="grid grid-cols-4 text-sm hover:bg-slate-700/50 p-2 rounded border-b border-slate-700/30">
//                                             <span className="text-center">{getDateFromItem(item)}</span>
//                                             <span className="text-center font-mono">{item.itemsNbr || 1}</span>
//                                             <span className="text-center">
//                                                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
//                                                     item.orderStatus === 'DELIVERED' ? 'bg-green-900 text-green-300' : 
//                                                     item.orderStatus === 'IN_PREPARATION' ? 'bg-yellow-900 text-yellow-300' : 'bg-slate-700 text-slate-300'
//                                                 }`}>{item.orderStatus}</span>
//                                             </span>
//                                             <span className="text-center">{item.totalAmount ? Number(item.totalAmount).toFixed(3) : '0.000'}</span>
//                                         </li>
//                                     ))}
//                                 </ul>
//                             )}
//                         </div>
//                     )}

//                     {/* ANALYTICS VIEW */}
//                     {activeTab === 'analytics' && (
//                         <div className="p-4 flex flex-col items-center">
//                             <div className="h-96 w-full bg-slate-900/30 rounded-lg p-2 border border-slate-700/50">
//                                 {chartData.length > 0 ? (
//                                     <ResponsiveContainer width="100%" height="100%">
//                                         {chartType === 'bar' ? (
//                                             <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
//                                                 <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
//                                                 <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={formatXAxisDate} angle={-45} textAnchor="end" interval={0} />
//                                                 <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
//                                                 <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} labelFormatter={formatXAxisDate} />
//                                                 <Legend verticalAlign="top" />
//                                                 <Bar dataKey="items" name="Items Ordered" fill="#38bdf8" radius={[4, 4, 0, 0]} />
//                                             </BarChart>
//                                         ) : (
//                                             <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
//                                                 <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
//                                                 <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={formatXAxisDate} angle={-45} textAnchor="end" interval={0} />
//                                                 <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
//                                                 <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} labelFormatter={formatXAxisDate} />
//                                                 <Legend verticalAlign="top" />
//                                                 <Line type="monotone" dataKey="items" name="Items Ordered" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} />
//                                             </LineChart>
//                                         )}
//                                     </ResponsiveContainer>
//                                 ) : (
//                                     <div className="h-full flex flex-col items-center justify-center text-slate-500">
//                                         <p>No data found for the selected range.</p>
//                                     </div>
//                                 )}
//                             </div>
//                         </div>
//                     )}
//                 </div>

//                 {/* --- Footer --- */}
//                 <div className="border-t border-slate-700 p-4 bg-slate-900/50 rounded-b-lg shrink-0 flex justify-between font-bold text-white">
//                     <span className="text-slate-400">Filtered Total Revenue</span>
//                     <span className="text-emerald-400">BD {orderTotal.toFixed(3)}</span>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default CustomersDetailModal;

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useEntityList } from '../DataHook/useEntityList';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import OrderDetailModal from './OrderDetailModal'; // 🟢 NEW: Import the modal

/* ------------------------------------------------------------------
   CUSTOM COMPONENT: Range Calendar
-------------------------------------------------------------------*/
const RangeCalendar = ({ startDate, endDate, onChange }) => {
    const [viewDate, setViewDate] = useState(new Date(startDate || new Date()));

    useEffect(() => { if(startDate) setViewDate(new Date(startDate)); }, [startDate]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); 

    const handleDayClick = (day) => {
        const dateObj = new Date(year, month, day);
        const selectedStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        
        if (!startDate || (startDate && endDate)) {
            onChange(selectedStr, null); 
        } else {
            if (selectedStr < startDate) {
                onChange(selectedStr, startDate);
            } else {
                onChange(startDate, selectedStr);
            }
        }
    };

    const changeMonth = (delta) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-600 p-3 select-none mt-2">
            <div className="flex justify-between items-center mb-3">
                <button onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} className="text-slate-400 hover:text-white p-1">◀</button>
                <span className="text-white text-xs font-bold font-mono">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={(e) => { e.stopPropagation(); changeMonth(1); }} className="text-slate-400 hover:text-white p-1">▶</button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={`h-${i}`} className="text-[9px] text-slate-500 font-bold">{d}</div>
                ))}
                
                {days.map((d, i) => {
                    if (!d) return <div key={`empty-${i}`} />;
                    const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isStart = currentStr === startDate;
                    const isEnd = currentStr === endDate;
                    const isInRange = startDate && endDate && currentStr > startDate && currentStr < endDate;
                    
                    let bgClass = "hover:bg-slate-700 text-slate-300";
                    if (isStart || isEnd) bgClass = "bg-indigo-600 text-white font-bold shadow-md transform scale-110 z-10 relative";
                    else if (isInRange) bgClass = "bg-indigo-900/50 text-indigo-200 rounded-none";
                    
                    return (
                        <button 
                            key={`day-${i}`} 
                            onClick={(e) => { e.stopPropagation(); handleDayClick(d); }} 
                            className={`h-7 w-7 ${isInRange ? '' : 'rounded-full'} text-xs flex items-center justify-center transition-all ${bgClass}`}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 text-[9px] text-slate-500 text-center font-mono">
                {!startDate ? "Select Start Date" : !endDate ? "Select End Date" : `${startDate} ➝ ${endDate}`}
            </div>
        </div>
    );
};

// --- HELPERS ---
const getTodayString = () => new Date().toISOString().split('T')[0];
const getPastDateString = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
};

/* ------------------------------------------------------------------
   MAIN COMPONENT: CustomersDetailModal
-------------------------------------------------------------------*/
const CustomersDetailModal = ({ IdCustomer, customerName, onClose, phoneNbr }) => {
    const [activeTab, setActiveTab] = useState('table'); 
    const [chartType, setChartType] = useState('bar');   
    
    const [dateFilter, setDateFilter] = useState({ start: null, end: null, label: 'All Time' });
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    
    // 🟢 NEW: State to track which order row was clicked
    const [selectedOrder, setSelectedOrder] = useState(null);

    // 🟢 NEW: Safely extract business phone if not passed directly in props
    const businessPhone = phoneNbr || (IdCustomer ? IdCustomer.split('#')[1] : null);

    const calendarWrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarWrapperRef.current && !calendarWrapperRef.current.contains(event.target)) {
                setIsCalendarOpen(false);
            }
        };
        if (isCalendarOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCalendarOpen]);

    // 1. Fetch ORDERS for this customer
    const { data: lineItems, loading } = useEntityList(
        {
            gsi2pk: IdCustomer,
            sk: { beginsWith: 'ORDER#' }, 
            sortDirection: 'DESC'
        },
        "listBusinessDataByGsi2pkAndSk"
    );

    const getDateFromItem = (item) => {
        if (item.orderDate) return item.orderDate.split('T')[0]; 
        const parts = item.sk.split('#');
        if (parts.length > 1 && parts[1].includes('T')) return parts[1].split('T')[0];
        return 'Unknown';
    };

    const filteredItems = useMemo(() => {
        if (!lineItems) return [];
        let res = lineItems;
        if (dateFilter.start) res = res.filter(item => getDateFromItem(item) >= dateFilter.start);
        if (dateFilter.end) res = res.filter(item => getDateFromItem(item) <= dateFilter.end);
        return res;
    }, [lineItems, dateFilter]);

    const chartData = useMemo(() => {
        const dayMap = {};
        filteredItems.forEach(item => {
            const dateStr = getDateFromItem(item);
            if (dateStr === 'Unknown') return;
            if (!dayMap[dateStr]) dayMap[dateStr] = 0;
            const qty = item.itemsNbr !== undefined ? Number(item.itemsNbr) : 1;
            dayMap[dateStr] += qty;
        });

        return Object.entries(dayMap)
            .map(([date, items]) => ({ date, items }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredItems]);

    const orderTotal = useMemo(() => {
        return filteredItems.reduce((acc, item) => acc + (Number(item.totalAmount) || 0), 0);
    }, [filteredItems]);

    const formatXAxisDate = (dateStr) => {
        if (!dateStr || dateStr === 'Unknown') return dateStr;
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year.slice(2)}`;
    };

    const setPreset = (type) => {
        const today = getTodayString();
        if (type === 'Today') setDateFilter({ start: today, end: today, label: 'Today' });
        if (type === 'Week') setDateFilter({ start: getPastDateString(6), end: today, label: 'Week' });
        if (type === 'All Time') setDateFilter({ start: null, end: null, label: 'All Time' });
        setIsCalendarOpen(false); 
    };

    const handleCalendarChange = (s, e) => { setDateFilter({ start: s, end: e, label: 'Custom' }); };

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
                <div className="p-3 bg-slate-900/50 border-b border-slate-700 flex flex-wrap gap-4 items-start justify-between shrink-0">
                    <div className="relative w-64" ref={calendarWrapperRef}>
                        <div 
                            onClick={() => setIsCalendarOpen(!isCalendarOpen)} 
                            className="flex items-center justify-between bg-slate-800 rounded-xl border border-slate-600 p-2 cursor-pointer hover:border-indigo-500 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">📅</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{dateFilter.label}</span>
                                    <span className="text-[10px] text-white font-bold font-mono">
                                        {!dateFilter.start ? "All Time" : dateFilter.start === dateFilter.end ? dateFilter.start : `${dateFilter.start} ➝ ${dateFilter.end || '...'}`}
                                    </span>
                                </div>
                            </div>
                            <span className={`text-slate-400 text-xs transform transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`}>▼</span>
                        </div>

                        <div className={`absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-[6000] overflow-hidden transition-all duration-300 origin-top ${isCalendarOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`}>
                            <div className="p-2 border-b border-slate-700 bg-slate-900/50 flex gap-1">
                                {['All Time', 'Today', 'Week'].map(l => (
                                    <button key={l} onClick={() => setPreset(l)} className={`flex-1 py-1 rounded text-[9px] font-bold uppercase border ${dateFilter.label === l ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>{l}</button>
                                ))}
                            </div>
                            <RangeCalendar startDate={dateFilter.start} endDate={dateFilter.end} onChange={handleCalendarChange} />
                        </div>
                    </div>

                    {activeTab === 'analytics' && (
                        <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
                            <button onClick={() => setChartType('bar')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${chartType === 'bar' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Bar</button>
                            <button onClick={() => setChartType('line')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${chartType === 'line' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Line</button>
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
                            <div className="grid grid-cols-4 font-semibold text-sm sticky top-0 bg-slate-800 py-3 z-50 border-b border-slate-700 shadow-md px-4">
                                <h3 className="text-sky-400 text-center">Order Date</h3>
                                <h3 className="text-amber-400 text-center">#Items</h3>
                                <h3 className="text-amber-400 text-center">Status</h3>
                                <h3 className="text-amber-400 text-center">T.Amount(BD)</h3>
                            </div>
                            
                            {loading ? <div className="text-center text-slate-500 py-10">Loading...</div> : 
                             filteredItems.length === 0 ? <div className="text-center text-slate-500 py-10">No orders found in range.</div> : (
                                <ul className="space-y-1 mt-1 text-slate-300 pb-4 px-4">
                                    {filteredItems.map(item => (
                                        <li 
                                            key={item.sk} 
                                            onClick={() => setSelectedOrder(item)} // 🟢 NEW: Trigger Modal open
                                            className="grid grid-cols-4 text-sm hover:bg-slate-700/80 p-2 rounded border-b border-slate-700/30 cursor-pointer transition-colors"
                                        >
                                            <span className="text-center">{getDateFromItem(item)}</span>
                                            <span className="text-center font-mono">{item.itemsNbr || 1}</span>
                                            <span className="text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.orderStatus === 'DELIVERED' ? 'bg-green-900 text-green-300' : 
                                                    item.orderStatus === 'IN_PREPARATION' ? 'bg-yellow-900 text-yellow-300' : 'bg-slate-700 text-slate-300'
                                                }`}>{item.orderStatus}</span>
                                            </span>
                                            <span className="text-center font-mono">{item.totalAmount ? Number(item.totalAmount).toFixed(3) : '0.000'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* ANALYTICS VIEW */}
                    {activeTab === 'analytics' && (
                        <div className="p-4 flex flex-col items-center">
                            <div className="h-96 w-full bg-slate-900/30 rounded-lg p-2 border border-slate-700/50">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        {chartType === 'bar' ? (
                                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={formatXAxisDate} angle={-45} textAnchor="end" interval={0} />
                                                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} labelFormatter={formatXAxisDate} />
                                                <Legend verticalAlign="top" />
                                                <Bar dataKey="items" name="Items Ordered" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        ) : (
                                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={formatXAxisDate} angle={-45} textAnchor="end" interval={0} />
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
                    <span className="text-slate-400 tracking-widest uppercase text-sm">Filtered Total Revenue</span>
                    <span className="text-emerald-400 font-mono text-lg">BD {orderTotal.toFixed(3)}</span>
                </div>
            </div>

            {/* 🟢 NEW: Nested Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <OrderDetailModal
                        orderId={selectedOrder.sk}
                        orderStatus={selectedOrder.orderStatus}
                        orderTotal={selectedOrder.totalAmount}
                        customerId={IdCustomer}
                        customerName={customerName}
                        phoneNbr={businessPhone}
                        agentId={selectedOrder.gsi1pk || selectedOrder.deliveryAgentId} // 🟢 ADD THIS LINE
                        onClose={() => setSelectedOrder(null)}
                    />
                </div>
            )}
        </div>
    );
};

export default CustomersDetailModal;
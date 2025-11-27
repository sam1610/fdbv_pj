// import React, { useState, useMemo, useEffect, useRef } from 'react';
// import { client } from '../DataHook/amplifyClient';
// import { useVirtualizer } from '@tanstack/react-virtual';

// // --- Configuration ---
// const classNames = (...classes) => classes.filter(Boolean).join(' ');

// const ALL_STATUSES = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'];
// const statusColors = {
//     ORDERED: 'bg-blue-500',
//     IN_PREPARATION: 'bg-yellow-500',
//     PREPARED: 'bg-green-500',
//     DELIVERED: 'bg-gray-500',
//     DELIVERING: 'bg-orange-500'
// };

// // --- Sub-components ---
// const OrderFilters = ({ currentFilter, setFilter }) => (
//     <div className="flex space-x-2 mb-4">
//         <button onClick={() => setFilter('active')} className={classNames(currentFilter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
//         <button onClick={() => setFilter('Prepared')} className={classNames(currentFilter === 'Prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
//         <button onClick={() => setFilter('all')} className={classNames(currentFilter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
   
//     </div>
// );

// const OrderStatusEditor = ({ order, isEditing, onEdit, onStatusChange }) => {
//     if (isEditing) {
//         return (
//             <select
//                 value={order.orderStatus}
//                 onChange={(e) => onStatusChange(order, e.target.value)}
//                 onBlur={() => onEdit(null)}
//                 onClick={(e) => e.stopPropagation()}
//                 className="bg-slate-600 text-white text-xs rounded p-1"
//                 autoFocus
//             >
//                 {ALL_STATUSES.map(status => (
//                     <option key={status} value={status}>{status.replace('_', ' ').toLowerCase()}</option>
//                 ))}
//             </select>
//         );
//     }

//     return (
//         <span
//             onClick={(e) => {
//                 e.stopPropagation();
//                 onEdit(order.sk);
//             }}
//             className={classNames(statusColors[order.orderStatus] || 'bg-gray-400', 'text-xs font-semibold px-2 py-0.5 rounded-full text-white cursor-pointer')}
//         >
//             {order.orderStatus ? order.orderStatus.replace('_', ' ').toLowerCase() : 'unknown'}
//         </span>
//     );
// };


// // Main OrdersView Component
// const OrdersView = ({ phoneNbr, setModal }) => {
    
//     // --- 1. State for Real-Time Data (Fetches ALL orders) ---
//     const [orders, setOrders] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);

//     // --- 2. Simple queryParam for the subscription ---
//     const queryParam = useMemo(() => {
//         if (!phoneNbr) return null;
//         return {
//             filter: { 
//                 pk: { eq: `BUSINESS#${phoneNbr}` }, 
//                 sk: { beginsWith: 'ORDER#' } 
//             }
//         };
//     }, [phoneNbr]);

//     // --- 3. observeQuery subscription logic ---
//     useEffect(() => {
//         if (!queryParam) return;

//         setLoading(true);
//         const observer = client.models.BusinessData.observeQuery(queryParam);

//         const subscription = observer.subscribe({
//             next: (snapshot) => {
//                 setOrders([...snapshot.items]);
//                 setError(null);
//                 setLoading(false);
//             },
//             error: (err) => {
//                 setError(err.message || 'Subscription error');
//                 setLoading(false);
//                 console.error('OrdersView observeQuery error:', err);
//             }
//         });

//         return () => subscription.unsubscribe();
//     }, [queryParam]);

//     // --- State for filters and editing ---
//     const [filter, setFilter] = useState('active');
//     const [editingId, setEditingId] = useState(null);
//     const [updatingId, setUpdatingId] = useState(null);

//     // --- handleStatusChange ---
//     const handleStatusChange = async (order, newStatus) => {
//         if (order.orderStatus === newStatus) {
//             setEditingId(null);
//             return;
//         }
//         setUpdatingId(order.sk);
//         setEditingId(null);

//         try {
//             await client.models.BusinessData.update({
//                 pk: order.pk,
//                 sk: order.sk,
//                 orderStatus: newStatus
//             });
//         } catch (err) {
//             console.error("Failed to update order status:", err);
//             alert(`Failed to update status for Order ${order.sk.replace('ORDER#', '')}. Please try again.`);
//         } finally {
//             setUpdatingId(null);
//         }
//     };
    
//     // --- 4. ✅ Sort ALL Orders ---
//     // Renamed from 'todayOrders'. This now sorts all orders by SK descending.
//     const sortedOrders = useMemo(() => {
//         if (!orders || orders.length === 0) return [];
        
//         // Sort all orders by SK (newest first)
//         return [...orders].sort((a, b) => b.sk.localeCompare(a.sk));

//     }, [orders]);

//     // --- 5. ✅ Filters now use 'sortedOrders' ---
//     // This hook filters the *entire* list based on your buttons.
//     const filteredOrders = useMemo(() => {
//         if (!sortedOrders) return [];
        
//         if (filter === 'active') return sortedOrders.filter(o => o.orderStatus === 'ORDERED' || o.orderStatus === 'IN_PREPARATION');
//         if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
//         if (filter === 'all') return sortedOrders; // This is now ALL orders
        
//         return [];
//     }, [sortedOrders, filter]);

//     // Delivery Added
    

//     // --- 6. Setup for Virtualization ---
//     const parentRef = useRef();

//     const rowVirtualizer = useVirtualizer({
//         count: filteredOrders.length, // Virtualizer will use the filtered list
//         getScrollElement: () => parentRef.current,
//         estimateSize: () => 92,
//         overscan: 5,
//     });

//     const virtualItems = rowVirtualizer.getVirtualItems();

//     // --- Render Logic ---
//     if (loading) return <div className="p-4 text-center text-slate-400">Loading Orders...</div>;
//     if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

//     return (
//         <div className="p-4">
//             <h1 className="text-2xl font-bold text-yellow-500 mb-4">Orders Dashboard</h1>
//             <OrderFilters currentFilter={filter} setFilter={setFilter} />

//             <div 
//                 ref={parentRef} 
//                 className="overflow-y-auto h-[600px] pr-2" 
//             >
//                 {filteredOrders.length > 0 ? (
//                     <div 
//                         style={{ 
//                             height: `${rowVirtualizer.getTotalSize()}px`, 
//                             position: 'relative', 
//                             width: '100%' 
//                         }}
//                     >
//                         {virtualItems.map((virtualItem , index) => {
//                             const order = filteredOrders[virtualItem.index];

//                             return (
//                                 <div 
//                                     key={order.sk} 
//                                     style={{
//                                         position: 'absolute',
//                                         top: 0,
//                                         left: 0,
//                                         width: '100%',
//                                         height: `${virtualItem.size}px`,
//                                         transform: `translateY(${virtualItem.start}px)`,
//                                     }}
//                                 >
//                                     {index > 0 && (
//                                 <div className=" mb-1"></div>
//                             )}

//                                 <div 
//                                         onClick={() => !editingId && setModal({ type: 'orderDetail', Id: order.sk ,orderStatus: order.orderStatus, totalAmount: order.totalAmount })} 
//                                         className={classNames(
//                                             // 1. Removed 'justify-between'
//                                             "bg-slate-800 p-3 rounded-lg flex items-center transition h-full", 
//                                             updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700',
//                                             !editingId && 'cursor-pointer'
//                                         )}
//                                     >
                                         
//                                         <div className="flex-grow min-w-0">
//                                             <p className="font-bold text-white truncate">ORD: {order.sk.replace('ORDER#', '').split(".")[0]}</p>
//                                             <p className="text-sm text-slate-400 truncate">Customer: {order.gsi2pk ? order.gsi2pk.split('#')[2] : 'N/A'}</p>
//                                         </div>

//                                         {/* 3. Column 2: Never shrinks, has fixed left margin */}
//                                         <div className="text-right flex-shrink-0 ml-4">
//                                             <p className="font-bold text-white">BD {order.totalAmount?.toFixed(2) || '0.S.00'}</p>
//                                             <OrderStatusEditor 
//                                                 order={order}
//                                                 isEditing={editingId === order.sk}
//                                                 onEdit={setEditingId}
//                                                 onStatusChange={handleStatusChange}
//                                             />
//                                         </div>
//                                     </div>
//                                 </div>
//                             );
//                         })}
//                     </div>
//                 ) : (
//                     <p className="text-slate-400 text-center mt-8">No {filter} orders found.</p>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default OrdersView;


// second update of OrdersView.jsx

// import React, { useState, useMemo, useEffect, useRef } from 'react';
// import { client } from '../DataHook/amplifyClient';
// import { useVirtualizer } from '@tanstack/react-virtual';
// import DeliveryOptimizer from './DeliveryOptimizer';

// // --- Configuration ---
// const classNames = (...classes) => classes.filter(Boolean).join(' ');

// const ALL_STATUSES = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'];
// const statusColors = {
//     ORDERED: 'bg-blue-500',
//     IN_PREPARATION: 'bg-yellow-500',
//     PREPARED: 'bg-green-500',
//     DELIVERED: 'bg-gray-500',
//     DELIVERING: 'bg-orange-500'
// };

// // --- 1. New Component: Pick-up Icon/Badge ---
// const PickUpBadge = () => (
//     <div className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-900 text-indigo-200 border border-indigo-500/30 shadow-sm">
//         {/* SVG: Hand holding a box */}
//         <svg 
//             className="mr-1.5 w-4 h-4 text-indigo-300" 
//             viewBox="0 0 24 24" 
//             fill="none" 
//             stroke="currentColor" 
//             strokeWidth="2" 
//             strokeLinecap="round" 
//             strokeLinejoin="round"
//         >
//             {/* The Box */}
//             <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
//             <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
//             <line x1="12" y1="22.08" x2="12" y2="12" />
//             {/* The "Hand" metaphor (Small arc under the box indicating holding) */}
//             <path d="M16 21c0-1.1-2-2-4-2s-4 .9-4 2" />
//         </svg>
//         Pick-Up
//     </div>
// );

// // --- Sub-components ---
// const OrderFilters = ({ currentFilter, setFilter }) => (
//     <div className="flex space-x-2 mb-4">
//         <button onClick={() => setFilter('active')} className={classNames(currentFilter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
//         <button onClick={() => setFilter('Prepared')} className={classNames(currentFilter === 'Prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
//         <button onClick={() => setFilter('all')} className={classNames(currentFilter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
//         <button onClick={() => setFilter('Auto-Assign')} className={classNames(currentFilter === 'Auto-Assign' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Auto-Assign</button>
//     </div>
// );
// const OrderStatusEditor = ({ order, isEditing, onEdit, onStatusChange }) => {
//     if (isEditing) {
//         return (
//             <select
//                 value={order.orderStatus}
//                 onChange={(e) => onStatusChange(order, e.target.value)}
//                 onBlur={() => onEdit(null)}
//                 onClick={(e) => e.stopPropagation()}
//                 className="bg-slate-600 text-white text-xs rounded p-1"
//                 autoFocus
//             >
//                 {ALL_STATUSES.map(status => (
//                     <option key={status} value={status}>{status.replace('_', ' ').toLowerCase()}</option>
//                 ))}
//             </select>
//         );
//     }

//     return (
//         <span
//             onClick={(e) => {
//                 e.stopPropagation();
//                 onEdit(order.sk);
//             }}
//             className={classNames(statusColors[order.orderStatus] || 'bg-gray-400', 'text-xs font-semibold px-2 py-0.5 rounded-full text-white cursor-pointer')}
//         >
//             {order.orderStatus ? order.orderStatus.replace('_', ' ').toLowerCase() : 'unknown'}
//         </span>
//     );
// };


// // Main OrdersView Component
// const OrdersView = ({ phoneNbr, setModal, deliveryAgents, businessLocation }) => {
    
//     const [orders, setOrders] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [showOptimizer, setShowOptimizer] = useState(false);

//     const queryParam = useMemo(() => {
//         if (!phoneNbr) return null;
//         return {
//             filter: { 
//                 pk: { eq: `BUSINESS#${phoneNbr}` }, 
//                 sk: { beginsWith: 'ORDER#' } 
//             }
//         };
//     }, [phoneNbr]);

//     useEffect(() => {
//         if (!queryParam) return;

//         setLoading(true);
//         const observer = client.models.BusinessData.observeQuery(queryParam);

//         const subscription = observer.subscribe({
//             next: (snapshot) => {
//                 setOrders([...snapshot.items]);
//                 setError(null);
//                 setLoading(false);
//             },
//             error: (err) => {
//                 setError(err.message || 'Subscription error');
//                 setLoading(false);
//                 console.error('OrdersView observeQuery error:', err);
//             }
//         });

//         return () => subscription.unsubscribe();
//     }, [queryParam]);

//     const [filter, setFilter] = useState('active');
//     const [editingId, setEditingId] = useState(null);
//     const [updatingId, setUpdatingId] = useState(null);

//     const handleStatusChange = async (order, newStatus) => {
//         if (order.orderStatus === newStatus) {
//             setEditingId(null);
//             return;
//         }
//         setUpdatingId(order.sk);
//         setEditingId(null);

//         try {
//             await client.models.BusinessData.update({
//                 pk: order.pk,
//                 sk: order.sk,
//                 orderStatus: newStatus
//             });
//         } catch (err) {
//             console.error("Failed to update order status:", err);
//             alert(`Failed to update status for Order ${order.sk.replace('ORDER#', '')}. Please try again.`);
//         } finally {
//             setUpdatingId(null);
//         }
//     };
    
//     const sortedOrders = useMemo(() => {
//         if (!orders || orders.length === 0) return [];
//         return [...orders].sort((a, b) => b.sk.localeCompare(a.sk));
//     }, [orders]);

//     const filteredOrders = useMemo(() => {
//         if (!sortedOrders) return [];
        
//         if (filter === 'active') return sortedOrders.filter(o => o.orderStatus === 'ORDERED' || o.orderStatus === 'IN_PREPARATION');
//         if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
//         if (filter === 'all') return sortedOrders; 
//         if (filter === 'Auto-Assign')  
            
//             return sortedOrders
//             .filter(o => o.orderStatus === 'PREPARED' && !o.isPickUp)
//             .map(order => ({
//         sk: order.sk,
//         pk: order.pk,
//         location:  order.location,
//         gsi2pk: order.gsi2pk.split('#')[2], 
//       })).filter(o => o.location !== null);
//     return [];
//     }, [sortedOrders, filter]);
//     console.log( " filterOrders", filteredOrders);
//     const readyForDispatchOrders = useMemo(() => {
//   return sortedOrders
//     .filter(o => o.orderStatus === 'PREPARED' && o.isPickUp !== true)
//     .map(order => ({
//       sk: order.sk,
//       pk: order.pk,
//       location: order.location,
//    : order.gsi2pk?.split('#')[2] || 'Unknown'
//     }))
//     .filter(o => o.location !== null);
// }, [sortedOrders]);
    
    
//     const parentRef = useRef();

//     const rowVirtualizer = useVirtualizer({
//         count: filteredOrders?.length,
//         getScrollElement: () => parentRef.current,
//         estimateSize: () => 92,
//         overscan: 5,
//     });

//     const virtualItems = rowVirtualizer.getVirtualItems();

//     if (loading) return <div className="p-4 text-center text-slate-400">Loading Orders...</div>;
//     if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

//     return (
//         <div className="p-4">
//             <h1 className="text-2xl font-bold text-yellow-500 mb-4">Orders Dashboard</h1>
//             <OrderFilters currentFilter={filter} setFilter={setFilter} />
            

//             <div 
//                 ref={parentRef} 
//                 className="overflow-y-auto h-[600px] pr-2"
//             >
//                 {filteredOrders.length > 0 ? (
//                     <div 
//                         style={{ 
//                             height: `${rowVirtualizer.getTotalSize()}px`, 
//                             position: 'relative', 
//                             width: '100%' 
//                         }}
//                     >
//                         {virtualItems.map((virtualItem , index) => {
//                             const order = filteredOrders[virtualItem.index];

//                             return (
//                                 <div 
//                                     key={order.sk} 
//                                     style={{
//                                         position: 'absolute',
//                                         top: 0,
//                                         left: 0,
//                                         width: '100%',
//                                         height: `${virtualItem.size}px`,
//                                         transform: `translateY(${virtualItem.start}px)`,
//                                     }}
//                                 >
//                                     {index > 0 && (
//                                 <div className=" mb-1"></div>
//                             )}

//                                 <div 
//                                         onClick={() => !editingId && setModal({ 
//                                             type: 'orderDetail', 
//                                             Id: order.sk ,
//                                             orderStatus: order.orderStatus, 
//                                             totalAmount: order.totalAmount , 
//                                             customerId: order.gsi2pk ? order.gsi2pk.split('#')[2] : 'N/A'})} 
//                                         className={classNames(
//                                             "bg-slate-800 p-3 rounded-lg flex items-center transition h-full", 
//                                             updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700',
//                                             !editingId && 'cursor-pointer'
//                                         )}
//                                     >
                                         
//                                         <div className="flex-grow min-w-0">
//                                             {/* --- UPDATED SECTION START --- */}
//                                             <div className="flex items-center">
//                                                 <p className="font-bold text-white truncate">
//                                                     ORD: {order.sk.replace('ORDER#', '').split(".")[0]}
//                                                 </p>
                                                
//                                                 {/* Logic to show the Hand/PickUp Icon */}
//                                                 {order.isPickUp === true && (
//                                                     <PickUpBadge />
//                                                 )}
//                                             </div>
//                                             {/* --- UPDATED SECTION END --- */}

//                                             <p className="text-sm text-slate-400 truncate"> Customer: {order.gsi2pk ? order.gsi2pk.split('#')[2] : 'N/A'}</p>
//                                         </div>

//                                         <div className="text-right flex-shrink-0 ml-4">
//                                             <p className="font-bold text-white">BD {order.totalAmount?.toFixed(2) || '0.S.00'}</p>
//                                             <OrderStatusEditor 
//                                                 order={order}
//                                                 isEditing={editingId === order.sk}
//                                                 onEdit={setEditingId}
//                                                 onStatusChange={handleStatusChange}
//                                             />
//                                         </div>
//                                     </div>
//                                 </div>
//                             );
//                         })}
//                     </div>
//                 ) : (
//                     <p className="text-slate-400 text-center mt-8">No {filter} orders found.</p>
//                 )}
//             </div>

//             {filter === 'Auto-Assign' && filteredOrders.length > 0 && (
//     <DeliveryOptimizer  
//       // Use your already-prepared filteredOrders!
//       orders={ readyForDispatchOrders}
//         agents={deliveryAgents
//         .map(agent => ({
//           id: agent.sk ,
//           currentLocation: businessLocation
//         }))
//         .filter(a => a.currentLocation)
//       }

//       restaurantLocation={businessLocation}

//       onClose={() => setFilter('Prepared')}
//       onAssignmentSaved={() => {
//         alert('All orders dispatched successfully!');
//         setFilter('Prepared');
//       }}
//     />
//   )}
//         </div>
//     );
// };

// export default OrdersView;



// 3d version 


// OrdersView.jsx — FINAL CLEAN VERSION
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { client } from '../DataHook/amplifyClient';
import { useVirtualizer } from '@tanstack/react-virtual';
import DeliveryOptimizer from './DeliveryOptimizer';

// --- Config & Helpers ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');
const ALL_STATUSES = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'];
const statusColors = {
  ORDERED: 'bg-blue-500',
  IN_PREPARATION: 'bg-yellow-500',
  PREPARED: 'bg-green-500',
  DELIVERING: 'bg-orange-500',
  DELIVERED: 'bg-gray-500'
};

// Parse DynamoDB Number location format
const parseLocation = (loc) => {
  if (!loc) return null;
  try {
    if (typeof loc === 'string') loc = JSON.parse(loc);
    return {
      latitude: parseFloat(loc.latitude?.N || loc.lat?.N || loc.latitude || 0),
      longitude: parseFloat(loc.longitude?.N || loc.long?.N || loc.longitude || 0)
    };
  } catch (e) {
    console.warn("Invalid location:", loc);
    return null;
  }
};

// PickUp Badge
const PickUpBadge = () => (
  <div className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-900 text-indigo-200 border border-indigo-500/30">
    <svg className="mr-1 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
      <path d="M16 21c0-1.1-2-2-4-2s-4 .9-4 2" />
    </svg>
    Pick-Up
  </div>
);

// Filters
const OrderFilters = ({ currentFilter, setFilter, hasPrepared , readyForDispatch}) => (
  <div className="flex flex-wrap gap-3 mb-6">
    <button onClick={() => setFilter('active')} className={classNames(currentFilter === 'active' ? 'bg-sky-600' : 'bg-slate-700', 'px-4 py-2 rounded-lg text-sm font-medium')}>
      Active
    </button>
    <button onClick={() => setFilter('Prepared')} className={classNames(currentFilter === 'Prepared' ? 'bg-sky-600' : 'bg-slate-700', 'px-4 py-2 rounded-lg text-sm font-medium')}>
      Prepared ({hasPrepared})
    </button>
    <button onClick={() => setFilter('all')} className={classNames(currentFilter === 'all' ? 'bg-sky-600' : 'bg-slate-700', 'px-4 py-2 rounded-lg text-sm font-medium')}>
      All
    </button>

    {hasPrepared > 0 && (
      <button
        onClick={() => setFilter('Auto-Assign')}
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition"
      >
        Auto-Assign Ready Orders ({readyForDispatch.length})
      </button>
    )}
  </div>
);

// Status Editor
const OrderStatusEditor = ({ order, isEditing, onEdit, onStatusChange }) => {
  if (isEditing) {
    return (
      <select
        value={order.orderStatus}
        onChange={(e) => onStatusChange(order, e.target.value)}
        onBlur={() => onEdit(null)}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-600 text-white text-xs rounded p-1"
        autoFocus
      >
        {ALL_STATUSES.map(status => (
          <option key={status} value={status}>{status.replace('_', ' ').toLowerCase()}</option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); onEdit(order.sk); }}
      className={classNames(statusColors[order.orderStatus] || 'bg-gray-400', 'text-xs font-semibold px-2 py-0.5 rounded-full text-white cursor-pointer')}
    >
      {order.orderStatus?.replace('_', ' ').toLowerCase() || 'unknown'}
    </span>
  );
};
const generateDistinctColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    // 1. Calculate hue: evenly spaced around the 360° color wheel
    // e.g. if 3 agents: 0°, 120°, 240°
    const hue = Math.floor((360 / count) * i);
    
    // 2. Create CSS HSL string (70% Saturation, 50% Lightness is standard "bright")
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
};
// Main Component
const OrdersView = ({ phoneNbr, setModal, deliveryAgents = [], businessLocation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');
  const [editingId, setEditingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
    console.log(" deliveryAgents", deliveryAgents);
  // Subscribe to all orders
  const queryParam = useMemo(() => phoneNbr ? {
    filter: { pk: { eq: `BUSINESS#${phoneNbr}` }, sk: { beginsWith: 'ORDER#' } }
  } : null, [phoneNbr]);

  useEffect(() => {
    if (!queryParam) return;
    setLoading(true);
    const sub = client.models.BusinessData.observeQuery(queryParam).subscribe({
      next: ({ items }) => {
        setOrders([...items]);
        setLoading(false);
      },
      error: (err) => {
        setError(err.message || 'Subscription failed');
        setLoading(false);
      }
    });
    return () => sub.unsubscribe();
  }, [queryParam]);

  // Sorted & filtered
  const sortedOrders = useMemo(() =>
    [...orders].sort((a, b) => b.sk.localeCompare(a.sk)), [orders]
  );

  const filteredOrders = useMemo(() => {
    if (!sortedOrders.length) return [];
    if (filter === 'active') return sortedOrders.filter(o => ['ORDERED', 'IN_PREPARATION'].includes(o.orderStatus));
    if (filter === 'Prepared') return sortedOrders.filter(o => o.orderStatus === 'PREPARED');
    if (filter === 'all') return sortedOrders;
    return [];
  }, [sortedOrders, filter]);
  console.log("Filtered Orders:", filteredOrders);
  // Ready for dispatch — stable & correct
  const readyForDispatch = useMemo(() => {
    return sortedOrders
      .filter(o => o.orderStatus === 'PREPARED' && !o.isPickUp )
      .map(order => ({
        sk: order.sk,
        pk: order.pk,
        location: parseLocation(order.location),
        customer: order.gsi2pk?.split('#')[2] || 'Unknown'
      }))
      .filter(o => o.location !== null);
  }, [sortedOrders]);

  const preparedCount = sortedOrders.filter(o => o.orderStatus === 'PREPARED').length;

  // Virtualization
  const parentRef = useRef();
  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 5,
  });
//   Colour generation for delivery agents
const agentColors = useMemo(() => {
  return generateDistinctColors(deliveryAgents.length);
}, [deliveryAgents.length]);
  const virtualItems = rowVirtualizer.getVirtualItems();

  const handleStatusChange = async (order, newStatus) => {
    if (order.orderStatus === newStatus) return setEditingId(null);
    setUpdatingId(order.sk);
    try {
      await client.models.BusinessData.update({
        pk: order.pk,
        sk: order.sk,
        orderStatus: newStatus
      });
    } catch (err) {
      alert('Update failed');
      console.error(err);
    } finally {
      setUpdatingId(null);
      setEditingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading orders...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-yellow-500 mb-4">Orders Dashboard</h1>

      <OrderFilters currentFilter={filter} setFilter={setFilter} hasPrepared={preparedCount} readyForDispatch={readyForDispatch} />

      <div ref={parentRef} className="overflow-y-auto h-[600px] pr-2">
        {filteredOrders.length > 0 ? (
          <div style={{ height: rowVirtualizer.getTotalSize() + 'px', position: 'relative', width: '100%' }}>
            {virtualItems.map((virtualItem, index) => {
              const order = filteredOrders[virtualItem.index];
              return (
                <div
                  key={order.sk}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualItem.size + 'px',
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                >
                  <div
                    onClick={() => !editingId && setModal({
                      type: 'orderDetail',
                      Id: order.sk,
                      orderStatus: order.orderStatus,
                      totalAmount: order.totalAmount,
                      customerId: order.gsi2pk?.split('#')[2] || 'N/A'
                    })}
                    className={classNames(
                      "bg-slate-800 p-3 rounded-lg flex items-center transition h-full",
                      updatingId === order.sk ? 'opacity-50' : 'hover:bg-slate-700',
                      !editingId && 'cursor-pointer'
                    )}
                  >
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center">
                        <p className="font-bold text-white truncate">
                          ORD: {order.sk.replace('ORDER#', '').split('.')[0]}
                        </p>
                        {order.isPickUp && <PickUpBadge />}
                      </div>
                      <p className="text-sm text-slate-400 truncate">
                        Customer: {order.gsi2pk?.split('#')[2] || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-bold text-white">BD {order.totalAmount?.toFixed(2) || '0.00'}</p>
                      <OrderStatusEditor
                        order={order}
                        isEditing={editingId === order.sk}
                        onEdit={setEditingId}
                        onStatusChange={handleStatusChange}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-400 text-center mt-8">No {filter} orders found.</p>
        )}
      </div>

      {/* AUTO-ASSIGN MODAL — 100% stable */}
      {filter === 'Auto-Assign' && readyForDispatch.length > 0 && (
        <DeliveryOptimizer
          orders={readyForDispatch}
          agents={deliveryAgents
            .map(agent => ({
              id: agent.sk ,
              name: agent.name, 
              currentLocation: parseLocation(businessLocation)
            }))
            .filter(a => a.currentLocation)
          }
          AGENT_COLORS={agentColors}
          restaurantLocation={parseLocation(businessLocation)}
          onClose={() => setFilter('Prepared')}
          onAssignmentSaved={() => {
            // alert('All orders dispatched successfully!');
            // setFilter('Prepared');
          }}
        />
      )}
    </div>
  );
};

export default OrdersView;
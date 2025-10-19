import React, { useState, useMemo, useEffect } from 'react';
// import { generateClient } from 'aws-amplify/data';
import { useEntityList } from '../DataHook/useEntityList';

// --- Component Setup ---
// const client = generateClient({ authMode: 'userPool' });
const classNames = (...classes) => classes.filter(Boolean).join(' ');
// Updated to match the schema's enum values
const statusColors = { 
  ORDERED: 'bg-blue-500', 
  IN_PREPARATION: 'bg-yellow-500', 
  PREPARED: 'bg-green-500', 
  DELIVERED: 'bg-gray-500', 
  DELIVERING: 'bg-orange-500' 
};

/**
 * An Order Management component that fetches its own data from DynamoDB
 * and displays a simple list of all orders for the business.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 * @param {Function} props.setModal - A function to open a modal window.
 */
const OrdersView = ({ phoneNbr, setModal }) => {
    // We only need one state for the raw data fetched from the API
    // const [allItems, setAllItems] = useState([]);
    // const [loading, setLoading] = useState(true);
    // const [error, setError] = useState(null);

    // --- Data Fetching Logic ---
    // useEffect(() => {
       

    //     if (!phoneNbr) {
    //         setLoading(false);
    //         return;
    //     }

    //     const fetchData = async () => {
    //         setLoading(true);
    //         setError(null);
    //         try {
    //             const allRecords = [];
    //             let nextToken = null;
    //             const pk = `BUSINESS#${phoneNbr}`;

    //             do {
    //                 const response = await client.models.BusinessData.listBusinessDataByPkAndSk({
    //                     pk: pk,
    //                     sk: { beginsWith: 'ORDER#' }, // Only fetch Order records
    //                     nextToken: nextToken,
    //                 });
    //                 const items = response.data || [];
    //                 allRecords.push(...items);
    //                 nextToken = response.nextToken;
    //             } while (nextToken);

    //             console.log("Fetched all orders for business:", allRecords);
    //             setAllItems(allRecords);
    //         } catch (err) {
    //             const msg = err.errors ? err.errors[0].message : err.message;
    //             setError(`Failed to fetch orders: ${msg}`);
    //             console.error(err);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     fetchData();
    // }, []);
   
    // ✅ FIX: The component now correctly derives the 'orders' list from 'allItems'
    // using useMemo. This prevents infinite re-renders.
    const { data: orders, loading, error } = useEntityList(
        {filter: {pk:{ eq:`BUSINESS#${phoneNbr}`} , sk: {beginsWith: 'ORDER#'} }} , "list");
    console.log("Records:", orders);
        const [filter, setFilter] = useState('active');
        const filteredOrders = useMemo(() => {
        if (filter === 'active') return orders.filter(o => o.orderStatus == 'ORDERED' || o.orderStatus == 'IN_PREPARATION');
        if (filter === 'Prepared') return orders.filter(o => o.orderStatus == 'PREPARED');

        if (filter === 'all') return orders;
        return orders.filter(o => o.orderStatus === filter);
    }, [orders, filter]);

    if (loading) return <div className="p-4 text-center">Loading Orders...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-white mb-4">All Orders for this Business</h1>
            
            <div className="flex space-x-2 mb-4">
                <button onClick={() => setFilter('active')} className={classNames(filter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
                <button onClick={() => setFilter('Prepared')} className={classNames(filter === 'Prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
                <button onClick={() => setFilter('all')} className={classNames(filter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
            </div>
            <div className="space-y-3">
                {filteredOrders.length > 0 ? (
                    filteredOrders.map(order => (
                        <div key={order.sk} onClick={() => setModal({ type: 'orderDetail', Id: order.sk , totalAmount: order.totalAmount })} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-700">
                            <div>
                                <p className="font-bold text-white">Order ID: {order.sk.replace('ORDER#', '')}</p>
                                {/* The customer phone is on gsi2pk: CUSTOMER#<business_phone>#<customer_phone> */}
                                <p className="text-sm text-slate-400">Customer Phone: {order.gsi2pk ? order.gsi2pk.split('#')[2] : 'N/A'}</p>
                                {/* <p className="text-sm text-slate-200">Order ID : {order.sk }</p> */}
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-white">${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                                <span className={classNames(statusColors[order.orderStatus], 'text-xs font-semibold px-2 py-0.5 rounded-full text-white')}>
                                    {order.orderStatus ? order.orderStatus.replace('_', ' ').toLowerCase() : 'unknown'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-slate-400">No orders found for this business.</p>
                )}
            </div>
        </div>
    );
};

export default OrdersView;


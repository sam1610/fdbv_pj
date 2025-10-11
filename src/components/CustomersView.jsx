import React, { useState, useMemo, useEffect } from 'react';
import { useEntityList } from '../DataHook/useEntityList';


// --- Component Setup ---
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
const CustomersView = ({ phoneNbr, setModal }) => {
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
    //                     sk: { beginsWith: 'CUSTOMER#' }, // Only fetch Customer records
    //                     nextToken: nextToken,
    //                 });
    //                 const items = response.data || [];
    //                 allRecords.push(...items);
    //                 nextToken = response.nextToken;
    //             } while (nextToken);

    //             console.log("Fetched all customers for business:", allRecords);
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
    // }, [phoneNbr]);

    // // ✅ FIX: The component now correctly derives the 'orders' list from 'allItems'
    // // using useMemo. This prevents infinite re-renders.
    // const customers = useMemo(() => {
    //     // A guard clause to ensure allItems is a valid array
    //     if (!Array.isArray(allItems)) return [];
    //     // The data fetching is already filtering by 'ORDER#', so we can just use it directly.
    //     return allItems;
    // }, [allItems]);
    const { data: customers, loading, error } = useEntityList(`BUSINESS#${phoneNbr}`, 'CUSTOMER#');
    console.log("Records:", customers);

    if (loading) return <div className="p-4 text-center">Loading Customers...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;




return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-white mb-4">Customers</h1>
            <div className="space-y-3">
                {customers.map(customer => (
                    <div key={customer.sk} 
                    onClick={() => setModal({ type: 'CustomerDetail', IdCustomer: customer.sk , totalAmount: customer.totalAmount })} 
                    className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{customer.name}</p>
                            <p className="text-sm text-slate-400">{customer.sk.split('#')[1]}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-sm">Total Orders</p>
                            {/* <p className="font-bold text-white">{customer.totalAmount}</p> */}
                            <p className="font-bold text-white">${customer.totalAmount ? customer.totalAmount.toFixed(2) : '0.00'}</p>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default CustomersView;


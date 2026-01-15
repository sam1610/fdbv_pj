import React, { useState, useMemo, useEffect, useRef } from 'react';
import { client } from '../DataHook/amplifyClient'; // Use shared client
import { useVirtualizer } from '@tanstack/react-virtual'; // Use virtualization

// --- Component Setup ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');

/**
 * A real-time, virtualized component to display all business customers.
 * @param {object} props
 * @param {string | null} props.phoneNbr - The phone number of the business owner.
 * @param {Function} props.setModal - A function to open a modal window.
 */
const CustomersView = ({ phoneNbr, setModal }) => {
    
    // --- 1. State for Real-Time Data ---
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    useEffect(() => {
        if (!phoneNbr) return;

        // Define filter for subscriptions (Server-side)
        const subFilter = { 
            pk: { eq: `BUSINESS#${phoneNbr}` },
            sk: { beginsWith: 'CUSTOMER#' }
        };

        let createSub;
        let updateSub;

        const fetchAndSubscribe = async () => {
            setLoading(true);
            try {
                // A. INITIAL FETCH: Use the Index (Query)
                const { data } = await client.models.BusinessData.listByBusiness({
                    pk: `BUSINESS#${phoneNbr}`,
                    sk: { beginsWith: 'CUSTOMER#' }
                });
                
                setCustomers(data);
                setLoading(false);

                // B. SUBSCRIBE: Listen for NEW customers
                createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
                    next: (item) => {
                        setCustomers(prev => [...prev, item]);
                    },
                    error: (err) => console.error("Customer Create Sub Error:", err)
                });

                // C. SUBSCRIBE: Listen for UPDATES (e.g., totalAmount changes)
                updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
                    next: (item) => {
                        setCustomers(prev => prev.map(c => 
                            (c.pk === item.pk && c.sk === item.sk) ? item : c
                        ));
                    },
                    error: (err) => console.error("Customer Update Sub Error:", err)
                });

            } catch (err) {
                console.error("Fetch customers failed:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchAndSubscribe();

        // Cleanup
        return () => {
            if (createSub) createSub.unsubscribe();
            if (updateSub) updateSub.unsubscribe();
        };
    }, [phoneNbr]);

    // --- 4. Sort Customers by Name ---
    const sortedCustomers = useMemo(() => {
        if (!customers || customers.length === 0) return [];
        
        // Sort all customers by name (alphabetical)
        return [...customers].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
        );

    }, [customers]);

    // --- 5. Setup for Virtualization ---
    const parentRef = useRef();

    const rowVirtualizer = useVirtualizer({
        count: sortedCustomers.length, // Use the sorted list
        getScrollElement: () => parentRef.current,
        estimateSize: () => 76, // Estimate 76px height for a customer row
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    // --- Render Logic ---
    if (loading) return <div className="p-4 text-center text-slate-400">Loading Customers...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-orange-500 mb-4">Customers</h1>
            
            {/* Scrolling container with a fixed height */}
            <div 
                ref={parentRef} 
                className="overflow-y-auto h-[600px] pr-2" // Adjust h-[600px] as needed
            >
                {sortedCustomers.length > 0 ? (
                    // Sizer div for the scrollbar
                    <div 
                        style={{ 
                            height: `${rowVirtualizer.getTotalSize()}px`, 
                            position: 'relative', 
                            width: '100%' 
                        }}
                    >
                        {/* Map over virtual items */}
                        {virtualItems.map(virtualItem => {
                            const customer = sortedCustomers[virtualItem.index];

                            return (
                                <div 
                                    key={customer.sk} 
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    {/* Your Original Customer Component */}
                                    <div 
                                        onClick={() => setModal({ type: 'CustomerDetail', IdCustomer: customer.sk , customerName: customer.name })} 
                                        className={classNames(
        // ✅ TERNARY OPERATOR FOR ZEBRA STRIPING:
        virtualItem.index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700', // Even rows
        "p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-600 h-full" // Removed hardcoded bg, added hover:bg-slate-600
    )}
>
                                        <div>
                                            <p className="font-bold text-white">{customer.name}</p>
                                            <p className="text-amber-400 text-sm ">+({customer.sk.split('#')[2].substring(0, 3)})-{customer.sk.split('#')[2].substring(3, 5)} {customer.sk.split('#')[2].substring(5, 11)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400 text-sm">Total Orders</p>
                                            {/* <p className="font-bold text-white"> {sortedCustomers.length}</p> */}
                                            <p className="font-bold text-white">BD {customer.totalAmount ? customer.totalAmount.toFixed(2) : '0.00'}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-slate-400 text-center mt-8">No customers found.</p>
                )}
            </div>
        </div>
    );
};
export default CustomersView;
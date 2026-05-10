import React, { useState, useMemo, useEffect, useRef } from 'react';
import { client } from '../DataHook/amplifyClient'; 
import { useVirtualizer } from '@tanstack/react-virtual'; 

const classNames = (...classes) => classes.filter(Boolean).join(' ');

const CustomersView = ({ phoneNbr, setModal }) => {
    
    // --- 1. State for Real-Time Data ---
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!phoneNbr) return;

        const subFilter = { 
            pk: { eq: `BUSINESS#${phoneNbr}` },
            sk: { beginsWith: 'CUSTOMER#' }
        };

        let createSub;
        let updateSub;

        const fetchAndSubscribe = async () => {
            setLoading(true);
            try {
                // A. INITIAL FETCH
                const { data } = await client.models.BusinessData.listByBusiness({
                    pk: `BUSINESS#${phoneNbr}`,
                    sk: { beginsWith: 'CUSTOMER#' }
                });
                
                setCustomers(data);
                setLoading(false);

                // B. SUBSCRIBE: Listen for NEW customers
                createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
                    next: (item) => {
                        if (item) setCustomers(prev => [...prev, item]);
                    },
                    error: (err) => console.error("Customer Create Sub Error:", err)
                });

                // C. SUBSCRIBE: Listen for UPDATES
                updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
                    next: (item) => {
                        if (item) {
                            setCustomers(prev => prev.map(c => 
                                (c?.pk === item.pk && c?.sk === item.sk) ? item : c
                            ));
                        }
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

        return () => {
            if (createSub) createSub.unsubscribe();
            if (updateSub) updateSub.unsubscribe();
        };
    }, [phoneNbr]);

    // --- 4. Sort Customers by Name (BULLETPROOF FIX) ---
    const sortedCustomers = useMemo(() => {
        if (!customers || !Array.isArray(customers) || customers.length === 0) return [];
        
        return [...customers]
            // 🟢 1. Filter out any null, undefined, or empty ghost records
            .filter(c => c && typeof c === 'object') 
            // 🟢 2. Use optional chaining (?.) so it never crashes if 'name' is missing
            .sort((a, b) => 
                (a?.name || '').localeCompare(b?.name || '')
            );

    }, [customers]);

    // --- 5. Setup for Virtualization ---
    const parentRef = useRef();

    const rowVirtualizer = useVirtualizer({
        count: sortedCustomers.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 76, 
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    // --- Render Logic ---
    if (loading) return <div className="p-4 text-center text-slate-400">Loading Customers...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-orange-500 mb-4">Customers</h1>
            
            <div 
                ref={parentRef} 
                className="overflow-y-auto h-[600px] pr-2" 
            >
                {sortedCustomers.length > 0 ? (
                    <div 
                        style={{ 
                            height: `${rowVirtualizer.getTotalSize()}px`, 
                            position: 'relative', 
                            width: '100%' 
                        }}
                    >
                        {virtualItems.map(virtualItem => {
                            const customer = sortedCustomers[virtualItem.index];
                            
                            // 🟢 Safe phone extraction just in case SK is malformed
                            const phoneParts = customer?.sk?.split('#') || [];
                            const rawPhone = phoneParts.length > 2 ? phoneParts[2] : (customer?.phone || 'Unknown');
                            const displayPhone = rawPhone.length >= 11 
                                ? `+(${rawPhone.substring(0, 3)})-${rawPhone.substring(3, 5)} ${rawPhone.substring(5, 11)}`
                                : rawPhone;

                            return (
                                <div 
                                    key={customer.sk || virtualItem.index} 
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    <div 
                                        onClick={() => setModal({ type: 'CustomerDetail', IdCustomer: customer.sk , customerName: customer.name })} 
                                        className={classNames(
                                            virtualItem.index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700', 
                                            "p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-600 h-full"
                                        )}
                                    >
                                        <div>
                                            <p className="font-bold text-white">{customer?.name || 'Unknown Customer'}</p>
                                            <p className="text-amber-400 text-sm ">{displayPhone}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400 text-sm">Total Orders</p>
                                            <p className="font-bold text-white">BD {customer?.totalAmount ? customer.totalAmount.toFixed(2) : '0.00'}</p>
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
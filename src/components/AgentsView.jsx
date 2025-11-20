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
const AgentsView = ({ phoneNbr, setModal }) => {
    
    // --- 1. State for Real-Time Data ---
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- 2. Simple queryParam for the subscription ---
    const queryParam = useMemo(() => {
        if (!phoneNbr) return null;
        return {
            filter: { 
                pk: { eq: `BUSINESS#${phoneNbr}` }, 
                sk: { beginsWith: 'AGENT#' } 
            }
        };
    }, [phoneNbr]);

    // --- 3. observeQuery subscription logic ---
    useEffect(() => {
        if (!queryParam) return;

        setLoading(true);
        const observer = client.models.BusinessData.observeQuery(queryParam);

        const subscription = observer.subscribe({
            next: (snapshot) => {
                setAgents([...snapshot.items]); // Use spread to force re-render
                setError(null);
                setLoading(false);
            },
            error: (err) => {
                setError(err.message || 'Subscription error');
                setLoading(false);
                console.error('AgentsView observeQuery error:', err);
            }
        });

        return () => subscription.unsubscribe();
    }, [queryParam]);

    // --- 4. Sort Customers by Name ---
    const sortedCustomers = useMemo(() => {
        if (!agents || agents.length === 0) return [];
        
        // Sort all agents by name (alphabetical)
        return [...agents].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
        );

    }, [agents]);

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
                            const agent = sortedCustomers[virtualItem.index];

                            return (
                                <div 
                                    key={agent.sk} 
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
                                        onClick={() => setModal({ type: 'AgentDetail', IdAgent: agent.sk , agentName: agent.name })} 
                                        className={classNames(
        // ✅ TERNARY OPERATOR FOR ZEBRA STRIPING:
        virtualItem.index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700', // Even rows
        "p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-600 h-full" // Removed hardcoded bg, added hover:bg-slate-600
    )}
>
                                        <div>
                                            <p className="font-bold text-white">{agent.name}</p>
                                            <p className="text-amber-400 text-sm ">{agent.sk.split('#')[1]}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400 text-sm">Total Deliveries</p>
                                            <p className="font-bold text-white"> {agent.length}</p>
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
export default AgentsView;
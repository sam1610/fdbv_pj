// import React, { useState, useMemo, useEffect, useRef } from 'react';
// import { client } from '../DataHook/amplifyClient'; // Use shared client
// import { useVirtualizer } from '@tanstack/react-virtual'; // Use virtualization

// // --- Component Setup ---
// const classNames = (...classes) => classes.filter(Boolean).join(' ');

// /**
//  * A real-time, virtualized component to display all business customers.
//  * @param {object} props
//  * @param {string | null} props.phoneNbr - The phone number of the business owner.
//  * @param {Function} props.setModal - A function to open a modal window.
//  */
// const AgentsView = ({ phoneNbr, setModal }) => {
    
//     // --- 1. State for Real-Time Data ---
//     const [agents, setAgents] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);

//     // --- 2. Simple queryParam for the subscription ---
//     const queryParam = useMemo(() => {
//         if (!phoneNbr) return null;
//         return {
//             filter: { 
//                 pk: { eq: `BUSINESS#${phoneNbr}` }, 
//                 sk: { beginsWith: 'AGENT#' } 
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
//                 setAgents([...snapshot.items]); // Use spread to force re-render
//                 setError(null);
//                 setLoading(false);
//             },
//             error: (err) => {
//                 setError(err.message || 'Subscription error');
//                 setLoading(false);
//                 console.error('AgentsView observeQuery error:', err);
//             }
//         });

//         return () => subscription.unsubscribe();
//     }, [queryParam]);

//     // --- 4. Sort Customers by Name ---
//     const sortedCustomers = useMemo(() => {
//         if (!agents || agents.length === 0) return [];
        
//         // Sort all agents by name (alphabetical)
//         return [...agents].sort((a, b) => 
//             (a.name || '').localeCompare(b.name || '')
//         );

//     }, [agents]);

//     // --- 5. Setup for Virtualization ---
//     const parentRef = useRef();

//     const rowVirtualizer = useVirtualizer({
//         count: sortedCustomers.length, // Use the sorted list
//         getScrollElement: () => parentRef.current,
//         estimateSize: () => 76, // Estimate 76px height for a customer row
//         overscan: 5,
//     });

//     const virtualItems = rowVirtualizer.getVirtualItems();

//     // --- Render Logic ---
//     if (loading) return <div className="p-4 text-center text-slate-400">Loading Customers...</div>;
//     if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

//     return (
//         <div className="p-4">
//             <h1 className="text-2xl font-bold text-orange-500 mb-4">Delivery Agents</h1>
            
//             {/* Scrolling container with a fixed height */}
//             <div 
//                 ref={parentRef} 
//                 className="overflow-y-auto h-[600px] pr-2" // Adjust h-[600px] as needed
//             >
//                 {sortedCustomers.length > 0 ? (
//                     // Sizer div for the scrollbar
//                     <div 
//                         style={{ 
//                             height: `${rowVirtualizer.getTotalSize()}px`, 
//                             position: 'relative', 
//                             width: '100%' 
//                         }}
//                     >
//                         {/* Map over virtual items */}
//                         {virtualItems.map(virtualItem => {
//                             const agent = sortedCustomers[virtualItem.index];

//                             return (
//                                 <div 
//                                     key={agent.sk} 
//                                     style={{
//                                         position: 'absolute',
//                                         top: 0,
//                                         left: 0,
//                                         width: '100%',
//                                         height: `${virtualItem.size}px`,
//                                         transform: `translateY(${virtualItem.start}px)`,
//                                     }}
//                                 >
//                                     {/* Your Original Customer Component */}
//                                     <div 
//                                         onClick={() => setModal({ type: 'AgentDetail', IdAgent: agent.sk , agentName: agent.name })} 
//                                         className={classNames(
//         // ✅ TERNARY OPERATOR FOR ZEBRA STRIPING:
//         virtualItem.index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700', // Even rows
//         "p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-600 h-full" // Removed hardcoded bg, added hover:bg-slate-600
//     )}
// >
//                                         <div>
//                                             <p className="font-bold text-white">{agent.name}</p>
//                                             <p className="text-amber-400 text-sm ">{agent.sk.split('#')[1]}</p>
//                                         </div>
//                                         <div className="text-right">
//                                             <p className="text-slate-400 text-sm">Total Deliveries</p>
//                                             <p className="font-bold text-white"> {agent.length}</p>
//                                         </div>
//                                     </div>
//                                 </div>
//                             );
//                         })}
//                     </div>
//                 ) : (
//                     <p className="text-slate-400 text-center mt-8">No customers found.</p>
//                 )}
//             </div>
//         </div>
//     );
// };
// export default AgentsView;



import React, { useState, useMemo, useEffect, useRef } from 'react';
import { client } from '../DataHook/amplifyClient'; 
import { useVirtualizer } from '@tanstack/react-virtual'; 

const classNames = (...classes) => classes.filter(Boolean).join(' ');

// --- Simple Modal Component ---
const CreateAgentModal = ({ onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic validation
    if (!formData.name || !formData.phone) return alert("Name and Phone are required");
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Add Delivery Agent</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Agent Name</label>
            <input 
              type="text" 
              required
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-orange-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Ahmed Ali"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Phone Number (Login ID)</label>
            <input 
              type="tel" 
              required
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-orange-500 outline-none"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="e.g. +97333..."
            />
            <p className="text-xs text-slate-500 mt-1">Format: +97312345678. This will be their username.</p>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Email (Optional)</label>
            <input 
              type="email" 
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-orange-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              placeholder="For recovery"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2 bg-orange-600 text-white rounded hover:bg-orange-500 font-bold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AgentsView = ({ phoneNbr, setModal }) => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    // --- 1. Subscription Logic ---
    const queryParam = useMemo(() => {
        if (!phoneNbr) return null;
        return {
            filter: { 
                pk: { eq: `BUSINESS#${phoneNbr}` }, 
                sk: { beginsWith: 'AGENT#' } 
            }
        };
    }, [phoneNbr]);

    useEffect(() => {
        if (!queryParam) return;
        setLoading(true);
        const sub = client.models.BusinessData.observeQuery(queryParam).subscribe({
            next: (snapshot) => {
                setAgents([...snapshot.items]);
                setLoading(false);
            },
            error: (err) => {
                console.error(err);
                setLoading(false);
            }
        });
        return () => sub.unsubscribe();
    }, [queryParam]);

    // --- 2. Create Agent Logic ---
    const handleCreateAgent = async (data) => {
        setCreating(true);
        try {
            // Step A: Create Cognito User (The "System" Identity)
            // This calls the Lambda function we created
            const response = await client.mutations.createAgentUser({
                name: data.name,
                phone: data.phone,
                email: data.email
            });

            // If Lambda fails, it throws an error caught by catch block
            console.log("Cognito User Created:", response);

            // Step B: Create DynamoDB Record (The "Business" Data)
            // Using the structure you requested: pk=BUSINESS#..., sk=AGENT#...
            await client.models.BusinessData.create({
                pk: `BUSINESS#${phoneNbr}`,
                sk: `AGENT#${data.phone}`,
                entityType: 'Agent',
                name: data.name,
                phone: data.phone,
                // Initialize other fields if needed
                itemsNbr: 0 // Used for tracking deliveries maybe?
            });

            // alert(`Agent ${data.name} created successfully!\nTemp Password: Welcome123!`);
            setShowCreateModal(false);

        } catch (err) {
            console.error("Creation Failed:", err);
            alert("Failed to create agent: " + (err.message || JSON.stringify(err)));
        } finally {
            setCreating(false);
        }
    };

    // --- Sorting & Virtualization ---
    const sortedCustomers = useMemo(() => 
        [...agents].sort((a, b) => (a.name || '').localeCompare(b.name || '')), 
    [agents]);

    const parentRef = useRef();
    const rowVirtualizer = useVirtualizer({
        count: sortedCustomers.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 76,
        overscan: 5,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();

    if (loading) return <div className="p-8 text-center text-slate-400">Loading Agents...</div>;

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-orange-500">Delivery Agents</h1>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center"
                >
                    <span className="text-xl mr-2">+</span> Add Agent
                </button>
            </div>
            
            <div ref={parentRef} className="overflow-y-auto flex-1 pr-2">
                {sortedCustomers.length > 0 ? (
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
                        {virtualItems.map(virtualItem => {
                            const agent = sortedCustomers[virtualItem.index];
                            return (
                                <div 
                                    key={agent.sk} 
                                    style={{
                                        position: 'absolute', top: 0, left: 0, width: '100%',
                                        height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    <div 
                                        onClick={() => setModal({ type: 'AgentDetail', IdAgent: agent.sk , agentName: agent.name })} 
                                        className={classNames(
                                            virtualItem.index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-700',
                                            "p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-600 h-full mb-2"
                                        )}
                                    >
                                        <div>
                                            <p className="font-bold text-white">{agent.name}</p>
                                            <p className="text-amber-400 text-sm ">{agent.sk.split('#')[1]}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400 text-xs">Deliveries</p>
                                            <p className="font-bold text-white">{agent.itemsNbr || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
                        <p className="mb-2">No agents found.</p>
                        <button onClick={() => setShowCreateModal(true)} className="text-orange-400 hover:underline">Create your first agent</button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <CreateAgentModal 
                    onClose={() => setShowCreateModal(false)} 
                    onSubmit={handleCreateAgent}
                    loading={creating}
                />
            )}
        </div>
    );
};

export default AgentsView;
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { client } from '../DataHook/amplifyClient';
import { useVirtualizer } from '@tanstack/react-virtual';

const classNames = (...classes) => classes.filter(Boolean).join(' ');

// --- Simple Modal Component (Unchanged) ---
const CreateAgentModal = ({ onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  // ✅ Validation: Check if all fields have values
  const isValid = formData.name.trim() !== '' && 
                  formData.phone.trim() !== '' && 
                  formData.email.trim() !== '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Add Delivery Agent</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">
              Agent Name <span className="text-red-500">*</span>
            </label>
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
            <label className="block text-slate-400 text-sm mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input 
              type="tel" 
              required
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-orange-500 outline-none"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="e.g. +97333..."
            />
            <p className="text-xs text-slate-500 mt-1">Format: +97312345678.</p>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">
              Email (Login ID) <span className="text-red-500">*</span>
            </label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-orange-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              placeholder="agent@example.com"
            />
          </div>
          
          <div className="flex gap-3 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || !isValid}
              className={`flex-1 py-2 rounded font-bold transition-all ${
                loading || !isValid 
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50' 
                  : 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg'
              }`}
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AgentsView = ({ phoneNbr, setModal, onAgentAdded }) => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line no-unused-vars
    const [error, setError] = useState(null);

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    // ✅ FIX 1: Add a Trigger State to force re-fetching
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // --- 1. Subscription Logic ---
    useEffect(() => {
        if (!phoneNbr) return;
        
        setLoading(true);
        const businessPk = `BUSINESS#${phoneNbr}`;
        const agentPrefix = 'AGENT#';
        const subFilter = { pk: { eq: businessPk }, sk: { beginsWith: agentPrefix } };

        let createSub, updateSub;

        const fetchAndSubscribe = async () => {
            try {
                // A. Initial Fetch (Query via Index)
                const { data } = await client.models.BusinessData.listByBusiness({
                    pk: businessPk,
                    sk: { beginsWith: agentPrefix }
                });
                setAgents(data);
                setLoading(false);

                // B. Real-time Subscriptions
                createSub = client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
                    next: (item) => setAgents(prev => [...prev, item]),
                    error: (err) => console.error("Agent Create Sub error:", err)
                });
                
                updateSub = client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
                    next: (item) => {
                        setAgents(prev => prev.map(a => 
                            (a.pk === item.pk && a.sk === item.sk) ? item : a
                        ));
                    },
                    error: (err) => console.error("Agent Update Sub error:", err)
                });

            } catch (e) {
                console.error("Agent Fetch failed", e);
                setError(e.message);
                setLoading(false);
            }
        };

        fetchAndSubscribe();

        // Safe Cleanup
        return () => {
            if (createSub) createSub.unsubscribe();
            if (updateSub) updateSub.unsubscribe();
        }; 
    }, [phoneNbr, refreshTrigger]); // ✅ FIX 2: Add refreshTrigger to dependencies


    // --- 2. Create Agent Logic (FIXED) ---
    const handleCreateAgent = async (data) => {
        setCreating(true);
        try {
            // 1. Fire the mutation
            await client.mutations.createAgentUser({
                name: data.name,
                phone: data.phone,
                email: data.email,
                businessPhone: phoneNbr 
            }, { authMode: 'userPool' });

            // 2. Success!
            console.log("Agent created successfully");
            setShowCreateModal(false);
            
            // ✅ FIX 3: Force the list to refresh immediately
            setRefreshTrigger(prev => prev + 1);

            // 4. Notify parent if needed
            if (onAgentAdded) onAgentAdded();

        } catch (err) {
            console.error("Agent creation failed:", err);
            const msg = err.errors?.[0]?.message || err.message || "Unknown Error";
            alert("Failed: " + msg);
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

    if (loading && agents.length === 0) return <div className="p-8 text-center text-slate-400">Loading Agents...</div>;

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
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
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
                                            
                                            <p className="text-amber-400 text-sm ">({agent.sk.split('#')[1].substring(0, 4)})-{agent.sk.split('#')[1].substring(4, 6)} {agent.sk.split('#')[1].substring(6, 12)}</p>
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
                        <button onClick={() => setShowCreateModal(true)} className="text-orange-400 hover:underline">
                            Create your first agent
                        </button>
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
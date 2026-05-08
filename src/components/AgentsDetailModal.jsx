// import React, { useMemo } from 'react';
// import { useEntityList } from '../DataHook/useEntityList';



// const AgentsDetailModal = ({ IdAgent,agentName,phoneNbr,  onClose }) => {

//     const { data: lineItems, loading } = useEntityList(
//         {
//             gsi1pk: IdAgent, 
//             // sk: {beginsWith: `ORDER#`},
//             sortDirection: 'DESC'}, 
//         "ByAgent");

//     console.log("Agent Orders Props:", { lineItems });
//     const orderTotal = useMemo(() => {
//         if (!lineItems || lineItems.length === 0) return 0;
        
//         // 🟢 FIX 2: Better parsing to ensure we grab the totalAmount correctly
//         return lineItems.reduce((acc, item) => {
//             const amount = parseFloat(item.totalAmount) || 0;
//             return acc + amount;
//         }, 0);
//     }, [lineItems]);
//     return (
//         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
//     <div className="bg-slate-800 rounded-lg w-full max-w-lg shadow-xl animate-fade-in-up">
//         <div className="p-4 border-b border-slate-700 flex justify-between items-center">
//             <h2 className="text-lg font-bold  text-orange-400 bg-black/10">Orders Deliveries</h2>
//             <span className="text-amber-400 text-sm text-jusity-left">{agentName} : ({IdAgent.split('#')[1]})</span>
//             <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
//         </div>

//         <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
//             <div>
//                 {/* ✅ FIX 1: Switched from 'flex' to 'grid' for proper column alignment */}
//                 <div className="grid grid-cols-4 font-semibold text-sm mb-2">
//                     {/* ✅ FIX 2: Added 'text-center' to all headers */}
//                     <h3 className="text-sky-400 text-center">Order Date</h3>
//                     <h3 className="text-amber-400 text-center">#Items</h3>
//                     <h3 className="text-amber-400 text-center">Status</h3>
//                     <h3 className="text-amber-400 text-center">T.Amount(BD)</h3>
//                 </div>

//                 <ul className="space-y-1 mt-1 text-slate-300">
//                     {lineItems.map(item => (
//                         // ✅ FIX 3: Switched list items to 'grid' as well
//                         <li key={item.sk} className="grid grid-cols-4 text-sm">
                            
//                             {/* ✅ FIX 4: Correctly parsed date and centered text */}
//                             {/* This assumes sk is like "ORDER#2025-11-08T..." */}
//                             <span className="text-center">{item.sk.split('#')[1]?.split('T')[0] || item.sk}</span>
                        
//                             {/* ✅ FIX 5: Centered all data cells */}
//                             <span className="text-center">{item.itemsNbr}</span>
//                             <span className="text-left">{item.orderStatus}</span>
//                             <span className="text-right"> {item.totalAmount}</span>
//                         </li>
//                     ))}
//                 </ul>
//             </div>

//             <div className="border-t border-slate-400 pt-2 flex justify-between font-bold text-white  opacity-80">
//                 <span>Total Amount</span>
//                 <span>BD {orderTotal.toFixed(2)}</span>
//             </div>
//         </div>

//     </div>
// </div>
//     );
// };
// export default AgentsDetailModal;


import React, { useMemo, useState, useEffect } from 'react';
import { useEntityList } from '../DataHook/useEntityList';
import { client } from '../DataHook/amplifyClient';

const AgentsDetailModal = ({ IdAgent, agentName, phoneNbr, onClose }) => {
    
    // 🟢 FIX: Moved businessPk declaration to the VERY TOP of the component
    const businessPk = String(phoneNbr).startsWith('+') ? `BUSINESS#${phoneNbr}` : `BUSINESS#+${phoneNbr}`;

    // 1. Fetch the Agent's Orders
    const { data: lineItems, loading } = useEntityList(
        {
            gsi1pk: IdAgent, 
            sk: { beginsWith: 'ORDER#' },
            filter: { pk: { eq: businessPk } }, // ✅ Safe to use here now
            sortDirection: 'DESC'
        }, 
        "ByAgent"
    );

    // 2. Local State for the Agent's Profile Data
    const [agentProfile, setAgentProfile] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // 3. Fetch the specific Agent Profile to check 'stockStatus'
    useEffect(() => {
        const fetchAgentStatus = async () => {
            try {
                const { data } = await client.models.BusinessData.get({
                    pk: businessPk,
                    sk: IdAgent // e.g., 'AGENT#+973...'
                });
                if (data) {
                    setAgentProfile(data);
                }
            } catch (err) {
                console.error("Failed to fetch agent profile:", err);
            }
        };
        fetchAgentStatus();
    }, [businessPk, IdAgent]);

    // 4. Calculate Total Amount
    const orderTotal = useMemo(() => {
        if (!lineItems || lineItems.length === 0) return 0;
        return lineItems.reduce((acc, item) => {
            const amount = parseFloat(item.totalAmount) || 0;
            return acc + amount;
        }, 0);
    }, [lineItems]);

    // 5. Toggle Agent Status Function
    const handleToggleStatus = async () => {
        if (!agentProfile) return;
        setIsUpdating(true);
        
        // We assume 'stockStatus' boolean determines if they are Active (true) or Inactive (false)
        // If it's undefined, we assume they were active, so the new status is false.
        const currentStatus = agentProfile.stockStatus !== undefined ? agentProfile.stockStatus : true;
        const newStatus = !currentStatus;

        try {
            await client.models.BusinessData.update({
                pk: businessPk,
                sk: IdAgent,
                stockStatus: newStatus
            });
            
            // Update local state to reflect the UI immediately
            setAgentProfile(prev => ({ ...prev, stockStatus: newStatus }));
        } catch (err) {
            console.error("Failed to update agent status:", err);
            alert("Error updating status. Ensure you have Admin permissions.");
        } finally {
            setIsUpdating(false);
        }
    };

    // 6. Placeholder for Password Reset
    const handleResetPassword = () => {
        alert("To securely reset a Cognito password, a dedicated Lambda mutation must be built using the AWS SDK 'admin-set-user-password' command.");
    };

    const isActive = agentProfile?.stockStatus !== false; // Default to true if undefined

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-2xl shadow-xl animate-fade-in-up">
                
                {/* Header Section */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                            {agentName}
                        </h2>
                        <span className="text-slate-400 font-mono text-xs">{IdAgent.replace('AGENT#', '')}</span>
                    </div>

                    {/* Admin Controls: Status Toggle and Password Reset */}
                    <div className="flex flex-col items-end gap-2">
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl absolute top-4 right-4">&times;</button>
                        
                        <div className="flex items-center gap-3 mt-6">
                            <button 
                                onClick={handleResetPassword}
                                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[10px] text-white font-bold uppercase tracking-wider transition-colors"
                            >
                                🔑 Reset Password
                            </button>

                            <button 
                                onClick={handleToggleStatus}
                                disabled={isUpdating || !agentProfile}
                                className={`px-3 py-1 border rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                                    isActive 
                                    ? 'bg-green-900/30 border-green-500 text-green-400 hover:bg-green-800/50' 
                                    : 'bg-red-900/30 border-red-500 text-red-400 hover:bg-red-800/50'
                                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isUpdating ? 'Updating...' : (isActive ? '🟢 Active' : '🔴 Inactive')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Orders List Section */}
                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    <div>
                        <div className="grid grid-cols-4 font-semibold text-xs mb-3 pb-2 border-b border-slate-700 uppercase tracking-widest text-slate-500">
                            <h3 className="text-center">Date</h3>
                            <h3 className="text-center">Items</h3>
                            <h3 className="text-left">Status</h3>
                            <h3 className="text-right">Amount</h3>
                        </div>

                        {loading ? (
                            <div className="text-center py-4 text-slate-500 text-sm animate-pulse">Loading deliveries...</div>
                        ) : lineItems && lineItems.length > 0 ? (
                            <ul className="space-y-2 text-slate-300">
                                {lineItems.map(item => (
                                    <li key={item.sk} className="grid grid-cols-4 text-sm bg-slate-900/50 p-2 rounded border border-slate-700/50 items-center">
                                        <span className="text-center font-mono text-[10px] text-slate-400">
                                            {item.sk.split('#')[1]?.split('T')[0] || item.sk}
                                        </span>
                                        <span className="text-center font-bold text-white bg-slate-800 rounded mx-auto w-6 h-6 flex items-center justify-center">
                                            {item.itemsNbr || 0}
                                        </span>
                                        <span className="text-left text-[10px] font-bold tracking-wider">
                                            {item.orderStatus}
                                        </span>
                                        <span className="text-right font-mono text-orange-400">
                                            {Number(item.totalAmount).toFixed(3)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-6 text-slate-500 text-sm italic">No deliveries recorded for this agent.</div>
                        )}
                    </div>

                    {/* Total Summary */}
                    <div className="border-t border-slate-600 pt-3 mt-4 flex justify-between font-black text-white text-lg">
                        <span className="text-slate-400 text-sm tracking-widest uppercase flex items-center">Total Revenue</span>
                        <span className="text-orange-400">BD {orderTotal.toFixed(3)}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AgentsDetailModal;
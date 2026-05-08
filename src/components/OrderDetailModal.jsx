// import React from 'react';
// import { useEntityList } from '../DataHook/useEntityList';

// // 🟢 BULLETPROOF PHONE EXTRACTOR
// const safeExtractPhone = (customerId) => {
//     if (!customerId || String(customerId).includes('undefined')) return "Unknown";
    
//     let rawPhone = String(customerId);
//     if (rawPhone.includes('#')) {
//         rawPhone = rawPhone.split('#').pop(); // Grabs the very last part of CUSTOMER#biz#phone
//     }

//     const clean = rawPhone.replace(/\D/g, ''); // Strip all non-numbers
//     if (clean.length > 8) {
//         return clean.replace(/(\d{3,4})(\d{4})(\d+)/, '+$1 $2 $3');
//     }
//     return clean.length > 5 ? '+' + clean : "Unknown";
// };

// const OrderDetailModal = ({ orderId, orderStatus, orderTotal, customerId, customerName, phoneNbr, onClose }) => {
    
//     // 1. Safe Keys
//     const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
//     const exactOrderId = String(orderId).replace('ORDER#', '');
//     const targetPk = `ORDER#${formattedPhone}#${exactOrderId}`;

//     // 2. Query Items
//     const { data: lineItems, loading } = useEntityList(
//         { pk: targetPk, sk: { beginsWith: 'ITEM#' }, sortDirection: 'DESC' },
//         "listByBusiness" 
//     );

//     const statusColors = {
//         ORDERED: 'bg-blue-500',
//         IN_PREPARATION: 'bg-yellow-500',
//         PREPARED: 'bg-green-500',
//         DELIVERED: 'bg-gray-500',
//         DELIVERING: 'bg-orange-500'
//     };

//     const badgeColor = statusColors[orderStatus] || 'bg-slate-600';
    
//     // 3. Safe Display Values
//     const displayPhone = safeExtractPhone(customerId);
//     const displayName = (customerName && !String(customerName).includes('undefined') && customerName !== 'unknown') 
//         ? customerName 
//         : "Customer";

//     return (
//         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
//             <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
//                 <div className="p-4 border-b border-slate-700 flex justify-between items-start">
//                     <div className="flex flex-col gap-1">
//                         <h2 className="text-sm font-bold text-orange-400 bg-black/10 px-2 py-0.5 rounded inline-block w-fit">
//                             {String(orderId).includes('#') ? String(orderId).split('#')[1] : orderId}
//                         </h2>
                        
//                         {/* ✅ THIS REPLACES THE BROKEN SUBSTRING CODE */}
//                         <div className="mt-2">
//                             <h2 className="text-base font-bold text-white">{displayName}</h2>
//                             <h2 className="text-xs font-medium text-slate-400 font-mono tracking-wide">{displayPhone}</h2>
//                         </div>
//                     </div>
                    
//                     <div className="flex flex-col items-end gap-3">
//                         <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
//                         <span className={`px-2 py-1 text-[10px] rounded-md text-white font-bold uppercase tracking-wide shadow-sm ${badgeColor}`}>
//                             {orderStatus ? orderStatus.replace('_', ' ') : 'N/A'}
//                         </span>
//                     </div>
//                 </div>

//                 <div className="p-4 space-y-4">
//                     <div>
//                         <div className="flex justify-between font-bold text-xs uppercase tracking-wider mb-3 text-slate-500 border-b border-slate-700 pb-2">
//                             <h3 className="text-sky-400">Items</h3>
//                             <h3 className="text-amber-400">Unit Price (BD)</h3>
//                         </div>

//                         <ul className="space-y-2 text-slate-300">
//                             {lineItems.map(item => (
//                                 <li key={item.sk} className="flex justify-between text-sm">
//                                     <span className="flex gap-2">
//                                         <span className="font-bold text-slate-400">{item.quantity}x</span> 
//                                         <span className="text-white">{item.name}</span>
//                                     </span>
//                                     <span className="font-mono text-slate-300">
//                                         {item.unitPrice ? parseFloat(item.unitPrice).toFixed(2) : '0.00'}
//                                     </span>
//                                 </li>
//                             ))}
//                         </ul>
//                         {loading && <div className="text-center text-xs text-slate-500 py-4 animate-pulse">Loading items...</div>}
//                     </div>

//                     <div className="border-t border-slate-600 pt-3 flex justify-between items-center font-black text-orange-400 bg-orange-900/10 p-3 rounded-lg">
//                         <span className="uppercase text-xs tracking-wider">Total Amount</span>
//                         <span className="text-lg font-mono">BD {orderTotal ? parseFloat(orderTotal).toFixed(3) : '0.000'}</span>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default OrderDetailModal;


import React, { useState, useEffect } from 'react';
import { useEntityList } from '../DataHook/useEntityList';
import { client } from '../DataHook/amplifyClient';

// 🟢 BULLETPROOF PHONE EXTRACTOR
const safeExtractPhone = (customerId) => {
    if (!customerId || String(customerId).includes('undefined')) return "Unknown";
    
    let rawPhone = String(customerId);
    if (rawPhone.includes('#')) {
        rawPhone = rawPhone.split('#').pop(); // Grabs the very last part of CUSTOMER#biz#phone
    }

    const clean = rawPhone.replace(/\D/g, ''); // Strip all non-numbers
    if (clean.length > 8) {
        return clean.replace(/(\d{3,4})(\d{4})(\d+)/, '+$1 $2 $3');
    }
    return clean.length > 5 ? '+' + clean : "Unknown";
};

// 🟢 ADDED 'agentName' to props
const OrderDetailModal = ({ orderId, orderStatus, orderTotal, customerId, customerName, phoneNbr, agentId, agentName, onClose }) => {
    
    // 1. Safe Keys
    const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
    const exactOrderId = String(orderId).replace('ORDER#', '');
    const targetPk = `ORDER#${formattedPhone}#${exactOrderId}`;
    const businessPk = `BUSINESS#${formattedPhone}`;

    // 2. Query Items
    const { data: lineItems, loading } = useEntityList(
        { pk: targetPk, sk: { beginsWith: 'ITEM#' }, sortDirection: 'DESC' },
        "listByBusiness" 
    );

    // 3. State to hold the Agent Name (initialized with the prop if available)
    const [agentProfileName, setAgentProfileName] = useState(agentName || "");

    // 4. Backup Fetch: Only runs if the modal was opened from a place that didn't pass the name
    useEffect(() => {
        if (agentProfileName || !agentId || agentId === "Unassigned" || !phoneNbr) return;

        const fetchAgentProfile = async () => {
            try {
                const { data } = await client.models.BusinessData.get(
                    { pk: businessPk, sk: agentId },
                    { authMode: 'apiKey' }
                );
                if (data && data.name) {
                    setAgentProfileName(data.name);
                }
            } catch (err) {
                console.error("Failed to fetch agent profile:", err);
            }
        };

        fetchAgentProfile();
    }, [agentId, businessPk, phoneNbr, agentProfileName]);

    const statusColors = {
        ORDERED: 'bg-blue-500',
        IN_PREPARATION: 'bg-yellow-500',
        PREPARED: 'bg-green-500',
        DELIVERED: 'bg-gray-500',
        DELIVERING: 'bg-orange-500'
    };

    const badgeColor = statusColors[orderStatus] || 'bg-slate-600';
    
    // Safe Display Values
    const displayPhone = safeExtractPhone(customerId);
    const displayName = (customerName && !String(customerName).includes('undefined') && customerName !== 'unknown') 
        ? customerName 
        : "Customer";

    // 🟢 FORMAT AGENT DISPLAY
    const displayAgentPhone = agentId ? String(agentId).replace('AGENT#', '') : 'Unassigned';
    
    // Combine the fetched name with the phone number, ignoring "Unknown Agent" text
    const finalAgentDisplay = agentProfileName && agentProfileName !== 'Unknown Agent'
        ? `${agentProfileName} (${displayAgentPhone})` 
        : displayAgentPhone;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-sm font-bold text-orange-400 bg-black/10 px-2 py-0.5 rounded inline-block w-fit">
                            {String(orderId).includes('#') ? String(orderId).split('#')[1] : orderId}
                        </h2>
                        
                        <div className="mt-2">
                            <h2 className="text-base font-bold text-white">{displayName}</h2>
                            <h2 className="text-xs font-medium text-slate-400 font-mono tracking-wide">{displayPhone}</h2>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none mb-1">&times;</button>
                        
                        <span className={`px-2 py-1 text-[10px] rounded-md text-white font-bold uppercase tracking-wide shadow-sm ${badgeColor}`}>
                            {orderStatus ? orderStatus.replace('_', ' ') : 'N/A'}
                        </span>

                        {/* 🟢 CONDITIONAL AGENT DISPLAY */}
                        {(orderStatus === 'DELIVERED' || orderStatus === 'DELIVERING') && agentId && (
                            <span className="text-[10px] font-mono text-slate-400 mt-1 bg-slate-900/50 px-2 py-1 rounded border border-slate-700 flex items-center gap-1">
                                🚚 <span className="text-emerald-400 font-bold">{finalAgentDisplay}</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <div className="flex justify-between font-bold text-xs uppercase tracking-wider mb-3 text-slate-500 border-b border-slate-700 pb-2">
                            <h3 className="text-sky-400">Items</h3>
                            <h3 className="text-amber-400">Unit Price (BD)</h3>
                        </div>

                        <ul className="space-y-2 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.sk} className="flex justify-between text-sm">
                                    <span className="flex gap-2">
                                        <span className="font-bold text-slate-400">{item.quantity}x</span> 
                                        <span className="text-white">{item.name}</span>
                                    </span>
                                    <span className="font-mono text-slate-300">
                                        {item.unitPrice ? parseFloat(item.unitPrice).toFixed(2) : '0.00'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {loading && <div className="text-center text-xs text-slate-500 py-4 animate-pulse">Loading items...</div>}
                    </div>

                    <div className="border-t border-slate-600 pt-3 flex justify-between items-center font-black text-orange-400 bg-orange-900/10 p-3 rounded-lg">
                        <span className="uppercase text-xs tracking-wider">Total Amount</span>
                        <span className="text-lg font-mono">BD {orderTotal ? parseFloat(orderTotal).toFixed(3) : '0.000'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailModal;
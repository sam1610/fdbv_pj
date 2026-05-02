import React from 'react';
import { useEntityList } from '../DataHook/useEntityList';

// Helper to safely extract and format the phone number from the GSI key
const formatCustomerPhone = (customerId) => {
    if (!customerId) return "Unknown";
    
    // Extract the actual phone part from "CUSTOMER#BUSINESS_PHONE#CUSTOMER_PHONE"
    let cleanPhone = String(customerId);
    if (cleanPhone.includes('#')) {
        const parts = cleanPhone.split('#');
        cleanPhone = parts[parts.length - 1]; // Grabs the last part (the customer phone)
    }

    // Format it nicely
    cleanPhone = cleanPhone.replace(/\D/g, '');
    if (cleanPhone.length > 8) {
        return cleanPhone.replace(/(\d{3,4})(\d{4})(\d+)/, '+$1 $2 $3');
    }
    return '+' + cleanPhone;
};

const OrderDetailModal = ({ orderId, orderStatus, orderTotal, customerId, customerName, phoneNbr, onClose }) => {
    
    // 🟢 1. BULLETPROOF THE KEYS
    const formattedPhone = String(phoneNbr).startsWith('+') ? String(phoneNbr) : `+${phoneNbr}`;
    const exactOrderId = String(orderId).replace('ORDER#', '');
    const targetPk = `ORDER#${formattedPhone}#${exactOrderId}`;

    // 🟢 2. EXECUTE QUERY
    const { data: lineItems, loading } = useEntityList(
        {
            pk: targetPk, 
            sk: { beginsWith: 'ITEM#' },                      
            sortDirection: 'DESC'                             
        },
        "listByBusiness" 
    );

    const statusColors = {
        ORDERED: 'bg-blue-500',
        IN_PREPARATION: 'bg-yellow-500',
        PREPARED: 'bg-green-500',
        DELIVERED: 'bg-gray-500',
        DELIVERING: 'bg-orange-500'
    };

    const badgeColor = statusColors[orderStatus] || 'bg-slate-600';
    const displayPhone = formatCustomerPhone(customerId);
    const displayName = customerName || "Customer";

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        {/* Display clean order timestamp */}
                        <h2 className="text-sm font-bold text-orange-400 bg-black/10 px-2 py-0.5 rounded inline-block w-fit">
                            {orderId.split('#')[1]}
                        </h2>
                        
                        {/* ✅ FIX: Display Name and cleanly formatted Phone */}
                        <div className="mt-2">
                            <h2 className="text-base font-bold text-white">{displayName}</h2>
                            <h2 className="text-xs font-medium text-slate-400 font-mono tracking-wide">{displayPhone}</h2>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                        <span className={`
                            px-2 py-1 
                            text-[10px]
                            rounded-md
                            text-white 
                            font-bold 
                            uppercase 
                            tracking-wide shadow-sm
                            ${badgeColor}
                        `}>
                            {orderStatus ? orderStatus.replace('_', ' ') : 'N/A'}
                        </span>
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
                                        {item.unitPrice ? item.unitPrice.toFixed(2) : '0.00'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {loading && <div className="text-center text-xs text-slate-500 py-4 animate-pulse">Loading items...</div>}
                    </div>

                    <div className="border-t border-slate-600 pt-3 flex justify-between items-center font-black text-orange-400 bg-orange-900/10 p-3 rounded-lg">
                        <span className="uppercase text-xs tracking-wider">Total Amount</span>
                        <span className="text-lg font-mono">BD {orderTotal ? orderTotal.toFixed(3) : '0.000'}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OrderDetailModal;
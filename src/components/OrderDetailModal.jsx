import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';


const OrderDetailModal = ({ orderId, orderStatus, orderTotal,customerId ,   phoneNbr, onClose }) => {
    console.log("OrderDetailModal Props:", { orderId, orderStatus, orderTotal, phoneNbr });
    // const lineItems = useMemo(() => allItems.filter(item => item.SortKey.startsWith(`ORDER#${order.OrderID}#ITEM#`)), [allItems, order.OrderID]);
    const { data: lineItems, loading, error } = useEntityList(
        {
            pk: `ORDER#${phoneNbr}#${orderId.split('#')[1]}`, // Direct Partition Key
            sk: { beginsWith: 'ITEM#' },                      // Direct Sort Key condition
            sortDirection: 'DESC'                             // ✅ Get records in Descending Order
        },
        "listByBusiness" // Matches the queryField in your resource.ts
    );
    const statusColors = {
    ORDERED: 'bg-blue-500',
    IN_PREPARATION: 'bg-yellow-500',
    PREPARED: 'bg-green-500',
    DELIVERED: 'bg-gray-500',
    DELIVERING: 'bg-orange-500'
};
console.log("Line Items:", lineItems);
const badgeColor = statusColors[orderStatus] || 'bg-slate-600';
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex flex-col gap-2">
                    <h2 className="text-sm font-bold  text-orange-400 bg-black/10">{orderId.split('#')[1]}</h2>
                    <h2 className="text-sm font-medium text-slate-300">({customerId.substring(0, 3)})-{customerId.substring(3, 5)} {customerId.substring(5, 11)}</h2>
                    </div>
                    <div className="flex flex-col items-start gap-1">    
                        <span className={`
                            px-2 py-0.5 
                            text-[10px]
                            rounded-full
                            text-white 
                            font-bold 
                            uppercase 
                            tracking-wide
                            ${badgeColor}
                        `}>
                            {orderStatus ? orderStatus.replace('_', ' ') : 'N/A'}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        {/* ✅ FIX: Added distinct text colors to the headers */}
                        <div className="flex justify-between font-semibold text-sm mb-2">
                            <h3 className="text-sky-400">Items</h3>
                            <h3 className="text-amber-400">Unit Price (BD)</h3>
                        </div>

                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.sk} className="flex justify-between text-sm">
                                    <span>{item.quantity} x {item.name}</span>
                                    {/* Added a check to prevent errors if unitPrice is null */}
                                    <span> {item.unitPrice ? item.unitPrice.toFixed(2) : '0.00'}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ✅ FIX: Added opacity-75 class to the Total Amount container */}
                    <div className="border-t border-slate-400 pt-2 flex justify-between font-bold text-orange-200  opacity-80">
                        <span>Total Amount</span>
                        {/* Added a check to prevent errors if orderTotal is null */}
                        <span>BD {orderTotal ? orderTotal.toFixed(3) : '0.000'}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
export default OrderDetailModal;
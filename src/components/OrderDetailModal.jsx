import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';


const OrderDetailModal = ({ orderId, orderTotal, phoneNbr, onClose }) => {
    // console.log("OrderDetailModal Props:", { orderId, orderTotal, phoneNbr });
    // const lineItems = useMemo(() => allItems.filter(item => item.SortKey.startsWith(`ORDER#${order.OrderID}#ITEM#`)), [allItems, order.OrderID]);
    const { data: lineItems, loading, error } = useEntityList(
        {filter: {pk: {eq: `ORDER#${phoneNbr}#${orderId.split('#')[1]}`}, sk: {beginsWith: 'ITEM#'}}}
        , "list");

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white text-orange-400 bg-black/10">{orderId} Details</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        {/* ✅ FIX: Added distinct text colors to the headers */}
                        <div className="flex justify-between font-semibold text-sm mb-2">
                            <h3 className="text-sky-400">Items</h3>
                            <h3 className="text-amber-400">Unit Price</h3>
                        </div>

                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.sk} className="flex justify-between text-sm">
                                    <span>{item.quantity} x {item.name}</span>
                                    {/* Added a check to prevent errors if unitPrice is null */}
                                    <span>BD {item.unitPrice ? item.unitPrice.toFixed(3) : '0.000'}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ✅ FIX: Added opacity-75 class to the Total Amount container */}
                    <div className="border-t border-slate-400 pt-2 flex justify-between font-bold text-white  opacity-80">
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
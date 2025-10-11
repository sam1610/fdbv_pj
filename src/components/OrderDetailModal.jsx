import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';


const OrderDetailModal = ({ orderId, orderTotal,phoneNbr,  onClose }) => {
    console.log("OrderDetailModal Props:", { orderId, orderTotal, phoneNbr });
    // const lineItems = useMemo(() => allItems.filter(item => item.SortKey.startsWith(`ORDER#${order.OrderID}#ITEM#`)), [allItems, order.OrderID]);
    const { data: lineItems, loading, error } = useEntityList(`ORDER#${phoneNbr}#${orderId.split('#')[1]}`, 'ITEM#');
        console.log("Records:", lineItems); 
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">{orderId} Details</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="font-semibold text-white">Line Items</h3>
                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={lineItems.sk} className="flex justify-between text-sm">
                                    <span>{item.quantity} x {item.name}</span>
                                    <span>${item.unitPrice.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
                        <span>Total Amount</span>
                        <span>${orderTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default OrderDetailModal;
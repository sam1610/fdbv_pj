import React, { useMemo } from 'react';
import '../App.css';

const OrderDetailModal = ({ order, allItems, onClose }) => {
    const lineItems = useMemo(() => allItems.filter(item => item.SortKey.startsWith(`ORDER#${order.OrderID}#ITEM#`)), [allItems, order.OrderID]);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">{order.OrderID} Details</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="font-semibold text-white">Line Items</h3>
                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.SortKey} className="flex justify-between text-sm">
                                    <span>{item.Quantity} x {item.ItemName}</span>
                                    <span>${item.UnitPrice.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
                        <span>Total Amount</span>
                        <span>${order.TotalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

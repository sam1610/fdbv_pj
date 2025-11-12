import React from 'react';
import { useEntityList } from '../DataHook/useEntityList';

const CustomersDetailModal = ({ IdCustomer, onClose }) => {

    const { data: lineItems, loading, error } = useEntityList(
        {gsi2pk: IdCustomer, sk: {beginsWith: 'ORDER#'}}, 
        "ByCustomer");

    if (loading) return <div className="p-4 text-center">Loading Orders...</div>;
    if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

    // Calculate total amount from the line items
    const totalAmount = lineItems.reduce((acc, item) => acc + (item.totalAmount || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-lg shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold  text-orange-400">Customer Orders</h2>
                     <span className="text-amber-400 text-sm">: ({IdCustomer.split('#')[2]})</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    <div>
                        {/* 4-Column Header */}
                        <div className="flex font-semibold text-sm mb-2">
                            <h3 className="w-1/4 text-sky-400">OrderID</h3>
                            <h3 className="w-1/4 text-amber-400 text-center">#Items</h3>
                            <h3 className="w-1/4 text-amber-400 text-center">Status</h3>
                            <h3 className="w-1/4 text-amber-400 text-right">T.Amount</h3>
                        </div>

                        {/* 4-Column Data */}
                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.sk} className="flex text-sm">
                                    <span className="w-1/4 truncate">{item.sk.split('#')[1]?.split('T')[0]}</span>
                                    <span className="w-1/4 text-center">{item.itemsNbr} </span>
                                    <span className="w-1/4 text-center">{item.orderStatus} </span>
                                    <span className="w-1/4 text-right">${item.totalAmount?.toFixed(2) || '0.00'}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div className="border-t border-slate-400 pt-2 flex justify-between font-bold text-white  opacity-80">
                        <span>Total Amount</span>
                        <span>${totalAmount.toFixed(2)}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
export default CustomersDetailModal;
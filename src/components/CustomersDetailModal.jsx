import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';



const CustomersDetailModal = ({ IdCustomer, onClose }) => {

    const { data: lineItems, loading, error } = useEntityList(
        {gsi2pk: IdCustomer, sk: {beginsWith: 'ORDER#'}}, 
        "ByCustomer");
    console.log("Customer Orders Props:", IdCustomer , { lineItems });
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-lg shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold  text-orange-400 bg-black/10">Customer Orders</h2>
                     <span className="text-amber-400 text-sm text-jusity-left">: ({IdCustomer.split('#')[2]})</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    <div>
                        {/* ✅ FIX: Added distinct text colors to the headers */}
                        <div className="flex justify-between font-semibold text-sm mb-2">
                            <h3 className="text-sky-400">OrderID</h3>
                            <h3 className="text-amber-400">#Items</h3>
                            <h3 className="text-amber-400 ">Status</h3>
                            <h3 className="text-amber-400">T.Amount</h3>
                        </div>

                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.sk} className="flex justify-between text-sm">
                                    {/* Added a check to prevent errors if unitPrice is null */}
                                    
                                    <span>{item.sk.split("T")[0]+".."} </span>
                                
                                    <span >{item.itemsNbr} </span>
                                    <span>{item.orderStatus} </span>
                                    <span>${item.totalAmount}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ✅ FIX: Added opacity-75 class to the Total Amount container */}
                    <div className="border-t border-slate-400 pt-2 flex justify-between font-bold text-white  opacity-80">
                        <span>Total Amount</span>
                        {/* Added a check to prevent errors if orderTotal is null */}
                        {/* <span>${orderTotal ? orderTotal.toFixed(2) : '0.00'}</span> */}
                    </div>
                </div>

            </div>
        </div>
    );
};
export default CustomersDetailModal;
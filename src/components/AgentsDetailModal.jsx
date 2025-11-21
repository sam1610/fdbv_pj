import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';



const AgentsDetailModal = ({ IdAgent,agentName, onClose }) => {

    const { data: lineItems, loading, error } = useEntityList(
        {gsi1pk: IdAgent, sk: {beginsWith: 'ORDER#'}}, 
        "ByAgent");
    console.log("Agent Orders Props:", { lineItems });
    const orderTotal = useMemo(() => {
    // Return 0 if lineItems is empty or not yet loaded
    if (!lineItems) return 0;

    // Sum all totalAmount fields, ensuring they are treated as numbers
    return lineItems.reduce((acc, item) => {
        // (Number(item.totalAmount) || 0) safely handles null/undefined values
        return acc + (Number(item.totalAmount) || 0);
    }, 0);
}, [lineItems]);
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-800 rounded-lg w-full max-w-lg shadow-xl animate-fade-in-up">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-lg font-bold  text-orange-400 bg-black/10">Orders Deliveries</h2>
            <span className="text-amber-400 text-sm text-jusity-left">{agentName} : ({IdAgent.split('#')[1]})</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            <div>
                {/* ✅ FIX 1: Switched from 'flex' to 'grid' for proper column alignment */}
                <div className="grid grid-cols-4 font-semibold text-sm mb-2">
                    {/* ✅ FIX 2: Added 'text-center' to all headers */}
                    <h3 className="text-sky-400 text-center">Order Date</h3>
                    <h3 className="text-amber-400 text-center">#Items</h3>
                    <h3 className="text-amber-400 text-center">Status</h3>
                    <h3 className="text-amber-400 text-center">T.Amount(BD)</h3>
                </div>

                <ul className="space-y-1 mt-1 text-slate-300">
                    {lineItems.map(item => (
                        // ✅ FIX 3: Switched list items to 'grid' as well
                        <li key={item.sk} className="grid grid-cols-4 text-sm">
                            
                            {/* ✅ FIX 4: Correctly parsed date and centered text */}
                            {/* This assumes sk is like "ORDER#2025-11-08T..." */}
                            <span className="text-center">{item.sk.split('#')[1]?.split('T')[0] || item.sk}</span>
                        
                            {/* ✅ FIX 5: Centered all data cells */}
                            <span className="text-center">{item.itemsNbr}</span>
                            <span className="text-left">{item.orderStatus}</span>
                            <span className="text-right"> {item.totalAmount}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="border-t border-slate-400 pt-2 flex justify-between font-bold text-white  opacity-80">
                <span>Total Amount</span>
                <span>BD {orderTotal.toFixed(3)}</span>
            </div>
        </div>

    </div>
</div>
    );
};
export default AgentsDetailModal;
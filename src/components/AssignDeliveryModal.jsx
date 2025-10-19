import { ConsoleLogger } from 'aws-amplify/utils';
import React, { useState, useMemo } from 'react';
import { updateRec } from '../DataHook/UpdateRec';


const AssignDeliveryModal = ({ orders, deliveryAgents, onAssign, onClose }) => {
    const [selectedAgent, setSelectedAgent] = useState(deliveryAgents[0]?.sk || '');
    // const preparedOrders = useMemo(() => orders.filter(o => o.orderStatus === 'prepared'), [orders]);
    const [selectedOrders, setSelectedOrders] = useState(() => orders.map(o => o.sk));

    const toggleOrderSelection = (orderId) => {
        setSelectedOrders(prev => 
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };
    const updates = {
      gsi1pk: selectedAgent , orderStatus: 'DELIVERING'
    };
    const handleAssign = async () => {
        if (!selectedAgent || selectedOrders.length === 0) return;
        onAssign( selectedAgent, selectedOrders);
        try {
      const updatedRecord = await updateRec(deliveryAgents[0]?.pk, selectedOrders, updates);
      console.log('Updated record details:', updatedRecord); // Use for UI refresh if needed
    } catch (err) {
      console.log(err.message);
    }
    console.log("pk  Orders",deliveryAgents[0]?.pk);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Assign Delivery</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label htmlFor="agent" className="block text-sm font-medium text-slate-300 mb-1">Select Delivery Agent</label>
                        <select id="agent" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="w-full bg-slate-700 text-white rounded-md p-2 border border-slate-600 focus:ring-sky-500 focus:border-sky-500">
                            {deliveryAgents.map(agent => <option key={agent.sk} value={agent.sk}>{agent.name}:   ({agent.phone})</option>)}
                        </select>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Select Orders to Assign</h3>
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                            {orders.map(order => (
                                <div key={order.sk} className="flex items-center bg-slate-700 p-2 rounded-md">
                                    <input 
                                        type="checkbox" 
                                        id={order.sk} 
                                        checked={selectedOrders.includes(order.sk)}
                                        onChange={() => toggleOrderSelection(order.sk)}
                                        className="h-4 w-4 rounded border-slate-500 text-sky-600 focus:ring-sky-500"
                                    />
                                    <label htmlFor={order.sk} className="ml-3 text-sm text-slate-200">{order.sk} ({order.itemsNbr} items)</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-b-lg flex justify-end">
                    <button onClick={handleAssign} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-md hover:bg-sky-700 disabled:opacity-50" disabled={!selectedAgent || selectedOrders.length === 0}>
                        Assign {selectedOrders.length} Orders
                    </button>
                </div>
            </div>
        </div>
    );
};
export default AssignDeliveryModal;


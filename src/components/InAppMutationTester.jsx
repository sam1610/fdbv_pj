// src/components/InAppMutationTester.jsx

import React, { useState } from 'react'; // ✅ FIX: Removed useEffect import
import { client } from '../DataHook/amplifyClient'; // Make sure this path is correct!

// This must match the phone number you are using!

const InAppMutationTester = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // ✅ FIX: This state holds the SK you want to update.
  // ⚠️ You MUST change this to a REAL order SK from your database.
  const [orderSkToUpdate, setOrderSkToUpdate] = useState('ORDER#2025-11-13T08:53:53.173Z');

  // ✅ FIX: handleCreate should CREATE a new record


  // ✅ FIX: handleUpdate should UPDATE an existing record
  const handleUpdate = async () => {
    setLoading(true);
    setMessage('');

    try {
      console.log(`🔄 Updating order ${orderSkToUpdate}...`);
      const updatedOrder = await client.models.BusinessData.update({
        pk: "BUSINESS#+97333787388",
        sk: "ORDER#2025-11-13T08:53:53.173Z",
        orderStatus: 'PREPARED', // Change the status
      });
      setMessage(`✅ Success! Updated ${orderSkToUpdate} to ORDERED. Check 'Ready' KPI.`);
      console.log('✅ Test mutation executed:', updatedOrder);
    } catch (mutationErr) {
      console.error('❌ In-app update failed:', mutationErr);
      setMessage(`Error: ${mutationErr.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 bg-slate-900 border-2 border-dashed border-red-500 rounded-lg space-y-3">
      <h3 className="font-bold text-red-400">In-App Mutation Tester</h3>
      {/* Input to change the SK you want to update */}
      <div className="flex flex-col space-y-1">
        <label htmlFor="skInput" className="text-sm text-slate-400">SK to Update:</label>
        <input
          id="skInput"
          type="text"
          value={orderSkToUpdate}
          onChange={(e) => setOrderSkToUpdate(e.target.value)}
          className="bg-slate-700 text-white p-1 rounded"
        />
      </div>
      
      <div className="flex space-x-4">

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="bg-yellow-600 text-white font-bold py-2 px-4 rounded-md hover:bg-yellow-700 disabled:opacity-50"
        >
          Update Order to PREPARED
        </button>
      </div>
      {message && <p className="text-slate-300 text-sm">{message}</p>}
    </div>
  );
};

export default InAppMutationTester;
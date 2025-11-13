// src/components/RealTimeKPIs.jsx

import React, { useState, useEffect, useMemo } from 'react';
// 1. IMPORT THE SHARED CLIENT
import { client } from '../DataHook/amplifyClient';

const RealTimeKPIs = ({ phoneNbr }) => {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);

  // 2. ✅ THIS IS THE FIXED useMemo HOOK
  //    The version in your file is broken.
  const queryParam = useMemo(() => {
    // Don't create params if phoneNbr isn't ready
    if (!phoneNbr) return null;

    return {
      filter: {
        pk: { eq: `BUSINESS#${phoneNbr}` },
        sk: { beginsWith: 'ORDER#' }
      }
    };
  }, [phoneNbr]); // The dependency array is part of the hook

  // 3. This is the observeQuery logic
  useEffect(() => {
    // This 'if' check is what stops the app from crashing
    if (!queryParam) {
      console.log('RealTimeKPIs: Waiting for queryParam...');
      return;
    }

    console.log('RealTimeKPIs: Subscribing with param:', queryParam);
    const observer = client.models.BusinessData.observeQuery(queryParam);

    const subscription = observer.subscribe({
      next: (snapshot) => {
        console.log('RealTimeKPIs: ✅ Data Received!', snapshot.items);
        
        // ✅ THE FIX: Spread snapshot.items into a new array
        setOrders([...snapshot.items]);
        setError(null);
      },
      error: (err) => {
        setError(err.message || 'Subscription error');
        console.error('RealTimeKPIs: ❌ Subscription error:', err);
      }
    });

    // Cleanup: Unsubscribe when component unmounts
    return () => {
      console.log('RealTimeKPIs: Unsubscribing...');
      subscription.unsubscribe();
    };

  }, [queryParam]); // Re-run only if the query parameters change

  // 4. This is your kpis logic (no change)
  const kpis = useMemo(() => {
    if (!orders || orders.length === 0) {
      return { totalOrders: 0, revenue: 0, inProgress: 0, readyForDelivery: 0 };
    }
    return {
      totalOrders: orders.length,
      revenue: orders.reduce((acc, o) => (o.totalAmount ? acc + o.totalAmount : acc), 0),
      inProgress: orders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
      readyForDelivery: orders.filter(o => o.orderStatus === 'PREPARED').length,
    };
  }, [orders]);

  // 5. Render the KPIs (no change)
  if (error) return <div className="p-4 text-center text-red-400">Real-Time Error: {error}</div>;

  return (
    <div className="border-4 border-dashed border-sky-500 p-4 rounded-lg">
      <h2 className="text-xl font-bold text-sky-300 mb-2">Real-Time Test KPIs</h2>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-700 p-3 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-white">{kpis.totalOrders}</p>
        </div>
        <div className="bg-slate-700 p-3 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Revenue</p>
          <p className="text-2xl font-bold text-white">${kpis.revenue.toFixed(2)}</p>
        </div>
        <div className="bg-slate-700 p-3 rounded-lg text-center">
          <p className="text-yellow-300 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-white">{kpis.inProgress}</p>
        </div>
        <div className="bg-slate-700 p-3 rounded-lg text-center">
          <p className="text-green-300 text-sm">Ready</p>
          <p className="text-2xl font-bold text-white">{kpis.readyForDelivery}</p>
        </div>
      </div>
    </div>
  );
};

export default RealTimeKPIs;
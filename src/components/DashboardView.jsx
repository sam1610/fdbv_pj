// src/components/DashboardView.jsx
import React, { useMemo, useEffect, useState } from 'react';
import * as Recharts from 'recharts';
import { generateClient } from 'aws-amplify/data';

const client = generateClient({ authMode: 'apiKey' });

const DashboardView = ({ phoneNbr, filterDays = 1, setModal }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------------------
  // 1. Build stable filter (same as before)
  // --------------------------------------------------------------
  const { filter, filterKey } = useMemo(() => {
    if (!phoneNbr) return { filter: null, filterKey: '' };

    const now = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (filterDays - 1));
    start.setHours(0, 0, 0, 0);

    const filterObj = {
      pk: { eq: `BUSINESS#${phoneNbr}` },
      sk: { between: [`ORDER#${start.toISOString()}`, `ORDER#${now.toISOString()}`] },
    };

    return {
      filter: filterObj,
      filterKey: JSON.stringify(filterObj), // stable string
    };
  }, [phoneNbr, filterDays]);

  // --------------------------------------------------------------
  // 2. Real-time subscription with observeQuery
  // --------------------------------------------------------------
  useEffect(() => {
    if (!filter) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const sub = client.models.BusinessData.observeQuery({
      filter,
    }).subscribe({
      next: ({ items }) => {
        // Sort newest first
        console.log('observeQuery received:', items.length, 'items');
        const sorted = [...items].sort((a, b) =>
          (b.orderDate || '').localeCompare(a.orderDate || '')
        );
        setOrders(sorted);
        setLoading(false);
      },
      error: (err) => {
        console.error('observeQuery error:', err);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [filterKey]);

  // --------------------------------------------------------------
  // 3. KPIs (live!)
  // --------------------------------------------------------------
  const kpis = useMemo(() => {
    if (!orders.length) {
      return { totalOrders: 0, revenue: 0, inProgress: 0, readyForDelivery: 0 };
    }
    return {
      totalOrders: orders.length,
      revenue: orders.reduce((a, o) => a + (o.totalAmount ?? 0), 0),
      inProgress: orders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
      readyForDelivery: orders.filter(o => o.orderStatus === 'PREPARED').length,
    };
  }, [orders]);
  useEffect(() => {
  console.log('DashboardView rendered', { phoneNbr, orders: orders.length });
}, [phoneNbr, orders]);
  const chartData = useMemo(() => {
    const counts = orders.reduce((acc, o) => {
      const s = o.orderStatus ?? 'UNKNOWN';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace('_', ' ').toLowerCase(),
      orders: value,
    }));
  }, [orders]);

  const readyOrders = useMemo(
    () => orders.filter(o => o.orderStatus === 'PREPARED'),
    [orders]
  );

  if (loading) return <div className="p-4 text-center">Loading live data…</div>;

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Good Morning!</h1>
        <p className="text-slate-400">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-4 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Total Orders</p>
          <p className="text-3xl font-bold text-white">{kpis.totalOrders}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Revenue Today</p>
          <p className="text-3xl font-bold text-white">${kpis.revenue.toFixed(2)}</p>
        </div>
        <div className="bg-yellow-800/50 p-4 rounded-lg text-center">
          <p className="text-yellow-300 text-sm">In Progress</p>
          <p className="text-3xl font-bold text-white">{kpis.inProgress}</p>
        </div>
        <button
          onClick={() => setModal({ type: 'assignDelivery', PreparedOrders: readyOrders })}
          className="bg-green-800/50 p-4 rounded-lg text-center hover:bg-green-700/50 transition"
        >
          <p className="text-green-300 text-sm">Ready for Delivery</p>
          <p className="text-3xl font-bold text-white">{kpis.readyForDelivery}</p>
        </button>
      </div>

      {/* Live Chart */}
      <div className="bg-slate-800 p-4 rounded-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Live Order Status</h2>
        <div style={{ width: '100%', height: 300 }}>
          <Recharts.ResponsiveContainer>
            <Recharts.BarChart data={chartData}>
              <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
              <Recharts.YAxis stroke="#94a3b8" allowDecimals={false} />
              <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
              <Recharts.Bar dataKey="orders" fill="#38bdf8" />
            </Recharts.BarChart>
          </Recharts.ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
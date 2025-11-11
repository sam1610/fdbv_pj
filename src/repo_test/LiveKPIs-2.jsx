// components/LiveKPIs.jsx
import React, { useMemo, useEffect } from 'react';
import * as Recharts from 'recharts';
import { useEntityList } from '../DataHook/useEntityList';

const LiveKPIs = ({ phoneNbr, filterDays, setModal }) => {
  const queryParam = useMemo(() => {
    if (!phoneNbr) return null;
    const now = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (filterDays - 1));
    start.setHours(0, 0, 0, 0);
    return {
      filter: {
        pk: { eq: `BUSINESS#${phoneNbr}` },
        sk: { between: [`ORDER#${start.toISOString()}`, `ORDER#${now.toISOString()}`] },
      },
    };
  }, [phoneNbr, filterDays]);

  const { data: orders, forceKpiUpdate } = useEntityList(queryParam, 'list');

  // Re-run on polling
  useEffect(() => {
    const interval = setInterval(() => {
      forceKpiUpdate();
    }, 45_000);
    return () => clearInterval(interval);
  }, [forceKpiUpdate]);

  // KPIs
  const kpis = useMemo(() => {
    if (!orders?.length) return { total: 0, revenue: 0, inProgress: 0, ready: 0 };
    return {
      total: orders.length,
      revenue: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
      inProgress: orders.filter(o => o.orderStatus === 'IN_PREPARATION').length,
      ready: orders.filter(o => o.orderStatus === 'PREPARED').length,
    };
  }, [orders]);

  const readyOrders = useMemo(
    () => orders.filter(o => o.orderStatus === 'PREPARED'),
    [orders]
  );

  // CHART DATA
  const chartData = useMemo(() => {
    if (!orders?.length) return [];
    const counts = orders.reduce((acc, o) => {
      const status = o.orderStatus || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace('_', ' ').toLowerCase(),
      orders: value,
    }));
  }, [orders]);

  const openModal = () => {
    setModal({ type: 'assignDelivery', PreparedOrders: readyOrders });
  };

  return (
    <>
      {/* KPI GRID */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800 p-4 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Total Orders</p>
          <p className="text-3xl font-bold text-white">{kpis.total}</p>
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
          onClick={openModal}
          className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50"
        >
          <p className="text-green-300 text-sm">Ready for Delivery</p>
          <p className="text-3xl font-bold text-white">{kpis.ready}</p>
        </button>
      </div>

      {/* CHART – Updates with data */}
      <div className="bg-slate-800 p-4 rounded-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Today's Order Status</h2>
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
    </>
  );
};

export default React.memo(LiveKPIs);
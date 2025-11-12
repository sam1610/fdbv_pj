// src/components/OrdersView.jsx
import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';

const OrdersView = ({ phoneNbr, setModal }) => {
  // --------------------------------------------------------------
  // 7-day window (you can change the number)
  // --------------------------------------------------------------
  const queryParam = useMemo(() => {
    if (!phoneNbr) return null;
    const now = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return {
      filter: {
        pk: { eq: `BUSINESS#${phoneNbr}` },
        sk: { between: [`ORDER#${start.toISOString()}`, `ORDER#${now.toISOString()}`] },
      },
    };
  }, [phoneNbr]);

  const { data: orders, loading, error } = useEntityList(queryParam, 'list');

  if (loading) return <div className="p-4 text-center">Loading orders…</div>;
  if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-semibold text-white">Orders</h2>

      {orders.length === 0 ? (
        <p className="text-slate-400">No orders in the selected range.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.sk}
              className="bg-slate-800 p-3 rounded flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-white">
                  {new Date(o.orderDate).toLocaleString()}
                </p>
                <p className="text-sm text-slate-400">
                  {o.totalAmount?.toFixed(2)} $ – {o.orderStatus}
                </p>
              </div>
              <button
                onClick={() =>
                  setModal({
                    type: 'orderDetail',
                    Id: o.sk,
                    totalAmount: o.totalAmount,
                  })
                }
                className="text-sky-400 text-sm"
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OrdersView;
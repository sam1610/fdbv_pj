// src/components/CustomersView.jsx
import React, { useMemo } from 'react';
import { useEntityList } from '../DataHook/useEntityList';

const CustomersView = ({ phoneNbr, setModal }) => {
  // --------------------------------------------------------------
  // Build a **stable** GSI-2 query: all customers for this business
  // --------------------------------------------------------------
  const queryParam = useMemo(() => {
    if (!phoneNbr) return null;
    return {
      gsi2pk: { eq: `CUSTOMER#${phoneNbr}` }, // <-- GSI 2 PK
    };
  }, [phoneNbr]);

  const { data: customers, loading, error } = useEntityList(
    queryParam,
    'ByCustomer'               // <-- tells the hook to use the GSI method
  );

  if (loading) return <div className="p-4 text-center">Loading customers…</div>;
  if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-semibold text-white">Customers</h2>

      {customers.length === 0 ? (
        <p className="text-slate-400">No customers yet.</p>
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li
              key={c.sk}
              className="bg-slate-800 p-3 rounded flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-white">{c.name ?? '—'}</p>
                <p className="text-sm text-slate-400">{c.phone ?? c.sk}</p>
              </div>
              <button
                onClick={() =>
                  setModal({ type: 'CustomerDetail', IdCustomer: c.sk })
                }
                className="text-sky-400 text-sm"
              >
                Details
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomersView;
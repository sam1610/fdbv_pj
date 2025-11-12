// src/components/Dashboard.jsx
import React, { useState } from 'react';
import DashboardView from './DashboardView';
import OrdersView from './OrdersView';
import CustomersView from './CustomersView';
import OrderDetailModal from './OrderDetailModal';
import AssignDeliveryModal from './AssignDeliveryModal';
import CustomersDetailModal from './CustomersDetailModal';
import { useEntityList } from '../DataHook/useEntityList';

export default function Dashboard({ phoneNbr }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [modal, setModal] = useState(null);

  // delivery agents (unchanged)
  const { data: deliveryAgents } = useEntityList(
    { filter: { pk: { eq: `BUSINESS#${phoneNbr}` }, sk: { beginsWith: 'AGENT#' } } },
    'list'
  );

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView phoneNbr={phoneNbr} setModal={setModal} />;
      case 'orders':
        return <OrdersView phoneNbr={phoneNbr} setModal={setModal} />;
      case 'customers':
        return <CustomersView phoneNbr={phoneNbr} setModal={setModal} />;
      default:
        return null;
    }
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal.type === 'orderDetail')
      return (
        <OrderDetailModal
          orderId={modal.Id}
          orderTotal={modal.totalAmount}
          phoneNbr={phoneNbr}
          onClose={() => setModal(null)}
        />
      );
    if (modal.type === 'CustomerDetail')
      return <CustomersDetailModal IdCustomer={modal.IdCustomer} onClose={() => setModal(null)} />;
    if (modal.type === 'assignDelivery')
      return (
        <AssignDeliveryModal
          orders={modal.PreparedOrders}
          deliveryAgents={deliveryAgents}
          onAssign={(agentId, orders) => {
            console.log('assign', agentId, orders);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      );
    return null;
  };

  return (
    <div className="bg-slate-900 text-slate-200 min-h-screen font-sans pb-20">
      {renderModal()}
      <main>{renderView()}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around">
        {['dashboard', 'orders', 'customers'].map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`flex-1 flex flex-col items-center justify-center py-2 ${
              activeView === v ? 'text-sky-400' : 'text-slate-400'
            }`}
          >
            <span className="text-xs capitalize">{v}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
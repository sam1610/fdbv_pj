import React, { useState, useMemo , useCallback} from 'react';
import * as Recharts from 'recharts';
import  DashboardView  from "./DashboardView";
import  OrdersView  from "./OrdersView";
import  CustomersView  from "./CustomersView";
import OrderDetailModal from './OrderDetailModal';
import AssignDeliveryModal from './AssignDeliveryModal';    
import CustomersDetailModal from './CustomersDetailModal';
import AgentsDetailModal from './AgentsDetailModal';
import AgentsView from './AgentsView';
import { useEntityList } from '../DataHook/useEntityList';


// --- Helper Functions & Static Components ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');
const statusColors = { ordered: 'bg-blue-500', 'in preparation': 'bg-yellow-500', prepared: 'bg-green-500', delivered: 'bg-gray-500', cancelled: 'bg-red-500' };

// --- Icon Components ---
const HomeIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const ClipboardListIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>;
const UsersIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const businessLocation = { "latitude" : { "N" : "26.0935053" }, "longitude" : { "N" : "50.48796" } };
// --- Main App Component ---
export default function Dashboard({phoneNbr}) {
    const [activeView, setActiveView] = useState('dashboard');
    const [modal, setModal] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const { data: deliveryAgents, loading, error } = useEntityList(
             {
            pk:`BUSINESS#${phoneNbr}` , 
            sk: {beginsWith: 'AGENT#'},
            sortDirection: 'DESC'
        }, "listByBusiness");
const handleDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
        console.log("Refreshing Dashboard Data...");
    }, []);

//   console.log("Delivery Agents:", deliveryAgents);
   
    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return <DashboardView phoneNbr={phoneNbr}  filterDays={2}  setModal={setModal}/>;
            case 'orders':
                return <OrdersView phoneNbr={phoneNbr} setModal={setModal} deliveryAgents={deliveryAgents} businessLocation={businessLocation} />;
            case 'customers':
                return <CustomersView phoneNbr={phoneNbr} setModal={setModal} />;
            case 'agents':
                return <AgentsView phoneNbr={phoneNbr} setModal={setModal}  onAgentAdded={handleDataRefresh}/>;
            default:
                return <DashboardView phoneNbr={phoneNbr}  filterDays={2}  setModal={setModal} />;
        }
    };

    const renderModal = () => {
        if (!modal) return null;
        if (modal.type === 'orderDetail') {
            return <OrderDetailModal orderId={modal.Id} orderStatus={modal.orderStatus} orderTotal={modal.totalAmount} phoneNbr={phoneNbr}  customerId={modal.customerId} onClose={() => setModal(null)} />;
        }
        if (modal.type === 'CustomerDetail') {
            return <CustomersDetailModal IdCustomer={modal.IdCustomer} customerName={modal.customerName}  onClose={() => setModal(null)} />;
        }
        if (modal.type === 'AgentDetail') {
            return <AgentsDetailModal IdAgent={modal.IdAgent} agentName={modal.agentName} phoneNbr={phoneNbr} onClose={() => setModal(null)} />;
        }
        if (modal.type === 'assignDelivery') {
            return <AssignDeliveryModal 
            orders={modal.PreparedOrders} 
            deliveryAgents={deliveryAgents} 
            onAssign={(agentId, orders) => {
            // This is just for logging, as set in your file
            console.log('Assigning:', agentId, orders);
            
          }}
          
          // ✅ FIX 6: This is what makes the '×' button work
          onClose={() => setModal(null)}
          
          // ✅ FIX 7: This passes the 'refetch' function to the modal
          onSuccess={modal.onSuccess}
             />;
        }
        return null;
    };

    return (
        <div className="bg-slate-900 text-slate-200 min-h-screen font-sans pb-20">
            {/* <BusinessDataProvider phoneNbr={phoneNbr}> */}
      {renderModal()}
      <main>
        {renderView()}
      </main>
            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around">
                <button onClick={() => setActiveView('dashboard')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'dashboard' ? 'text-sky-400' : 'text-slate-400')}>
                    <HomeIcon className="h-6 w-6 mb-1" />
                    <span className="text-xs">Dashboard</span>
                </button>
                <button onClick={() => setActiveView('orders')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'orders' ? 'text-sky-400' : 'text-slate-400')}>
                    <ClipboardListIcon className="h-6 w-6 mb-1" />
                    <span className="text-xs">Orders</span>
                </button>
                <button onClick={() => setActiveView('customers')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'customers' ? 'text-sky-400' : 'text-slate-400')}>
                    <UsersIcon className="h-6 w-6 mb-1" />
                    <span className="text-xs">Customers</span>
                </button>
                <button onClick={() => setActiveView('agents')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'agents' ? 'text-sky-400' : 'text-slate-400')}>
                    <UsersIcon className="h-6 w-6 mb-1" />
                    <span className="text-xs">Delivery</span>
                </button>
            </nav>
        </div>
        
    );
}

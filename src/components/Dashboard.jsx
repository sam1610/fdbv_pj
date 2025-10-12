import React, { useState, useMemo } from 'react';
import * as Recharts from 'recharts';
import  DashboardView  from "./DashboardView";
import  OrdersView  from "./OrdersView";
import  CustomersView  from "./CustomersView";
import OrderDetailModal from './OrderDetailModal';
import AssignDeliveryModal from './AssignDeliveryModal';    
import { useEntityList } from '../DataHook/useEntityList';
import CustomersDetailModal from './CustomersDetailModal';
import { BusinessDataProvider } from '../DataHook/BusinessDataProvider';
// --- Mock Data ---
// This data simulates the items you would fetch from your DynamoDB table.
// It's structured to match your single-table design with different item types.
const mockData = {
  businessName: "The Cloud Kitchen",
  deliveryAgents: [
    { id: "AGENT_001", name: "John Deliver" },
    { id: "AGENT_002", name: "Maria Speed" },
    { id: "AGENT_003", name: "Sam Courier" },
  ],
  items: [
    // --- Business 1 Data ---
    // Customer Profiles
    { BusinessPhone: "+15551112222", SortKey: "CUSTOMER#+1234567890", CustomerName: "John Doe", TotalOrders: 15, TotalSpent: 550.75, DefaultDeliveryAddress: { lat: 26.2153, lon: 50.5822 } },
    { BusinessPhone: "+15551112222", SortKey: "CUSTOMER#+1987654321", CustomerName: "Jane Smith", TotalOrders: 8, TotalSpent: 275.50, DefaultDeliveryAddress: { lat: 26.2311, lon: 50.5987 } },
    
    // Today's Orders & a few historical ones
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-001", OrderID: "ORD-2222-001", CustomerPhone: "+1234567890", OrderDate: new Date().toISOString(), Status: "delivered", TotalAmount: 45.50, ItemsNumber: 3 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-002", OrderID: "ORD-2222-002", CustomerPhone: "+1987654321", OrderDate: new Date().toISOString(), Status: "prepared", TotalAmount: 22.75, ItemsNumber: 2 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-003", OrderID: "ORD-2222-003", CustomerPhone: "+1234567890", OrderDate: new Date().toISOString(), Status: "in preparation", TotalAmount: 33.00, ItemsNumber: 2 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-004", OrderID: "ORD-2222-004", CustomerPhone: "+1234567890", OrderDate: new Date().toISOString(), Status: "in preparation", TotalAmount: 15.25, ItemsNumber: 1 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-005", OrderID: "ORD-2222-005", CustomerPhone: "+1987654321", OrderDate: new Date().toISOString(), Status: "ordered", TotalAmount: 88.00, ItemsNumber: 5 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-006", OrderID: "ORD-2222-006", CustomerPhone: "+1234567890", OrderDate: new Date().toISOString(), Status: "prepared", TotalAmount: 12.50, ItemsNumber: 1 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-007", OrderID: "ORD-2222-007", CustomerPhone: "+1987654321", OrderDate: "2025-09-14T12:30:00Z", Status: "delivered", TotalAmount: 55.00, ItemsNumber: 4 },

    
    // Order Line Items (for Order Detail view)
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-001#ITEM#A", ItemName: "Margherita Pizza", Quantity: 2, UnitPrice: 12.50 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-001#ITEM#B", ItemName: "Soda", Quantity: 3, UnitPrice: 2.50 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-002#ITEM#A", ItemName: "Classic Burger", Quantity: 1, UnitPrice: 9.75 },
    { BusinessPhone: "+15551112222", SortKey: "ORDER#ORD-2222-002#ITEM#B", ItemName: "Fries", Quantity: 1, UnitPrice: 3.00 },
  ]
};

// --- Helper Functions & Static Components ---
const classNames = (...classes) => classes.filter(Boolean).join(' ');
const statusColors = { ordered: 'bg-blue-500', 'in preparation': 'bg-yellow-500', prepared: 'bg-green-500', delivered: 'bg-gray-500', cancelled: 'bg-red-500' };

// --- Icon Components ---
const HomeIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const ClipboardListIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>;
const UsersIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;

// --- Main App Component ---
export default function Dashboard({phoneNbr}) {
    const [activeView, setActiveView] = useState('dashboard');
    const [modal, setModal] = useState(null);
    const [appData, setAppData] = useState(mockData);

    // Filter data for a specific business, simulating a logged-in user.
    const businessPhone = "+15551112222";
    const businessData = useMemo(() => appData.items.filter(item => item.BusinessPhone === businessPhone), [appData, businessPhone]);
    
    // console.log("Business Data:", useEntityList(`BUSINESS#${phoneNbr}`,  "ORDER#"));


    const orders = useMemo(() => businessData.filter(item => item.SortKey.startsWith('ORDER#') && !item.SortKey.includes('#ITEM#')), [businessData]);
    // const customers = useMemo(() => businessData.filter(item => item.SortKey.startsWith('CUSTOMER#')), [businessData]);
    
    const handleAssignDelivery = (agentId, selectedOrders) => {
        console.log(`Assigning ${selectedOrders.length} orders to ${agentId}`);
        // Here you would typically update the state, but for now we just log it
        // and close the modal.
        setModal(null);
    };
    
    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return <DashboardView phoneNbr={phoneNbr}  filterDays="30"/>;
            case 'orders':
                return <OrdersView phoneNbr={phoneNbr} setModal={setModal} />;
            case 'customers':
                return <CustomersView phoneNbr={phoneNbr} setModal={setModal} />;
            default:
                return <DashboardView orders={orders} setModal={setModal} businessName={appData.businessName} />;
        }
    };

    const renderModal = () => {
        if (!modal) return null;
        if (modal.type === 'orderDetail') {
            return <OrderDetailModal orderId={modal.Id} orderTotal={modal.totalAmount} phoneNbr={phoneNbr}  onClose={() => setModal(null)} />;
        }
        if (modal.type === 'CustomerDetail') {
            return <CustomersDetailModal IdCustomer={modal.IdCustomer}  onClose={() => setModal(null)} />;
        }
        if (modal.type === 'assignDelivery') {
            return <AssignDeliveryModal orders={orders} deliveryAgents={appData.deliveryAgents} onAssign={handleAssignDelivery} onClose={() => setModal(null)} />;
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
            {/* </BusinessDataProvider> */}

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
            </nav>
        </div>
        
    );
}

// --- View Components ---




// --- Modal Components ---




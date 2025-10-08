import React, { useState, useMemo } from 'react';
import * as Recharts from 'recharts';

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
export default function Dashboard({ user, client, phoneNbr }) {
    const [activeView, setActiveView] = useState('dashboard');
    const [modal, setModal] = useState(null);
    const [appData, setAppData] = useState(mockData);

    // Filter data for a specific business, simulating a logged-in user.
    const businessPhone = "+15551112222";
    const businessData = useMemo(() => appData.items.filter(item => item.BusinessPhone === businessPhone), [appData, businessPhone]);
    
    const orders = useMemo(() => businessData.filter(item => item.SortKey.startsWith('ORDER#') && !item.SortKey.includes('#ITEM#')), [businessData]);
    const customers = useMemo(() => businessData.filter(item => item.SortKey.startsWith('CUSTOMER#')), [businessData]);

    const handleAssignDelivery = (agentId, selectedOrders) => {
        console.log(`Assigning ${selectedOrders.length} orders to ${agentId}`);
        // Here you would typically update the state, but for now we just log it
        // and close the modal.
        setModal(null);
    };

    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return <DashboardView orders={orders} setModal={setModal} businessName={appData.businessName} />;
            case 'orders':
                return <OrdersView allItems={businessData} setModal={setModal} />;
            case 'customers':
                return <CustomersView customers={customers} setModal={setModal} />;
            default:
                return <DashboardView orders={orders} setModal={setModal} businessName={appData.businessName} />;
        }
    };

    const renderModal = () => {
        if (!modal) return null;
        if (modal.type === 'orderDetail') {
            return <OrderDetailModal order={modal.data.order} allItems={businessData} onClose={() => setModal(null)} />;
        }
        if (modal.type === 'assignDelivery') {
            return <AssignDeliveryModal orders={orders} deliveryAgents={appData.deliveryAgents} onAssign={handleAssignDelivery} onClose={() => setModal(null)} />;
        }
        return null;
    };

    return (
        <div className="bg-slate-900 text-slate-200 min-h-screen font-sans pb-20">
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
            </nav>
        </div>
    );
}

// --- View Components ---

const DashboardView = ({ orders, setModal, businessName }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todaysOrders = useMemo(() => orders.filter(o => o.OrderDate.startsWith(today)), [orders, today]);

    const kpis = useMemo(() => ({
        totalOrders: todaysOrders.length,
        revenueToday: todaysOrders.reduce((acc, o) => o.Status === 'delivered' ? acc + o.TotalAmount : acc, 0),
        inProgress: todaysOrders.filter(o => o.Status === 'in preparation').length,
        readyForDelivery: todaysOrders.filter(o => o.Status === 'prepared').length,
    }), [todaysOrders]);
    
    const chartData = useMemo(() => {
        const statusCounts = todaysOrders.reduce((acc, o) => {
            acc[o.Status] = (acc[o.Status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({ name, orders: value }));
    }, [todaysOrders]);

    return (
        <div className="p-4 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-white">Good Morning, {businessName}</h1>
                <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Total Orders</p><p className="text-3xl font-bold text-white">{kpis.totalOrders}</p></div>
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Revenue Today</p><p className="text-3xl font-bold text-white">${kpis.revenueToday.toFixed(2)}</p></div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center"><p className="text-yellow-300 text-sm">In Progress</p><p className="text-3xl font-bold text-white">{kpis.inProgress}</p></div>
                {/* Make the "Ready for Delivery" a button */}
                <button onClick={() => setModal({ type: 'assignDelivery' })} className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50">
                    <p className="text-green-300 text-sm">Ready for Delivery</p>
                    <p className="text-3xl font-bold text-white">{kpis.readyForDelivery}</p>
                </button>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg shadow-md">
                 <h2 className="text-lg font-semibold text-white mb-4">Today's Order Status</h2>
                 <div style={{ width: '100%', height: 300 }}>
                    <Recharts.ResponsiveContainer>
                        <Recharts.BarChart data={chartData}>
                            <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
                            <Recharts.YAxis stroke="#94a3b8" />
                            <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                            <Recharts.Bar dataKey="orders" fill="#38bdf8" />
                        </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                 </div>
            </div>
        </div>
    );
};

const OrdersView = ({ allItems, setModal }) => {
    const [filter, setFilter] = useState('active');
    const orders = useMemo(() => allItems.filter(item => item.SortKey.startsWith('ORDER#') && !item.SortKey.includes('#ITEM#')), [allItems]);

    const filteredOrders = useMemo(() => {
        if (filter === 'active') return orders.filter(o => o.Status !== 'delivered' && o.Status !== 'cancelled');
        if (filter === 'all') return orders;
        return orders.filter(o => o.Status === filter);
    }, [orders, filter]);

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-white mb-4">Order Management</h1>
            <div className="flex space-x-2 mb-4">
                <button onClick={() => setFilter('active')} className={classNames(filter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
                <button onClick={() => setFilter('prepared')} className={classNames(filter === 'prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
                <button onClick={() => setFilter('all')} className={classNames(filter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
            </div>
            <div className="space-y-3">
                {filteredOrders.map(order => (
                    <div key={order.SortKey} onClick={() => setModal({ type: 'orderDetail', data: { order } })} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-700">
                        <div>
                            <p className="font-bold text-white">{order.OrderID}</p>
                            <p className="text-sm text-slate-400">{order.CustomerPhone}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-white">${order.TotalAmount.toFixed(2)}</p>
                            <span className={classNames(statusColors[order.Status], 'text-xs font-semibold px-2 py-0.5 rounded-full text-white')}>{order.Status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CustomersView = ({ customers, setModal }) => {
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold text-white mb-4">Customers</h1>
            <div className="space-y-3">
                {customers.map(customer => (
                    <div key={customer.SortKey} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{customer.CustomerName}</p>
                            <p className="text-sm text-slate-400">{customer.SortKey.split('#')[1]}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-400 text-sm">Total Orders</p>
                            <p className="font-bold text-white">{customer.TotalOrders}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Modal Components ---

const OrderDetailModal = ({ order, allItems, onClose }) => {
    const lineItems = useMemo(() => allItems.filter(item => item.SortKey.startsWith(`ORDER#${order.OrderID}#ITEM#`)), [allItems, order.OrderID]);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl animate-fade-in-up">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">{order.OrderID} Details</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="font-semibold text-white">Line Items</h3>
                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map(item => (
                                <li key={item.SortKey} className="flex justify-between text-sm">
                                    <span>{item.Quantity} x {item.ItemName}</span>
                                    <span>${item.UnitPrice.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
                        <span>Total Amount</span>
                        <span>${order.TotalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AssignDeliveryModal = ({ orders, deliveryAgents, onAssign, onClose }) => {
    const [selectedAgent, setSelectedAgent] = useState(deliveryAgents[0]?.id || '');
    const preparedOrders = useMemo(() => orders.filter(o => o.Status === 'prepared'), [orders]);
    const [selectedOrders, setSelectedOrders] = useState(() => preparedOrders.map(o => o.OrderID));

    const toggleOrderSelection = (orderId) => {
        setSelectedOrders(prev => 
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };

    const handleAssign = () => {
        if (!selectedAgent || selectedOrders.length === 0) return;
        onAssign(selectedAgent, selectedOrders);
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
                            {deliveryAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Select Orders to Assign</h3>
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                            {preparedOrders.map(order => (
                                <div key={order.OrderID} className="flex items-center bg-slate-700 p-2 rounded-md">
                                    <input 
                                        type="checkbox" 
                                        id={order.OrderID} 
                                        checked={selectedOrders.includes(order.OrderID)}
                                        onChange={() => toggleOrderSelection(order.OrderID)}
                                        className="h-4 w-4 rounded border-slate-500 text-sky-600 focus:ring-sky-500"
                                    />
                                    <label htmlFor={order.OrderID} className="ml-3 text-sm text-slate-200">{order.OrderID} ({order.ItemsNumber} items)</label>
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

import React from 'react';
import BusinessByStatus from  './components/BusinessByStatus';
import BusinessByEntity from './components/BusinessByEntity';
import AgentByStatus from './components/AgentByStatus';
import CustomerOrders from './components/CustomerOrders';
import './App.css';

function App() {
  return (
    <div className="container">
      <header>
        <h1>Business Data Queries</h1>
        <p>Results from all GSIs.</p>
      </header>
      <BusinessByStatus />
      <BusinessByEntity />
      <AgentByStatus />
      <CustomerOrders />
    </div>
  );
}

export default App;
import React from 'react';
import BusinessByStatus from  './components/BusinessByStatus';
import BusinessByEntity from './components/BusinessByEntity';
import AgentByStatus from './components/AgentByStatus';
import CustomerOrders from './components/CustomerOrders';
import './App.css';
import RecordsView from '../components/GlobalCustomerList';

interface AppProps {
  signOut: () => void;
  user: { username: string } | null;
}

function App({ signOut, user }: AppProps) {
  if (!user) {
    return <p>Please sign in to view data.</p>;
  }

  return (
    <div className="container">
      <header>
        <h1>Business Data Queries</h1>
        <p>Results from all GSIs. Signed in as {user.username}.</p>
        <button onClick={signOut}>Sign Out</button>
      </header>
      <BusinessByStatus user={user} client={client} />
      <CustomerOrders user={user} client={client} />
      <RecordsView user={user} client={client} />
    </div>
  );
}

export default App;
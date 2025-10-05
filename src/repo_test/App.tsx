import React from 'react';
import BusinessByStatus from  './components/BusinessByStatus';
import BusinessByEntity from './components/BusinessByEntity';
import AgentByStatus from './components/AgentByStatus';
import CustomerOrders from './components/CustomerOrders';
import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';

import { generateClient } from 'aws-amplify/data';

import type { Schema } from '../amplify/data/resource'; // Adjust path if needed

import './App.css';


const client = generateClient<Schema>({ authMode: "userPool" });

// Custom hook to fetch user attributes
function useUserAttributes() {
  const [userAttributes, setUserAttributes] = React.useState<FetchUserAttributesOutput | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const result = await fetchUserAttributes();
        setUserAttributes(result);
      } catch (error) {
        console.error('Failed to fetch user attributes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttributes();
  }, []);

  return { userAttributes, loading };
}

interface AppProps {
  signOut: () => void;
  user: { username: string  } | null;
}

function App({ signOut, user }: AppProps) {
  const { userAttributes, loading: attributesLoading } = useUserAttributes();

  if (!user) {
    return <p>Please sign in to view data.</p>;
  }

  if (attributesLoading) {
    return <p>Loading user details...</p>;
  }

  return (
    <div className="container">
      <header>
        <h1>Business Data Queries</h1>
        <p>Results from all GSIs. Signed in as {user.username}.</p>
        <p>User Email: {userAttributes?.email || 'N/A'}</p>
        <p>User Phone Number: {userAttributes?.phone_number || 'N/A'}</p>
        <button onClick={signOut}>Sign Out</button>
      </header>
      <BusinessByStatus user={user} client={client} />
      {/* <BusinessByEntity user={user} client={client} />
      <AgentByStatus user={user} client={client} />
      <CustomerOrders user={user} client={client} /> */}
    </div>
  );
}

export default App;
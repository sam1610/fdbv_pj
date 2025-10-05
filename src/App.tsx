import React from 'react';
import BusinessByStatus from './components/BusinessByStatus';
import CustomerOrders from './components/CustomerOrders';
import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource'; // Adjust path if needed
import './App.css';
import RecordsView from './components/GlobalCustomerList';

const client = generateClient<Schema>({ authMode: 'userPool' });

// Custom hook to fetch user attributes like email and phone number
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

// ✅ FIX: Updated the user prop interface to include userId (the 'sub')
interface AppProps {
  signOut: () => void;
  user: {
    username: string;
    userId: string; // The 'userId' from the authenticator is the Cognito 'sub'
  } | null;
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
        <p>Signed in as: {user.username}.</p>
        <p>User Email: {userAttributes?.email || 'N/A'}</p>
        <p>User Phone Number: {userAttributes?.phone_number || 'N/A'}</p>
        {/* ✅ NEW: Display the Cognito User ID (sub) */}
        <p className="user-sub">Cognito User ID (sub): {user.userId}</p>
        <button onClick={signOut}>Sign Out</button>
      </header>
      {/* Pass the full user object to child components that might need the ID */}
      <BusinessByStatus user={user} client={client} />
      <CustomerOrders user={user} client={client} />
      <RecordsView user={user} client={client} />
    </div>
  );
}

export default App;


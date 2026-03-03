
import React, { useEffect, useState } from 'react';
import { FetchUserAttributesOutput, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { client } from './DataHook/amplifyClient'; 
import './App.css';
import Dashboard from './components/Dashboard';
import AgentDashboard from './components/AgentDashboard'; 
import SuperAgentDashboard from './components/SuperAgentDashboard';
import { Amplify } from 'aws-amplify'; // ✅ Import Amplify
// import outputs from '../amplify_outputs.json'; // ✅ Import Outputs

// ✅ FIX 1: Configure at the top level to prevent "Not Configured" race conditions
// Amplify.configure(outputs);

// Fallback Default (Bahrain)
const DEFAULT_LOCATION = { latitude: 26.0935053, longitude: 50.48796 };

function useUserAttributes() {
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
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
  user: { username: string; userId: string; } | null;
}

function App({ signOut, user }: AppProps) {
  const { userAttributes, loading: attributesLoading } = useUserAttributes();
  const [appLoading, setAppLoading] = useState(true);
  const [userGroup, setUserGroup] = useState<string | null>(null); 
  
  // ✅ FIX 2: Initialize with DEFAULT_LOCATION instead of null
  // This ensures downstream components never receive null, preventing crashes/silent failures.
  const [startLocation, setStartLocation] = useState<any>(DEFAULT_LOCATION);

  // --- 1. Check User Group ---
  useEffect(() => {
    const checkGroup = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        
        if (groups.includes('ManaDeeb')) {
            setUserGroup('SUPER_AGENT');
        } else if (groups.includes('DeliveryAgents')) {
            setUserGroup('AGENT');
        } else {
            setUserGroup('ADMIN');
        }
      } catch (e) {
        console.error("Error checking groups", e);
        setUserGroup('ADMIN'); 
      }
    };
    checkGroup();
  }, []);

  // --- 2. Fetch Location ---
  useEffect(() => {
    // Wait for critical data
    if (!user || attributesLoading || userGroup === null) {
        return;
    }
    
    // ✅ FIX 3: Robust check for phone number
    // If phone is missing, we stop loading but keep the DEFAULT_LOCATION set above
    if (!userAttributes?.phone_number) {
        console.warn("No phone number found for user. Using default location.");
        setAppLoading(false);
        return;
    }

    const phone = userAttributes.phone_number;
    // console log email , name curretn user

    const initData = async () => {
      setAppLoading(true);
      try {
        let locationFound = null;

        if (userGroup === 'ADMIN') {
          // 🅰️ ADMIN
          const { data: config } = await client.models.BusinessData.get({
            pk: `BUSINESS#${phone}`,
            sk: "CONFIG",
          });
          if (config?.location) locationFound = config.location;

        } else if (userGroup === 'AGENT' || userGroup === 'SUPER_AGENT') {
          // 🅱️ AGENTS
          const { data: agentRecords } = await client.models.BusinessData.ByAgent({
             gsi1pk: `AGENT#${phone}`,
             sk: { eq: `AGENT#${phone}` } 
          });
          
          if (agentRecords.length > 0 && agentRecords[0].location) {
            locationFound = agentRecords[0].location;
          }
        }

        // ✅ FIX 4: Safe Parse logic
        if (locationFound) {
            const loc = typeof locationFound === 'string' ? JSON.parse(locationFound) : locationFound;
            setStartLocation(loc); // Update to real location
        } 
        // Note: If no location found, we do nothing, preserving DEFAULT_LOCATION

      } catch (err) {
        console.error("Error initializing app data:", err);
      } finally {
        setAppLoading(false);
      }
    };

    initData();
  }, [user, userAttributes, attributesLoading, userGroup]); 


  if (!user) return <p>Please sign in.</p>;
  if (attributesLoading || appLoading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading Cloud Order...</div>;

  return (
    <div className="App">
      {userGroup === 'SUPER_AGENT' ? (
        <SuperAgentDashboard 
          agentPhone={userAttributes?.phone_number}  
          businessLocation={startLocation} 
        />
      ) : userGroup === 'AGENT' ? (
        <AgentDashboard 
          agentPhone={userAttributes?.phone_number}  
          businessLocation={startLocation} 
          agentName={userAttributes?.email}
        />
      ) : (
        <Dashboard 
          phoneNbr={userAttributes?.phone_number} 
          businessLocation={startLocation} 
          
        />
      )}
    </div>
  );
}

export default App;



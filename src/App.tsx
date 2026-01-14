
// import React, { useEffect, useState } from 'react';
// import { FetchUserAttributesOutput, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
// import { client } from './DataHook/amplifyClient'; 
// import './App.css';
// import Dashboard from './components/Dashboard';
// import AgentDashboard from './components/AgentDashboard'; 

// // Fallback Default (Bahrain)
// const DEFAULT_LOCATION = { latitude: 26.0935053, longitude: 50.48796 };

// function useUserAttributes() {
//   const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null);
//   const [loading, setLoading] = React.useState(true);

//   React.useEffect(() => {
//     const fetchAttributes = async () => {
//       try {
//         const result = await fetchUserAttributes();
//         setUserAttributes(result);
//       } catch (error) {
//         console.error('Failed to fetch user attributes:', error);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchAttributes();
//   }, []);

//   return { userAttributes, loading };
// }

// interface AppProps {
//   signOut: () => void;
//   user: { username: string; userId: string; } | null;
// }

// function App({ signOut, user }: AppProps) {
//   const { userAttributes, loading: attributesLoading } = useUserAttributes();
//   const [appLoading, setAppLoading] = useState(true);
//   const [userGroup, setUserGroup] = useState<string | null>(null); 
//   const [startLocation, setStartLocation] = useState<any>(null);

//   // --- 1. Check User Group ---
//   useEffect(() => {
//     const checkGroup = async () => {
//       try {
//         const session = await fetchAuthSession();
//         const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
//         setUserGroup(groups.includes('DeliveryAgents') ? 'AGENT' : 'ADMIN');
//       } catch (e) {
//         console.error("Error checking groups", e);
//         setUserGroup('ADMIN'); 
//       }
//     };
//     checkGroup();
//   }, []);

//   // --- 2. Fetch Location (ZERO SCAN LOGIC) ---
//   useEffect(() => {
//     if (!user || !userAttributes?.phone_number || userGroup === null) {
//       if (!attributesLoading && userGroup !== null) setAppLoading(false);
//       return;
//     }

//     const phone = userAttributes.phone_number;

//     const initData = async () => {
//       setAppLoading(true);
//       try {
//         let locationFound = null;

//         if (userGroup === 'ADMIN') {
//           // 🅰️ ADMIN: Primary Key Lookup (Fastest)
//           // PK: BUSINESS#<phone>, SK: CONFIG
//           const { data: config } = await client.models.BusinessData.get({
//             pk: `BUSINESS#${phone}`,
//             sk: "CONFIG",
//           });
//           if (config?.location) locationFound = config.location;

//         } else if (userGroup === 'AGENT') {
//           // 🅱️ AGENT: GSI Query (Exact Match)
//           // Query "ByAgent" Index where:
//           // gsi1pk = AGENT#<phone> AND sk = AGENT#<phone>
//           // This avoids scanning the whole table.
//           const { data: agentRecords } = await client.models.BusinessData.ByAgent({
//              gsi1pk: `AGENT#${phone}`,
//              sk: { eq: `AGENT#${phone}` } // 🔥 EXACT MATCH on Sort Key
//           });

//           if (agentRecords.length > 0 && agentRecords[0].location) {
//             locationFound = agentRecords[0].location;
//             console.log("📍 Agent Profile Location Found:", locationFound);
//           }
//         }

//         // Set Location State
//         if (locationFound) {
//             const loc = typeof locationFound === 'string' ? JSON.parse(locationFound) : locationFound;
//             setStartLocation(loc);
//         } else {
//             // New businesses/agents might not have a record yet
//             console.log("ℹ️ No custom location found, using default.");
//             setStartLocation(DEFAULT_LOCATION);
//         }

//       } catch (err) {
//         console.error("Error initializing app data:", err);
//         setStartLocation(DEFAULT_LOCATION);
//       } finally {
//         setAppLoading(false);
//       }
//     };

//     initData();
//   }, [user, userAttributes, attributesLoading, userGroup]); 


//   if (!user) return <p>Please sign in.</p>;
//   if (attributesLoading || appLoading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading App...</div>;

//   return (
//     <div className="App">
//       <header>
//         <button onClick={signOut}>Sign Out</button> 
//       </header>
      
//       {userGroup === 'AGENT' ? (
//         <AgentDashboard 
//           agentPhone={userAttributes?.phone_number}  
//           agentEmail={userAttributes?.email}
//           initialLocation={startLocation} 
//         />
//       ) : (
//         <Dashboard 
//           phoneNbr={userAttributes?.phone_number} 
//           businessLocation={startLocation} 
//         />
//       )}
//     </div>
//   );
// }

// export default App;

import React, { useEffect, useState } from 'react';
import { FetchUserAttributesOutput, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { client } from './DataHook/amplifyClient'; 
import './App.css';
import Dashboard from './components/Dashboard';
import AgentDashboard from './components/AgentDashboard'; 
import SuperAgentDashboard from './components/SuperAgentDashboard';

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
  const [startLocation, setStartLocation] = useState<any>(null);

  // --- 1. Check User Group ---
  useEffect(() => {
    const checkGroup = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        
        // ✅ PRIORITY 1: Check for 'ManaDeeb' (Super Agent)
        if (groups.includes('ManaDeeb')) {
            console.log("User identified as SUPER_AGENT");
            setUserGroup('SUPER_AGENT');
        } 
        // ✅ PRIORITY 2: Check for 'DeliveryAgents' (Regular Agent)
        else if (groups.includes('DeliveryAgents')) {
            console.log("User identified as AGENT");
            setUserGroup('AGENT');
        } 
        // ✅ DEFAULT: Business Owner / Admin
        else {
            console.log("User identified as ADMIN");
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
    // Wait until we know who the user is
    if (!user || !userAttributes?.phone_number || userGroup === null) {
      if (!attributesLoading && userGroup !== null) setAppLoading(false);
      return;
    }

    const phone = userAttributes.phone_number;
    console.log("Fetching location for phone:", phone, "in group:", userGroup);

    const initData = async () => {
      setAppLoading(true);
      try {
        let locationFound = null;

        if (userGroup === 'ADMIN') {
          // 🅰️ ADMIN: Look for Business Config
          const { data: config } = await client.models.BusinessData.get({
            pk: `BUSINESS#${phone}`,
            sk: "CONFIG",
          });
          if (config?.location) locationFound = config.location;

        } else if (userGroup === 'AGENT' || userGroup === 'SUPER_AGENT') {
          // 🅱️ AGENT & SUPER AGENT: Look for Agent Profile
          // ✅ FIX: Use 'SUPER_AGENT' here to match the state, NOT 'ManaDeeb'
          const { data: agentRecords } = await client.models.BusinessData.ByAgent({
             gsi1pk: `AGENT#${phone}`,
             sk: { eq: `AGENT#${phone}` } 
          });
          
          if (agentRecords.length > 0 && agentRecords[0].location) {
            locationFound = agentRecords[0].location;
            console.log("📍 Agent Profile Location Found:", locationFound);
          }
        }

        // Set Location State
        if (locationFound) {
            const loc = typeof locationFound === 'string' ? JSON.parse(locationFound) : locationFound;
            setStartLocation(loc);
        } else {
            setStartLocation(DEFAULT_LOCATION);
        }

      } catch (err) {
        console.error("Error initializing app data:", err);
        setStartLocation(DEFAULT_LOCATION);
      } finally {
        setAppLoading(false);
      }
    };

    initData();
  }, [user, userAttributes, attributesLoading, userGroup]); 


  if (!user) return <p>Please sign in.</p>;
  if (attributesLoading || appLoading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading App...</div>;

  return (
    <div className="App">
      {/* <header>
        <button onClick={signOut}>Sign Out</button> 
      </header> */}
      
      {/* ✅ FIX: Route based on 'SUPER_AGENT' state */}
      {userGroup === 'SUPER_AGENT' ? (
        <SuperAgentDashboard 
          agentPhone={userAttributes?.phone_number}  
          businessLocation={startLocation} 
        />
      ) : userGroup === 'AGENT' ? (
        <AgentDashboard 
          agentPhone={userAttributes?.phone_number}  
          businessLocation={startLocation} 
        />
      ) : (
        <Dashboard 
          phoneNbr={userAttributes?.phone_number} 
          // Note: Dashboard expects 'restaurantLocation' prop in previous turns, 
          // but 'businessLocation' works if you updated Dashboard.jsx as discussed.
          // Using 'restaurantLocation' to be safe based on your Dashboard.jsx history.
          businessLocation={startLocation} 
        />
      )}
    </div>
  );
}

export default App;
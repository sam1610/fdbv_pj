

// import React, { useEffect, useState } from 'react';
// import { FetchUserAttributesOutput, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
// import { client } from './DataHook/amplifyClient'; 
// import './App.css';
// import Dashboard from './components/Dashboard';
// import AgentDashboard from './components/AgentDashboard'; // Import the new dashboard

// // Custom hook to fetch user attributes
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
//   user: {
//     username: string;
//     userId: string; 
//   } | null;
// }

// function App({ signOut, user }: AppProps) {
//   const { userAttributes, loading: attributesLoading } = useUserAttributes();
//   const [businessLoading, setBusinessLoading] = useState(true);
//   const [userGroup, setUserGroup] = useState<string | null>(null); // Track group: 'ADMIN' or 'AGENT'
//   const userEmail = userAttributes?.email || user?.signInDetails?.loginId;
//   // --- 1. Check User Group ---
//   useEffect(() => {
//     const checkGroup = async () => {
//       try {
//         const session = await fetchAuthSession();
//         const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        
//         if (groups.includes('DeliveryAgents')) {
//           setUserGroup('AGENT');
//         } else {
//           // Default to Admin/Business Owner if not explicitly an Agent
//           // You can add stricter checks here if needed (e.g., must be in 'Admins')
//           setUserGroup('ADMIN');
//         }
//       } catch (e) {
//         console.error("Error checking groups", e);
//       }
//     };
//     checkGroup();
//   }, []);

//   // --- 2. Business Profile Logic (Only for Admins) ---
//   useEffect(() => {
//     // If we don't know the group yet, or if it's an Agent, skip this check
//     if (!user || !userAttributes?.phone_number || userGroup === 'AGENT' || userGroup === null) {
//       if (!attributesLoading && userGroup !== null) {
//         setBusinessLoading(false);
//       }
//       return;
//     }

//     const phoneNbr = userAttributes.phone_number;
//     const businessPk = `BUSINESS#${phoneNbr}`;
//     const businessSk = "CONFIG";

//     const checkAndCreateBusiness = async () => {
//       setBusinessLoading(true);
//       try {
//         const { data: existingBusiness, errors } = await client.models.BusinessData.get({
//           pk: businessPk,
//           sk: businessSk,
      
//         });

//         if (errors) {
//           console.error("Error checking for business:", errors);
//           return;
//         }

//         if (!existingBusiness) {
//           console.log("Business not found, creating new one...");
//           await client.models.BusinessData.create({
//             pk: businessPk,
//             sk: businessSk,
//             entityType: 'Business',
//             businessOwnerId: user.userId,
//             businessPhone: phoneNbr,
//             name: user.username,
//           });
//           console.log("Business created successfully.");
//         } else {
//           console.log("Business profile already exists.");
//         }

//       } catch (err) {
//         console.error("Error in checkAndCreateBusiness:", err);
//       } finally {
//         setBusinessLoading(false);
//       }
//     };

//     checkAndCreateBusiness();

//   }, [user, userAttributes, attributesLoading, userGroup]); 

//   // --- Render Logic ---
//   if (!user) {
//     return <p>Please sign in to view data.</p>;
//   }

//   // Wait for all checks to finish
//   if (attributesLoading || (userGroup === 'ADMIN' && businessLoading) || userGroup === null) {
//     return <p className="p-4 text-center text-slate-400">Loading application...</p>;
//   }

//   return (
//     <div className="App">
//       {/* Header is shared, but you might want to simplify it for Agents */}
//       <header>
//         <button onClick={signOut}>Sign Out</button> 
//       </header>
      
//       {/* Route based on Group */}
//       {userGroup === 'AGENT' ? (
//         // Agents see their specific dashboard
//         <AgentDashboard agentPhone={userAttributes?.phone_number}  agentEmail={userAttributes?.email } />
//       ) : (
//         // Admins see the main dashboard
//         <Dashboard phoneNbr={userAttributes?.phone_number} />
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
        setUserGroup(groups.includes('DeliveryAgents') ? 'AGENT' : 'ADMIN');
      } catch (e) {
        console.error("Error checking groups", e);
        setUserGroup('ADMIN'); 
      }
    };
    checkGroup();
  }, []);

  // --- 2. Fetch Location (ZERO SCAN LOGIC) ---
  useEffect(() => {
    if (!user || !userAttributes?.phone_number || userGroup === null) {
      if (!attributesLoading && userGroup !== null) setAppLoading(false);
      return;
    }

    const phone = userAttributes.phone_number;

    const initData = async () => {
      setAppLoading(true);
      try {
        let locationFound = null;

        if (userGroup === 'ADMIN') {
          // 🅰️ ADMIN: Primary Key Lookup (Fastest)
          // PK: BUSINESS#<phone>, SK: CONFIG
          const { data: config } = await client.models.BusinessData.get({
            pk: `BUSINESS#${phone}`,
            sk: "CONFIG",
          });
          if (config?.location) locationFound = config.location;

        } else if (userGroup === 'AGENT') {
          // 🅱️ AGENT: GSI Query (Exact Match)
          // Query "ByAgent" Index where:
          // gsi1pk = AGENT#<phone> AND sk = AGENT#<phone>
          // This avoids scanning the whole table.
          const { data: agentRecords } = await client.models.BusinessData.ByAgent({
             gsi1pk: `AGENT#${phone}`,
             sk: { eq: `AGENT#${phone}` } // 🔥 EXACT MATCH on Sort Key
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
            // New businesses/agents might not have a record yet
            console.log("ℹ️ No custom location found, using default.");
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
      <header>
        <button onClick={signOut}>Sign Out</button> 
      </header>
      
      {userGroup === 'AGENT' ? (
        <AgentDashboard 
          agentPhone={userAttributes?.phone_number}  
          agentEmail={userAttributes?.email}
          initialLocation={startLocation} 
        />
      ) : (
        <Dashboard 
          phoneNbr={userAttributes?.phone_number} 
          restaurantLocation={startLocation} 
        />
      )}
    </div>
  );
}

export default App;
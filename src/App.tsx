

// import React, { useEffect, useState } from 'react';
// import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';
// import { client } from './DataHook/amplifyClient'; // Use shared client
// // No need to import Schema unless you use the type directly
// // import type { Schema } from '../amplify/data/resource'; 
// import './App.css';
// import Dashboard from './components/Dashboard';

// // Custom hook to fetch user attributes like email and phone number
// function useUserAttributes() {
//   const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null); // Added type
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
//     userId: string; // The 'userId' from the authenticator is the Cognito 'sub'
//   } | null;
// }

// function App({ signOut, user }: AppProps) {
//   const { userAttributes, loading: attributesLoading } = useUserAttributes();

//   // --- ✅ 1. Add state for the business profile check ---
//   const [businessLoading, setBusinessLoading] = useState(true);

//   // --- ✅ 2. Add useEffect to check-and-create the business profile ---
//   useEffect(() => {
//     // Don't run if we don't have the user or attributes yet
//     if (!user || !userAttributes?.phone_number) {
//       // If attributes are loaded but there's no phone number, stop loading
//       if (!attributesLoading) {
//         setBusinessLoading(false);
//         console.error("Cannot check business profile: User has no phone number.");
//       }
//       return;
//     }

//     const phoneNbr = userAttributes.phone_number;
//     const businessPk = `BUSINESS#${phoneNbr}`;
//     const businessSk = `BUSINESS#${phoneNbr}`; // The SK is the same as the PK

//     const checkAndCreateBusiness = async () => {
//       setBusinessLoading(true);
//       try {
//         // 1. Try to GET the record (much faster than 'list')
//         const { data: existingBusiness, errors } = await client.models.BusinessData.get({
//           pk: businessPk,
//           sk: businessSk
//         });

//         if (errors) {
//           console.error("Error checking for business:", errors);
//           return;
//         }

//         // 2. If 'data' is null, the record doesn't exist
//         if (!existingBusiness) {
//           console.log("Business not found, creating new one...");
          
//           // 3. Create the record
//           await client.models.BusinessData.create({
//             pk: businessPk,
//             sk: businessSk,
//             entityType: 'Business', // <-- You MUST provide this
//             businessOwnerId: user.userId, // The Cognito 'sub' ID
//             phone: phoneNbr,
//             name: user.username, // A good default
//             // Add any other default fields here
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

//   }, [user, userAttributes, attributesLoading]); // Runs when user and attributes are loaded

//   // --- Render Logic ---
//   if (!user) {
//     return <p>Please sign in to view data.</p>;
//   }

//   // Show a combined loading state
//   if (attributesLoading || businessLoading) {
//     return <p className="p-4 text-center text-slate-400">Loading user details...</p>;
//   }

//   return (
//     <div className="App">
//       <header>
//         <button onClick={signOut}>Sign Out</button> 
//         {/* <p className="user-sub">Cognito User ID (sub): {user.userId}</p>
//         <button onClick={signOut}>Sign Out</button> */}
//       </header>
      
//       {/* Pass the phone number to the dashboard */}
//       {/* It's safe to pass now because loading is complete */}
//       <Dashboard phoneNbr={userAttributes?.phone_number} />
//     </div>
//   );
// }

// export default App;

import React, { useEffect, useState } from 'react';
import { FetchUserAttributesOutput, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { client } from './DataHook/amplifyClient'; 
import './App.css';
import Dashboard from './components/Dashboard';
import AgentDashboard from './components/AgentDashboard'; // Import the new dashboard

// Custom hook to fetch user attributes
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
  user: {
    username: string;
    userId: string; 
  } | null;
}

function App({ signOut, user }: AppProps) {
  const { userAttributes, loading: attributesLoading } = useUserAttributes();
  const [businessLoading, setBusinessLoading] = useState(true);
  const [userGroup, setUserGroup] = useState<string | null>(null); // Track group: 'ADMIN' or 'AGENT'

  // --- 1. Check User Group ---
  useEffect(() => {
    const checkGroup = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || [];
        
        if (groups.includes('DeliveryAgents')) {
          setUserGroup('AGENT');
        } else {
          // Default to Admin/Business Owner if not explicitly an Agent
          // You can add stricter checks here if needed (e.g., must be in 'Admins')
          setUserGroup('ADMIN');
        }
      } catch (e) {
        console.error("Error checking groups", e);
      }
    };
    checkGroup();
  }, []);

  // --- 2. Business Profile Logic (Only for Admins) ---
  useEffect(() => {
    // If we don't know the group yet, or if it's an Agent, skip this check
    if (!user || !userAttributes?.phone_number || userGroup === 'AGENT' || userGroup === null) {
      if (!attributesLoading && userGroup !== null) {
        setBusinessLoading(false);
      }
      return;
    }

    const phoneNbr = userAttributes.phone_number;
    const businessPk = `BUSINESS#${phoneNbr}`;
    const businessSk = `BUSINESS#${phoneNbr}`;

    const checkAndCreateBusiness = async () => {
      setBusinessLoading(true);
      try {
        const { data: existingBusiness, errors } = await client.models.BusinessData.get({
          pk: businessPk,
          sk: businessSk
        });

        if (errors) {
          console.error("Error checking for business:", errors);
          return;
        }

        if (!existingBusiness) {
          console.log("Business not found, creating new one...");
          await client.models.BusinessData.create({
            pk: businessPk,
            sk: businessSk,
            entityType: 'Business',
            businessOwnerId: user.userId,
            phone: phoneNbr,
            name: user.username,
          });
          console.log("Business created successfully.");
        } else {
          console.log("Business profile already exists.");
        }

      } catch (err) {
        console.error("Error in checkAndCreateBusiness:", err);
      } finally {
        setBusinessLoading(false);
      }
    };

    checkAndCreateBusiness();

  }, [user, userAttributes, attributesLoading, userGroup]); 

  // --- Render Logic ---
  if (!user) {
    return <p>Please sign in to view data.</p>;
  }

  // Wait for all checks to finish
  if (attributesLoading || (userGroup === 'ADMIN' && businessLoading) || userGroup === null) {
    return <p className="p-4 text-center text-slate-400">Loading application...</p>;
  }

  return (
    <div className="App">
      {/* Header is shared, but you might want to simplify it for Agents */}
      <header>
        <button onClick={signOut}>Sign Out</button> 
      </header>
      
      {/* Route based on Group */}
      {userGroup === 'AGENT' ? (
        // Agents see their specific dashboard
        <AgentDashboard agentPhone={userAttributes?.phone_number} />
      ) : (
        // Admins see the main dashboard
        <Dashboard phoneNbr={userAttributes?.phone_number} />
      )}
    </div>
  );
}

export default App;
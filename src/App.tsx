// import React, {useEffect, useState} from 'react';
// import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';
// import { client } from './DataHook/amplifyClient'; // Use shared client
// import type { Schema } from '../amplify/data/resource'; // Adjust path if needed
// import './App.css';
// import Dashboard from './components/Dashboard';


// // Custom hook to fetch user attributes like email and phone number
// function useUserAttributes() {
//   const [userAttributes, setUserAttributes] = useState(null);
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

// // ✅ FIX: Updated the user prop interface to include userId (the 'sub')
// interface AppProps {
//   signOut: () => void;
//   user: {
//     username: string;
//     userId: string; // The 'userId' from the authenticator is the Cognito 'sub'
//   } | null;
// }

// function App({ signOut, user }: AppProps) {
//   const { userAttributes, loading: attributesLoading } = useUserAttributes();

//   if (!user) {
//     return <p>Please sign in to view data.</p>;
//   }

//   if (attributesLoading) {
//     return <p>Loading user details...</p>;
//   }

//   return (
//     <div className="App">
//       <header>
//         {/* <h1>Business Data Queries</h1>
//         <p>Signed in as: {user.username}.</p>
//         <p>User Email: {userAttributes?.email || 'N/A'}</p>
//         <p>User Phone Number: {userAttributes?.phone_number || 'N/A'}</p> */}
//         {/* ✅ NEW: Display the Cognito User ID (sub) */}
//         <p className="user-sub">Cognito User ID (sub): {user.userId}</p>
//         <button onClick={signOut}>Sign Out</button>
//       </header>
//       {/* Pass the full user object to child components that might need the ID */}
//       {/*  associte  "BUSINESS#" to the userAttributes?.phone_number  */}
//       {/* <BusinessByStatus user={user} client={client} phoneNbr={`BUSINESS#${userAttributes?.phone_number}`} /> */}
//       <Dashboard  phoneNbr={userAttributes?.phone_number} />
//       {/* <CustomerOrders user={user} client={client}/>
//       <B client={client}/> */}
//     </div>
//   );
// }

// export default App;

import React, { useEffect, useState } from 'react';
import { FetchUserAttributesOutput, fetchUserAttributes } from 'aws-amplify/auth';
import { client } from './DataHook/amplifyClient'; // Use shared client
// No need to import Schema unless you use the type directly
// import type { Schema } from '../amplify/data/resource'; 
import './App.css';
import Dashboard from './components/Dashboard';

// Custom hook to fetch user attributes like email and phone number
function useUserAttributes() {
  const [userAttributes, setUserAttributes] = useState<FetchUserAttributesOutput | null>(null); // Added type
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
    userId: string; // The 'userId' from the authenticator is the Cognito 'sub'
  } | null;
}

function App({ signOut, user }: AppProps) {
  const { userAttributes, loading: attributesLoading } = useUserAttributes();

  // --- ✅ 1. Add state for the business profile check ---
  const [businessLoading, setBusinessLoading] = useState(true);

  // --- ✅ 2. Add useEffect to check-and-create the business profile ---
  useEffect(() => {
    // Don't run if we don't have the user or attributes yet
    if (!user || !userAttributes?.phone_number) {
      // If attributes are loaded but there's no phone number, stop loading
      if (!attributesLoading) {
        setBusinessLoading(false);
        console.error("Cannot check business profile: User has no phone number.");
      }
      return;
    }

    const phoneNbr = userAttributes.phone_number;
    const businessPk = `BUSINESS#${phoneNbr}`;
    const businessSk = `BUSINESS#${phoneNbr}`; // The SK is the same as the PK

    const checkAndCreateBusiness = async () => {
      setBusinessLoading(true);
      try {
        // 1. Try to GET the record (much faster than 'list')
        const { data: existingBusiness, errors } = await client.models.BusinessData.get({
          pk: businessPk,
          sk: businessSk
        });

        if (errors) {
          console.error("Error checking for business:", errors);
          return;
        }

        // 2. If 'data' is null, the record doesn't exist
        if (!existingBusiness) {
          console.log("Business not found, creating new one...");
          
          // 3. Create the record
          await client.models.BusinessData.create({
            pk: businessPk,
            sk: businessSk,
            entityType: 'Business', // <-- You MUST provide this
            businessOwnerId: user.userId, // The Cognito 'sub' ID
            phone: phoneNbr,
            name: user.username, // A good default
            // Add any other default fields here
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

  }, [user, userAttributes, attributesLoading]); // Runs when user and attributes are loaded

  // --- Render Logic ---
  if (!user) {
    return <p>Please sign in to view data.</p>;
  }

  // Show a combined loading state
  if (attributesLoading || businessLoading) {
    return <p className="p-4 text-center text-slate-400">Loading user details...</p>;
  }

  return (
    <div className="App">
      <header>
        <button onClick={signOut}>Sign Out</button> 
        {/* <p className="user-sub">Cognito User ID (sub): {user.userId}</p>
        <button onClick={signOut}>Sign Out</button> */}
      </header>
      
      {/* Pass the phone number to the dashboard */}
      {/* It's safe to pass now because loading is complete */}
      <Dashboard phoneNbr={userAttributes?.phone_number} />
    </div>
  );
}

export default App;
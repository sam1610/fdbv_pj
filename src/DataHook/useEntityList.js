// import { useState, useEffect, useCallback } from 'react';
// import { client } from './amplifyClient';

// /**
//  * A simple, non-real-time hook to fetch a list of entities.
//  * It handles pagination and fetches data only on load or when params change.
//  */
// export const useEntityList = (queryParam, queryName= "list") => {
//   const [data, setData] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // prevent infinite loops from the parent component.
//   const serializedQueryParam = JSON.stringify(queryParam);

//   const fetchData = useCallback(async () => {
//     // We parse the params back inside the callback
//     const params = JSON.parse(serializedQueryParam);
//     // let apiMethod;
    
//     setLoading(true);
//     setError(null);
//     const apiMethod = client.models.BusinessData[queryName];
//     if (!apiMethod || typeof apiMethod !== 'function') {
//       const msg = `Invalid queryName: "${queryName}" does not exist on BusinessData model.`;
//       console.error(msg);
//       setError(msg);
//       setLoading(false);
//       return;
//     }

   

//     try {
//       const allRecords = [];
//       let nextToken = null;
      
//       // Loop to handle pagination automatically
//       do {
//         const response = await apiMethod({ ...params, nextToken });
//         allRecords.push(...(response.data || []));
//         nextToken = response.nextToken;
//       } while (nextToken);
      
//       setData(allRecords);
//     } catch (err) {
//       const msg = err.errors ? err.errors[0].message : 'An unknown error occurred.';
//       setError(`Failed to fetch data: ${msg}`);
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   }, [queryName, serializedQueryParam]); // Only re-create fetchData if queryName or params change

//   // This useEffect runs the fetchData function
//   useEffect(() => {
//     fetchData();
//   }, [fetchData]); // Only re-run the effect if the fetchData function itself changes

//   // Return the state and a manual refetch function
//   return { data, loading, error, refetch: fetchData };
// };


import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client
const client = generateClient({ authMode: 'apiKey' });

export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const serializedQueryParam = JSON.stringify(queryParam);

  const fetchData = useCallback(async () => {
    const params = JSON.parse(serializedQueryParam);
    setLoading(true);
    setError(null);
    
    try {
      let apiMethod;
      
      // 🟢 FIX 1: Route to the correct GSI defined in your schema
      if (queryName === "ByCustomer") {
        apiMethod = client.models.BusinessData.ByCustomer; 
      } else if (queryName === "ByAgent") {
        apiMethod = client.models.BusinessData.ByAgent; 
      } else {
        apiMethod = client.models.BusinessData[queryName] || client.models.BusinessData.list;
      }

      if (!apiMethod) throw new Error(`Query method ${queryName} not found.`);

      const allRecords = [];
      let nextToken = null;
      do {
        // Fetch data using the specific GSI (e.g., ByAgent)
        const response = await apiMethod({ ...params, nextToken });
        allRecords.push(...(response.data || []));
        nextToken = response.nextToken;
      } while (nextToken);
      
      setData(allRecords);
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  }, [queryName, serializedQueryParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🟢 FIX 2: Strict Real-Time Subscriptions
  useEffect(() => {
    const params = JSON.parse(serializedQueryParam);
    const subscriptions = [];

    // Base filter: We only care about Orders
    const subFilter = { entityType: { eq: 'Order' } };
    
    // IMPORTANT: If querying ByAgent, STRICTLY filter the real-time updates to this Agent's ID!
    if (queryName === "ByAgent" && params.gsi1pk) {
        subFilter.gsi1pk = { eq: params.gsi1pk };
    }

    // 1. Subscription for UPDATED items
    subscriptions.push(
      client.models.BusinessData.onUpdate({ filter: subFilter }).subscribe({
        next: (updatedItem) => {
          setData(prevData => {
              // If the order is already in the list, update its values
              if (prevData.some(item => item.sk === updatedItem.sk)) {
                  return prevData.map(item => item.sk === updatedItem.sk ? { ...item, ...updatedItem } : item);
              }
              // If the order was just ASSIGNED to this agent, add it to the list
              if (queryName === "ByAgent" && updatedItem.gsi1pk === params.gsi1pk) {
                  return [updatedItem, ...prevData];
              }
              return prevData;
          });
        }
      })
    );

    // 2. Subscription for CREATED items
    subscriptions.push(
      client.models.BusinessData.onCreate({ filter: subFilter }).subscribe({
        next: (newItem) => {
          setData(prevData => [newItem, ...prevData]);
        }
      })
    );

    // 3. Subscription for DELETED items
    subscriptions.push(
      client.models.BusinessData.onDelete({ filter: subFilter }).subscribe({
        next: (deletedItem) => {
          setData(prevData => prevData.filter(item => item.sk !== deletedItem.sk));
        }
      })
    );
    
    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [serializedQueryParam, queryName]);

  return { data, loading, error, refetch: fetchData };
};
import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client once.
const client = generateClient({ authMode: 'userPool' });

export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const serializedQueryParam = JSON.stringify(queryParam);

  const fetchData = useCallback(async () => {
    const params = JSON.parse(serializedQueryParam);
    let apiMethod;
    setLoading(true);
    setError(null);
    
    if (queryName === "ByCustomer") {
      apiMethod = client.models.BusinessData.listBusinessDataByGsi2pkAndSk;
    } else  {
      apiMethod = client.models.BusinessData[queryName];
    }

    try {
      const allRecords = [];
      let nextToken = null;
      do {
        const response = await apiMethod({ ...params, nextToken });
        allRecords.push(...(response.data || []));
        nextToken = response.nextToken;
      } while (nextToken);
      setData(allRecords);
    } catch (err) {
      const msg = err.errors ? err.errors[0].message : 'An unknown error occurred.';
      setError(`Failed to fetch data: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [queryName, serializedQueryParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


//  subscribe to real-time create  for the relevant entity type
useEffect(() => {
  // Use observeQuery to get initial data AND subscribe to changes
  const observer = client.models.BusinessData.observeQuery({
    filter: {
      entityType: { eq: 'Order' }
    }
  });

  // This one subscription handles create, update, delete, and initial load
  const sub = observer.subscribe({
    next: ({ items }) => {
      // 'items' is the full, real-time list of orders.
      // Sort them by date to show the newest first.
      const sortedItems = [...items].sort((a, b) => 
        (b.orderDate || '').localeCompare(a.orderDate || '')
      );
      setData(sortedItems);
      console.log('Real-time data synced:', sortedItems);
    },
    error: (err) => {
      console.error('observeQuery subscription error:', err);
    }
  });

  // Return a cleanup function to unsubscribe when the component unmounts
  return () => {
    sub.unsubscribe();
  };

}, []); // Empty array means this runs once when the component mounts
// 


  
  // ✅ MODIFIED: This useEffect now handles create, update, and delete events.
  useEffect(() => {
    const isOrderQuery = serializedQueryParam.includes('ORDER#');
    if (!isOrderQuery) return;

    const subscriptions = [];

    // 1. Subscription for UPDATED items
    subscriptions.push(
      client.models.BusinessData.onUpdate({
        filter: { entityType: { eq: 'Order' } }
      }).subscribe({
        next: (updatedItem) => {
          console.log('Order updated:', updatedItem);
          // Merges the update into the existing list
          setData(prevData => prevData.map(item => 
            item.sk === updatedItem.sk ? { ...item, ...updatedItem } : item
          ));
        }
      })
    );

   // 2. Subscription for CREATED items
// subscriptions.push(
//   client.models.BusinessData.onCreate().subscribe({  // Removed filter
//     next: (newItem) => {
//       setData(prevData => [newItem, ...prevData]);
    
//     },
//     error: (error) => console.error('Subscription error:', error),
//   })
// );

// 3. Subscription for DELETED items
subscriptions.push(
  client.models.BusinessData.onDelete().subscribe({  // Removed filter
    next: (deletedItem) => {
    setData(prevData => prevData.filter(item => item.sk !== deletedItem.sk));
    },
    error: (error) => console.error('Subscription error:', error),
  })
);
    
    // Cleanup all subscriptions on component unmount
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [serializedQueryParam]); // Re-subscribe if the query changes


// //  Test mutation: Update an orderStatus after 10 seconds (for demonstration)
  // useEffect(() => {
  //   const timer = setTimeout(async () => {
  //     try {
  //       const updatedOrder = await client.models.BusinessData.update({
  //         pk: 'BUSINESS#+97333787388',  // From your screenshot; adjust if needed
  //         sk: 'ORDER#2025-11-08T15:55:09.200Z',  // Adjust to a valid order SK from your data
  //         orderStatus: 'PREPARED'  // Your new value
  //       });
  //       console.log('Test mutation executed:', updatedOrder);
  //     } catch (mutationErr) {
  //       console.error('Mutation error:', mutationErr);
  //     }
  //   }, 30000);  // 10 seconds delay

  //   // Cleanup timer on unmount
  //   return () => clearTimeout(timer);
  // }, []);  // Empty dependency: Runs once on mount

// // Test mutation: Create a new order after 10 seconds (for demonstration)
// useEffect(() => {
//   const timer = setTimeout(async () => {
//     try {
//       // Generate a unique SK for the new order using current timestamp
//       const timestamp = new Date().toISOString();
//       const newOrder = await client.models.BusinessData.create({
//         pk: 'BUSINESS#+97333787388',  // Business identifier
//         sk: `ORDER#${timestamp}`,      // Unique order identifier with timestamp
//         orderStatus: 'ORDERED',        // Initial status for new order
//         gsi2pk: 'CUSTOMER#+97333787388#+97311122255',
//         totalAmount: 29.99,
//         orderDate: timestamp,
//         entityType: 'Order',
//         itemsNbr: 3,

//         // ... other necessary fields
//       });
//       console.log('Test mutation executed - New order created:', newOrder);
//     } catch (mutationErr) {
//       console.error('Mutation error:', mutationErr);
//     }
//   }, 30000);  // 10 seconds delay

//   // Cleanup timer on unmount
//   return () => clearTimeout(timer);
// }, []);  // Empty dependency: Runs once on mount

  return { data, loading, error, refetch: fetchData };
};
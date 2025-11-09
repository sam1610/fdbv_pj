import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';

// const client = generateClient({ authMode: 'userPool' });
const client = generateClient({ authMode: 'apiKey' });


export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const serializedQueryParam = JSON.stringify(queryParam);

  // Keep fetchData for manual refetches if needed
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

  // SINGLE useEffect for real-time data
  useEffect(() => {
    setLoading(true);
    
    // Use observeQuery for both initial load AND real-time updates
    const observer = client.models.BusinessData.observeQuery({
      filter: {
        entityType: { eq: 'Order' }
        // Add your specific filters based on queryParam if needed
      }
    });

    const sub = observer.subscribe({
      next: ({ items }) => {
        // Sort by date (newest first)
        const sortedItems = [...items].sort((a, b) => 
          (b.orderDate || '').localeCompare(a.orderDate || '')
        );
        setData(sortedItems);
        setLoading(false);
        console.log('Real-time data synced:', sortedItems);
      },
      error: (err) => {
        console.error('observeQuery subscription error:', err);
        setError(`Real-time sync failed: ${err.message}`);
        setLoading(false);
      }
    });

    // Cleanup subscription
    return () => {
      sub.unsubscribe();
    };
  }, [serializedQueryParam]); // Re-subscribe when query changes
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

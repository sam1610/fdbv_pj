import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client once. It can be shared across all hooks and components.
const client = generateClient({ authMode: 'userPool' });
export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ FIX: We serialize the queryParam object to create a stable dependency string.
  // This is the key to preventing the infinite loop.
  const serializedQueryParam = JSON.stringify(queryParam);
  const fetchData = useCallback(async () => {
    // The hook now receives a serialized string, so we parse it back into an object.
    const params = JSON.parse(serializedQueryParam);
    console.log( client.models.BusinessData[`listBusinessDatasBy${queryName}`])
    // console.log(Object.keys(client.models.BusinessData).filter(key => key.startsWith('listBusinessData')));

    let apiMethod  ;

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
        const response = await apiMethod({
          ...params,
          nextToken: nextToken,
        });

        const items = response.data || [];
        allRecords.push(...items);
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

  // This useEffect now depends on the stable, serialized string.
  // It will only re-run when the query parameters actually change.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

// 
useEffect(() => {
    // Subscribe only if the query involves orders (e.g., sk beginsWith 'ORDER#')
    const isOrderQuery = serializedQueryParam.includes('ORDER#');
    if (!isOrderQuery) return;

    const sub = client.models.BusinessData.onUpdate({
      // Server-side filter to only trigger for Order entityType
      filter: { entityType: { eq: 'Order' } }
    }).subscribe({
      next: (updatedItem) => {
        if (updatedItem.orderStatus) {
          console.log(`Order status updated for order ${updatedItem.sk}: New status - ${updatedItem.orderStatus}`);
          
          // Merge update into local state (optimistic update)
          setData(prevData => prevData.map(item => 
            item.sk === updatedItem.sk ? { ...item, ...updatedItem } : item
          ));
        }
      },
      error: (err) => {
        console.error('Subscription error:', err);
      }
    });

    // Cleanup subscription on unmount
    return () => sub.unsubscribe();
  }, [serializedQueryParam]); // Re-subscribe if query params change

 
  
// 
// Real-time subscription for new Order creations
  useEffect(() => {
    // Subscribe only if the query involves orders (e.g., sk beginsWith 'ORDER#')
    const isOrderQuery = serializedQueryParam.includes('ORDER#');
    if (!isOrderQuery) return;

    const createSub = client.models.BusinessData.onCreate({
      // Server-side filter to only trigger for Order entityType
      filter: { entityType: { eq: 'Order' } }
    }).subscribe({
      next: (newItem) => {
        console.log(`New order created: ${newItem.sk}`);
        
        // Append new item to local state (optimistic update)
        setData(prevData => [...prevData, newItem]);
      },
      error: (err) => {
        console.error('Create subscription error:', err);
      }
    });

    // Cleanup subscription on unmount
    return () => createSub.unsubscribe();
  }, [serializedQueryParam]); // Re-subscribe if query params change
  //
 // Test mutation: Update an orderStatus after 10 seconds (for demonstration)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const updatedOrder = await client.models.BusinessData.update({
          pk: 'BUSINESS#+97333787388',  // From your screenshot; adjust if needed
          sk: 'ORDER#2025-10-12T15:30:00.000Z',  // Adjust to a valid order SK from your data
          orderStatus: 'DELIVERING'  // Your new value
        });
        console.log('Test mutation executed:', updatedOrder);
      } catch (mutationErr) {
        console.error('Mutation error:', mutationErr);
      }
    }, 10000);  // 10 seconds delay

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, []);  // Empty dependency: Runs once on mount

  return { data, loading, error, refetch: fetchData };
};


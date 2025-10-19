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

    // 2. ✅ NEW: Subscription for CREATED items
    subscriptions.push(
      client.models.BusinessData.onCreate({
        filter: { entityType: { eq: 'Order' } }
      }).subscribe({
        next: (newItem) => {
          console.log('New order created:', newItem);
          // Adds the new item to the top of the list.
          // Note: This doesn't check if the new item matches the current filter.
          // For maximum accuracy, you could trigger a full refetch instead.
          setData(prevData => [newItem, ...prevData]);
        }
      })
    );

    // 3. ✅ NEW: Subscription for DELETED items
    subscriptions.push(
      client.models.BusinessData.onDelete({
        filter: { entityType: { eq: 'Order' } }
      }).subscribe({
        next: (deletedItem) => {
          console.log('Order deleted:', deletedItem);
          // Removes the deleted item from the list
          setData(prevData => prevData.filter(item => item.sk !== deletedItem.sk));
        }
      })
    );
    
    // Cleanup all subscriptions on component unmount
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [serializedQueryParam]); // Re-subscribe if the query changes

  return { data, loading, error, refetch: fetchData };
};
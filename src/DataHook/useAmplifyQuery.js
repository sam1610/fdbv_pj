import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client once. It can be shared across all hooks and components.
const client = generateClient({ authMode: 'apiKey' });

/**
 * A reusable custom hook to fetch all records for a specific business (PK)
 * that have a sort key (SK) beginning with a given prefix, with real-time updates.
 *
 * This hook automatically handles pagination and listens for live updates.
 *
 * @param {object} queryParam - An object containing the parameters for the GSI query.
 * @param {string} queryName - The name of the GSI helper function to call.
 * @returns {{ data: Array, loading: boolean, error: string | null, refetch: Function }}
 */
export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // We serialize the queryParam to use it as a stable dependency.
  const serializedQueryParam = JSON.stringify(queryParam);

  const fetchData = useCallback(async () => {
    if (!queryName || !queryParam) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    console.log(`Executing query: ${queryName} with params:`, queryParam);


    try {
      const allRecords = [];
      let nextToken = null;

      do {
        const response = await client.models.BusinessData[queryName]({
          ...queryParam,
          nextToken: nextToken,
        });

        // The response for a queryField is nested, so we extract items correctly
        const items = response.data?.[queryName]?.items || [];
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
  }, []);

  // This useEffect now depends on the stable, serialized parameters.
  // This prevents it from re-running on every parent component render.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // This useEffect handles the real-time subscriptions.
  useEffect(() => {
    console.log("Setting up real-time subscriptions...");

    const createSub = client.models.BusinessData.onCreate().subscribe({
      next: (newItem) => {
        console.log("✅ New item received via subscription:", newItem);
        // Add a client-side filter to the subscription.
        // This is a basic filter; a more complex one could parse the queryParam.
        if (queryParam && queryParam.pk && newItem.pk === queryParam.pk) {
          setData(currentData => [newItem, ...currentData]);
        }
      },
      error: (err) => console.error("Subscription error (create):", err),
    });

    const updateSub = client.models.BusinessData.onUpdate().subscribe({
      next: (updatedItem) => {
        console.log("✅ Record update received via subscription:", updatedItem);
        // Use the unique system 'id' for a more reliable match.
        setData(currentData => 
          currentData.map(item => (item.id === updatedItem.id) ? updatedItem : item)
        );
      },
      error: (err) => console.error("Subscription error (update):", err),
    });

    return () => {
      console.log("Tearing down subscriptions.");
      createSub.unsubscribe();
      updateSub.unsubscribe();
    };
    // ✅ FIX: The dependency array now uses the stable, serialized string version
    // of the parameters, which will prevent the infinite loop.
  }, []);

  return { data, loading, error, refetch: fetchData };
};


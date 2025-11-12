import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client once. It can be shared across all hooks and components.
const client = generateClient({ authMode: 'userPool' });

/**
 * A reusable custom hook to fetch all records for a specific business (PK)
 * that match a sort key (SK) prefix, with real-time updates using observeQuery.
 *
 * @param {object} queryParam - An object containing the parameters for the GSI query.
 * @param {string} queryName - The name of the GSI helper function to call.
 * @returns {{ data: Array, loading: boolean, error: string | null }}
 */
export const BusinessDataOrderHook = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // We serialize the queryParam object to use it as a stable dependency in our effects.
  const serializedQueryParam = JSON.stringify(queryParam);

  // This useEffect now handles both the initial fetch and the real-time subscription.
  useEffect(() => {

    setLoading(true);
    setError(null);
    console.log(`Setting up observeQuery for: ${queryName}`);

    // Access the GSI helper function dynamically using its string name
    const apiMethod = client.models.BusinessData[queryName];
    if (typeof apiMethod !== 'function') {
      const msg = `Query method "${queryName}" does not exist.`;
      setError(msg);
      setLoading(false);
      console.error(msg);
      return;
    }

    // Use observeQuery to get real-time updates for the query.
    const sub = apiMethod(queryParam).observe().subscribe({
      next: ({ items, isSynced }) => {
        console.log("✅ Subscription data received:", items);
        setData([...items]); // Replace the local state with the new, complete list
        
        // isSynced is true when the initial query is complete.
        if (isSynced) {
          setLoading(false);
        }
      },
      error: (err) => {
        const msg = err.errors ? err.errors[0].message : 'An unknown error occurred.';
        setError(`Failed to observe query: ${msg}`);
        setLoading(false);
        console.error(err);
      },
    });

    // This is the cleanup function. It's critical for preventing memory leaks.
    return () => {
      console.log("Tearing down subscription.");
      sub.unsubscribe();
    };
  }, [queryName, serializedQueryParam]); // Re-subscribe if the query itself changes.

  return { data, loading, error };
};


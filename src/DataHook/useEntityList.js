import { useState, useEffect, useCallback } from 'react';
import { client } from './amplifyClient';

/**
 * A simple, non-real-time hook to fetch a list of entities.
 * It handles pagination and fetches data only on load or when params change.
 */
export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Serialize the query parameters to create a stable dependency.
  // This is a great solution to prevent infinite loops from the parent component.
  const serializedQueryParam = JSON.stringify(queryParam);

  const fetchData = useCallback(async () => {
    // We parse the params back inside the callback
    const params = JSON.parse(serializedQueryParam);
    let apiMethod;
    
    setLoading(true);
    setError(null);
    
    // Determine which API method to call (primary index or GSI)
    if (queryName === "ByCustomer") {
      apiMethod = client.models.BusinessData.listBusinessDataByGsi2pkAndSk;
    } else {
      // Assumes queryName is a valid key like "list"
      apiMethod = client.models.BusinessData[queryName];
    }

    // Check if the apiMethod is valid before proceeding
    if (!apiMethod || typeof apiMethod !== 'function') {
      setError(`Failed to fetch data: Invalid queryName "${queryName}"`);
      console.error(`Invalid queryName: ${queryName}`);
      setLoading(false);
      return;
    }

    try {
      const allRecords = [];
      let nextToken = null;
      
      // Loop to handle pagination automatically
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
  }, [queryName, serializedQueryParam]); // Only re-create fetchData if queryName or params change

  // This useEffect runs the fetchData function
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Only re-run the effect if the fetchData function itself changes

  // Return the state and a manual refetch function
  return { data, loading, error, refetch: fetchData };
};
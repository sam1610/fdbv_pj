import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client once. It can be shared across all hooks and components.
const client = generateClient({ authMode: 'apiKey' });

/**
 * A reusable custom hook to fetch all records for a specific business (PK)
 * that have a sort key (SK) beginning with a given prefix.
 *
 * This hook automatically handles pagination to fetch the complete dataset.
 *
 * @param {string | null} phoneNbr - The phone number of the business owner, used to construct the PK.
 * @param {string} skPrefix - The prefix for the sort key to filter by (e.g., 'ORDER#', 'CUSTOMER#').
 * @returns {{ data: Array, loading: boolean, error: string | null, refetch: Function }}
 */
export const useEntityList = (pkPrefix, skPrefix, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  console.log("useEntityList Params:", { pkPrefix, skPrefix, queryName });
  const fetchData = useCallback(async () => {


    setLoading(true);
    setError(null);

    try {
      const allRecords = [];
      let nextToken = null;
      const pk = pkPrefix ; //`BUSINESS#${phoneNbr}`;
      const apiMethod = client.models.BusinessData[queryName];

      // Loop to fetch all pages of data automatically
      do {
        const response = await apiMethod({
          pk: pk,
          sk: { beginsWith: skPrefix }, // Use the dynamic prefix
          nextToken: nextToken,
        });

        const items = response.data || [];
        allRecords.push(...items);
        nextToken = response.nextToken;
      } while (nextToken);

      // console.log(`Fetched ${allRecords.length} items for PK=${pk} and SK prefix=${skPrefix}`, allRecords);
      setData(allRecords);
      console.log("allRecords:", allRecords);

    } catch (err) {
      const msg = err.errors ? err.errors[0].message : 'An unknown error occurred.';
      setError(`Failed to fetch data: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pkPrefix, skPrefix, queryName]); // The query logic depends on these two values

  // Automatically fetch data when the component mounts or the filter criteria change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Return the state and a 'refetch' function for manual refreshes
  return { data, loading, error, refetch: fetchData };
};

import { useState, useCallback, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';

// This client can be initialized once here.
const client = generateClient({ authMode: 'userPool' });

/**
 * A custom hook to fetch ALL orders for a specific business within the last 24 hours.
 * This version fetches all pages of data automatically.
 * @param {string | null} phoneNbr - The business ID (phone number) of the admin.
 */
export const useOrdersByStatus = (phoneNbr) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    // Don't attempt to fetch if the business ID isn't available yet.
    if (!phoneNbr) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allOrders = [];
      let nextToken = null;

      // 1. Calculate the time range for the last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 7 * 60 * 60 * 1000);

      // 2. Construct the GSI keys for a targeted 'between' query
      const gsi1pk = `BUSINESS#${phoneNbr}`;
      // We create a start and end range for the sort key to get all statuses in the time window
      const startKey = `ORDER#${twentyFourHoursAgo.toISOString()}`;
      const endKey = `ORDER#${now.toISOString()}`;

      // 3. Loop to fetch all pages of data automatically
      do {
        const response = await client.models.BusinessData.listByBusinessByStatus({
          gsi1pk: gsi1pk,
          gsi1sk: {
            between: [startKey, endKey]
          },
          nextToken: nextToken, // Pass the token from the previous iteration
          sortDirection: 'DESC', // Get the newest orders first
        });

        const items = response.data || [];
        allOrders.push(...items); // Add the fetched items to our results array
        nextToken = response.nextToken; // Get the token for the next page, if it exists

      } while (nextToken); // Continue looping as long as there is a nextToken

      // 4. Set the final, complete list of orders
      setOrders(allOrders);

    } catch (e) {
      const msg = e.errors ? e.errors[0].message : 'An unknown error occurred.';
      setError(`Failed to fetch orders: ${msg}`);
      console.error('Error fetching byBusinessByStatus:', e);
    } finally {
      setLoading(false);
    }
  }, [phoneNbr]); // The query logic depends on the phoneNbr

  // Automatically trigger the fetch when the component mounts or phoneNbr changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Return only the essential state and the fetchData function for manual refetches
  return { orders, loading, error, fetchData };
};
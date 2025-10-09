import { useState, useCallback } from 'react';

/**
 * A custom hook to fetch all orders for a specific business within the last 24 hours,
 * filterable by status, and with support for pagination.
 * @param {object} client - The initialized Amplify Data client.
 * @param {string | null} phoneNbr - The business ID (phone number) of the admin.
 * @param {string} status - The order status to filter by (e.g., 'PREPARED').
 */
export const useBusinessByStatus = (client, phoneNbr) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchData = useCallback(async (token = null) => {
    // Don't attempt to fetch if the business ID isn't available yet.
    if (!phoneNbr) {
      setLoading(false);
      return;
    }

    token ? setLoadingMore(true) : setLoading(true);
    setError(null);

    try {
      // 1. Calculate the time range for the last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 2. Construct the GSI keys for a targeted 'between' query
      // ✅ FIX: Use the 'phoneNbr' parameter instead of the undefined 'businessId'
      const gsi1pk = `BUSINESS#${phoneNbr}`;
      const startKey = `ORDER#${twentyFourHoursAgo.toISOString()}`;
      const endKey = `ORDER#${now.toISOString()}`;

      // 3. Fetch a page of orders using the GSI
      const response = await client.models.BusinessData.listByBusinessByStatus({
        gsi1pk: gsi1pk,
        gsi1sk: {
          between: [startKey, endKey]
        },
        limit: 10, // A reasonable page size
        nextToken: token,
        sortDirection: 'DESC', // Get the newest orders first
      });

      const newOrders = response.data || [];
      // If a token was used, we are loading more, so append the new data.
      // Otherwise, it's a new fetch, so replace the data.
      setOrders(prev => token ? [...prev, ...newOrders] : newOrders);
      
      const nextTokenResult = response.nextToken;
      setNextToken(nextTokenResult || null);
      setHasMore(!!nextTokenResult);

    } catch (e) {
      const msg = e.errors ? e.errors[0].message : 'An unknown error occurred.';
      setError(`Failed to fetch orders: ${msg}`);
      console.error('Error fetching byBusinessByStatus:', e);
    } finally {
      token ? setLoadingMore(false) : setLoading(false);
    }
  }, [client, phoneNbr, ]); // The query logic depends on these three values

  // This function is called by the UI to load the next page
  const loadMore = () => {
    if (nextToken && !loadingMore) {
      fetchData(nextToken);
    }
  };

  // Return all the state and functions needed for a component to render a complete UI
  return { orders, loading, loadingMore, hasMore, error, loadMore, fetchData };
};

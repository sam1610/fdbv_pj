import { useState, useEffect } from 'react';

export const useOrderStatus = (client, phoneNbr) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Calculate the time range for the last 24 hours
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 2. Construct the query parameters using phoneNbr for pk
        const pk = `BUSINESS#+${phoneNbr}`; // Use the phoneNbr parameter dynamically
        const startKey = `ORDER#${twentyFourHoursAgo.toISOString().split('.')[0]}Z`; // Truncate to seconds
        const endKey = `ORDER#${now.toISOString().split('.')[0]}Z`; // Truncate to seconds

        const response = await client.models.BusinessData.listBusinessDatasByPkAndSk({
          pk: pk, // Dynamic pk based on phoneNbr
          sk: {
            between: [startKey, endKey] // Use between for 24-hour range
          },
          limit: 10,
          sortDirection: 'DESC'
        });

        setOrders(response.data?.listBusinessDatasByPkAndSk?.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (phoneNbr) {
      fetchData();
    } else {
      setLoading(false); // Avoid fetch if no phoneNbr
      setError("No phone number provided");
    }
  }, [phoneNbr, client]); // Add phoneNbr and client as dependencies

  return { orders, loading, error };
};
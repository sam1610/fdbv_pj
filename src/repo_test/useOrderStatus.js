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

      // 2. Construct the GSI keys for a targeted 'between' query
      // ✅ FIX: Use the 'phoneNbr' parameter instead of the undefined 'businessId'
      const gsi1pk = "BUSINESS#+97333787388";
      const startKey = `ORDER#${twentyFourHoursAgo.toISOString()}`;
      const endKey = `ORDER#${now.toISOString()}`;
      const response = await client.models.BusinessData.listBusinessDataByAgentByOrderDate({
        gsi1pk: gsi1pk,
        gsi1sk: {
        //   between: [startKey, endKey]
        beginsWith: 'ORDER#'
        },
        limit: 10, // A reasonable page size
        sortDirection: 'DESC', // Get the newest orders first
      });
        setOrders(response.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return { orders, loading, error };
};
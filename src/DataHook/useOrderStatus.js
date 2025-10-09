import { useState, useEffect } from 'react';

export const useOrderStatus = (client, phoneNbr) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Calculate 24-hour range
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const pk =`BUSINESS#+${phoneNbr}`;
        const startKey = `ORDER#${twentyFourHoursAgo.toISOString().split('.')[0]}Z`; // ISO format matching your sk
        const endKey = `ORDER#${now.toISOString().split('.')[0]}Z`;

        const response = await client.models.BusinessData.listBusinessDataByPkAndSk({  // Or listBusinessDataByPkAndSk if no 's'
          pk: pk,
          sk: { beginsWith: "ORDER#"
            // between: [startKey, endKey]  // Efficient range for last 24 hours
          },
          limit: 10,
          sortDirection: 'DESC'
        });

        setOrders(response.items || []);  // Use .items for the array of results
        console.log("Fetched Orders:", response.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (phoneNbr) {
      fetchData();
    } else {
      setLoading(false);
      setError("No phone number provided");
    }
  }, [phoneNbr, client]);  // Re-run on changes

  return { orders, loading, error };
};
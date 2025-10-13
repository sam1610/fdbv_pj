import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';

// Initialize the Amplify client
const client = generateClient({ authMode: 'userPool' });

/**
 * A simple React hook that fetches all orders for a specific business
 * by querying the table's primary key.
 * @param {string} businessId - The ID of the business to fetch orders for (e.g., 'B123').
 * @returns {{ orders: Array, loading: boolean, error: object|null }}
 */
function BusinessDataOrderHook(phoneNbr="+97333787388") {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Return early if the businessId is not yet available
 
    const fetchOrdersForBusiness = async () => {
      setLoading(true);
      setError(null);
      try {
        // This is an efficient Query operation, not a Scan, because we provide the partition key.
        // NOTE: The model is 'BusinessData' based on our final schema, not 'Customer'.
        const { data: items } = await client.models.BusinessData.list({
          filter: {
            pk: {
              eq: `BUSINESS#${phoneNbr}`
            },
            sk: {
              beginsWith: 'ORDER#' 
            }
          }
        });

        console.log('Fetched Orders:', items);
        setOrders(items || []); // Ensure we always set an array
      } catch (err) {
        console.error('Error fetching orders:', err);
        const errorMessage = err.errors ? err.errors[0].message : err.message;
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchOrdersForBusiness();
  }, [phoneNbr]); // The hook re-runs its effect if the phoneNbr changes

  // The hook returns the data and the state of the fetch operation.
  return { orders, loading, error };
}

export default BusinessDataOrderHook;


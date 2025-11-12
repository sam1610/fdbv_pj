import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchUserAttributes } from '@aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed

// Define the type for a single record from our schema
type BusinessData = Schema['BusinessData']['type'];

// This interface defines the props the component expects
interface BusinessByStatusProps {
  // The client is passed in from the parent to be reused
  client: ReturnType<typeof generateClient<Schema>>;
}

/**
 * A component that securely fetches and displays all orders for the
 * currently logged-in admin's business, filterable by status.
 */
function B({ client }: BusinessByStatusProps) {
  const [orders, setOrders] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ORDERED'); // Default filter

  useEffect(() => {
    const fetchOrdersByStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch the logged-in admin's attributes to get their phone number
        const attributes = await fetchUserAttributes();
        const businessId = attributes.phone_number;

        if (!businessId) {
          throw new Error("Could not determine Business ID from user's phone number.");
        }

        // 2. Construct the GSI partition and sort keys for a targeted query
        const gsi1pk = `BUSINESS#${businessId}`;
        const gsi1sk = `ORDER#${statusFilter}#`; // e.g., "ORDER#PREPARED#"

        // 3. Perform a targeted query against the correct GSI helper
        const response = await client.models.BusinessData.listBusinessDataByBusinessByStatus({
          gsi1pk: gsi1pk,
          gsi1sk: { beginsWith: gsi1sk } // Get all orders with the specified status
        });
        
        setOrders(response.data || []);

      } catch (e: any) {
        const errorMessage = e.errors ? e.errors[0].message : 'An unknown error occurred.';
        setError(`Failed to fetch orders: ${errorMessage}`);
        console.error('Error fetching orders:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchOrdersByStatus();
  }, [statusFilter, client]); // Refetch data whenever the statusFilter changes

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Order Management Dashboard</h2>
      <div style={styles.filterControls}>
        {['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING'].map(status => (
          <button 
            key={status}
            onClick={() => setStatusFilter(status)}
            style={status === statusFilter ? styles.activeButton : styles.button}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>
      
      {loading && <p>Loading orders...</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      
      {!loading && !error && (
        orders.length > 0 ? (
          <ul style={styles.list}>
            {orders.map((order) => (
              <li key={order.pk} style={styles.listItem}>
                <div>
                  <span style={styles.name}>{order.pk}</span>
                  <span style={styles.subtext}>Customer: {order.customerId}</span>
                </div>
                <div style={styles.right}>
                  <span style={styles.price}>${order.totalPrice?.toFixed(2)}</span>
                  <span style={styles.status}>{order.orderStatus}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No orders found with status "{statusFilter}".</p>
        )
      )}
    </div>
  );
}

// Basic styling for a modern dashboard look
const styles: { [key: string]: React.CSSProperties } = {
  container: { fontFamily: 'sans-serif', margin: '2rem auto', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', maxWidth: '900px', backgroundColor: '#fff' },
  header: { color: '#333', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' },
  filterControls: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' },
  button: { padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '20px', background: '#f8f9fa', cursor: 'pointer' },
  activeButton: { padding: '0.5rem 1rem', border: '1px solid #007bff', borderRadius: '20px', background: '#007bff', color: 'white', cursor: 'pointer' },
  list: { listStyle: 'none', padding: 0 },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #f0f0f0' },
  name: { fontWeight: 'bold', display: 'block' },
  subtext: { color: '#6c757d', fontSize: '0.85rem' },
  right: { textAlign: 'right' },
  price: { fontWeight: 'bold', fontSize: '1.1rem', display: 'block' },
  status: { color: '#555', fontSize: '0.8rem', background: '#e9ecef', padding: '0.2rem 0.5rem', borderRadius: '10px', marginTop: '0.25rem' },
  errorText: { color: 'red' },
};

export default B;


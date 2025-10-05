import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed


// Define the type for a single record from our schema
type BusinessData = Schema['BusinessData']['type'];

// Initialize the Amplify client, specifying userPools as the auth mode
const client = generateClient<Schema>({ authMode: 'userPool' });
interface AProps {
  user: { username: string; attributes?: { businessId?: string } } | null;
  client: ReturnType<typeof generateClient<Schema>>;
}
/**
 * A component that securely fetches and displays all customer records
 * from across all businesses using an inverted index GSI.
 */
function GlobalCustomerList({ user, client }: AProps) {
  const [customers, setCustomers] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Perform a targeted query against the new 'listAllCustomers' GSI
        const response = await client.models.BusinessData.listAllCustomers({
          // Use the static partition key we designed for this index
          gsi5pk: 'ALL_CUSTOMERS',
        });
        
        setCustomers(response.data || []);

      } catch (e: any) {
        const errorMessage = e.errors ? e.errors[0].message : 'An unknown error occurred.';
        setError(`Failed to fetch customers: ${errorMessage}`);
        console.error('Error fetching customers:', e);
      } finally {
        setLoading(false);
      }
    };
 if (user) {
      fetchAllCustomers();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, client]);

  if (loading) return <p>Loading byCustomer...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Global Customer Directory</h2>
      <p style={styles.explanation}>This list is fetched using a dedicated GSI to efficiently query for all customers across all businesses.</p>
      
      {loading && <p>Loading all customers...</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      
      {!loading && !error && (
        customers.length > 0 ? (
          <ul style={styles.list}>
            {customers.map((customer) => (
              <li key={customer.pk} style={styles.listItem}>
                <span style={styles.name}>{customer.name}</span>
                <span style={styles.phone}>{customer.phone}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No customers found in the system.</p>
        )
      )}
    </div>
  );
}

// Basic styling for readability
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'sans-serif',
    margin: '2rem auto',
    padding: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    maxWidth: '900px',
  },
  header: {
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '0.5rem',
  },
  explanation: {
    fontSize: '0.9rem',
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
  },
  list: {
    listStyle: 'none',
    padding: 0,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.75rem 0.5rem',
    borderBottom: '1px solid #f0f0f0',
  },
  name: {
    fontWeight: 'bold',
  },
  phone: {
    color: '#555',
    fontFamily: 'monospace',
  },
  errorText: {
    color: 'red',
  },
};

export default GlobalCustomerList;


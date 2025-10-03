import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed

// Generate the Amplify Data client
const client = generateClient<Schema>();

// Define a type for our data for better readability in the component
type BusinessData = Schema['BusinessData']['type'];

function CustomerOrders() {
  const [data, setData] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Example value - replace with actual ID
        const exampleCustomerId = 'CUSTOMER#C789';
        const response = await client.models.BusinessData.listBusinessDataByCustomer({
          gsi4pk: exampleCustomerId,
        });
        setData(response.data || []);
      } catch (e) {
        console.error('Error fetching byCustomer:', e);
        setError('Failed to fetch byCustomer data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading byCustomer...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>GSI 4: byCustomer</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>PK</th>
            <th>SK</th>
            <th>Entity Type</th>
            <th>Order Date</th>
            <th>Total Price</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item) => (
              <tr key={`${item.pk}-${item.sk}`}>
                <td>{item.pk}</td>
                <td>{item.sk}</td>
                <td>{item.entityType}</td>
                <td>{item.orderDate ? new Date(item.orderDate).toLocaleString() : 'N/A'}</td>
                <td>{item.totalPrice ? `$${item.totalPrice.toFixed(2)}` : 'N/A'}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={5}>No data found.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default CustomerOrders;
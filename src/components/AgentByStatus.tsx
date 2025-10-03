import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed

// Generate the Amplify Data client
const client = generateClient<Schema>();

// Define a type for our data for better readability in the component
type BusinessData = Schema['BusinessData']['type'];

function AgentByStatus() {
  const [data, setData] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Example value - replace with actual ID
        const exampleAgentId = 'AGENT#A456';
        const response = await client.models.BusinessData.listBusinessDataByAgentByStatus({
          gsi3pk: exampleAgentId,
        });
        setData(response.data || []);
      } catch (e) {
        console.error('Error fetching byAgentByStatus:', e);
        setError('Failed to fetch byAgentByStatus data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading byAgentByStatus...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>GSI 3: byAgentByStatus</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>PK</th>
            <th>SK</th>
            <th>Entity Type</th>
            <th>Order Status</th>
            <th>Delivery Date</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item) => (
              <tr key={`${item.pk}-${item.sk}`}>
                <td>{item.pk}</td>
                <td>{item.sk}</td>
                <td>{item.entityType}</td>
                <td>{item.orderStatus}</td>
                <td>{item.deliveryDate ? new Date(item.deliveryDate).toLocaleString() : 'N/A'}</td>
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

export default AgentByStatus;
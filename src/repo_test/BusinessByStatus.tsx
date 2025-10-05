// components/A.tsx (BusinessByStatus)
import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';
// Define a type for our data for better readability in the component
type BusinessData = Schema['BusinessData']['type'];

interface AProps {
  user: { username: string; attributes?: { businessId?: string } } | null;
  client: ReturnType<typeof generateClient<Schema>>;
}

function BusinessByStatus({ user, client }: AProps) {
  const [data, setData] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use user attributes for dynamic ID (fallback to example)
        const exampleBusinessId = user?.attributes?.businessId || 'BUSINESS#B123';
        const response = await client.models.BusinessData.listBusinessDataByBusinessByStatus({
          gsi1pk: exampleBusinessId,
        });
        setData(response.data || []);
      } catch (e) {
        console.error('Error fetching byBusinessByStatus:', e);
        setError('Failed to fetch byBusinessByStatus data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, client]);

  if (loading) return <p>Loading byBusinessByStatus...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>GSI 1: byBusinessByStatus</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>PK</th>
            <th>SK</th>
            <th>Entity Type</th>
            <th>Name</th>
            <th>Order Status</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item) => (
              <tr key={`${item.pk}-${item.sk}`}>
                <td>{item.pk}</td>
                <td>{item.sk}</td>
                <td>{item.entityType}</td>
                <td>{item.name}</td>
                <td>{item.orderStatus}</td>
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

export default BusinessByStatus;
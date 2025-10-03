import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed

// Generate the Amplify Data client
const client = generateClient<Schema>();

// Define a type for our data for better readability in the component
type BusinessData = Schema['BusinessData']['type'];

function BusinessByEntity() {
  const [data, setData] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Example value - replace with actual ID
        const exampleBusinessId = 'BUSINESS#B123';
        const response = await client.models.BusinessData.listBusinessDataByBusinessByEntity({
          gsi2pk: exampleBusinessId,
        });
        setData(response.data || []);
      } catch (e) {
        console.error('Error fetching byBusinessByEntity:', e);
        setError('Failed to fetch byBusinessByEntity data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading byBusinessByEntity...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>GSI 2: byBusinessByEntity</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>PK</th>
            <th>SK</th>
            <th>Entity Type</th>
            <th>Name</th>
            <th>Phone</th>
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
                <td>{item.phone}</td>
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

export default BusinessByEntity;
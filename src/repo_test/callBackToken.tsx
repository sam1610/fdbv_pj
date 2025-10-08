// components/A.tsx (BusinessByStatus)
import { useState, useEffect, useCallback } from 'react';
import type { Schema } from '../../amplify/data/resource'; // Adjust path if needed
import { generateClient } from 'aws-amplify/data';

// Define a type for our data for better readability in the component
type BusinessData = Schema['BusinessData']['type'];

interface AProps {
  user: { username: string; attributes?: Record<string, unknown> } | null; 
  client: ReturnType<typeof generateClient<Schema>>;
  phoneNbr: string; // Prop for the phone number associated with the business (e.g., 'BUSINESS#+97333787388')
}

function BusinessByStatus({ user, client, phoneNbr }: AProps) {
  const [data, setData] = useState<BusinessData[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null); // For pagination
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (token: string | null = null) => {
    if (token ? loadingMore : loading) return;
    token ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      // Since phoneNbr already includes 'BUSINESS#', use it directly after normalization
      const normalizedPhone = phoneNbr.startsWith('BUSINESS#') ? phoneNbr : `BUSINESS#${phoneNbr.startsWith('+') ? phoneNbr : `+${phoneNbr}`}`;
      console.log('Querying with gsi1pk:', normalizedPhone); // Debug log

      const response = await client.models.BusinessData.listBusinessDataByBusinessByStatus({
        gsi1pk: normalizedPhone,
        gsi1sk: { beginsWith: 'ORDER#' },
        limit: 2, // Pagination limit
        nextToken: token,
        sortDirection: 'DESC', // Newest first
      });
      const newData = response.data || [];
      setData((prev) => (token ? [...prev, ...newData] : newData)); // Append if loading more
      setNextToken(response.nextToken || null);
      setHasMore(!!response.nextToken);
      console.log('Fetched data:', newData.length);
    } catch (e) {
      console.error('Error fetching byBusinessByStatus:', e);
      setError('Failed to fetch byBusinessByStatus data');
    } finally {
      token ? setLoadingMore(false) : setLoading(false);
    }
  }, [client, loading, loadingMore, phoneNbr]); // Dependencies for memoization

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, fetchData]); // Trigger initial fetch; fetchData is memoized

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
      {hasMore && (
        <button onClick={() => fetchData(nextToken)} disabled={loadingMore}>
          {loadingMore ? 'Loading More...' : 'Load More'}
        </button>
      )}
    </section>
  );
}

export default BusinessByStatus;
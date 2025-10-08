// components/BusinessByStatus.jsx
import { useState, useEffect, useCallback } from 'react';

function BusinessByStatus({ user, client, phoneNbr }) {
  const [data, setData] = useState([]);
  const [nextToken, setNextToken] = useState(null); // For pagination
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (token ) => {
    // if (token ? loadingMore : loading) return; // Uncommented: Prevent concurrent fetches
    token ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const response = await client.models.BusinessData.listBusinessDataByBusinessByStatus({
        gsi1pk: phoneNbr,
        gsi1sk: { beginsWith: 'ORDER#' },
        limit: 1, // Keep your limit; adjust as needed for performance
        nextToken: token,
        sortDirection: 'DESC',
      });
      const newData = response.data || [];
      setData(prev => token ? [...prev, ...newData] : newData);
      setNextToken(response.nextToken || null);
      setHasMore(!!response.nextToken);
      console.log('Fetched data:', newData.length, 'Next token:', response.nextToken);
    } catch (e) {
      console.error('Error fetching byBusinessByStatus:', e);
      setError('Failed to fetch byBusinessByStatus data. Check AppSync logs or schema.');
    } finally {
      token ? setLoadingMore(false) : setLoading(false);
    }
  }, [client, phoneNbr]); // Removed loading/loadingMore from deps to avoid infinite loops

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, fetchData]);

  if (loading) return <p className="text-center text-gray-500">Loading byBusinessByStatus...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <section className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">GSI 1: byBusinessByStatus</h2>
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
        <button
          onClick={() => fetchData(nextToken)}
          disabled={loadingMore}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loadingMore ? 'Loading More...' : 'Load More'}
        </button>
      )}
    </section>
  );
}

export default BusinessByStatus;
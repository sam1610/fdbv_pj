// components/BusinessByStatus.jsx
import { useState, useEffect, useCallback } from 'react';

function BusinessByStatus({ user, client, phoneNbr }) {
  const [data, setData] = useState([]);
  const [nextToken, setNextToken] = useState(null); // For next pagination
  const [prevTokens, setPrevTokens] = useState([]); // Stack for previous tokens
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingBack, setLoadingBack] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (token = null) => {
    // if ((token === null ? loading : token ? loadingMore : loadingBack)) return;
    token === null ? setLoading(true) : token ? setLoadingMore(true) : setLoadingBack(true);
    setError(null);
    try {
      console.log('Fetching data with token:', token, 'phoneNbr:', phoneNbr);
      const response = await client.models.BusinessData.listBusinessDataByBusinessByStatus({
        gsi1pk: phoneNbr,
        gsi1sk: { beginsWith: 'ORDER#' },
        limit: 1,
        nextToken: token,
        sortDirection: 'DESC',
      });
      const newData = response.data || [];
      setData(prev => token === null ? newData : [...prev, ...newData]); // Reset data for back navigation
      setNextToken(response.nextToken || null);
      setHasMore(!!response.nextToken);
      if (token) {
        setPrevTokens(prev => [...prev, token]); // Store the current token for back navigation
      }
      console.log('Fetched data:', newData.length, 'Next token:', response.nextToken);
    } catch (e) {
      console.error('Error fetching byBusinessByStatus:', e);
      setError('Failed to fetch byBusinessByStatus data. Check AppSync logs or schema.');
    } finally {
      token === null ? setLoading(false) : token ? setLoadingMore(false) : setLoadingBack(false);
    }
  }, [client, phoneNbr]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, fetchData]);

  const goBack = () => {
    if (prevTokens.length === 0) return;
    const previousToken = prevTokens[prevTokens.length - 1];
    setPrevTokens(prev => prev.slice(0, -1)); // Remove the last token
    fetchData(previousToken); // Fetch with the previous token
  };

  if (loading) return <p className="text-center text-gray-500">Loading byBusinessByStatus...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <section className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">GSI 1: byBusinessByStatus</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PK</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SK</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((item) => (
                <tr key={`${item.pk}-${item.sk}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.pk}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.sk}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.entityType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.orderStatus}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No data found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex space-x-4">
        <button
          onClick={goBack}
          disabled={prevTokens.length === 0 || loadingBack}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {loadingBack ? 'Loading Back...' : 'Go Back'}
        </button>
        {hasMore && (
          <button
            onClick={() => fetchData(nextToken)}
            disabled={loadingMore}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingMore ? 'Loading More...' : 'Load More'}
          </button>
        )}
      </div>
    </section>
  );
}

export default BusinessByStatus;
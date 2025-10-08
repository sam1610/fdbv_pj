// hooks/useBusinessByStatus.js
import { useState, useEffect, useCallback } from 'react';

export const useBusinessByStatus = (user, client, phoneNbr) => {
  const [data, setData] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (token = null) => {
    if (token ? loadingMore : loading) return;
    token ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const response = await client.models.BusinessData.listBusinessDataByBusinessByStatus({
        gsi1pk: phoneNbr,
        gsi1sk: { beginsWith: 'ORDER#' },
        limit: 20,
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
  }, [client, phoneNbr, loading, loadingMore]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, fetchData]);

  return { data, nextToken, hasMore, loading, loadingMore, error, fetchData };
};
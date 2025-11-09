// useEntityList.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';

const client = generateClient({ authMode: 'userPool' });

export const useEntityList = (queryParam, queryName) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dataRef = useRef([]);           // Live data
  const [, forceKpiUpdate] = useState({}); // Only KPI re-render

  const serialized = JSON.stringify(queryParam);

  const fetchData = useCallback(async () => {
    if (!queryParam) return;

    const params = JSON.parse(serialized);
    let apiMethod =
      queryName === 'ByCustomer'
        ? client.models.BusinessData.listBusinessDataByGsi2pkAndSk
        : client.models.BusinessData[queryName];

    try {
      setLoading(true);
      const all = [];
      let nt = null;
      do {
        const resp = await apiMethod({ ...params, nextToken: nt });
        all.push(...(resp.data || []));
        nt = resp.nextToken;
      } while (nt);

      dataRef.current = all;
      forceKpiUpdate({}); // Only KPIs
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [queryName, serialized]);

  // Real-time
  useEffect(() => {
    if (!queryParam) return;

    const filter = { ...queryParam.filter, entityType: { eq: 'Order' } };
    const observer = client.models.BusinessData.observeQuery({ filter });
    const sub = observer.subscribe({
      next: ({ items }) => {
        dataRef.current = [...items].sort((a, b) =>
          (b.orderDate || '').localeCompare(a.orderDate || '')
        );
        forceKpiUpdate({});
      },
      error: (err) => setError(err.message),
    });
    return () => sub.unsubscribe();
  }, [serialized]);

  // 45s polling
  useEffect(() => {
    const id = setInterval(() => {
      if (!loading) fetchData();
    }, 45_000);
    return () => clearInterval(id);
  }, [fetchData, loading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data: dataRef.current,
    loading,
    error,
    refetch: fetchData,
    forceKpiUpdate: () => forceKpiUpdate({}), // Expose for external use
  };
};
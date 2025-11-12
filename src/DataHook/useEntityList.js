// src/DataHook/useEntityList.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';

const client = generateClient({ authMode: 'apiKey' });

/**
 * Generic list-only hook.
 *
 * @param queryParam   – object passed to the generated list method
 * @param queryName    – "list" | "listBusinessDataByGsi2pkAndSk" (GSI 2)
 */
export const useEntityList = (queryParam, queryName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --------------------------------------------------------------
  // 1. Keep the param **stable** (prevents endless re-fetch)
  // --------------------------------------------------------------
  const stableParam = useMemo(() => queryParam ?? {}, [queryParam]);

  // --------------------------------------------------------------
  // 2. Choose the right API method (primary index vs GSI 2)
  // --------------------------------------------------------------
  const apiMethod = useMemo(() => {
    if (!queryName) return null;
    if (queryName === 'ByCustomer') {
      return client.models.BusinessData.listBusinessDataByGsi2pkAndSk;
    }
    // primary index list()
    return client.models.BusinessData[queryName];
  }, [queryName]);

  // --------------------------------------------------------------
  // 3. Fetch with pagination
  // --------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!apiMethod) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const all = [];
    let nextToken = null;

    try {
      do {
        const resp = await apiMethod({ ...stableParam, nextToken });
        all.push(...(resp.data ?? []));
        nextToken = resp.nextToken;
      } while (nextToken);

      setData(all);
    } catch (e) {
      const msg = e.errors?.[0]?.message ?? 'Unknown error';
      setError(`Failed to fetch data: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiMethod, stableParam]);

  // --------------------------------------------------------------
  // 4. Run only when the *real* dependencies change
  // --------------------------------------------------------------
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
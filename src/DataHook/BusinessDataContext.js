// src/context/BusinessDataContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import { useEntityList } from '../hooks/useEntityList'; // Your provided hook

const client = generateClient({ authMode: 'userPool' });

const BusinessDataContext = createContext();

export const BusinessDataProvider = ({ phoneNbr, children }) => {
  const [orders, setOrders] = useState([]);
  const [currentQueryParams, setCurrentQueryParams] = useState(null); // Manage params in state to trigger re-fetches
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Prepare query params (default to last 30 days)
  const getQueryParams = useCallback((filterDays = 30) => {
    if (!phoneNbr) return null;
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (filterDays - 1));
    startDate.setHours(0, 0, 0, 0); // Local midnight
    return {
      pk: `BUSINESS#${phoneNbr}`,
      sk: { between: [`ORDER#${startDate.toISOString()}`, `ORDER#${now.toISOString()}`] },
    };
  }, [phoneNbr]);

  // Set initial params on mount
  useEffect(() => {
    setCurrentQueryParams(getQueryParams(30)); // Default range
  }, [getQueryParams]);

  // Fetch using useEntityList (hook doesn't watch params, so params state triggers re-fetch via useEffect in hook)
  const { data: fetchedOrders, loading: queryLoading, error: queryError, refetch: queryRefetch } = useEntityList(
    currentQueryParams,
    'listBusinessDataByPkAndSk'
  );

  useEffect(() => {
    if (queryError) {
      setError(queryError);
    } else {
      setOrders(fetchedOrders || []);
    }
    setLoading(queryLoading);
  }, [fetchedOrders, queryLoading, queryError]);

  // Subscriptions using Gen2 model-based API (no imported GraphQL needed)
  useEffect(() => {
    if (!phoneNbr) return;

    console.log("Setting up subscriptions...");

    // On Create
    const createSub = client.models.BusinessData.onCreate().subscribe({
      next: (newRecord) => {
        if (newRecord.pk === `BUSINESS#${phoneNbr}` && newRecord.sk.startsWith('ORDER#')) {
          console.log("New order received via subscription:", newRecord);
          setOrders((prev) => [...prev, newRecord].sort((a, b) => a.sk.localeCompare(b.sk))); // Append and sort by SK
        }
      },
      error: (err) => {
        console.error('Subscription error (create):', err);
        setError('Real-time create updates failed.');
      },
    });

    // On Update
    const updateSub = client.models.BusinessData.onUpdate().subscribe({
      next: (updatedRecord) => {
        if (updatedRecord.pk === `BUSINESS#${phoneNbr}` && updatedRecord.sk.startsWith('ORDER#')) {
          console.log("Updated order received via subscription:", updatedRecord);
          setOrders((prev) =>
            prev.map((order) => (order.id === updatedRecord.id ? updatedRecord : order))
          );
        }
      },
      error: (err) => {
        console.error('Subscription error (update):', err);
        setError('Real-time update updates failed.');
      },
    });

    // On Delete (for completeness)
    const deleteSub = client.models.BusinessData.onDelete().subscribe({
      next: (deletedRecord) => {
        if (deletedRecord.pk === `BUSINESS#${phoneNbr}` && deletedRecord.sk.startsWith('ORDER#')) {
          console.log("Deleted order received via subscription:", deletedRecord);
          setOrders((prev) => prev.filter((order) => order.id !== deletedRecord.id));
        }
      },
      error: (err) => {
        console.error('Subscription error (delete):', err);
        setError('Real-time delete updates failed.');
      },
    });

    // Cleanup
    return () => {
      console.log("Tearing down subscriptions.");
      createSub.unsubscribe();
      updateSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [phoneNbr]); // Depend on phoneNbr for resubscription

  // Refetch function with dynamic filterDays: Update params state to trigger hook re-fetch
  const refetchOrders = useCallback((filterDays = 30) => {
    if (!phoneNbr) return;
    setCurrentQueryParams(getQueryParams(filterDays)); // Update params to re-trigger fetch
    queryRefetch(); // Also call hook's refetch for good measure
  }, [phoneNbr, getQueryParams]);

  return (
    <BusinessDataContext.Provider value={{ orders, loading, error, refetchOrders }}>
      {children}
    </BusinessDataContext.Provider>
  );
};

export const useBusinessData = () => useContext(BusinessDataContext);
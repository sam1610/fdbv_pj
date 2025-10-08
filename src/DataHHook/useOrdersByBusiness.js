// hooks/useOrdersByBusiness.js
import { useState, useEffect } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { listBusinessDataByBusinessByStatus } from '../graphql/queries';

export const useOrdersByBusiness = (businessPhone) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await API.graphql(graphqlOperation(listBusinessDataByBusinessByStatus, {
          gsi1pk: businessPhone,
          gsi1sk: { beginsWith: 'ORDER#' },
          limit: 100, // Adjust as needed
        }));
        const items = response.data.listBusinessDataByBusinessByStatus.items || [];
        const filteredOrders = items.filter(item => item.SortKey.startsWith('ORDER#') && !item.SortKey.includes('#ITEM#'));
        setOrders(filteredOrders);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [businessPhone]);

  return { orders, loading, error };
};
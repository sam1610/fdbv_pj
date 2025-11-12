// components/OrderItems.tsx
import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource'; // Adjust path
import { generateClient } from 'aws-amplify/data';
import '../App.css';
type BusinessData = Schema['BusinessData']['type'];

interface Props {
  client: ReturnType<typeof generateClient<Schema>>;
  orderId: string; // e.g., 'ORD02'
}

function OrderItems({ client, orderId }: Props) {
  const [items, setItems] = useState<BusinessData[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const pk = `ORDER#${orderId}`;

  const fetchItems = async (token: string | null = null) => {
    setLoading(true);
    setError(null);
    try {
      // Query primary index directly (no GSI needed)
      const response = await client.models.BusinessData.list({
        filter: { pk: { eq: pk }, sk: { beginsWith: 'ITEM#' } }, // Fetch only items for this order
        limit: 10, // Pagination for efficiency
        nextToken: token,
      });
      const newItems = response.data || [];
      setItems((prev) => [...prev, ...newItems]);
      setNextToken(response.nextToken || null);
      setHasMore(!!response.nextToken);
    } catch (e) {
      console.error('Error fetching order items:', e);
      setError('Failed to fetch order items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      setItems([]); // Reset on orderId change
      setNextToken(null);
      setHasMore(true);
      fetchItems();
    }
  }, [orderId, client]);

  if (loading) return <p>Loading order items...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>Items for Order #{orderId}</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Quantity</th>
            <th>SK (Item ID)</th>
            <th>Total Price</th>
            <th>Unit Price</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((item) => (
              <tr key={item.sk}>
                <td>{item.productId}</td>
                <td>{item.quantity}</td>
                <td>{item.sk}</td>
                <td>{item.totalPrice}</td>
                <td>{item.unitPrice}</td>
                <td>{item.updatedAt || 'N/A'}</td> {/* Assuming an updatedAt field; adjust as needed */}
              </tr>
            ))
          ) : (
            <tr><td colSpan={6}>No items found for this order.</td></tr>
          )}
        </tbody>
      </table>
      {hasMore && (
        <button onClick={() => fetchItems(nextToken)} disabled={loading}>
          {loading ? 'Loading More...' : 'Load More Items'}
        </button>
      )}
    </section>
  );
}

export default OrderItems;
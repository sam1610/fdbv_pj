import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource'; // Adjust path if needed

// Generate the Amplify Data client
const client = generateClient<Schema>();

// Define a type for our product for better readability in the component
type Product = Schema['Product']['type'];

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Define the function to fetch in-stock products
    const fetchInStockProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        // ✅ FIX: Use the correct 'stockStatus' field and string value for the query
        const response = await client.models.Product.listByStockStatus({
          stockStatus: 'IN_STOCK', // This is the partition key for the GSI
          sortDirection: 'DESC',   // Sorts by 'orderDate' (the sort key), newest first
        });

        if (response.data) {
          setProducts(response.data);
        }
      } catch (e) {
        console.error('Error fetching products:', e);
        setError('Failed to fetch products. Please check the console.');
      } finally {
        setLoading(false);
      }
    };

    // Call the fetch function
    fetchInStockProducts();
  }, []); // The empty dependency array ensures this runs once on component mount

  // Render a loading state
  if (loading) {
    return (
      <div className="container">
        <h1>Loading In-Stock Products...</h1>
      </div>
    );
  }

  // Render an error state
  if (error) {
    return (
      <div className="container error">
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }
  
  // Render the list of products
  return (
    <div className="container">
      <header>
        <h1>Freshly Stocked Products</h1>
        <p>Showing all available items, sorted by the most recent order date.</p>
      </header>
      <ul className="product-list">
        {products.length > 0 ? (
          products.map((product) => (
            <li key={product.id} className="product-item">
              <div className="product-info">
                <h2>{product.name}</h2>
                <p className="price">${product.price.toFixed(2)}</p>
              </div>
              <p className="order-date">
                Ordered: {new Date(product.orderDate!).toLocaleDateString()}
              </p>
            </li>
          ))
        ) : (
          <p>No in-stock products found.</p>
        )}
      </ul>
      <style>{`
        body { font-family: sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        header { text-align: center; margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1rem; }
        header h1 { color: #2c3e50; }
        header p { color: #7f8c8d; }
        .product-list { list-style: none; padding: 0; }
        .product-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee; transition: background-color 0.2s; }
        .product-item:hover { background-color: #fafafa; }
        .product-item:last-child { border-bottom: none; }
        .product-info h2 { margin: 0; font-size: 1.2rem; color: #34495e; }
        .price { margin: 0.25rem 0 0; color: #27ae60; font-weight: bold; }
        .order-date { margin: 0; color: #95a5a6; font-size: 0.9rem; }
        .error { background-color: #ffebee; color: #c62828; border: 1px solid #c62828; }
      `}</style>
    </div>
  );
}

export default App;


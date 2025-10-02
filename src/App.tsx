import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource'; // Adjust path if needed
import './App.css';

// Generate the Amplify Data client
const client = generateClient<Schema>();

// Define a type for our product for better readability in the component
type Product = Schema['Product']['type'];

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Define the function to fetch all products
    const fetchAllProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await client.models.Product.list();

        if (response.data) {
          setProducts(response.data);
        }
      } catch (e) {
        console.error('Error fetching products:', e);
        setError('Failed to fetch products. Please check the console');
      } finally {
        setLoading(false);
      }
    };

    // Call the fetch function
    fetchAllProducts();
  }, []); // The empty dependency array ensures this runs once on component mount

  // Render a loading state
  if (loading) {
    return (
      <div className="container">
        <h1>Loading Products...</h1>
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
        <h1>All Products</h1>
        <p>Showing all items.</p>
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
                Ordered: {product.orderDate ? new Date(product.orderDate).toLocaleDateString() : 'N/A'}
              </p>
            </li>
          ))
        ) : (
          <p>No products found.</p>
        )}
      </ul>
    </div>
  );
}

export default App;
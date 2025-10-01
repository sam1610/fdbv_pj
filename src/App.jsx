import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import output from '../amplify_outputs.json';
import './App.css';

// Configure the Amplify client
Amplify.configure(output);

// Generate a client for your backend data
const client = generateClient();

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Effect to fetch products when the component mounts
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Fetch all products from the 'Product' table
        const { data: items, errors } = await client.models.Product.list();
        if (errors) {
          console.error('Failed to fetch products:', errors);
        } else {
          setProducts(items);
        }
      } catch (error) {
        console.error('An error occurred:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return <div>Loading products...</div>;
  }

  return (
    <div className="App">
      <h1>Product List</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Price</th>
            <th>In Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.description}</td>
              <td>${product.price?.toFixed(2)}</td>
              <td>{product.inStock ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
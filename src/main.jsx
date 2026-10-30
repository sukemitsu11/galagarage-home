import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SiteProvider } from './site.jsx';
import { CartProvider, FavoritesProvider, ProductsProvider } from './store.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <SiteProvider>
      <ProductsProvider>
        <CartProvider>
          <FavoritesProvider>
            <App />
          </FavoritesProvider>
        </CartProvider>
      </ProductsProvider>
    </SiteProvider>
  </BrowserRouter>
);

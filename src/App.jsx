import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import CartDrawer from './components/CartDrawer.jsx';
import Footer from './components/Footer.jsx';
import Header from './components/Header.jsx';
import Catalog from './pages/Catalog.jsx';
import Favorites from './pages/Favorites.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const target = hash && document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <main id="main" className="page">
      <h1 className="page-title">Страницы нет</h1>
      <p className="state-message">Проверьте адрес или вернитесь в каталог.</p>
      <Link className="underlined-link" to="/catalog">Перейти в каталог</Link>
    </main>
  );
}

export default function App() {
  const { pathname } = useLocation();
  // The admin panel is a standalone page without the storefront header, footer and cart.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <Suspense fallback={null}><Routes><Route path="/admin/*" element={<AdminApp />} /></Routes></Suspense>;
  }
  return (
    <>
      <a className="skip-link" href="#main">К содержимому</a>
      <ScrollManager />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <CartDrawer />
    </>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { useSite } from './site.jsx';
import { formatPrice } from './lib.js';

const ProductsContext = createContext(null);
const CartContext = createContext(null);
const FavoritesContext = createContext(null);
const cartKey = 'galagarage-home-cart-v1';
// localStorage has no expiry: favorites stay until the visitor removes them or clears site data.
const favoritesKey = 'galagarage-home-favorites-v2';

export const useProducts = () => useContext(ProductsContext);
export const useCart = () => useContext(CartContext);
export const useFavorites = () => useContext(FavoritesContext);

// Both messengers open the boutique chat with the order text already typed in.
export function orderLinks(message, contacts) {
  const text = encodeURIComponent(message);
  return {
    whatsapp: `https://wa.me/${contacts.whatsapp}?text=${text}`,
    telegram: `${contacts.telegramChat}?text=${text}`
  };
}

export function ProductsProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', products: [] });
  const latest = useRef(0);

  // Only the newest request may update the state; a failed reload keeps the products already shown.
  const load = useCallback(() => {
    const request = ++latest.current;
    setState(previous => ({ ...previous, status: previous.products.length ? previous.status : 'loading' }));
    api.products()
      .then(products => { if (request === latest.current) setState({ status: 'ready', products }); })
      .catch(() => { if (request === latest.current) setState(previous => ({ ...previous, status: previous.products.length ? 'ready' : 'error' })); });
  }, []);

  useEffect(load, [load]);
  return <ProductsContext.Provider value={{ ...state, reload: load }}>{children}</ProductsContext.Provider>;
}

const parseItems = raw => {
  const stored = JSON.parse(raw || '[]');
  return Array.isArray(stored) ? stored.filter(item => Number.isInteger(item?.id) && Number.isInteger(item?.qty) && item.qty > 0) : [];
};
const parseIds = raw => {
  const stored = JSON.parse(raw || '[]');
  return Array.isArray(stored) ? stored.filter(Number.isInteger) : [];
};

// State mirrored to localStorage and kept in sync with other open tabs.
function useStoredState(key, parse) {
  const [value, setValue] = useState(() => {
    try { return parse(localStorage.getItem(key)); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
  }, [key, value]);

  useEffect(() => {
    const onStorage = event => {
      if (event.key !== key) return;
      try { setValue(parse(event.newValue)); } catch { /* Ignore malformed data from another tab. */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, parse]);

  return [value, setValue];
}

export function buildMessage(lines) {
  const rows = lines.map(({ product, qty }, index) => {
    const color = product.color ? ` (${product.color.toLowerCase()})` : '';
    const count = qty > 1 ? `, ${qty} шт.` : '';
    return `${index + 1}. ${product.name}${color}${count}: ${formatPrice(product.price * qty)}`;
  });
  const total = lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0);
  return `Здравствуйте! Хочу купить:\n${rows.join('\n')}\nИтого: ${formatPrice(total)}\nПодскажите, пожалуйста, наличие и как оформить заказ.`;
}

export function CartProvider({ children }) {
  const { products, reload } = useProducts();
  const { contacts } = useSite();
  const [items, setItems] = useStoredState(cartKey, parseItems);
  const [open, setOpen] = useState(false);

  // Refresh prices before the visitor reviews the order.
  useEffect(() => { if (open) reload(); }, [open, reload]);

  const lines = useMemo(() => items
    .map(item => ({ product: products.find(product => product.id === item.id), qty: item.qty }))
    .filter(line => line.product), [items, products]);

  // Items whose product is hidden or removed stay stored but are not shown or ordered.
  const value = useMemo(() => {
    const message = buildMessage(lines);
    return {
      lines,
      open,
      setOpen,
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      total: lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
      has: id => lines.some(line => line.product.id === id),
      add: id => setItems(current => current.some(item => item.id === id) ? current : [...current, { id, qty: 1 }]),
      setQty: (id, qty) => setItems(current => qty < 1
        ? current.filter(item => item.id !== id)
        : current.map(item => item.id === id ? { ...item, qty: Math.min(qty, 99) } : item)),
      remove: id => setItems(current => current.filter(item => item.id !== id)),
      clear: () => setItems([]),
      message,
      links: orderLinks(message, contacts)
    };
  }, [lines, open, setItems, contacts]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function FavoritesProvider({ children }) {
  const { products } = useProducts();
  const [ids, setIds] = useStoredState(favoritesKey, parseIds);

  const value = useMemo(() => {
    const saved = ids.map(id => products.find(product => product.id === id)).filter(Boolean);
    return {
      ids,
      count: saved.length,
      products: saved,
      has: id => ids.includes(id),
      toggle: id => setIds(current => current.includes(id) ? current.filter(item => item !== id) : [id, ...current])
    };
  }, [ids, products, setIds]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

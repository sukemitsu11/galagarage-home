import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dimensionRows, formatPrice } from '../lib.js';
import { useSite } from '../site.jsx';
import { buildMessage, orderLinks, useCart } from '../store.jsx';
import FavoriteButton from './FavoriteButton.jsx';

// The product page body. Also used by the admin preview with draft data.
export default function ProductView({ product }) {
  const cart = useCart();
  const { categoryName, contacts } = useSite();
  const [photo, setPhoto] = useState(0);
  const current = Math.min(photo, Math.max(0, product.images.length - 1));
  const specRows = product.specs.filter(spec => spec.label || spec.value).map(spec => ['specs', spec.label, spec.value]);
  const rows = [
    ...(product.color ? [['color', 'Цвет', product.color]] : []),
    ...dimensionRows(product).map(([label, value]) => ['dims', label, value]),
    ...specRows
  ];
  const inCart = cart.has(product.id);
  const quickOrder = orderLinks(buildMessage([{ product, qty: 1 }]), contacts);

  return (
    <>
      <nav className="crumbs" aria-label="Путь" data-field="category">
        <Link to="/">Главная</Link>
        <Link to="/catalog">Каталог</Link>
        <Link to={`/catalog?category=${product.category}`}>{categoryName(product.category) || 'Раздел'}</Link>
      </nav>
      <div className="product-layout">
        <div className="gallery" data-field="images">
          <div className="gallery-main">
            {product.images[current] ? <img src={product.images[current]} alt={`${product.name}, фото ${current + 1}`} width="800" height="800" /> : <span className="tile-empty">Нет фото</span>}
          </div>
          {product.images.length > 1 && (
            <div className="gallery-thumbs" role="group" aria-label="Фотографии">
              {product.images.map((src, index) => (
                <button key={src} type="button" className={index === current ? 'is-active' : ''} aria-label={`Фото ${index + 1}`} aria-pressed={index === current} onClick={() => setPhoto(index)}>
                  <img src={src} alt="" width="80" height="80" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <h1 data-field="name">{product.name || 'Название товара'}</h1>
          <p className="product-price" data-field="price">{formatPrice(product.price)}</p>
          <div className="buy">
            <div className="buy-main">
              {inCart
                ? <button className="button button-primary" type="button" onClick={() => cart.setOpen(true)}>Открыть корзину</button>
                : <button className="button button-primary" type="button" onClick={() => { cart.add(product.id); cart.setOpen(true); }}>Добавить в корзину</button>}
              <FavoriteButton product={product} className="favorite-square" />
            </div>
            <div className="buy-quick">
              <a className="button button-outline" href={quickOrder.whatsapp} target="_blank" rel="noopener noreferrer">Заказать в WhatsApp</a>
              <a className="button button-outline" href={quickOrder.telegram} target="_blank" rel="noopener noreferrer">Заказать в Telegram</a>
            </div>
          </div>
          {product.description && <p className="product-description" data-field="description">{product.description}</p>}
          {rows.length > 0 && (
            <>
              <h2 className="info-heading">Характеристики</h2>
              <dl className="specs">
                {rows.map(([field, label, value], index) => <div key={`${label}-${index}`} data-field={field}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            </>
          )}
        </div>
      </div>
    </>
  );
}

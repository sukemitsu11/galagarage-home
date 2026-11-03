import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dimensionRows, formatPrice, isAvailable } from '../lib.js';
import { useSite } from '../site.jsx';
import { buildMessage, orderLinks, useCart } from '../store.jsx';
import FavoriteButton from './FavoriteButton.jsx';
import Lightbox from './Lightbox.jsx';
import Photo from './Photo.jsx';
import ShareMenu from './ShareMenu.jsx';

// The product page body.
export default function ProductView({ product }) {
  const cart = useCart();
  const { categoryName, contacts } = useSite();
  const [photo, setPhoto] = useState(0);
  const [zoom, setZoom] = useState(-1);
  const current = Math.min(photo, Math.max(0, product.images.length - 1));
  const specRows = product.specs.filter(spec => spec.label || spec.value).map(spec => [spec.label, spec.value]);
  const rows = [
    ...(product.color ? [['Цвет', product.color]] : []),
    ...dimensionRows(product),
    ...specRows
  ];
  const inCart = cart.has(product.id);
  const available = isAvailable(product);
  const quickOrder = orderLinks(buildMessage([{ product, qty: 1 }]), contacts);

  return (
    <>
      <nav className="crumbs" aria-label="Путь">
        <Link to="/">Главная</Link>
        <Link to="/catalog">Каталог</Link>
        <Link to={`/catalog/${product.category}`}>{categoryName(product.category) || 'Раздел'}</Link>
      </nav>
      <div className="product-layout">
        <div className="gallery">
          <div className="gallery-main">
            {product.images[current]
              ? (
                <button className="gallery-zoom" type="button" onClick={() => setZoom(current)} aria-label="Открыть фото на весь экран">
                  <img src={product.images[current]} alt={`${product.name}, фото ${current + 1}`} width="800" height="800" />
                </button>
              )
              : <span className="tile-empty">Нет фото</span>}
          </div>
          {product.images.length > 1 && (
            <div className="gallery-thumbs" role="group" aria-label="Фотографии">
              {product.images.map((src, index) => (
                <button key={src} type="button" className={index === current ? 'is-active' : ''} aria-label={`Фото ${index + 1}`} aria-pressed={index === current} onClick={() => setPhoto(index)}>
                  <Photo small src={src} width="80" height="80" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <h1>{product.name || 'Название товара'}</h1>
          <p className="product-price">{formatPrice(product.price)}</p>
          {available ? (
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
          ) : (
            <div className="buy">
              <p className="sold-note">
                {product.status === 'sold'
                  ? 'Этот предмет уже продан. Загляните в каталог: возможно, найдётся похожий.'
                  : 'Этот предмет забронирован. Если бронь не состоится, он вернётся в продажу.'}
              </p>
              <div className="buy-main">
                <Link className="button button-outline" to="/catalog">Смотреть каталог</Link>
                <FavoriteButton product={product} className="favorite-square" />
              </div>
            </div>
          )}
          <ShareMenu product={product} />
          {product.description && <p className="product-description">{product.description}</p>}
          {rows.length > 0 && (
            <>
              <h2 className="info-heading">Характеристики</h2>
              <dl className="specs">
                {rows.map(([label, value], index) => <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            </>
          )}
        </div>
      </div>
      <Lightbox images={product.images} index={zoom} onIndex={setZoom} onClose={() => setZoom(-1)} name={product.name} />
    </>
  );
}

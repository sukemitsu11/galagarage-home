import { Handbag } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../lib.js';
import { useCart } from '../store.jsx';
import FavoriteButton from './FavoriteButton.jsx';

export default function ProductTile({ product }) {
  const cart = useCart();
  const photo = product.images[0];
  const inCart = cart.has(product.id);

  return (
    <article className="tile">
      <div className="tile-media">
        <Link className="tile-photo" to={`/product/${product.id}`} tabIndex={-1} aria-hidden="true">
          {photo ? <img src={photo} alt="" width="600" height="600" loading="lazy" /> : <span className="tile-empty">Нет фото</span>}
        </Link>
        <FavoriteButton product={product} className="tile-favorite" />
      </div>
      <Link className="tile-name" to={`/product/${product.id}`}>{product.name}</Link>
      <div className="tile-bottom">
        <span className="tile-price">{formatPrice(product.price)}</span>
        <button
          type="button"
          className={`tile-cart${inCart ? ' is-added' : ''}`}
          aria-label={inCart ? `Открыть корзину, ${product.name} уже в ней` : `В корзину: ${product.name}`}
          onClick={() => inCart ? cart.setOpen(true) : cart.add(product.id)}
        >
          <Handbag size={18} weight={inCart ? 'fill' : 'light'} aria-hidden="true" />
          <span>{inCart ? 'В корзине' : 'В корзину'}</span>
        </button>
      </div>
    </article>
  );
}

export function TileSkeletons({ count = 4 }) {
  return Array.from({ length: count }, (_, index) => (
    <div className="tile tile-skeleton" key={index} aria-hidden="true">
      <span className="tile-photo" />
      <span className="skeleton-line" />
      <span className="skeleton-line short" />
    </div>
  ));
}

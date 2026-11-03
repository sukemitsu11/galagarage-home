import { Handbag } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { formatPrice, isAvailable, statusLabels } from '../lib.js';
import { useCart } from '../store.jsx';
import FavoriteButton from './FavoriteButton.jsx';
import Photo from './Photo.jsx';

export default function ProductTile({ product }) {
  const cart = useCart();
  const [photo, second] = product.images;
  const inCart = cart.has(product.id);
  const available = isAvailable(product);

  return (
    <article className={`tile${available ? '' : ' is-unavailable'}`}>
      <div className="tile-media">
        <Link className="tile-photo" to={`/product/${product.slug || product.id}`} tabIndex={-1} aria-label={product.name}>
          {photo ? <Photo small src={photo} width="600" height="600" loading="lazy" /> : <span className="tile-empty">Нет фото</span>}
          {second && available && <Photo small className="tile-alt" src={second} width="600" height="600" loading="lazy" />}
        </Link>
        <FavoriteButton product={product} className="tile-favorite" />
      </div>
      <Link className="tile-name" to={`/product/${product.slug || product.id}`}>{product.name}</Link>
      <div className="tile-bottom">
        <span className="tile-price">{formatPrice(product.price)}</span>
        {available ? (
          <button
            type="button"
            className={`tile-cart${inCart ? ' is-added' : ''}`}
            aria-label={inCart ? `Открыть корзину, ${product.name} уже в ней` : `В корзину: ${product.name}`}
            onClick={() => inCart ? cart.setOpen(true) : cart.add(product.id)}
          >
            <Handbag size={18} weight={inCart ? 'fill' : 'light'} aria-hidden="true" />
            <span>{inCart ? 'В корзине' : 'В корзину'}</span>
          </button>
        ) : <span className="tile-state">{statusLabels[product.status]}</span>}
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

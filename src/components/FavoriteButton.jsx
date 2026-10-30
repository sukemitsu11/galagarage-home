import { Heart } from '@phosphor-icons/react';
import { useFavorites } from '../store.jsx';

export default function FavoriteButton({ product, className = '' }) {
  const favorites = useFavorites();
  const saved = favorites.has(product.id);
  return (
    <button
      type="button"
      className={`favorite-button${saved ? ' is-saved' : ''} ${className}`}
      aria-pressed={saved}
      aria-label={saved ? `Убрать из избранного: ${product.name}` : `В избранное: ${product.name}`}
      onClick={() => favorites.toggle(product.id)}
    >
      <Heart size={20} weight={saved ? 'fill' : 'light'} aria-hidden="true" />
    </button>
  );
}

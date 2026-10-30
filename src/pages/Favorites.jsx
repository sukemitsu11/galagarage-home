import { Link } from 'react-router-dom';
import ProductTile from '../components/ProductTile.jsx';
import { useCart, useFavorites, useProducts } from '../store.jsx';

export default function Favorites() {
  const { status, reload } = useProducts();
  const favorites = useFavorites();
  const cart = useCart();
  const notInCart = favorites.products.filter(product => !cart.has(product.id));

  function addAll() {
    notInCart.forEach(product => cart.add(product.id));
    cart.setOpen(true);
  }

  return (
    <main id="main" className="page">
      <nav className="crumbs" aria-label="Путь"><Link to="/">Главная</Link><Link to="/favorites">Избранное</Link></nav>
      <div className="page-head">
        <h1 className="page-title">Избранное</h1>
        {notInCart.length > 0 && <button className="button button-primary" type="button" onClick={addAll}>Добавить всё в корзину</button>}
      </div>
      {status === 'loading' ? (
        <p className="state-message">Загружаем избранное…</p>
      ) : status === 'error' ? (
        <div className="state-message">
          <p>Не удалось загрузить избранное: нет связи с сервером. Ваш список сохранён.</p>
          <button className="button button-outline" type="button" onClick={reload}>Повторить</button>
        </div>
      ) : favorites.products.length === 0 ? (
        <div className="state-message">
          <p>Здесь будут предметы, отмеченные сердечком. Список сохраняется в этом браузере, пока вы его не очистите.</p>
          <Link className="button button-outline" to="/catalog">Перейти в каталог</Link>
        </div>
      ) : (
        <div className="grid">{favorites.products.map(product => <ProductTile key={product.id} product={product} />)}</div>
      )}
    </main>
  );
}

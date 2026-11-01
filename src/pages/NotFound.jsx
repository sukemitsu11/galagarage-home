import { Link } from 'react-router-dom';
import ProductTile, { TileSkeletons } from '../components/ProductTile.jsx';
import { SITE_NAME, usePageMeta } from '../seo.js';
import { useProducts } from '../store.jsx';

// "4 [photo] 4": the zero is an oval photo of a table lamp, so it reads as a zero.
export default function NotFound() {
  const { status, products } = useProducts();
  usePageMeta({ title: `Страница не найдена | ${SITE_NAME}`, description: 'Такой страницы нет. Вернитесь в каталог.', noindex: true });
  const more = products.slice(0, 4);

  return (
    <main id="main" className="page lost">
      <div className="lost-top">
        <div className="lost-mark" aria-hidden="true">
          <span>4</span>
          <span className="lost-photo"><img src="/assets/lamp-ceramic.jpg" alt="" width="450" height="800" /></span>
          <span>4</span>
        </div>
        <div className="lost-text">
          <h1 className="page-title"><span className="visually-hidden">Ошибка 404. </span>Такой страницы нет</h1>
          <p>Ссылка устарела, или предмет уже нашёл нового хозяина. Загляните в каталог: там всё, что сейчас есть в бутике.</p>
          <div className="lost-actions">
            <Link className="button button-primary" to="/catalog">Перейти в каталог</Link>
            <Link className="button button-outline" to="/">На главную</Link>
          </div>
        </div>
      </div>

      {(status === 'loading' || more.length > 0) && (
        <section className="shelf lost-shelf" aria-labelledby="lost-new">
          <div className="shelf-head">
            <h2 id="lost-new">Новые поступления</h2>
            <Link className="shelf-all" to="/catalog">Смотреть все</Link>
          </div>
          <div className="grid lost-grid">{status === 'loading' ? <TileSkeletons count={4} /> : more.map(product => <ProductTile key={product.id} product={product} />)}</div>
        </section>
      )}
    </main>
  );
}

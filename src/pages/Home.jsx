import { Link } from 'react-router-dom';
import Banner from '../components/Banner.jsx';
import Boutique from '../components/Boutique.jsx';
import CategorySquares from '../components/CategorySquares.jsx';
import ProductTile, { TileSkeletons } from '../components/ProductTile.jsx';
import { useSite } from '../site.jsx';
import { useProducts } from '../store.jsx';

export default function Home() {
  const { status, products, reload } = useProducts();
  const { contacts, settings } = useSite();
  const latest = products.slice(0, 10);

  return (
    <main id="main">
      <Banner settings={settings} />

      <section className="shelf" aria-labelledby="latest-title">
        <div className="shelf-head">
          <h2 id="latest-title">Новые поступления</h2>
          <Link className="shelf-all" to="/catalog">Смотреть все</Link>
        </div>
        {status === 'error' ? (
          <p className="state-message">Каталог не загрузился. <button className="link-button" type="button" onClick={reload}>Повторить</button></p>
        ) : status === 'ready' && latest.length === 0 ? (
          <p className="state-message">Скоро здесь появятся первые предметы.</p>
        ) : (
          <div className="shelf-row">{status === 'loading' ? <TileSkeletons count={5} /> : latest.map(product => <ProductTile key={product.id} product={product} />)}</div>
        )}
      </section>

      <section className="shelf" aria-labelledby="sections-title">
        <div className="shelf-head"><h2 id="sections-title">Разделы</h2></div>
        <CategorySquares />
      </section>

      <Boutique contacts={contacts} />
    </main>
  );
}

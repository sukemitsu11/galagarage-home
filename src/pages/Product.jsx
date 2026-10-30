import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductTile from '../components/ProductTile.jsx';
import ProductView from '../components/ProductView.jsx';
import { useProducts } from '../store.jsx';

export default function Product() {
  const { id } = useParams();
  const catalog = useProducts();
  const [state, setState] = useState({ status: 'loading', product: null });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', product: null });
    api.product(id)
      .then(product => active && setState({ status: 'ready', product }))
      .catch(error => active && setState({ status: error.status === 404 ? 'missing' : 'error', product: null }));
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (state.product) document.title = `${state.product.name} | Galagarage home`;
    return () => { document.title = 'Galagarage home: предметы с характером'; };
  }, [state.product]);

  if (state.status === 'loading') return <main id="main" className="page"><p className="state-message">Загружаем предмет.</p></main>;
  if (state.status !== 'ready') {
    return (
      <main id="main" className="page">
        <p className="state-message">{state.status === 'missing' ? 'Такого предмета нет в каталоге. Возможно, он уже продан.' : 'Не удалось загрузить предмет. Попробуйте обновить страницу.'}</p>
        <Link className="button button-ghost" to="/catalog">Вернуться в каталог</Link>
      </main>
    );
  }

  const { product } = state;
  const related = catalog.products.filter(item => item.category === product.category && item.id !== product.id).slice(0, 4);

  return (
    <main id="main" className="page">
      <ProductView key={product.id} product={product} />
      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title">Похожие предметы</h2>
          <div className="grid">{related.map(item => <ProductTile key={item.id} product={item} />)}</div>
        </section>
      )}
    </main>
  );
}

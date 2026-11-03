import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductTile from '../components/ProductTile.jsx';
import ProductView from '../components/ProductView.jsx';
import { isAvailable } from '../lib.js';
import { SITE_NAME, shorten, usePageMeta } from '../seo.js';
import { useProducts } from '../store.jsx';

export default function Product() {
  const { id } = useParams(); // the product slug, or an old numeric id from links made earlier
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

  const loaded = state.product;
  usePageMeta(loaded ? {
    title: `${loaded.name} | ${SITE_NAME}`,
    description: shorten(loaded.description) || `${loaded.name}. Бутик ${SITE_NAME}, Омск.`,
    path: `/product/${loaded.slug || loaded.id}`,
    image: loaded.images[0],
    kind: 'product'
  } : state.status === 'missing' ? {
    title: `Страница не найдена | ${SITE_NAME}`,
    description: 'Такой страницы нет. Вернитесь в каталог.',
    noindex: true
  } : {});

  if (state.status === 'ready' && state.product.slug && state.product.slug !== id) {
    return <Navigate to={`/product/${state.product.slug}`} replace />;
  }

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
  // The same section first; when it has fewer than four items, the newest items from the rest of the shop fill the row.
  const others = catalog.products.filter(item => item.id !== product.id && isAvailable(item));
  const sameSection = others.filter(item => item.category === product.category);
  const related = [...sameSection, ...others.filter(item => item.category !== product.category)].slice(0, 4);
  const relatedTitle = sameSection.length > 0 ? 'Похожие предметы' : 'Новые поступления';

  return (
    <main id="main" className="page">
      <ProductView key={product.id} product={product} />
      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title">{relatedTitle}</h2>
          <div className="grid">{related.map(item => <ProductTile key={item.id} product={item} />)}</div>
        </section>
      )}
    </main>
  );
}

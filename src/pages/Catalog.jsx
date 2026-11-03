import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CategorySquares from '../components/CategorySquares.jsx';
import ProductTile, { TileSkeletons } from '../components/ProductTile.jsx';
import { SITE_NAME, usePageMeta } from '../seo.js';
import { useSite } from '../site.jsx';
import { useProducts } from '../store.jsx';

const PAGE_SIZE = 40;

const normalize = text => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');

export default function Catalog() {
  const { status, products, reload } = useProducts();
  const { categories, categoryName, status: siteStatus } = useSite();
  const { category: categoryParam } = useParams(); // /catalog/<раздел>
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = categoryParam ?? 'all';
  const known = categories.some(item => item.id === category);
  const title = category === 'all' ? 'Каталог' : categoryName(category) || 'Каталог';
  usePageMeta({
    title: `${title} | ${SITE_NAME}`,
    description: category === 'all'
      ? `Каталог бутика ${SITE_NAME} в Омске: мебель, посуда, текстиль и декор. Цены и наличие уточняйте в WhatsApp или Telegram.`
      : `${title}: каталог бутика ${SITE_NAME} в Омске. Цены и наличие уточняйте в WhatsApp или Telegram.`,
    path: category === 'all' ? '/catalog' : `/catalog/${category}`,
    image: category === 'all' ? '/assets/category-all.jpg' : categories.find(item => item.id === category)?.image,
    noindex: category !== 'all' && siteStatus === 'ready' && !known
  });
  const sort = ['price-asc', 'price-desc'].includes(params.get('sort')) ? params.get('sort') : 'new';
  const query = (params.get('q') ?? '').trim();
  const color = params.get('color') ?? '';
  const min = Number(params.get('min')) || 0;
  const max = Number(params.get('max')) || 0;
  const requestedPage = Math.max(1, Number(params.get('page')) || 1);

  const colors = useMemo(() => [...new Set(products.map(product => normalize(product.color.trim())).filter(Boolean))].sort(), [products]);

  const visible = useMemo(() => {
    const needle = normalize(query);
    const list = products.filter(product => {
      if (category !== 'all' && product.category !== category) return false;
      if (color && normalize(product.color.trim()) !== color) return false;
      if (min && product.price < min) return false;
      if (max && product.price > max) return false;
      return !needle || normalize(`${product.name} ${product.description} ${product.color} ${categoryName(product.category)}`).includes(needle);
    });
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, category, color, min, max, query, sort]);

  const counts = useMemo(() => {
    const result = { all: products.length };
    for (const product of products) result[product.category] = (result[product.category] ?? 0) + 1;
    return result;
  }, [products]);
  const countIn = id => counts[id] ?? 0;
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const shown = useMemo(() => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [visible, page]);
  const countRef = useRef(null);
  const firstRender = useRef(true);
  // Moving to another page brings the top of the list into view; the first render must not scroll.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    countRef.current?.scrollIntoView({ block: 'start' });
  }, [page]);
  const filtered = Boolean(category !== 'all' || color || min || max || query);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (!value || value === 'new') next.delete(key); else next.set(key, value);
    next.delete('page');
    setParams(next, { replace: true });
  }

  // The section is part of the address, the filters stay in the query string.
  function selectCategory(id) {
    const kept = new URLSearchParams(params);
    kept.delete('page');
    const search = kept.toString();
    navigate({ pathname: id === 'all' ? '/catalog' : `/catalog/${id}`, search: search ? `?${search}` : '' }, { replace: true });
  }

  // Links made before sections got their own address: /catalog?category=decor.
  const legacy = params.get('category');
  if (legacy) {
    const rest = new URLSearchParams(params);
    rest.delete('category');
    const search = rest.toString();
    return <Navigate replace to={{ pathname: legacy === 'all' ? '/catalog' : `/catalog/${legacy}`, search: search ? `?${search}` : '' }} />;
  }
  if (categoryParam && siteStatus === 'ready' && !known) return <Navigate replace to="/catalog" />;

  return (
    <main id="main" className="page">
      <nav className="crumbs" aria-label="Путь">
        <Link to="/">Главная</Link>
        <Link to="/catalog">Каталог</Link>
        {category !== 'all' && <Link to={`/catalog/${category}`}>{title}</Link>}
      </nav>
      <h1 className="page-title">{title}</h1>

      <CategorySquares active={category} onSelect={selectCategory} counts={countIn} />

      <div className="toolbar" role="group" aria-label="Фильтры">
        <div className="price-range">
          <label><span className="visually-hidden">Цена от, ₽</span><input name="min" inputMode="numeric" autoComplete="off" placeholder="Цена от" value={params.get('min') ?? ''} onChange={event => update('min', event.target.value.replace(/\D/g, ''))} /></label>
          <label><span className="visually-hidden">Цена до, ₽</span><input name="max" inputMode="numeric" autoComplete="off" placeholder="до" value={params.get('max') ?? ''} onChange={event => update('max', event.target.value.replace(/\D/g, ''))} /></label>
        </div>
        {colors.length > 0 && (
          <div className="color-chips" role="group" aria-label="Цвет">
            {colors.map(item => (
              <button key={item} type="button" className={`chip${color === item ? ' is-active' : ''}`} aria-pressed={color === item} onClick={() => update('color', color === item ? '' : item)}>{item}</button>
            ))}
          </div>
        )}
        <label className="sort"><span className="visually-hidden">Сортировка</span>
          <select value={sort} onChange={event => update('sort', event.target.value)}>
            <option value="new">Сначала новые</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
          </select>
        </label>
      </div>

      <div className="count" role="status" ref={countRef}>
        {status === 'ready' && <span>Найдено: {visible.length}{pages > 1 ? `, показаны ${(page - 1) * PAGE_SIZE + 1}-${(page - 1) * PAGE_SIZE + shown.length}` : ''}{query ? `, по запросу «${query}»` : ''}</span>}
        {filtered && <button className="link-button" type="button" onClick={() => navigate('/catalog', { replace: true })}>Сбросить</button>}
      </div>

      {status === 'error' ? (
        <p className="state-message">Каталог не загрузился. <button className="link-button" type="button" onClick={reload}>Повторить</button></p>
      ) : status === 'ready' && visible.length === 0 ? (
        <p className="state-message">{filtered ? 'По этим условиям ничего не нашлось. Уберите фильтр или измените запрос.' : 'Здесь пока нет предметов.'}</p>
      ) : (
        <div className="grid">{status === 'loading' ? <TileSkeletons count={8} /> : shown.map(product => <ProductTile key={product.id} product={product} />)}</div>
      )}
      {status === 'ready' && pages > 1 && <Pager page={page} pages={pages} params={params} />}
    </main>
  );
}

// 1 2 3 ... 9 10: the first, the last and the neighbours of the current page.
function pageList(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const list = [];
  let last = 0;
  for (const number of [...wanted].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (number - last > 1) list.push('gap');
    list.push(number);
    last = number;
  }
  return list;
}

function Pager({ page, pages, params }) {
  const to = number => {
    const next = new URLSearchParams(params);
    if (number === 1) next.delete('page'); else next.set('page', String(number));
    const search = next.toString();
    return { search: search ? `?${search}` : '' };
  };
  return (
    <nav className="pager" aria-label="Страницы каталога">
      {page > 1 ? <Link className="pager-step" to={to(page - 1)}>Назад</Link> : <span className="pager-step is-off">Назад</span>}
      <ol>
        {pageList(page, pages).map((item, index) => item === 'gap'
          ? <li key={`gap${index}`} className="pager-gap" aria-hidden="true">...</li>
          : <li key={item}><Link to={to(item)} aria-current={item === page ? 'page' : undefined} aria-label={`Страница ${item}`}>{item}</Link></li>)}
      </ol>
      {page < pages ? <Link className="pager-step" to={to(page + 1)}>Вперёд</Link> : <span className="pager-step is-off">Вперёд</span>}
    </nav>
  );
}

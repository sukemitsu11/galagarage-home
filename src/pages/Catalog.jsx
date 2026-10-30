import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CategorySquares from '../components/CategorySquares.jsx';
import ProductTile, { TileSkeletons } from '../components/ProductTile.jsx';
import { useSite } from '../site.jsx';
import { useProducts } from '../store.jsx';

const normalize = text => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');

export default function Catalog() {
  const { status, products, reload } = useProducts();
  const { categories, categoryName } = useSite();
  const [params, setParams] = useSearchParams();
  const category = categories.some(item => item.id === params.get('category')) ? params.get('category') : 'all';
  const sort = ['price-asc', 'price-desc'].includes(params.get('sort')) ? params.get('sort') : 'new';
  const query = (params.get('q') ?? '').trim();
  const color = params.get('color') ?? '';
  const min = Number(params.get('min')) || 0;
  const max = Number(params.get('max')) || 0;

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

  const countIn = id => products.filter(product => id === 'all' || product.category === id).length;
  const filtered = Boolean(category !== 'all' || color || min || max || query);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || value === 'new') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }

  return (
    <main id="main" className="page">
      <nav className="crumbs" aria-label="Путь"><Link to="/">Главная</Link><Link to="/catalog">Каталог</Link></nav>
      <h1 className="page-title">{category === 'all' ? 'Каталог' : categoryName(category)}</h1>

      <CategorySquares active={category} onSelect={id => update('category', id)} counts={countIn} />

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

      <div className="count" role="status">
        {status === 'ready' && <span>Найдено: {visible.length}{query ? `, по запросу «${query}»` : ''}</span>}
        {filtered && <button className="link-button" type="button" onClick={() => setParams({}, { replace: true })}>Сбросить</button>}
      </div>

      {status === 'error' ? (
        <p className="state-message">Каталог не загрузился. <button className="link-button" type="button" onClick={reload}>Повторить</button></p>
      ) : status === 'ready' && visible.length === 0 ? (
        <p className="state-message">{filtered ? 'По этим условиям ничего не нашлось. Уберите фильтр или измените запрос.' : 'Здесь пока нет предметов.'}</p>
      ) : (
        <div className="grid">{status === 'loading' ? <TileSkeletons count={8} /> : visible.map(product => <ProductTile key={product.id} product={product} />)}</div>
      )}
    </main>
  );
}

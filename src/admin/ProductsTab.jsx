import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatPrice } from '../lib.js';
import { useSite } from '../site.jsx';
import { useProducts } from '../store.jsx';
import { Field, PhotoList, useUnsavedWarning } from './shared.jsx';

const blank = { id: 0, name: '', category: '', price: '', color: '', heightCm: '', widthCm: '', lengthCm: '', description: '', specs: [], images: [], published: true };

function toForm(product, fallbackCategory) {
  return {
    ...blank, ...product,
    category: product.category || fallbackCategory,
    price: product.price === '' || product.price === undefined ? '' : String(product.price),
    heightCm: product.heightCm ?? '', widthCm: product.widthCm ?? '', lengthCm: product.lengthCm ?? '',
    specs: (product.specs || []).map(spec => ({ ...spec })),
    images: [...(product.images || [])]
  };
}

const number = value => {
  const text = String(value).trim().replace(',', '.');
  return text === '' ? null : Number(text);
};

function ProductForm({ initial, onSaved, onClose }) {
  const { categories } = useSite();
  const start = useMemo(() => toForm(initial, categories[0]?.id ?? ''), [initial, categories]);
  const [form, setForm] = useState(start);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(start);
  useUnsavedWarning(dirty);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setImages = update => setForm(current => ({ ...current, images: typeof update === 'function' ? update(current.images) : update }));
  const updateSpec = (index, key, value) => set('specs', form.specs.map((spec, i) => i === index ? { ...spec, [key]: value } : spec));

  async function submit(event) {
    event.preventDefault();
    setError('');
    const price = Number(String(form.price).replace(/\s/g, ''));
    if (!Number.isInteger(price) || price < 0) return setError('Цена: целое число рублей, например 4500');
    const dimensions = { heightCm: number(form.heightCm), widthCm: number(form.widthCm), lengthCm: number(form.lengthCm) };
    if (Object.values(dimensions).some(value => value !== null && !(value > 0))) return setError('Размеры: числа в сантиметрах, например 82 или 46,5');
    setBusy(true);
    try {
      const saved = await api.saveProduct({ ...form, ...dimensions, price });
      onSaved(saved, form.id ? 'Изменения сохранены' : 'Товар добавлен');
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  function close() {
    if (dirty && !confirmLeave) return setConfirmLeave(true);
    onClose();
  }

  return (
    <form className="panel product-form" onSubmit={submit}>
      <div className="panel-head">
        <h2>{form.id ? 'Редактирование товара' : 'Новый товар'}</h2>
        <button className="link" type="button" onClick={close}>К списку товаров</button>
      </div>
      <p className="form-intro">Всё, что вы здесь заполните, увидят покупатели. Обязательные поля: название, раздел и цена. Остальное можно добавить позже.</p>
      {confirmLeave && (
        <div className="confirm" role="alert">
          <span>Есть несохранённые изменения.</span>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Выйти без сохранения</button>
          <button className="btn btn-secondary" type="button" onClick={() => setConfirmLeave(false)}>Продолжить редактирование</button>
        </div>
      )}

      <div className="form-columns">
        <div className="form-main">
          <Field id="f-name" label="Название" hint="Показывается под фото в каталоге, заголовком на странице товара и в сообщении заказа. Например: «Ваза Mushroom».">
            <input id="f-name" name="name" autoComplete="off" required maxLength={120} value={form.name} onChange={event => set('name', event.target.value)} aria-describedby="f-name-hint" />
          </Field>
          <Field id="f-category" label="Раздел" hint="Раздел каталога, где лежит товар. Разделы создаются на вкладке «Разделы».">
            <select id="f-category" name="category" value={form.category} onChange={event => set('category', event.target.value)} required aria-describedby="f-category-hint">
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
          <div className="field-row two">
            <Field id="f-price" label="Цена, ₽" hint="Целое число рублей. Видна в каталоге и попадает в сообщение заказа.">
              <input id="f-price" name="price" autoComplete="off" required inputMode="numeric" placeholder="4500" value={form.price} onChange={event => set('price', event.target.value)} aria-describedby="f-price-hint" />
            </Field>
            <Field id="f-color" label="Цвет" hint="Показывается на странице товара. По этим цветам покупатели фильтруют каталог.">
              <input id="f-color" name="color" autoComplete="off" maxLength={40} placeholder="Серый" value={form.color} onChange={event => set('color', event.target.value)} aria-describedby="f-color-hint" />
            </Field>
          </div>
          <fieldset className="field">
            <legend>Размеры, см</legend>
            <p className="field-hint">Необязательно. Показываются в таблице характеристик на странице товара. Дробные числа пишите через запятую: 46,5.</p>
            <div className="field-row">
              {[['heightCm', 'Высота'], ['widthCm', 'Ширина'], ['lengthCm', 'Длина']].map(([key, label]) => (
                <div className="field" key={key}>
                  <label htmlFor={`f-${key}`}>{label}</label>
                  <input id={`f-${key}`} name={key} autoComplete="off" inputMode="decimal" value={form[key]} onChange={event => set(key, event.target.value)} />
                </div>
              ))}
            </div>
          </fieldset>
          <Field id="f-description" label="Описание" hint="Короткий рассказ о предмете на странице товара: из чего сделан, для чего подходит. Можно оставить пустым.">
            <textarea id="f-description" name="description" autoComplete="off" rows="5" maxLength={4000} value={form.description} onChange={event => set('description', event.target.value)} aria-describedby="f-description-hint" />
          </Field>
          <fieldset className="field">
            <legend>Характеристики</legend>
            <p className="field-hint">Пары «название и значение», например «Материал: дуб». Показываются таблицей на странице товара, под цветом и размерами.</p>
            {form.specs.map((spec, index) => (
              <div className="spec-row" key={index}>
                <input aria-label={`Название характеристики ${index + 1}`} placeholder="Материал" maxLength={60} value={spec.label} onChange={event => updateSpec(index, 'label', event.target.value)} />
                <input aria-label={`Значение характеристики ${index + 1}`} placeholder="Дуб, шпон" maxLength={200} value={spec.value} onChange={event => updateSpec(index, 'value', event.target.value)} />
                <button className="link danger" type="button" onClick={() => set('specs', form.specs.filter((_, i) => i !== index))}>Убрать</button>
              </div>
            ))}
            {form.specs.length < 20 && <button className="btn btn-secondary btn-small" type="button" onClick={() => set('specs', [...form.specs, { label: '', value: '' }])}>Добавить характеристику</button>}
          </fieldset>
        </div>

        <div className="form-side">
          <fieldset className="field">
            <legend>Фотографии</legend>
            <p className="field-hint">Первое фото показывается в каталоге и на главной, остальные листаются на странице товара. Лучше всего подходят квадратные фото от 800 px.</p>
            <PhotoList images={form.images} onChange={setImages} onError={setError} />
          </fieldset>
          <label className="switch">
            <input type="checkbox" checked={form.published} onChange={event => set('published', event.target.checked)} />
            <span>
              Показывать на сайте
              <small>Если выключить, товар пропадёт с сайта, но останется в этом списке и его можно вернуть.</small>
            </span>
          </label>
        </div>
      </div>

      <div className="form-footer">
        <p className="form-error" role="alert">{error}</p>
        <button className="btn btn-secondary" type="button" onClick={close}>Отмена</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
      </div>
    </form>
  );
}

export default function ProductsTab({ onNotice, onUnauthorized }) {
  const { categories, categoryName } = useSite();
  const catalog = useProducts();
  const [state, setState] = useState({ status: 'loading', products: [] });
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.adminProducts()
      .then(products => setState({ status: 'ready', products }))
      .catch(failure => failure.status === 401 ? onUnauthorized() : setState({ status: 'error', products: [] }));
  }, [onUnauthorized]);

  useEffect(load, [load]);

  const refresh = () => { load(); catalog.reload(); };

  const visible = state.products.filter(product =>
    (category === 'all' || product.category === category) &&
    (visibility === 'all' || (visibility === 'shown') === product.published) &&
    (!query.trim() || product.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))));

  async function togglePublished(product) {
    setError('');
    try {
      await api.saveProduct({ ...product, published: !product.published });
      onNotice(product.published ? 'Товар скрыт с сайта' : 'Товар снова на сайте');
      refresh();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function remove(id) {
    setError('');
    try {
      await api.deleteProduct(id);
      setConfirmId(null);
      onNotice('Товар удалён');
      refresh();
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (editing) {
    return (
      <ProductForm
        initial={editing === 'new' ? { ...blank, category: category !== 'all' ? category : '' } : editing}
        onClose={() => setEditing(null)}
        onSaved={(saved, message) => { onNotice(message); setEditing(null); refresh(); }}
      />
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Товары <span className="muted">{state.products.length}</span></h2>
        <button className="btn btn-primary" type="button" onClick={() => setEditing('new')} disabled={categories.length === 0}>Добавить товар</button>
      </div>
      {categories.length === 0 && <p className="hint">Сначала создайте хотя бы один раздел на вкладке «Разделы».</p>}
      <div className="filters">
        <label className="visually-hidden" htmlFor="p-search">Поиск по названию</label>
        <input id="p-search" type="search" name="q" autoComplete="off" placeholder="Поиск по названию…" value={query} onChange={event => setQuery(event.target.value)} />
        <label className="visually-hidden" htmlFor="p-category">Раздел</label>
        <select id="p-category" value={category} onChange={event => setCategory(event.target.value)}>
          <option value="all">Все разделы</option>
          {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="p-visibility">Видимость</label>
        <select id="p-visibility" value={visibility} onChange={event => setVisibility(event.target.value)}>
          <option value="all">Все товары</option>
          <option value="shown">Показаны на сайте</option>
          <option value="hidden">Скрыты</option>
        </select>
      </div>
      <p className="form-error" role="alert">{error}</p>
      {state.status === 'loading' && <p className="hint">Загружаем товары…</p>}
      {state.status === 'error' && <p className="hint">Не удалось загрузить товары. <button className="link" type="button" onClick={load}>Повторить</button></p>}
      {state.status === 'ready' && visible.length === 0 && (
        <p className="empty">{state.products.length === 0 ? 'Товаров пока нет. Нажмите «Добавить товар».' : 'По этим условиям товаров нет.'}</p>
      )}
      <ul className="rows">
        {visible.map(product => (
          <li key={product.id} className={product.published ? '' : 'is-hidden'}>
            {product.images[0] ? <img src={product.images[0]} alt="" width="56" height="56" /> : <span className="no-photo">Нет фото</span>}
            <button className="row-main" type="button" onClick={() => setEditing(product)}>
              <strong>{product.name}</strong>
              <span>{categoryName(product.category) || product.category}{product.color ? `, ${product.color}` : ''}</span>
            </button>
            <span className="row-price">{formatPrice(product.price)}</span>
            <span className={`status ${product.published ? 'is-on' : 'is-off'}`}>{product.published ? 'На сайте' : 'Скрыт'}</span>
            <div className="row-actions">
              <button className="btn btn-secondary btn-small" type="button" onClick={() => setEditing(product)}>Изменить</button>
              <button className="btn btn-secondary btn-small" type="button" onClick={() => togglePublished(product)}>{product.published ? 'Скрыть' : 'Показать'}</button>
              {confirmId === product.id ? (
                <>
                  <button className="btn btn-danger btn-small" type="button" onClick={() => remove(product.id)}>Да, удалить</button>
                  <button className="btn btn-secondary btn-small" type="button" onClick={() => setConfirmId(null)}>Отмена</button>
                </>
              ) : <button className="btn btn-ghost btn-small danger" type="button" onClick={() => setConfirmId(product.id)}>Удалить</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

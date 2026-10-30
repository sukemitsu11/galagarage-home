import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSite } from '../site.jsx';
import CategorySquares from '../components/CategorySquares.jsx';
import { PreviewPanel, SiteDraft } from './Preview.jsx';
import { FileButton, uploadFiles } from './shared.jsx';

function CategoryEditor({ category, onSave, onCancel, submitLabel }) {
  const site = useSite();
  const [name, setName] = useState(category.name);
  const [image, setImage] = useState(category.image);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function replace(files) {
    setBusy(true);
    const { urls, errors } = await uploadFiles(files.slice(0, 1));
    setBusy(false);
    if (urls[0]) setImage(urls[0]);
    setError(errors.join('. '));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ ...category, name, image });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  const inputId = `c-name-${category.id || 'new'}`;
  const draftId = category.id || 'new';
  // The same row visitors see on the home page, with this category as typed.
  const draftCategories = category.id
    ? site.categories.map(item => item.id === category.id ? { ...item, name: name.trim() || 'Название раздела', image } : item)
    : [...site.categories, { id: 'new', name: name.trim() || 'Название раздела', image }];
  return (
    <div className="category-edit">
    <form className="category-editor" onSubmit={submit}>
      <div className="category-photo">
        {image ? <img src={image} alt="" width="120" height="120" /> : <span className="no-photo">Нет фото</span>}
        <FileButton id={`c-photo-${category.id || 'new'}`} label={busy ? 'Загружаем…' : image ? 'Заменить фото' : 'Загрузить фото'} disabled={busy} onFiles={replace} />
      </div>
      <div className="field">
        <label htmlFor={inputId}>Название раздела</label>
        <input id={inputId} name="name" autoComplete="off" required maxLength={60} value={name} onChange={event => setName(event.target.value)} />
        <p className="form-error" role="alert">{error}</p>
        <div className="inline-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{submitLabel}</button>
          {onCancel && <button className="btn btn-secondary" type="button" onClick={onCancel}>Отмена</button>}
        </div>
      </div>
    </form>
    <PreviewPanel title="Разделы на главной" highlight={`category-${draftId}`} width={760}>
      <SiteDraft categories={draftCategories}>
        <div className="shelf"><div className="shelf-head"><h2>Разделы</h2></div><CategorySquares /></div>
      </SiteDraft>
    </PreviewPanel>
    </div>
  );
}

export default function CategoriesTab({ onNotice, onUnauthorized }) {
  const site = useSite();
  const [counts, setCounts] = useState({});
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');

  const loadCounts = useCallback(() => {
    api.adminProducts()
      .then(products => setCounts(products.reduce((acc, product) => ({ ...acc, [product.category]: (acc[product.category] || 0) + 1 }), {})))
      .catch(failure => { if (failure.status === 401) onUnauthorized(); });
  }, [onUnauthorized]);

  useEffect(loadCounts, [loadCounts]);

  async function run(action, message) {
    setError('');
    try {
      await action();
      site.reload();
      loadCounts();
      onNotice(message);
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  }

  const move = (index, delta) => {
    const ids = site.categories.map(category => category.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    run(() => api.orderCategories(ids), 'Порядок разделов сохранён');
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Разделы <span className="muted">{site.categories.length}</span></h2>
        {!adding && <button className="btn btn-primary" type="button" onClick={() => setAdding(true)}>Добавить раздел</button>}
      </div>
      <p className="hint">Разделы показываются квадратами на главной и в каталоге в этом порядке. Фото лучше квадратное, от 800 px.</p>
      <p className="form-error" role="alert">{error}</p>

      {adding && (
        <div className="row-card">
          <CategoryEditor
            category={{ id: '', name: '', image: '' }}
            submitLabel="Создать раздел"
            onCancel={() => setAdding(false)}
            onSave={async category => { if (await run(() => api.createCategory(category), 'Раздел добавлен')) setAdding(false); }}
          />
        </div>
      )}

      <ul className="rows">
        {site.categories.map((category, index) => (
          <li key={category.id} className="category-row">
            {editing === category.id ? (
              <CategoryEditor
                category={category}
                submitLabel="Сохранить"
                onCancel={() => setEditing(null)}
                onSave={async next => { if (await run(() => api.updateCategory(next), 'Раздел сохранён')) setEditing(null); }}
              />
            ) : (
              <>
                {category.image ? <img src={category.image} alt="" width="56" height="56" /> : <span className="no-photo">Нет фото</span>}
                <div className="row-main as-text">
                  <strong>{category.name}</strong>
                  <span>Товаров: {counts[category.id] || 0}</span>
                </div>
                <div className="row-actions">
                  <button className="btn btn-secondary btn-small" type="button" disabled={index === 0} onClick={() => move(index, -1)}>Выше</button>
                  <button className="btn btn-secondary btn-small" type="button" disabled={index === site.categories.length - 1} onClick={() => move(index, 1)}>Ниже</button>
                  <button className="btn btn-secondary btn-small" type="button" onClick={() => setEditing(category.id)}>Изменить</button>
                  {confirmId === category.id ? (
                    <>
                      <button className="btn btn-danger btn-small" type="button" onClick={async () => { if (await run(() => api.deleteCategory(category.id), 'Раздел удалён')) setConfirmId(null); }}>Да, удалить</button>
                      <button className="btn btn-secondary btn-small" type="button" onClick={() => setConfirmId(null)}>Отмена</button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-small danger"
                      type="button"
                      disabled={(counts[category.id] || 0) > 0}
                      title={(counts[category.id] || 0) > 0 ? 'Сначала перенесите товары в другой раздел' : undefined}
                      onClick={() => setConfirmId(category.id)}
                    >Удалить</button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {site.categories.length === 0 && site.status === 'ready' && <p className="empty">Разделов пока нет. Добавьте первый, чтобы создавать товары.</p>}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Uploads files one by one and reports which ones failed.
export async function uploadFiles(files) {
  const urls = [];
  const errors = [];
  for (const file of files) {
    try {
      const { url } = await api.upload(file);
      urls.push(url);
    } catch (failure) {
      errors.push(`${file.name}: ${failure.message}`);
    }
  }
  return { urls, errors };
}

// Warns before closing the tab while a form has unsaved changes.
export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

export function FileButton({ id, label, multiple = false, disabled, onFiles }) {
  return (
    <>
      <label className={`file-label${disabled ? ' is-disabled' : ''}`} htmlFor={id}>{label}</label>
      <input
        id={id}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        disabled={disabled}
        onChange={event => { const files = [...event.target.files]; event.target.value = ''; if (files.length) onFiles(files); }}
      />
    </>
  );
}

// Product photos: upload several, reorder, choose the main one, remove.
export function PhotoList({ images, onChange, max = 10, onError }) {
  const [uploading, setUploading] = useState(false);

  async function add(files) {
    setUploading(true);
    const { urls, errors } = await uploadFiles(files.slice(0, max - images.length));
    setUploading(false);
    if (urls.length) onChange(current => [...current, ...urls]);
    onError(errors.join('. '));
  }

  const move = (index, delta) => onChange(current => {
    const next = [...current];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    return next;
  });

  return (
    <div className="photos">
      {images.length > 0 && (
        <ul className="photo-grid">
          {images.map((src, index) => (
            <li key={src}>
              <img src={src} alt={`Фото ${index + 1}`} width="160" height="160" />
              {index === 0 && <span className="photo-main">Главное</span>}
              <div className="photo-actions">
                {index > 0 && <button type="button" onClick={() => move(index, -1)}>Левее</button>}
                {index < images.length - 1 && <button type="button" onClick={() => move(index, 1)}>Правее</button>}
                {index > 0 && <button type="button" onClick={() => onChange(current => [src, ...current.filter(item => item !== src)])}>Сделать главным</button>}
                <button type="button" className="danger" onClick={() => onChange(current => current.filter(item => item !== src))}>Убрать</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length < max && (
        <div className="photo-add">
          <FileButton id="product-photos" label={uploading ? 'Загружаем…' : 'Добавить фото'} multiple disabled={uploading} onFiles={add} />
          <span className="hint">JPG, PNG или WebP до 6 МБ. Можно выбрать несколько. Первое фото показывается в каталоге.</span>
        </div>
      )}
    </div>
  );
}

// A short "Сохранено" message that disappears by itself.
export function useNotice() {
  const [notice, setNotice] = useState('');
  const timer = useRef(0);
  const show = text => {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(''), 3500);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return [notice, show];
}

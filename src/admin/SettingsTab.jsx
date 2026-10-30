import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useSite } from '../site.jsx';
import { Field, FileButton, uploadFiles, useUnsavedWarning } from './shared.jsx';

const contactFields = [
  ['phone', 'Телефон', '+7 (913) 608-07-35', 'Показывается в блоке «Бутик» и в подвале. На телефоне по нажатию начинается звонок.'],
  ['whatsapp', 'WhatsApp', '79136080735', 'Номер только цифрами, с кодом страны. На него уходит заказ из корзины и со страницы товара.'],
  ['telegram', 'Telegram', '+79136080735', 'Куда уходит заказ в Telegram: номер с плюсом или имя пользователя без @. Для номера в Telegram должен быть разрешён поиск по номеру.'],
  ['channel', 'Telegram-канал', 'galagarage_home', 'Ссылка на канал в подвале. Имя без @. Можно оставить пустым.'],
  ['address', 'Адрес', 'Омск, улица Карла Либкнехта, 26', 'Показывается в блоке «Бутик» и в подвале.'],
  ['hours', 'Часы работы', 'Ежедневно, 11:00–20:00', 'Показываются в блоке «Бутик» и в подвале.'],
  ['gisUrl', 'Ссылка на 2ГИС', 'https://2gis.ru/omsk/firm/…', 'Ссылки «Маршрут и отзывы» в блоке «Бутик» и «Мы в 2ГИС» в подвале. Скопируйте адрес карточки бутика из 2ГИС.']
];

export default function SettingsTab(props) {
  const site = useSite();
  if (site.status === 'loading') return <section className="panel"><p className="hint">Загружаем настройки…</p></section>;
  if (site.status === 'error') return <section className="panel"><p className="hint">Не удалось загрузить настройки. <button className="link" type="button" onClick={site.reload}>Повторить</button></p></section>;
  return <SettingsForm {...props} />;
}

function SettingsForm({ onNotice }) {
  const site = useSite();
  const start = useMemo(() => ({ ...site.settings, bannerImages: [...site.settings.bannerImages] }), [site.settings]);
  const [form, setForm] = useState(start);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(-1);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(start);
  useUnsavedWarning(dirty);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function replaceBanner(index, files) {
    setUploading(index);
    const { urls, errors } = await uploadFiles(files.slice(0, 1));
    setUploading(-1);
    if (urls[0]) setForm(current => ({ ...current, bannerImages: current.bannerImages.map((src, i) => i === index ? urls[0] : src) }));
    setError(errors.join('. '));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.saveSettings(form);
      site.reload();
      onNotice('Настройки сохранены');
    } catch (failure) {
      setError(failure.message);
    }
    setBusy(false);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-head"><h2>Настройки сайта</h2></div>
      <p className="form-intro">Здесь контакты бутика и верх главной страницы. Под каждым полем написано, где это видно на сайте. Изменения появятся у покупателей сразу после сохранения.</p>

      <fieldset className="settings-group">
        <legend>Контакты бутика</legend>
        <div className="settings-grid">
          {contactFields.map(([key, label, placeholder, hint]) => (
            <Field key={key} id={`s-${key}`} label={label} hint={hint}>
              <input id={`s-${key}`} name={key} autoComplete="off" spellCheck={false} placeholder={placeholder} value={form[key]} onChange={event => set(key, event.target.value)} aria-describedby={`s-${key}-hint`} />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Верх главной страницы</legend>
        <div className="settings-grid">
          <Field id="s-title" label="Заголовок" hint="Крупная надпись над кнопкой «Смотреть каталог» на главной странице.">
            <input id="s-title" name="bannerTitle" autoComplete="off" maxLength={80} value={form.bannerTitle} onChange={event => set('bannerTitle', event.target.value)} aria-describedby="s-title-hint" />
          </Field>
          <Field id="s-text" label="Строка под заголовком" hint="Одна фраза о бутике под заголовком. Можно оставить пустой.">
            <input id="s-text" name="bannerText" autoComplete="off" maxLength={200} value={form.bannerText} onChange={event => set('bannerText', event.target.value)} aria-describedby="s-text-hint" />
          </Field>
        </div>
        <p className="field-label">Три фото главной страницы</p>
        <p className="field-hint">Показываются в ряд под шапкой сайта, слева направо. Лучше вертикальные фото от 800 px по короткой стороне.</p>
        <ul className="banner-slots">
          {form.bannerImages.map((src, index) => (
            <li key={index}>
              <img src={src} alt={`Фото ${index + 1} на главной`} width="200" height="260" />
              <span className="slot-name">{['Слева', 'По центру', 'Справа'][index]}</span>
              <FileButton id={`s-banner-${index}`} label={uploading === index ? 'Загружаем…' : 'Заменить'} disabled={uploading !== -1} onFiles={files => replaceBanner(index, files)} />
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="form-footer">
        <p className="form-error" role="alert">{error}</p>
        {dirty && <button className="btn btn-secondary" type="button" onClick={() => setForm(start)}>Отменить изменения</button>}
        <button className="btn btn-primary" type="submit" disabled={busy || !dirty}>{busy ? 'Сохраняем…' : 'Сохранить настройки'}</button>
      </div>
    </form>
  );
}

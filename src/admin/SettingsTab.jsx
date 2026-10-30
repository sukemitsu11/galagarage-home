import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useSite } from '../site.jsx';
import Banner from '../components/Banner.jsx';
import Boutique from '../components/Boutique.jsx';
import Footer from '../components/Footer.jsx';
import { contactsFrom } from '../config.js';
import { PreviewPanel, SiteDraft, useFocusedField } from './Preview.jsx';
import { FileButton, uploadFiles, useUnsavedWarning } from './shared.jsx';

const contactFields = [
  ['phone', 'Телефон', '+7 (913) 608-07-35', 'Показывается на сайте, по нажатию звонок.'],
  ['whatsapp', 'WhatsApp', '79136080735', 'Номер только цифрами, на него придут заказы из корзины.'],
  ['telegram', 'Telegram', '+79136080735', 'Номер с плюсом или имя пользователя без @. Для номера включите в Telegram поиск по номеру.'],
  ['channel', 'Telegram-канал', 'galagarage_home', 'Имя канала без @. Можно оставить пустым.'],
  ['address', 'Адрес', 'Омск, улица Карла Либкнехта, 26', ''],
  ['hours', 'Часы работы', 'Ежедневно, 11:00–20:00', ''],
  ['gisUrl', 'Ссылка на 2ГИС', 'https://2gis.ru/omsk/firm/…', 'Карточка бутика: маршрут и отзывы.']
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
  const [focus, focusProps] = useFocusedField();
  const [tab, setTab] = useState('banner');

  // Banner fields show the top of the home page, contact fields show the bottom.
  useEffect(() => {
    if (focus.startsWith('banner')) setTab('banner');
    else if (focus) setTab('contacts');
  }, [focus]);

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
    <div className="edit-layout">
    <form className="panel" onSubmit={submit} {...focusProps}>
      <div className="panel-head"><h2>Настройки сайта</h2></div>

      <fieldset className="settings-group">
        <legend>Контакты</legend>
        <p className="hint">Эти данные выводятся в шапке, подвале, блоке «Бутик» и подставляются в ссылки на заказ.</p>
        <div className="settings-grid">
          {contactFields.map(([key, label, placeholder, hint]) => (
            <div className="field" key={key} data-field={key}>
              <label htmlFor={`s-${key}`}>{label}</label>
              <input id={`s-${key}`} name={key} autoComplete="off" spellCheck={false} placeholder={placeholder} value={form[key]} onChange={event => set(key, event.target.value)} aria-describedby={hint ? `s-${key}-hint` : undefined} />
              {hint && <span className="hint" id={`s-${key}-hint`}>{hint}</span>}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Главная страница</legend>
        <div className="settings-grid">
          <div className="field" data-field="bannerTitle">
            <label htmlFor="s-title">Заголовок баннера</label>
            <input id="s-title" name="bannerTitle" autoComplete="off" maxLength={80} value={form.bannerTitle} onChange={event => set('bannerTitle', event.target.value)} />
          </div>
          <div className="field" data-field="bannerText">
            <label htmlFor="s-text">Текст под заголовком</label>
            <input id="s-text" name="bannerText" autoComplete="off" maxLength={200} value={form.bannerText} onChange={event => set('bannerText', event.target.value)} />
          </div>
        </div>
        <p className="field-label">Три фото баннера</p>
        <ul className="banner-slots">
          {form.bannerImages.map((src, index) => (
            <li key={index} data-field={`bannerImages-${index}`}>
              <img src={src} alt={`Фото баннера ${index + 1}`} width="200" height="260" />
              <FileButton id={`s-banner-${index}`} label={uploading === index ? 'Загружаем…' : 'Заменить'} disabled={uploading !== -1} onFiles={files => replaceBanner(index, files)} />
            </li>
          ))}
        </ul>
        <p className="hint">Лучше вертикальные фото, от 800 px по короткой стороне.</p>
      </fieldset>

      <div className="form-footer">
        <p className="form-error" role="alert">{error}</p>
        {dirty && <button className="btn btn-secondary" type="button" onClick={() => setForm(start)}>Отменить изменения</button>}
        <button className="btn btn-primary" type="submit" disabled={busy || !dirty}>{busy ? 'Сохраняем…' : 'Сохранить настройки'}</button>
      </div>
    </form>
    <PreviewPanel
      title={tab === 'banner' ? 'Главная страница, баннер' : 'Контакты и подвал'}
      tabs={[{ id: 'banner', label: 'Баннер' }, { id: 'contacts', label: 'Контакты' }]}
      tab={tab}
      onTab={setTab}
      highlight={focus}
      width={820}
    >
      <SiteDraft settings={form}>
        {tab === 'banner' ? <Banner settings={form} /> : <><Boutique contacts={contactsFrom(form)} /><Footer /></>}
      </SiteDraft>
    </PreviewPanel>
    </div>
  );
}

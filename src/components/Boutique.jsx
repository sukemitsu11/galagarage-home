import { useEffect, useState } from 'react';

// The "Бутик" block of the home page: address, hours, phone and ways to get there.
export default function Boutique({ contacts }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(contacts.address);
      setCopied(true);
    } catch { /* The address stays visible to copy by hand. */ }
  }

  return (
    <section className="boutique" id="boutique" aria-labelledby="boutique-title">
      <div>
        <h2 id="boutique-title">Бутик Galagarage home</h2>
        <p>Приходите рассмотреть предметы вживую: в бутике есть то, что не попало на сайт.</p>
      </div>
      <div>
        <dl className="facts">
          <div><dt>Адрес</dt><dd>{contacts.address}</dd></div>
          <div><dt>Часы</dt><dd>{contacts.hours}</dd></div>
          <div><dt>Телефон</dt><dd><a href={contacts.phoneHref}>{contacts.phone}</a></dd></div>
          {contacts.gis && <div><dt>2ГИС</dt><dd><a href={contacts.gis} target="_blank" rel="noopener noreferrer">Маршрут и отзывы, оценка 5</a></dd></div>}
        </dl>
        <div className="boutique-actions">
          <a className="button button-outline" href={`https://yandex.ru/maps/?text=${encodeURIComponent(contacts.address)}`} target="_blank" rel="noopener noreferrer">Маршрут в Яндекс Картах</a>
          {navigator.clipboard && <button className="button button-outline" type="button" onClick={copyAddress}>Скопировать адрес</button>}
          <span className="boutique-copied" role="status">{copied ? 'Адрес скопирован' : ''}</span>
        </div>
      </div>
    </section>
  );
}

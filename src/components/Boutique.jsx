// The "Бутик" block of the home page: address, hours and phone.
export default function Boutique({ contacts }) {
  return (
    <section className="boutique" id="boutique" aria-labelledby="boutique-title">
      <div>
        <h2 id="boutique-title">Бутик Galagarage home</h2>
        <p>Приходите рассмотреть предметы вживую: в бутике есть то, что не попало на сайт.</p>
      </div>
      <dl className="facts">
        <div><dt>Адрес</dt><dd>{contacts.address}</dd></div>
        <div><dt>Часы</dt><dd>{contacts.hours}</dd></div>
        <div><dt>Телефон</dt><dd><a href={contacts.phoneHref}>{contacts.phone}</a></dd></div>
        {contacts.gis && <div><dt>2ГИС</dt><dd><a href={contacts.gis} target="_blank" rel="noopener noreferrer">Маршрут и отзывы, оценка 5</a></dd></div>}
      </dl>
    </section>
  );
}

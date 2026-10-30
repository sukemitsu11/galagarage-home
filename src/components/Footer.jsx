import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function Footer() {
  const { categories, contacts } = useSite();
  return (
    <footer className="footer" id="contacts">
      <div className="footer-main">
        <section aria-labelledby="f-info">
          <h2 id="f-info">Информация</h2>
          <Link to="/#boutique">О бутике</Link>
          <Link to="/favorites">Избранное</Link>
          <a href={contacts.gis} target="_blank" rel="noopener noreferrer">Мы в 2ГИС</a>
        </section>
        <section aria-labelledby="f-catalog">
          <h2 id="f-catalog">Каталог</h2>
          <Link to="/catalog">Весь каталог</Link>
          {categories.map(category => <Link key={category.id} to={`/catalog?category=${category.id}`}>{category.name}</Link>)}
        </section>
        <section aria-labelledby="f-shop">
          <h2 id="f-shop">Бутик</h2>
          <a className="footer-phone" href={contacts.phoneHref}>{contacts.phone}</a>
          <address><span>{contacts.address}</span><br /><span>{contacts.hours}</span></address>
        </section>
        <section aria-labelledby="f-social">
          <h2 id="f-social">Мы в соцсетях</h2>
          <a href={`https://wa.me/${contacts.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href={contacts.telegramChat} target="_blank" rel="noopener noreferrer">Telegram</a>
          {contacts.telegramChannel && <a href={contacts.telegramChannel} target="_blank" rel="noopener noreferrer">Канал {contacts.channelHandle}</a>}
        </section>
      </div>
      <div className="footer-bottom">
        <span>© Galagarage home, 2026</span>
        <span>{contacts.address}</span>
      </div>
    </footer>
  );
}

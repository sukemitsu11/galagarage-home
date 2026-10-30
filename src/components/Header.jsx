import { Handbag, Heart, List, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Modal from '../Modal.jsx';
import { useSite } from '../site.jsx';
import { useCart, useFavorites } from '../store.jsx';

export function Wordmark() {
  return <Link className="wordmark" to="/" aria-label="Galagarage home, главная" translate="no"><span>GALAGARAGE</span><span className="wordmark-home">HOME</span></Link>;
}

export default function Header() {
  const { categories, contacts } = useSite();
  const cart = useCart();
  const favorites = useFavorites();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef(null);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [location]);
  useEffect(() => { if (searchOpen) input.current?.focus(); }, [searchOpen]);

  function submit(event) {
    event.preventDefault();
    const text = query.trim();
    navigate(text ? `/catalog?q=${encodeURIComponent(text)}` : '/catalog');
  }

  return (
    <>
      <header className="header">
        <div className="header-bar">
          <button className="menu-toggle" type="button" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
            <List size={22} weight="light" aria-hidden="true" /><span>Меню</span>
          </button>
          <Wordmark />
          <div className="header-icons">
            <button type="button" className="icon-button" aria-label="Поиск" aria-expanded={searchOpen} aria-controls="search-panel" onClick={() => setSearchOpen(!searchOpen)}>
              <MagnifyingGlass size={22} weight="light" aria-hidden="true" />
            </button>
            <Link to="/favorites" className="icon-button" aria-label={`Избранное, предметов: ${favorites.count}`}>
              <Heart size={22} weight="light" aria-hidden="true" />
              {favorites.count > 0 && <span className="badge" aria-hidden="true">{favorites.count}</span>}
            </Link>
            <button type="button" className="icon-button" aria-haspopup="dialog" aria-label={`Корзина, предметов: ${cart.count}`} onClick={() => cart.setOpen(true)}>
              <Handbag size={22} weight="light" aria-hidden="true" />
              {cart.count > 0 && <span className="badge" aria-hidden="true">{cart.count}</span>}
            </button>
          </div>
        </div>
        <form id="search-panel" className="search-panel" role="search" hidden={!searchOpen} onSubmit={submit}>
          <label className="visually-hidden" htmlFor="site-search">Поиск по каталогу</label>
          <input ref={input} id="site-search" name="q" type="search" placeholder="Например, ваза или плед…" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} />
          <button className="button button-primary" type="submit">Найти</button>
        </form>
      </header>
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} className="menu-drawer" labelledBy="menu-title">
        <h2 id="menu-title" className="visually-hidden">Меню</h2>
        <nav aria-label="Основная навигация">
          <Link to="/catalog">Весь каталог</Link>
          {categories.map(category => <Link key={category.id} to={`/catalog?category=${category.id}`}>{category.name}</Link>)}
          <Link to="/favorites">Избранное</Link>
          <Link to="/#boutique">О бутике</Link>
          <Link to="/#contacts">Контакты</Link>
        </nav>
        <a className="menu-phone" href={contacts.phoneHref}>{contacts.phone}</a>
      </Modal>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { api } from '../api.js';
import CategoriesTab from './CategoriesTab.jsx';
import ProductsTab from './ProductsTab.jsx';
import SettingsTab from './SettingsTab.jsx';
import { useNotice } from './shared.jsx';
import './admin.css';

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onDone();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <form className="panel" onSubmit={submit}>
        <p className="admin-brand" translate="no">Galagarage home</p>
        <h1>Вход в управление сайтом</h1>
        <div className="field">
          <label htmlFor="admin-password">Пароль</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required autoFocus value={password} onChange={event => setPassword(event.target.value)} aria-describedby="login-error" />
        </div>
        <p className="form-error" id="login-error" role="alert">{error}</p>
        <button className="btn btn-primary btn-wide" type="submit" disabled={busy}>{busy ? 'Проверяем…' : 'Войти'}</button>
        <Link className="link" to="/">Вернуться на сайт</Link>
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [auth, setAuth] = useState('checking');
  const [notice, showNotice] = useNotice();
  const signOut = useCallback(() => setAuth('out'), []);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.append(robots);
    document.title = 'Управление сайтом | Galagarage home';
    api.me().then(() => setAuth('in'), () => setAuth('out'));
    return () => robots.remove();
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    setAuth('out');
  }

  if (auth === 'checking') return <main className="admin-login"><p className="hint">Проверяем вход…</p></main>;
  if (auth === 'out') return <Login onDone={() => setAuth('in')} />;

  const tabProps = { onNotice: showNotice, onUnauthorized: signOut };
  return (
    <div className="admin">
      <header className="admin-top">
        <span className="admin-brand" translate="no">Galagarage home</span>
        <nav className="admin-tabs" aria-label="Разделы управления">
          <NavLink to="/admin/products">Товары</NavLink>
          <NavLink to="/admin/categories">Разделы</NavLink>
          <NavLink to="/admin/settings">Настройки</NavLink>
        </nav>
        <div className="admin-top-actions">
          <a className="link" href="/" target="_blank" rel="noopener">Открыть сайт</a>
          <button className="btn btn-secondary btn-small" type="button" onClick={logout}>Выйти</button>
        </div>
      </header>
      <main className="admin-main" id="main">
        <Routes>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<ProductsTab {...tabProps} />} />
          <Route path="categories" element={<CategoriesTab {...tabProps} />} />
          <Route path="settings" element={<SettingsTab {...tabProps} />} />
          <Route path="*" element={<Navigate to="products" replace />} />
        </Routes>
      </main>
      <div className={`toast${notice ? ' is-visible' : ''}`} role="status" aria-live="polite">{notice}</div>
    </div>
  );
}

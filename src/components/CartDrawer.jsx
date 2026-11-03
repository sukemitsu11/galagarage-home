import { Link } from 'react-router-dom';
import Modal from '../Modal.jsx';
import { formatPrice, statusLabels } from '../lib.js';
import { useCart, useProducts } from '../store.jsx';
import Photo from './Photo.jsx';

// Sold and reserved items that were added earlier: shown, but not part of the order.
function Unavailable({ lines, cart, close }) {
  if (lines.length === 0) return null;
  return (
    <div className="cart-unavailable">
      <h3>Недоступно</h3>
      <ul className="cart-lines">
        {lines.map(({ product }) => (
          <li className="cart-line" key={product.id}>
            {product.images[0] && <Photo small src={product.images[0]} width="72" height="72" />}
            <div className="cart-line-body">
              <Link className="cart-line-name" to={`/product/${product.slug || product.id}`} onClick={close}>{product.name}</Link>
              <span className="cart-line-meta">{statusLabels[product.status]}, в заказ не попадёт</span>
            </div>
            <div className="cart-line-side">
              <button className="link-button" type="button" onClick={() => cart.remove(product.id)}>Убрать</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CartDrawer() {
  const cart = useCart();
  const catalog = useProducts();
  const close = () => cart.setOpen(false);

  return (
    <Modal open={cart.open} onClose={close} className="cart-drawer" labelledBy="cart-title">
      <h2 id="cart-title">Корзина</h2>
      {catalog.status === 'error' ? (
        <div className="cart-empty">
          <p>Не удалось загрузить корзину: нет связи с сервером. Ваши товары сохранены.</p>
          <button className="button button-outline" type="button" onClick={catalog.reload}>Повторить</button>
        </div>
      ) : catalog.status === 'loading' && cart.lines.length === 0 ? (
        <p className="cart-empty">Загружаем корзину…</p>
      ) : cart.lines.length === 0 ? (
        <>
          <div className="cart-empty">
            <p>{cart.unavailable.length ? 'Предметы из вашей корзины сейчас недоступны.' : 'В корзине пока пусто. Добавьте предметы из каталога, и мы подготовим сообщение для бутика.'}</p>
            <Link className="button button-primary" to="/catalog" onClick={close}>Перейти в каталог</Link>
          </div>
          <Unavailable lines={cart.unavailable} cart={cart} close={close} />
        </>
      ) : (
        <>
          <ul className="cart-lines">
            {cart.lines.map(({ product, qty }) => (
              <li className="cart-line" key={product.id}>
                {product.images[0] && <Photo small src={product.images[0]} width="72" height="72" />}
                <div className="cart-line-body">
                  <Link className="cart-line-name" to={`/product/${product.slug || product.id}`} onClick={close}>{product.name}</Link>
                  <span className="cart-line-meta">{product.color}</span>
                  <div className="qty" role="group" aria-label={`Количество: ${product.name}`}>
                    <button type="button" onClick={() => cart.setQty(product.id, qty - 1)} aria-label="Уменьшить количество">-</button>
                    <output aria-live="polite">{qty}</output>
                    <button type="button" onClick={() => cart.setQty(product.id, qty + 1)} aria-label="Увеличить количество">+</button>
                  </div>
                </div>
                <div className="cart-line-side">
                  <span className="cart-line-price">{formatPrice(product.price * qty)}</span>
                  <button className="link-button" type="button" onClick={() => cart.remove(product.id)}>Убрать</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-total"><span>Итого</span><strong>{formatPrice(cart.total)}</strong></div>
          <div className="message-preview">
            <span>Это сообщение уйдёт бутику</span>
            <pre>{cart.message}</pre>
          </div>
          <div className="cart-actions">
            <a className="button button-primary" href={cart.links.whatsapp} target="_blank" rel="noopener noreferrer">Отправить в WhatsApp</a>
            <a className="button button-outline" href={cart.links.telegram} target="_blank" rel="noopener noreferrer">Отправить в Telegram</a>
          </div>
          <Unavailable lines={cart.unavailable} cart={cart} close={close} />
          <button className="link-button cart-clear" type="button" onClick={cart.clear}>Очистить корзину</button>
        </>
      )}
    </Modal>
  );
}

import { Check, Envelope, LinkSimple, ShareNetwork, TelegramLogo, WhatsappLogo } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../lib.js';

// "Поделиться": on a phone the system share sheet, elsewhere a small menu with the usual ways to send a link.
export default function ShareMenu({ product }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const url = `${window.location.origin}/product/${product.slug || product.id}`;
  const text = `${product.name}, ${formatPrice(product.price)}`;

  async function toggle() {
    // Phones already have a share sheet with every app the visitor uses.
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: product.name, text, url }); } catch { /* The visitor closed the sheet. */ }
      return;
    }
    setOpen(!open);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Скопируйте ссылку', url);
    }
  }

  const encoded = { url: encodeURIComponent(url), text: encodeURIComponent(text), both: encodeURIComponent(`${text} ${url}`) };
  const targets = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${encoded.both}`, Icon: WhatsappLogo },
    { label: 'Telegram', href: `https://t.me/share/url?url=${encoded.url}&text=${encoded.text}`, Icon: TelegramLogo },
    { label: 'Почта', href: `mailto:?subject=${encodeURIComponent(product.name)}&body=${encoded.both}`, Icon: Envelope }
  ];

  return (
    <div className="share" ref={root}>
      <button ref={button} className="share-button" type="button" aria-haspopup="true" aria-expanded={open} onClick={toggle}>
        <ShareNetwork size={20} weight="light" aria-hidden="true" />
        <span>Поделиться</span>
      </button>
      {open && (
        <div className="share-menu" role="group" aria-label="Поделиться ссылкой на товар">
          <button className="share-item" type="button" onClick={copy}>
            {copied ? <Check size={20} weight="light" aria-hidden="true" /> : <LinkSimple size={20} weight="light" aria-hidden="true" />}
            <span>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</span>
          </button>
          {targets.map(({ label, href, Icon }) => (
            <a key={label} className="share-item" href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <Icon size={20} weight="light" aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </div>
      )}
      <span className="visually-hidden" role="status">{copied ? 'Ссылка скопирована' : ''}</span>
    </div>
  );
}

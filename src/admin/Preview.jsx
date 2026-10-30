import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { contactsFrom } from '../config.js';
import { SiteContext, useSite } from '../site.jsx';

// Shows the real storefront components with draft values, so the preview cannot drift from the site.
export function SiteDraft({ settings, categories, children }) {
  const site = useSite();
  const value = useMemo(() => {
    const nextSettings = settings ?? site.settings;
    const nextCategories = categories ?? site.categories;
    return {
      ...site,
      settings: nextSettings,
      categories: nextCategories,
      contacts: contactsFrom(nextSettings),
      categoryName: id => nextCategories.find(category => category.id === id)?.name ?? ''
    };
  }, [site, settings, categories]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

// Lays the content out at a fixed "virtual" width and scales it down to fit the panel.
function ScaledCanvas({ width, children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const scale = Math.min(1, outer.current.clientWidth / width);
      setBox({ scale, height: inner.current.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer.current);
    observer.observe(inner.current);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="preview-viewport" style={{ height: box.height || undefined }}>
      <div ref={inner} className="preview-canvas" style={{ width, transform: `scale(${box.scale})` }} inert="" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

// `tabs` is [{ id, label }], `highlight` is the data-field token the visitor should look at.
export function PreviewPanel({ title, tabs, tab, onTab, highlight, width = 760, children }) {
  const body = useRef(null);

  // Mark the matching elements and bring them into view inside the panel.
  useEffect(() => {
    const root = body.current;
    if (!root) return;
    root.querySelectorAll('.preview-hit').forEach(node => node.classList.remove('preview-hit'));
    if (!highlight) return;
    const hits = [...root.querySelectorAll('[data-field]')].filter(node => !node.closest('[data-preview-skip]') && node.dataset.field.split(' ').includes(highlight));
    hits.forEach(node => node.classList.add('preview-hit'));
    if (hits[0]) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      hits[0].scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
  });

  return (
    <aside className="preview" aria-label="Предпросмотр на сайте">
      <header className="preview-head">
        <div>
          <p className="preview-eyebrow">Предпросмотр</p>
          <h3>{title}</h3>
        </div>
        {tabs && (
          <div className="preview-tabs" role="group" aria-label="Что показать">
            {tabs.map(item => (
              <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} aria-pressed={tab === item.id} onClick={() => onTab(item.id)}>{item.label}</button>
            ))}
          </div>
        )}
      </header>
      <div className="preview-screen" ref={body}>
        <ScaledCanvas width={width}>{children}</ScaledCanvas>
      </div>
      <p className="preview-note">Так увидят посетители. Рамкой отмечено поле, которое вы сейчас меняете.</p>
    </aside>
  );
}

// Keeps track of which form field is focused. Returns props for the <form>.
export function useFocusedField() {
  const [field, setField] = useState('');
  const props = {
    onFocus: event => {
      const target = event.target.closest('[data-field]');
      if (target) setField(target.dataset.field);
    },
    onBlur: event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setField('');
    }
  };
  return [field, props, setField];
}

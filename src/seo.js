import { useEffect } from 'react';

export const SITE_NAME = 'Galagarage home';

// The server puts the right tags into the first page it sends (see deploy/nginx.conf). This keeps them
// right when the visitor moves between pages without a reload. The wording matches server/seo.go.
let origin;
function siteOrigin() {
  if (!origin) {
    try {
      const canonical = document.head.querySelector('link[rel="canonical"]')?.href;
      origin = canonical ? new URL(canonical).origin : window.location.origin;
    } catch {
      origin = window.location.origin;
    }
  }
  return origin;
}

function tag(selector, name, value, create) {
  let element = document.head.querySelector(selector);
  if (!value) {
    element?.remove();
    return;
  }
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute(name, value);
}

function meta(attribute, key, content) {
  tag(`meta[${attribute}="${key}"]`, 'content', content, () => {
    const element = document.createElement('meta');
    element.setAttribute(attribute, key);
    return element;
  });
}

// Title, description, canonical address, link preview and the noindex flag for the current page.
export function usePageMeta({ title, description = '', path = '', image = '', kind = 'website', noindex = false }) {
  useEffect(() => {
    if (!title) return;
    const base = siteOrigin();
    const url = noindex || !path ? '' : base + path;
    document.title = title;
    meta('name', 'description', description);
    meta('name', 'robots', noindex ? 'noindex, nofollow' : '');
    tag('link[rel="canonical"]', 'href', url, () => {
      const element = document.createElement('link');
      element.rel = 'canonical';
      return element;
    });
    meta('property', 'og:site_name', SITE_NAME);
    meta('property', 'og:type', kind);
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:url', url);
    meta('property', 'og:image', image ? base + image : '');
  }, [title, description, path, image, kind, noindex]);
}

// One full stop after each part: the home page description.
export function sentences(...parts) {
  const list = parts.map(part => (part ?? '').trim().replace(/[. ]+$/, '')).filter(Boolean);
  return list.length ? `${list.join('. ')}.` : '';
}

export function shorten(text, limit = 160) {
  const flat = (text ?? '').split(/\s+/).filter(Boolean).join(' ');
  const runes = [...flat];
  return runes.length <= limit ? flat : `${runes.slice(0, limit).join('').replace(/[ ,.;:-]+$/, '')}…`;
}

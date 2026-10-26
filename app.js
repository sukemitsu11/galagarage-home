const products = GALAGARAGE_CATALOG;
const categoryNames = {all:'Все предметы',decor:'Вазы и декор',tableware:'Посуда',textiles:'Текстиль',furniture:'Мебель и свет'};
const favoritesKey = 'galagarage-home-favorites-v1';
const favorites = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
  if (Array.isArray(stored)) stored.filter(id => products.some(product => product.id === id)).forEach(id => favorites.add(id));
} catch { /* The collection still works when browser storage is unavailable. */ }

let category = 'all';
let budget = null;
let expanded = false;
let currentProduct = null;
let photoIndex = 0;
let returnFocus = null;
const grid = document.querySelector('#product-grid');
const productDialog = document.querySelector('#product-dialog');
const searchDialog = document.querySelector('#search-dialog');
const favoritesDialog = document.querySelector('#favorites-dialog');
const searchInput = document.querySelector('#search-input');
const sortSelect = document.querySelector('#catalog-sort');
const formatPrice = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const priceLabel = product => `${product.from ? 'от ' : ''}${formatPrice(product.price)}${product.unit ? ' / ' + product.unit : ''}`;
const productURL = product => `https://t.me/galagarage_home/${product.source}`;

function filteredProducts() {
  const matches = products.filter(product => (category === 'all' || product.category === category) && (budget === null || product.price <= budget));
  if (sortSelect.value === 'price-asc') matches.sort((a,b) => a.price - b.price);
  if (sortSelect.value === 'price-desc') matches.sort((a,b) => b.price - a.price);
  return matches;
}

function renderProducts() {
  const matches = filteredProducts();
  const visible = expanded || category !== 'all' || budget !== null || sortSelect.value !== 'curated' ? matches : matches.slice(0,4);
  grid.innerHTML = visible.map(product => `
    <article class="product-card">
      <button class="product-open" type="button" data-product="${product.id}" aria-label="Подробнее: ${escapeHTML(product.name)}">
        <span class="product-photo"><img src="assets/${product.images[0]}" alt="${escapeHTML(product.name)} — фотография Galagarage home" width="600" height="800" loading="lazy"></span>
        <span class="product-title">${escapeHTML(product.name)}</span>
        <span class="product-type">${escapeHTML(product.type)}</span>
      </button>
      <div class="product-bottom"><span class="product-price">${priceLabel(product)}</span><button class="product-save" type="button" data-favorite="${product.id}" aria-pressed="${favorites.has(product.id)}" aria-label="${favorites.has(product.id) ? 'Убрать из избранного' : 'Сохранить'}: ${escapeHTML(product.name)}">${favorites.has(product.id) ? 'В избранном' : 'Сохранить'}</button></div>
    </article>`).join('');
  document.querySelector('#collection-count').textContent = `${visible.length} из ${matches.length} предметов${budget !== null ? ' · до ' + formatPrice(budget) : ''}`;
  const showMore = document.querySelector('#show-more');
  showMore.hidden = visible.length === matches.length;
  showMore.textContent = `Показать всю коллекцию (${matches.length})`;
  document.querySelector('.collection-more').hidden = showMore.hidden;
  document.querySelector('.clear-budget').hidden = budget === null;
}

function selectCategory(value) {
  category = Object.hasOwn(categoryNames, value) ? value : 'all';
  budget = null;
  expanded = true;
  document.querySelectorAll('[data-category]').forEach(button => {
    const active = button.dataset.category === category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderProducts();
}

function updateFavoriteControls() {
  document.querySelectorAll('[data-favorites-count]').forEach(element => { element.textContent = favorites.size; });
  document.querySelectorAll('[data-favorite]').forEach(button => {
    const product = products.find(item => item.id === button.dataset.favorite);
    const selected = favorites.has(product.id);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? 'Убрать из избранного' : 'Сохранить'}: ${product.name}`);
    button.textContent = selected ? 'В избранном' : 'Сохранить';
  });
  if (currentProduct) {
    const selected = favorites.has(currentProduct.id);
    const button = document.querySelector('#detail-save');
    button.textContent = selected ? 'Убрать из избранного' : 'Сохранить в избранное';
    button.setAttribute('aria-pressed', String(selected));
  }
}

function toggleFavorite(id) {
  if (!products.some(product => product.id === id)) return;
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  try { localStorage.setItem(favoritesKey, JSON.stringify([...favorites])); } catch { /* Favorites remain available in memory. */ }
  updateFavoriteControls();
  const focusedId = document.activeElement?.dataset.removeFavorite;
  renderFavorites();
  if (focusedId && favoritesDialog.open) {
    const next = document.querySelector('#favorites-results button') || favoritesDialog.querySelector('[data-close]');
    next.focus();
  }
}

function closeMobileMenu() {
  document.querySelector('#mobile-nav').hidden = true;
  const toggle = document.querySelector('.menu-toggle');
  toggle.setAttribute('aria-expanded','false');
  toggle.textContent = 'Меню';
}

function openDialog(dialog) {
  const previous = document.querySelector('dialog[open]');
  if (!previous) returnFocus = document.activeElement;
  if (previous) previous.close();
  dialog.showModal();
  document.body.classList.add('modal-open');
}

function renderPhoto() {
  const img = document.querySelector('#detail-img');
  img.src = `assets/${currentProduct.images[photoIndex]}`;
  img.alt = `${currentProduct.name}, фото ${photoIndex + 1}`;
  document.querySelector('#gallery-controls').hidden = currentProduct.images.length < 2;
  document.querySelector('#photo-count').textContent = `${photoIndex + 1} / ${currentProduct.images.length}`;
}

function updateVariant() {
  if (!currentProduct) return;
  const variant = currentProduct.variants?.[Number(document.querySelector('#product-variant').value)];
  document.querySelector('#detail-price').textContent = variant ? formatPrice(variant.price) : priceLabel(currentProduct);
  const message = `Здравствуйте! Интересует ${currentProduct.name}${variant ? ' (' + variant.label + ')' : ''}. Подскажите наличие и актуальную стоимость. Публикация: ${productURL(currentProduct)}`;
  document.querySelector('#product-contact').href = `https://wa.me/79136080735?text=${encodeURIComponent(message)}`;
}

function openProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  currentProduct = product;
  photoIndex = 0;
  document.querySelector('#product-title').textContent = product.name;
  document.querySelector('#detail-category').textContent = categoryNames[product.category];
  document.querySelector('#detail-description').textContent = product.description;
  document.querySelector('#product-source').href = productURL(product);
  document.querySelector('#variant-control').hidden = !product.variants;
  document.querySelector('#product-variant').innerHTML = (product.variants || []).map((variant,index) => `<option value="${index}">${escapeHTML(variant.label)}</option>`).join('');
  document.querySelector('#product-specs').innerHTML = (product.specs || []).map(([label,value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
  renderPhoto(); updateVariant(); updateFavoriteControls(); openDialog(productDialog);
}

function resultMarkup(product, removable = false) {
  return `<div class="result-item"><img src="assets/${product.images[0]}" alt="${escapeHTML(product.name)}" width="80" height="100"><button class="result-open" type="button" data-product="${product.id}"><strong>${escapeHTML(product.name)}</strong><span>${categoryNames[product.category]} · ${priceLabel(product)}</span></button>${removable ? `<button class="remove-favorite" type="button" data-remove-favorite="${product.id}" aria-label="Убрать ${escapeHTML(product.name)} из избранного">Убрать</button>` : ''}</div>`;
}

function renderSearch() {
  const query = searchInput.value.trim().toLocaleLowerCase('ru').replaceAll('ё','е');
  const matches = products.filter(product => `${product.name} ${product.type} ${categoryNames[product.category]} ${product.keywords}`.toLocaleLowerCase('ru').replaceAll('ё','е').includes(query));
  document.querySelector('#search-results').innerHTML = matches.length ? matches.map(product => resultMarkup(product)).join('') : '<p class="empty-result">Пока ничего не нашли. Попробуйте «ваза», «плед» или «лампа».</p>';
}

function renderFavorites() {
  const matches = products.filter(product => favorites.has(product.id));
  document.querySelector('#favorites-results').innerHTML = matches.length ? matches.map(product => resultMarkup(product,true)).join('') : '<p class="empty-result">Здесь будут предметы, которые вы сохраните в коллекции.</p>';
}

document.addEventListener('click', event => {
  const product = event.target.closest('[data-product]');
  if (product) openProduct(product.dataset.product);
  const save = event.target.closest('[data-favorite]');
  if (save) toggleFavorite(save.dataset.favorite);
  const remove = event.target.closest('[data-remove-favorite]');
  if (remove) toggleFavorite(remove.dataset.removeFavorite);
  const tab = event.target.closest('[data-category]');
  if (tab) selectCategory(tab.dataset.category);
  const categoryLink = event.target.closest('[data-category-link]');
  if (categoryLink) selectCategory(categoryLink.dataset.categoryLink);
  const budgetLink = event.target.closest('[data-budget]');
  if (budgetLink) { selectCategory('all'); budget = Number(budgetLink.dataset.budget); renderProducts(); }
  const close = event.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
});

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) {
      document.body.classList.remove('modal-open');
      if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus();
      else document.querySelector('.search-trigger').focus();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});

document.querySelector('.search-trigger').addEventListener('click', () => { searchInput.value = ''; closeMobileMenu(); renderSearch(); openDialog(searchDialog); searchInput.focus(); });
searchInput.addEventListener('input', renderSearch);
document.querySelectorAll('.favorites-trigger').forEach(button => button.addEventListener('click', () => { closeMobileMenu(); renderFavorites(); openDialog(favoritesDialog); }));
document.querySelector('#detail-save').addEventListener('click', () => { if (currentProduct) toggleFavorite(currentProduct.id); });
document.querySelector('#product-variant').addEventListener('change', updateVariant);
document.querySelector('#previous-photo').addEventListener('click', () => { photoIndex = (photoIndex - 1 + currentProduct.images.length) % currentProduct.images.length; renderPhoto(); });
document.querySelector('#next-photo').addEventListener('click', () => { photoIndex = (photoIndex + 1) % currentProduct.images.length; renderPhoto(); });
document.querySelector('#show-more').addEventListener('click', () => { expanded = true; renderProducts(); document.querySelectorAll('.product-open')[4]?.focus({preventScroll:true}); });
sortSelect.addEventListener('change', () => { expanded = true; renderProducts(); });
document.querySelector('.clear-budget').addEventListener('click', () => { budget = null; renderProducts(); });
document.querySelector('#concept-info').addEventListener('click', () => openDialog(document.querySelector('#concept-dialog')));
document.querySelector('.menu-toggle').addEventListener('click', event => {
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded',String(!expanded));
  event.currentTarget.textContent = expanded ? 'Меню' : 'Закрыть';
  document.querySelector('#mobile-nav').hidden = expanded;
});
document.querySelectorAll('#mobile-nav a').forEach(link => link.addEventListener('click', closeMobileMenu));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const dialog = document.querySelector('dialog[open]');
  if (dialog) {
    event.preventDefault();
    dialog.close();
  } else if (!document.querySelector('#mobile-nav').hidden) {
    closeMobileMenu();
    document.querySelector('.menu-toggle').focus();
  }
}, true);
renderProducts(); updateFavoriteControls();

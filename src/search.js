export const normalize = text => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');

const words = text => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Edit distance where swapping two neighbouring letters counts as one mistake ("вазы" and "взаа" are close).
function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { rows[i][j] = j; continue; }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

// How many typos are allowed grows with the length of the word.
const allowed = length => (length <= 2 ? 0 : length <= 5 ? 1 : length <= 8 ? 2 : 3);

export function productText(product, categoryName) {
  return normalize(`${product.name} ${product.description} ${product.color} ${categoryName(product.category)}`);
}

export function matchesQuery(text, query) {
  const needle = normalize(query);
  return !needle || needle.split(/\s+/).every(part => text.includes(part));
}

// Words a visitor can reasonably type: names, sections and colours, most frequent first.
function vocabulary(products, categoryName) {
  const counts = new Map();
  for (const product of products) {
    for (const word of words(`${product.name} ${product.color} ${categoryName(product.category)}`)) {
      if (word.length >= 3) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(entry => entry[0]);
}

// "вааза" gives "ваза". Returns '' when every word is already fine or nothing is close enough.
export function suggestQuery(query, products, categoryName) {
  const parts = normalize(query).split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const known = vocabulary(products, categoryName);
  let changed = false;
  const fixed = parts.map(part => {
    if (known.some(word => word.includes(part))) return part;
    const limit = allowed(part.length);
    let best = null;
    let bestDistance = limit + 1;
    for (const word of known) {
      // Compared with the whole word and with its beginning, so a wrong ending ("кошки" for "кошками") still counts.
      let value = distance(part, word, limit);
      for (let cut = part.length - 1; cut <= part.length + 1 && value > 0; cut++) {
        if (cut >= 2 && cut < word.length) value = Math.min(value, distance(part, word.slice(0, cut), limit));
      }
      if (value < bestDistance) { best = word; bestDistance = value; }
    }
    if (!best) return part;
    changed = true;
    return best;
  });
  return changed ? fixed.join(' ') : '';
}

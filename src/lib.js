export const formatPrice = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
export const formatSize = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);

export function dimensionRows(product) {
  return [
    ['Высота', product.heightCm],
    ['Ширина', product.widthCm],
    ['Длина', product.lengthCm]
  ].filter(([, value]) => value).map(([label, value]) => [label, `${formatSize(value)} см`]);
}

// Uploads come with a small copy next to them (name-s.jpg) for catalog lists. Older uploads and
// the shop photos in /assets have none, so those keep the original address.
export const thumb = src => (/^\/uploads\/[A-Za-z0-9]+\.jpg$/.test(src) ? src.replace(/\.jpg$/, '-s.jpg') : src);

export const statusLabels = { reserved: 'Забронирован', sold: 'Продан' };
export const isAvailable = product => (product.status || 'available') === 'available';

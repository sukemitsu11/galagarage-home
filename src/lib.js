export const formatPrice = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
export const formatSize = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);

export function dimensionRows(product) {
  return [
    ['Высота', product.heightCm],
    ['Ширина', product.widthCm],
    ['Длина', product.lengthCm]
  ].filter(([, value]) => value).map(([label, value]) => [label, `${formatSize(value)} см`]);
}

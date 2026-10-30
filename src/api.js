async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (method !== 'GET') headers['X-Requested-With'] = 'galagarage-admin';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет и повторите.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'Не удалось выполнить запрос');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  products: () => request('/api/products'),
  categories: () => request('/api/categories'),
  settings: () => request('/api/settings'),
  createCategory: category => request('/api/admin/categories', { method: 'POST', body: category }),
  updateCategory: category => request(`/api/admin/categories/${encodeURIComponent(category.id)}`, { method: 'PUT', body: category }),
  deleteCategory: id => request(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  orderCategories: ids => request('/api/admin/categories/order', { method: 'POST', body: { slugs: ids } }),
  saveSettings: settings => request('/api/admin/settings', { method: 'PUT', body: settings }),
  product: id => request(`/api/products/${id}`),
  login: password => request('/api/admin/login', { method: 'POST', body: { password } }),
  logout: () => request('/api/admin/logout', { method: 'POST' }),
  me: () => request('/api/admin/me'),
  adminProducts: () => request('/api/admin/products'),
  saveProduct: product => product.id
    ? request(`/api/admin/products/${product.id}`, { method: 'PUT', body: product })
    : request('/api/admin/products', { method: 'POST', body: product }),
  deleteProduct: id => request(`/api/admin/products/${id}`, { method: 'DELETE' }),
  upload: file => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/admin/upload', { method: 'POST', form });
  }
};

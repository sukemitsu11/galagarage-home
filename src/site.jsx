import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { contactsFrom, defaultSettings } from './config.js';

export const SiteContext = createContext(null);
export const useSite = () => useContext(SiteContext);

// Categories and contact settings edited in the admin panel.
export function SiteProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [status, setStatus] = useState('loading');

  const reload = useCallback(() => {
    Promise.all([api.categories(), api.settings()])
      .then(([list, values]) => {
        setCategories(list.map(item => ({ id: item.slug, name: item.name, image: item.image })));
        setSettings({ ...defaultSettings, ...values });
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(reload, [reload]);

  const value = useMemo(() => ({
    status,
    categories,
    settings,
    contacts: contactsFrom(settings),
    categoryName: id => categories.find(category => category.id === id)?.name ?? '',
    reload
  }), [status, categories, settings, reload]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

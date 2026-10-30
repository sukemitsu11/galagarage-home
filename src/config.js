// Fallbacks shown until the server answers; the owners change the real values in the admin panel.
export const defaultSettings = {
  phone: '+7 (913) 608-07-35',
  whatsapp: '79136080735',
  telegram: '+79136080735',
  channel: 'galagarage_home',
  address: 'Омск, улица Карла Либкнехта, 26',
  hours: 'Ежедневно, 11:00–20:00',
  gisUrl: 'https://2gis.ru/omsk/firm/70000001105982026',
  bannerTitle: 'Galagarage home',
  bannerText: 'Мебель, посуда и декор с характером. Бутик в Омске',
  bannerImages: ['/assets/chair-leather.jpg', '/assets/boutique.jpg', '/assets/vase-artglass.jpg']
};

export function contactsFrom(settings) {
  return {
    phone: settings.phone,
    phoneHref: `tel:+${settings.phone.replace(/\D/g, '')}`,
    whatsapp: settings.whatsapp,
    telegramChat: `https://t.me/${settings.telegram}`,
    telegramChannel: settings.channel ? `https://t.me/${settings.channel}` : '',
    channelHandle: settings.channel ? `@${settings.channel}` : '',
    address: settings.address,
    hours: settings.hours,
    gis: settings.gisUrl,
    gisReviews: settings.gisUrl ? `${settings.gisUrl.replace(/\/$/, '')}/tab/reviews` : ''
  };
}

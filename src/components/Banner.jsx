import { Link } from 'react-router-dom';

// The home page banner. `data-field` marks elements the admin preview can highlight.
export default function Banner({ settings }) {
  return (
    <section className="banner" aria-labelledby="hero-title">
      <div className="banner-photos">
        {settings.bannerImages.map((src, index) => (
          <img key={`${src}-${index}`} data-field={`bannerImages bannerImages-${index}`} src={src} alt={`Интерьер бутика Galagarage home, фото ${index + 1}`} width="600" height="800" fetchPriority={index < 2 ? 'high' : undefined} />
        ))}
      </div>
      <div className="banner-text">
        <h1 id="hero-title" data-field="bannerTitle">{settings.bannerTitle}</h1>
        {settings.bannerText && <p data-field="bannerText">{settings.bannerText}</p>}
        <Link className="button button-primary" to="/catalog">Смотреть каталог</Link>
      </div>
    </section>
  );
}

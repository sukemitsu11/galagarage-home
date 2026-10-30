import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

const all = { id: 'all', name: 'Весь каталог', image: '/assets/category-all.jpg' };

// Square category tiles. With `active` and `onSelect` they act as a filter on the catalog page.
export default function CategorySquares({ active, onSelect, counts }) {
  const { categories } = useSite();
  return (
    <ul className={`squares${onSelect ? ' squares-compact' : ''}`}>
      {[all, ...categories].map(category => {
        const content = (
          <>
            <span className="square-photo"><img src={category.image} alt="" width="400" height="400" loading="lazy" /></span>
            <span className="square-name">{category.name}{counts && <span className="square-count">{counts(category.id)}</span>}</span>
          </>
        );
        return (
          <li key={category.id}>
            {onSelect
              ? <button type="button" className={`square${active === category.id ? ' is-active' : ''}`} aria-pressed={active === category.id} onClick={() => onSelect(category.id)}>{content}</button>
              : <Link className="square" to={category.id === 'all' ? '/catalog' : `/catalog?category=${category.id}`}>{content}</Link>}
          </li>
        );
      })}
    </ul>
  );
}

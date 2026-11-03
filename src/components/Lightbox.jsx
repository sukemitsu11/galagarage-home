import { useEffect } from 'react';
import Modal from '../Modal.jsx';

// The product photo at full size. `index` is the shown photo, -1 means closed.
export default function Lightbox({ images, index, onIndex, onClose, name }) {
  const open = index >= 0 && index < images.length;
  const many = images.length > 1;

  useEffect(() => {
    if (!open || !many) return undefined;
    const go = delta => onIndex((index + delta + images.length) % images.length);
    const onKey = event => {
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, many, index, images.length, onIndex]);

  return (
    <Modal open={open} onClose={onClose} className="lightbox" labelledBy="lightbox-title">
      <h2 id="lightbox-title" className="visually-hidden">{name}, фото {index + 1} из {images.length}</h2>
      {open && <img src={images[index]} alt={`${name}, фото ${index + 1}`} />}
      {many && (
        <div className="lightbox-nav">
          <button className="text-button" type="button" onClick={() => onIndex((index - 1 + images.length) % images.length)}>Назад</button>
          <span>{index + 1} из {images.length}</span>
          <button className="text-button" type="button" onClick={() => onIndex((index + 1) % images.length)}>Вперёд</button>
        </div>
      )}
    </Modal>
  );
}

import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, className, labelledBy, children }) {
  const ref = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeOnBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }

  return (
    <dialog ref={ref} className={className} aria-labelledby={labelledBy} onClose={() => { if (openRef.current) onClose(); }} onClick={closeOnBackdrop}>
      <button className="dialog-close text-button" type="button" onClick={onClose}>Закрыть</button>
      {children}
    </dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function GalleryLightbox({
  images,
  start,
  title,
  onClose,
}: {
  images: string[];
  start: number;
  title: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(start);
  const startXRef = useRef(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && images.length > 1) setIdx((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft' && images.length > 1) setIdx((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', h);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(6, 14, 34, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="lightbox__inner"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          startXRef.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startXRef.current;
          if (images.length > 1 && Math.abs(dx) > 50) {
            if (dx < 0) next();
            else prev();
          }
        }}
        style={{
          position: 'relative',
          maxWidth: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l’aperçu"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(10, 22, 51, 0.85)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon name="x" size={22} />
        </button>

        <img
          src={images[idx]}
          alt={`${title} — photo ${idx + 1}/${images.length}`}
          className="lightbox__img"
          style={{
            maxWidth: '92vw',
            maxHeight: images.length > 1 ? '76vh' : '86vh',
            objectFit: 'contain',
            borderRadius: 12,
            boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
          }}
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Photo précédente"
              style={{
                position: 'fixed',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(10, 22, 51, 0.8)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name="chevron-left" size={24} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Photo suivante"
              style={{
                position: 'fixed',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(10, 22, 51, 0.8)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name="chevron-right" size={24} />
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
                {idx + 1} / {images.length}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

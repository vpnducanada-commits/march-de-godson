import { useEffect, useRef } from 'react';

/**
 * Révélation douce des sections au scroll : ajoute `.reveal--in` quand
 * l'élément entre dans le viewport (une seule fois). Respecte
 * prefers-reduced-motion (l'élément est simplement visible, sans transition).
 * Usage : const ref = useReveal(); <section ref={ref} className="reveal">
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reveal--in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('reveal--in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

import { useEffect } from 'react';

const SITE_URL: string = import.meta.env.VITE_SITE_URL || window.location.origin;

/** Image de partage social par défaut (générée à la racine du site). */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

function setMeta(attr: 'name' | 'property', value: string, content: string): void {
  let el = Array.from(document.querySelectorAll<HTMLMetaElement>('meta')).find((m) => m.getAttribute(attr) === value);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Met à jour le titre, la description et les balises Open Graph
 * (SEO + partage WhatsApp / réseaux sociaux).
 *
 * @param ogImage image de partage pour cette page (si absente, image de marque par défaut).
 */
export function usePageMeta(title: string, description?: string, ogImage?: string): void {
  useEffect(() => {
    document.title = title
      ? `${title} — GODSON Marketplace`
      : 'GODSON Marketplace — Le marché gabonais, à portée de clic';

    const suffix = title ? `${title} — GODSON Marketplace` : '';
    setMeta('name', 'description', description ?? '');
    if (description) setMeta('property', 'og:description', description);
    if (suffix) setMeta('property', 'og:title', suffix);

    // og:image : image de la page (absolue si fournie en relatif), sinon image de marque.
    const img = ogImage
      ? ogImage.startsWith('http')
        ? ogImage
        : `${window.location.origin}${ogImage}`
      : DEFAULT_OG_IMAGE;
    setMeta('property', 'og:image', img);
  }, [title, description, ogImage]);
}

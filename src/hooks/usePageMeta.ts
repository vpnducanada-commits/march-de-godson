import { useEffect } from 'react';

/**
 * Domaine de référence : `VITE_SITE_URL` si défini (build), sinon le domaine
 * réel du navigateur. L'URL canonique est toujours calculée à l'exécution
 * (window.location.origin) : elle reste correcte quel que soit le domaine
 * de publication (vercel.app → domaine personnalisé), sans rebuild.
 */
const SITE_URL: string = import.meta.env.VITE_SITE_URL || 'https://godson-marketplace.vercel.app';

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

    // URL canonique + og:url : une URL officielle par page (SEO anti-doublons).
    // Toujours calculée sur le domaine réel de consultation : correct sur
    // godson-marketplace.vercel.app aujourd'hui comme sur le futur domaine
    // personnalisé, sans re-build.
    const canonical = `${window.location.origin}${window.location.pathname}`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
    setMeta('property', 'og:url', canonical);
  }, [title, description, ogImage]);
}

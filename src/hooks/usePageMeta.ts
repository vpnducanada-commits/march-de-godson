import { useEffect } from 'react';

/** Met à jour le titre et la meta description (SEO + partage social). */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title
      ? `${title} — GODSON Marketplace`
      : 'GODSON Marketplace — Le marché gabonais, à portée de clic';
    if (description) {
      let el = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!el) {
        el = document.createElement('meta');
        el.name = 'description';
        document.head.appendChild(el);
      }
      el.content = description;
    }
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle && title) ogTitle.content = `${title} — GODSON Marketplace`;
    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc && description) ogDesc.content = description;
  }, [title, description]);
}

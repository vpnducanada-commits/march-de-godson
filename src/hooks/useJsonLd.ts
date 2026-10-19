import { useEffect } from 'react';

/**
 * Injecte (et maintient) une balise <script type="application/ld+json">
 * dans <head> — données structurées pour les résultats enrichis Google.
 *
 * @param id identifiant stable de la balise (permet le remplacement propre).
 * @param data objet sérialisé en JSON-LD, ou null pour retirer la balise.
 */
export function useJsonLd(id: string, data: Record<string, unknown> | null): void {
  useEffect(() => {
    const selector = `script[data-ld-id="${id}"]`;
    document.head.querySelector(selector)?.remove();
    if (!data) return;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-ld-id', id);
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
    return () => {
      document.head.querySelector(selector)?.remove();
    };
  }, [id, data]);
}

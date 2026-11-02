import { useEffect } from 'react';

/**
 * Injecte (et maintient) une balise <script type="application/ld+json">
 * dans <head> — données structurées pour les résultats enrichis Google.
 * Échappe `<`, `>`, `&`, U+2028 et U+2029 pour bloquer toute sortie de balise `</script>`.
 */
export function useJsonLd(id: string, data: Record<string, unknown> | null): void {
  useEffect(() => {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    const selector = `script[data-ld-id="${safeId}"]`;
    document.head.querySelector(selector)?.remove();
    if (!data) return;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-ld-id', safeId);
    s.textContent = JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    document.head.appendChild(s);
    return () => {
      document.head.querySelector(selector)?.remove();
    };
  }, [id, data]);
}

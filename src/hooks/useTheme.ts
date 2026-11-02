import { useSyncExternalStore } from 'react';

/**
 * Thème clair/sombre — état global minimaliste (sans contexte) :
 * la source de vérité est `document.documentElement.dataset.theme`,
 * posé avant le premier rendu par le script inline d'index.html
 * (localStorage → préférence système). useSyncExternalStore abonne
 * tous les composants qui l'utilisent aux changements.
 */
const STORAGE_KEY = 'gm:theme';

function current(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function subscribe(cb: () => void): () => void {
  document.addEventListener('gm:theme-change', cb);
  return () => document.removeEventListener('gm:theme-change', cb);
}

export function applyTheme(t: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* mode privé : le choix reste pour la session */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0b1220' : '#0A1633');
  document.dispatchEvent(new Event('gm:theme-change'));
}

export function useTheme(): { theme: 'light' | 'dark'; toggle: () => void } {
  const theme = useSyncExternalStore<'light' | 'dark'>(subscribe, current, () => 'light');
  const toggle = () => applyTheme(theme === 'dark' ? 'light' : 'dark');
  return { theme, toggle };
}

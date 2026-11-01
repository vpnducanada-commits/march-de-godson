import { useEffect } from 'react';

const SAFE_REF_RE = /^[@#]?[a-zA-Z0-9_.-]{3,36}$/;

export function useReferral() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const ref = p.get('ref')?.trim();
      if (ref && SAFE_REF_RE.test(ref)) {
        localStorage.setItem('gm_ref', ref.replace(/^[@#]+/, ''));
      }
    } catch {
      /* stockage local indisponible */
    }
  }, []);
}

export function getReferral(): string | null {
  try {
    const raw = localStorage.getItem('gm_ref');
    return raw && SAFE_REF_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function referralLink(userId: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(userId)}`;
}

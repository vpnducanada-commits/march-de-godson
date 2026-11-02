import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { GMTile } from '../components/Logo';
import { Spinner } from '../components/ui/Spinner';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta('Page introuvable', "La page demandée n'existe pas ou a été déplacée.");
  const { pathname } = useLocation();
  const [checkingUpdate, setCheckingUpdate] = useState(() => {
    if (typeof window === 'undefined' || !navigator.onLine) return false;
    try {
      return sessionStorage.getItem(`gm_nf_sw:${pathname}`) !== '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!checkingUpdate) return;
    let cancelled = false;
    (async () => {
      try {
        sessionStorage.setItem(`gm_nf_sw:${pathname}`, '1');
        // Vérifier si le serveur sert un bundle JS plus récent que celui en mémoire
        const currentScript = document
          .querySelector('script[type="module"][src*="/assets/index-"]')
          ?.getAttribute('src');
        const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
          if (match && currentScript && !currentScript.endsWith(match[0])) {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
            }
            window.location.reload();
            return;
          }
        }
      } catch {
        /* hors ligne ou erreur réseau */
      }
      if (!cancelled) setCheckingUpdate(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkingUpdate, pathname]);

  if (checkingUpdate) {
    return <Spinner label="Chargement de la page…" />;
  }

  return (
    <div className="container notfound">
      <GMTile size={64} />
      <p className="notfound__code">404</p>
      <h1 className="page-title">Page introuvable</h1>
      <p className="page-sub">
        Cette page n'existe pas, a été déplacée ou l'annonce a été retirée.
      </p>
      <div className="notfound__actions">
        <Link to="/" className="btn btn--primary">
          <Icon name="home" size={16} /> Retour à l'accueil
        </Link>
        <Link to="/annonces" className="btn btn--ghost">
          <Icon name="grid" size={16} /> Parcourir le catalogue
        </Link>
      </div>
    </div>
  );
}

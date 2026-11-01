import { useEffect, useState, type ReactNode, lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { BottomNav } from './components/layout/BottomNav';
import { Icon } from './components/Icon';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './context/AuthContext';
import { demoMode } from './lib/api';

import Home from './pages/Home';
import { usePwaInstall } from './hooks/usePwaInstall';
import { usePushReminder } from './hooks/usePushReminder';
import { useReferral } from './hooks/useReferral';
import { HelpBot } from './components/HelpBot';
import { ScrollProgress } from './components/ScrollProgress';
import { RouteProgress } from './components/RouteProgress';
import { PageTransition } from './components/ui/PageTransition';

// Code-split: chaque route = chunk séparé (3.2)
const Catalog = lazy(()=> import('./pages/Catalog'));
const Category = lazy(()=> import('./pages/Category'));
const ListingDetail = lazy(()=> import('./pages/ListingDetail'));
const Publish = lazy(()=> import('./pages/Publish'));
const EditListing = lazy(()=> import('./pages/EditListing'));
const AuthPages = lazy(()=> import('./pages/AuthPages'));
const AuthCallback = lazy(()=> import('./pages/AuthCallback'));
const SellerProfile = lazy(()=> import('./pages/SellerProfile'));
const UsersDirectory = lazy(()=> import('./pages/UsersDirectory'));
const Dashboard = lazy(()=> import('./pages/Dashboard'));
const Notifications = lazy(()=> import('./pages/Notifications'));
const Favorites = lazy(()=> import('./pages/Favorites'));
const Messages = lazy(()=> import('./pages/Messages'));
const Settings = lazy(()=> import('./pages/Settings'));
const Admin = lazy(()=> import('./pages/Admin'));
const StaticPage = lazy(()=> import('./pages/StaticPage'));
const NotFound = lazy(()=> import('./pages/NotFound'));
const DownloadApp = lazy(()=> import('./pages/DownloadApp'));

/**
 * Bandeau « hors ligne » (PWA) : l'app shell reste consultable sans réseau
 * (précache), mais le chargement de nouvelles données est suspendu — le
 * bandeau l'indique honnêtement tant que la connexion est revenue.
 */
function OfflineBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <div className="container offline-banner__inner">
        <Icon name="globe" size={15} />
        <span>
          Vous êtes hors ligne — le contenu déjà chargé reste consultable ; les nouvelles
          données se chargeront au retour de la connexion.
        </span>
      </div>
    </div>
  );
}

/**
 * Bandeau PWA : propose l'installation sur les navigateurs qui l'émettent
 * (Chrome/Edge — Android et desktop). Masquable, mémorisé dans localStorage,
 * et absent dès que l'app est installée ou déjà lancée en standalone.
 */
function InstallBanner() {
  const { canInstall, installed, isStandalone, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(
    () => window.localStorage.getItem('gm-install-dismissed') === '1',
  );
  const [busy, setBusy] = useState(false);

  if (!canInstall || installed || isStandalone || dismissed) return null;

  const dismiss = () => {
    window.localStorage.setItem('gm-install-dismissed', '1');
    setDismissed(true);
  };

  const install = async () => {
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="install-banner" role="region" aria-label="Installer l'application">
      <div className="container install-banner__inner">
        <Icon name="download" size={18} className="install-banner__icon" />
        <p className="install-banner__text">
          <strong>GODSON Marketplace</strong>{' '}
          <span>— installez l'application gratuite et rapide sur cet appareil.</span>
        </p>
        <button type="button" className="btn btn--gold" onClick={install} disabled={busy}>
          {busy ? '…' : 'Installer'}
        </button>
        <button type="button" className="install-banner__close" onClick={dismiss} aria-label="Ne plus afficher">
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, isBanned } = useAuth();
  if (loading) return <Spinner label="Vérification de la session…" />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (isBanned) {
    return (
      <div className="banned-box">
        <Icon name="ban" size={40} />
        <h2>Compte suspendu</h2>
        <p>
          Votre compte a été suspendu pour non-respect de nos règles. Vous ne pouvez
          plus publier ni gérer vos annonces.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Spinner label="Vérification des droits…" />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (profile?.role !== 'admin') {
    return (
      <div className="banned-box">
        <Icon name="lock" size={40} />
        <h2>Accès réservé</h2>
        <p>Cette section est réservée aux administrateurs de la plateforme.</p>
        <Link className="btn btn--primary" to="/">
          Retour à l'accueil
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

function ApkDirectDownload() {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [loadedMb, setLoadedMb] = useState('0.0');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
        }
        const res = await fetch('/apk/godson-marketplace.apk?dl=' + Date.now(), {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const reader = res.body?.getReader();
        if (!reader) {
          const blob = await res.blob();
          triggerBlob(blob);
          if (!cancelled) setStatus('done');
          return;
        }
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            if (!cancelled) setLoadedMb((received / (1024 * 1024)).toFixed(1));
          }
        }
        const blob = new Blob(chunks as BlobPart[], {
          type: 'application/vnd.android.package-archive',
        });
        if (!cancelled) {
          triggerBlob(blob);
          setStatus('done');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    function triggerBlob(blob: Blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'godson-marketplace.apk';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container" style={{ padding: '48px 16px', maxWidth: 480, textAlign: 'center' }}>
      <div className="card" style={{ padding: 24 }}>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#0a1633',
            color: '#f5b82e',
            display: 'inline-grid',
            placeItems: 'center',
            marginBottom: 14,
          }}
        >
          <Icon name="download" size={26} />
        </span>
        <h1 className="page-title" style={{ fontSize: 20, marginBottom: 8 }}>
          {status === 'loading'
            ? `Téléchargement de l’APK (${loadedMb} / 6.8 Mo)…`
            : status === 'done'
              ? 'Téléchargement lancé'
              : 'Télécharger GODSON Marketplace (.apk)'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 18 }}>
          {status === 'done'
            ? 'Ouvrez le fichier godson-marketplace.apk dans vos téléchargements Android pour installer l’application.'
            : 'Fichier Android signé v2.9 (6,8 Mo) — ouverture animée, plein écran, GPS et notifications temps réel.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/apk/godson-marketplace.apk?direct=1"
            download="godson-marketplace.apk"
            className="btn btn--primary"
          >
            <Icon name="download" size={16} /> Relancer le téléchargement
          </a>
          <a href="/application" className="btn btn--ghost">
            Page Application
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useReferral();
  usePushReminder();
  const location = useLocation();
  const bare = location.pathname === '/admin';

  useEffect(() => {
    // Masque en douceur l'écran de démarrage animé dès que l'app shell React est peint
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const w = window as unknown as { __gmDismissSplash?: () => void };
        w.__gmDismissSplash?.();
      });
    });

    // Préchargement silencieux des routes les plus visitées après l'ouverture (hors mode économie de données)
    const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    const timer = window.setTimeout(() => {
      if (conn?.saveData) return;
      import('./pages/Catalog').catch(() => undefined);
      import('./pages/ListingDetail').catch(() => undefined);
      import('./pages/UsersDirectory').catch(() => undefined);
    }, 1200);

    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Aller au contenu principal
      </a>
      <div className="app-shell">
        <RouteProgress />
        <ScrollProgress />
        <Header />
        <OfflineBanner />
        <InstallBanner />
        {demoMode && (
          <div className="demo-banner" role="note">
            <Icon name="alert" size={15} />
            Mode démo : Supabase non configuré. Les annonces affichées sont des exemples
            clairement identifiés.
          </div>
        )}
        <main id="main" className="main page-enter">
          <PageTransition>
          <Suspense fallback={<Spinner label="Chargement…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/annonces" element={<Catalog />} />
            <Route path="/categorie/:slug" element={<Category />} />
            <Route path="/annonce/:slug" element={<ListingDetail />} />
            <Route path="/vendeur/:id" element={<SellerProfile />} />
            <Route path="/utilisateurs" element={<UsersDirectory />} />
            <Route path="/application" element={<DownloadApp />} />
            <Route path="/publier" element={<RequireAuth><Publish /></RequireAuth>} />
            <Route path="/modifier/:slug" element={<RequireAuth><EditListing /></RequireAuth>} />
            <Route path="/connexion" element={<AuthPages mode="login" />} />
            <Route path="/inscription" element={<AuthPages mode="signup" />} />
            <Route path="/mot-de-passe" element={<AuthPages mode="forgot" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/compte" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/compte/favoris" element={<RequireAuth><Favorites /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/compte/parametres" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/faq" element={<StaticPage page="faq" />} />
            <Route path="/apropos" element={<StaticPage page="about" />} />
            <Route path="/securite" element={<StaticPage page="security" />} />
            <Route path="/conditions" element={<StaticPage page="terms" />} />
            <Route path="/confidentialite" element={<StaticPage page="privacy" />} />
            <Route path="/apk/*" element={<ApkDirectDownload />} />
            <Route path="/telecharger-apk" element={<ApkDirectDownload />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </PageTransition>
        </main>
        {!bare && <Footer />}
        {!bare && <HelpBot />}
        {!bare && <BottomNav />}
      </div>
    </>
  );
}

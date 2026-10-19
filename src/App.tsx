import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Icon } from './components/Icon';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './context/AuthContext';
import { demoMode } from './lib/api';

import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Category from './pages/Category';
import ListingDetail from './pages/ListingDetail';
import Publish from './pages/Publish';
import EditListing from './pages/EditListing';
import AuthPages from './pages/AuthPages';
import AuthCallback from './pages/AuthCallback';
import SellerProfile from './pages/SellerProfile';
import Dashboard from './pages/Dashboard';
import Favorites from './pages/Favorites';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import StaticPage, { StaticContent } from './pages/StaticPage';
import NotFound from './pages/NotFound';
import DownloadApp from './pages/DownloadApp';
import { usePwaInstall } from './hooks/usePwaInstall';

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
        <a className="btn btn--primary" href="#/" onClick={(e) => e.preventDefault()}>
          Retour à l'accueil
        </a>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const bare = location.pathname === '/admin';

  return (
    <>
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Aller au contenu principal
      </a>
      <div className="app-shell">
        <Header />
        <InstallBanner />
        {demoMode && (
          <div className="demo-banner" role="note">
            <Icon name="alert" size={15} />
            Mode démo : Supabase non configuré. Les annonces affichées sont des exemples
            clairement identifiés.
          </div>
        )}
        <main id="main" className="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/annonces" element={<Catalog />} />
            <Route path="/categorie/:slug" element={<Category />} />
            <Route path="/annonce/:slug" element={<ListingDetail />} />
            <Route path="/vendeur/:id" element={<SellerProfile />} />
            <Route path="/application" element={<DownloadApp />} />
            <Route path="/publier" element={<RequireAuth><Publish /></RequireAuth>} />
            <Route path="/modifier/:slug" element={<RequireAuth><EditListing /></RequireAuth>} />
            <Route path="/connexion" element={<AuthPages mode="login" />} />
            <Route path="/inscription" element={<AuthPages mode="signup" />} />
            <Route path="/mot-de-passe" element={<AuthPages mode="forgot" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/compte" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/compte/favoris" element={<RequireAuth><Favorites /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/compte/parametres" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/faq" element={<StaticPage content={StaticContent.faq} />} />
            <Route path="/apropos" element={<StaticPage content={StaticContent.about} />} />
            <Route path="/securite" element={<StaticPage content={StaticContent.security} />} />
            <Route path="/conditions" element={<StaticPage content={StaticContent.terms} />} />
            <Route path="/confidentialite" element={<StaticPage content={StaticContent.privacy} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        {!bare && <Footer />}
      </div>
    </>
  );
}

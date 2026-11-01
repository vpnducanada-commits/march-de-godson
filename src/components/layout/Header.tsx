import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../Logo';
import { Icon } from '../Icon';
import { SearchBar } from '../SearchBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationsContext';
import { NotificationList } from '../NotificationList';
import { DrawerSparkles } from '../ui/DrawerSparkles';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../../hooks/useTheme';
import { demoMode, fetchLocalities } from '../../lib/api';
import { safeMediaUrl } from '../../lib/security';
import type { Locality } from '../../lib/types';
import '../../styles/signup-attract.css';

export function Header() {
  const { session, profile, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isSignupPage = pathname === '/inscription';
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { total: notifTotal, unreadTotal: unread } = useNotifications();
  const { theme: uiTheme } = useTheme();
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Ombre discrète du header dès que la page est défilée.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetchLocalities().then(setLocalities).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Fermer le tiroir mobile et les menus à chaque changement de route
  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
    setCatOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  const onSignOut = async () => {
    await signOut();
    toast('info', 'Vous êtes déconnecté.');
    navigate('/');
  };

  return (
    <>
    {/* Overlay translucide : quand un menu déroulant est ouvert, le reste de
        la page « recule » (faible opacité + léger flou) — et un tap/clic
        n'importe où le ferme. */}
    {(notifOpen || userMenuOpen) && (
      <div
        className="menu-overlay"
        aria-hidden="true"
        onClick={() => {
          setNotifOpen(false);
          setUserMenuOpen(false);
        }}
      />
    )}
    <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
      <div className="header__inner container">
        <button
          type="button"
          className="icon-btn header__burger"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} size={22} />
        </button>

        <Logo variant="dark" compact />

        <div className="header__search">
          <SearchBar localities={localities} />
        </div>

        <nav className="header__nav" aria-label="Actions principales">
          <Link to="/annonces" className="header__link">
            Catalogue
          </Link>
          <Link to="/utilisateurs" className="header__link" title="Rechercher par @utilisateur ou ID">
            Membres
          </Link>
          <Link to="/publier" className="btn btn--gold">
            <Icon name="plus" size={16} />
            <span>Publier</span>
          </Link>
          <ThemeToggle />
          <Link to="/compte/favoris" className="icon-btn header__fav" aria-label="Mes favoris">
            <Icon name="heart" size={20} />
          </Link>
          {session && !demoMode && (
            <div className="header__notif" ref={notifRef}>
              <button
                type="button"
                className="icon-btn"
                aria-label={
                  notifTotal
                    ? `Notifications — ${notifTotal} nouvelle${notifTotal > 1 ? 's' : ''}`
                    : 'Notifications'
                }
                aria-haspopup="menu"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Icon name="bell" size={20} />
                {notifTotal > 0 && (
                  <span className="header__msg-badge">{notifTotal > 9 ? '9+' : notifTotal}</span>
                )}
              </button>
              {notifOpen && (
                <div className="dropdown dropdown--notif" role="menu">
                  <NotificationList />
                </div>
              )}
            </div>
          )}
          {session && !demoMode && (
            <Link
              to="/messages"
              className="icon-btn header__msg"
              aria-label={unread ? `Messages — ${unread} non-lus` : 'Messages'}
            >
              <Icon name="send" size={20} />
              {unread > 0 && <span className="header__msg-badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}

          {session && profile ? (
            <div className="header__user" ref={userRef}>
              <button
                type="button"
                className="header__avatar-btn"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                {safeMediaUrl(profile.avatar_url) ? (
                  <img src={safeMediaUrl(profile.avatar_url)!} alt="" className="header__avatar" />
                ) : (
                  <span className="header__avatar header__avatar--ph" aria-hidden="true">
                    {(profile.display_name || profile.pseudonym || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <Icon name="chevron-down" size={14} />
              </button>
              {userMenuOpen && (
                <div className="dropdown" role="menu">
                  <p className="dropdown__name">
                    {profile.display_name || 'Mon compte'}
                    {profile.username && (
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
                        @{profile.username}
                      </span>
                    )}
                  </p>
                  <Link to={`/vendeur/${profile.username || profile.id}`} className="dropdown__item" role="menuitem">
                    <Icon name="user" size={16} /> Mon profil public
                  </Link>
                  <Link to="/compte" className="dropdown__item" role="menuitem">
                    <Icon name="tag" size={16} /> Mes annonces
                  </Link>
                  <Link to="/compte/favoris" className="dropdown__item" role="menuitem">
                    <Icon name="heart" size={16} /> Mes favoris
                  </Link>
                  <Link to="/compte/parametres" className="dropdown__item" role="menuitem">
                    <Icon name="sliders" size={16} /> Paramètres
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="dropdown__item dropdown__item--admin" role="menuitem">
                      <Icon name="shield" size={16} /> Administration
                    </Link>
                  )}
                  <button type="button" className="dropdown__item dropdown__item--danger" onClick={onSignOut} role="menuitem">
                    <Icon name="logout" size={16} /> Déconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="header__auth">
              <Link to="/connexion" className="header__link header__link--login">
                Connexion
              </Link>
              <Link
                to="/inscription"
                className={`btn btn--primary btn--signup-attract${isSignupPage ? ' btn--signup-attract--calm' : ''}`}
              >
                <span className="btn__shine" aria-hidden="true" />
                <span className="btn__spark-dot" aria-hidden="true" />
                <span className="btn__signup-label">S'inscrire</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>

    {/* Tiroir mobile — rendu en dehors de <header> : le backdrop-filter du
        header crée un containing block pour les éléments fixed, ce qui
        réduirait le tiroir à la hauteur du header. */}
    {menuOpen && (
      <div className="drawer-overlay" onClick={() => setMenuOpen(false)} />
    )}
    <aside className={`drawer${menuOpen ? ' drawer--open' : ''}`} aria-hidden={!menuOpen}>
        <DrawerSparkles active={menuOpen} />
        <div className="drawer__head">
          <Logo variant="dark" compact as="div" />
          <button type="button" className="icon-btn" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="drawer__search">
          <SearchBar localities={localities} onDone={() => setMenuOpen(false)} />
        </div>
        <nav className="drawer__nav" aria-label="Menu principal">
          <NavLink to="/annonces" onClick={() => setMenuOpen(false)}>
            <Icon name="grid" size={18} /> Catalogue complet
          </NavLink>
          <NavLink to="/utilisateurs" onClick={() => setMenuOpen(false)}>
            <Icon name="users" size={18} /> Chercher un membre (@pseudo / ID)
          </NavLink>
          <NavLink to="/publier" onClick={() => setMenuOpen(false)}>
            <Icon name="plus" size={18} /> Publier une annonce
          </NavLink>
          <NavLink to="/compte" onClick={() => setMenuOpen(false)}>
            <Icon name="tag" size={18} /> Mes annonces
          </NavLink>
          <NavLink to="/compte/favoris" onClick={() => setMenuOpen(false)}>
            <Icon name="heart" size={18} /> Mes favoris
          </NavLink>
          {session && !demoMode && (
            <NavLink to="/messages" onClick={() => setMenuOpen(false)}>
              <Icon name="send" size={18} />
              {unread > 0 ? `Messages (${unread})` : 'Messages'}
            </NavLink>
          )}
          {session && !demoMode && (
            <NavLink to="/notifications" onClick={() => setMenuOpen(false)}>
              <Icon name="bell" size={18} />
              {notifTotal > 0 ? `Notifications (${notifTotal})` : 'Notifications'}
            </NavLink>
          )}
          <div className="drawer__row">
            <span className="drawer__row-label">
              <Icon name={uiTheme === 'dark' ? 'sun' : 'moon'} size={18} />
              Apparence
            </span>
            <ThemeToggle label />
          </div>
          <NavLink to="/application" onClick={() => setMenuOpen(false)}>
            <Icon name="download" size={18} /> Télécharger l'application
          </NavLink>
          <NavLink to="/faq" onClick={() => setMenuOpen(false)}>
            <Icon name="info" size={18} /> Aide & FAQ
          </NavLink>
        </nav>
        <div className="drawer__cats">
          <button type="button" className="drawer__cats-toggle" onClick={() => setCatOpen((v) => !v)} aria-expanded={catOpen}>
            <Icon name="chevron-down" size={16} style={{ transform: catOpen ? 'rotate(180deg)' : undefined }} />
            Parcourir les catégories
          </button>
          {catOpen && (
            <div className="drawer__cats-list">
              <Link to="/annonces?cat=telephones" onClick={() => setMenuOpen(false)}>Téléphones & accessoires</Link>
              <Link to="/annonces?cat=informatique" onClick={() => setMenuOpen(false)}>Informatique & électronique</Link>
              <Link to="/annonces?cat=vehicules" onClick={() => setMenuOpen(false)}>Véhicules & automobile</Link>
              <Link to="/annonces?cat=immobilier" onClick={() => setMenuOpen(false)}>Immobilier</Link>
              <Link to="/annonces?cat=maison" onClick={() => setMenuOpen(false)}>Maison & décoration</Link>
              <Link to="/annonces?cat=mode" onClick={() => setMenuOpen(false)}>Mode & chaussures</Link>
              <Link to="/annonces?cat=services" onClick={() => setMenuOpen(false)}>Services professionnels</Link>
              <Link to="/annonces?cat=emploi" onClick={() => setMenuOpen(false)}>Emploi & recrutement</Link>
            </div>
          )}
        </div>
        {!session && (
          <div className="drawer__auth">
            <Link
              to="/inscription"
              onClick={() => setMenuOpen(false)}
              className={`btn btn--primary btn--signup-attract${isSignupPage ? ' btn--signup-attract--calm' : ''}`}
            >
              <span className="btn__shine" aria-hidden="true" />
              <span className="btn__spark-dot" aria-hidden="true" />
              <span className="btn__signup-label">S'inscrire gratuitement</span>
            </Link>
            <Link to="/connexion" onClick={() => setMenuOpen(false)} className="btn btn--ghost">
              Connexion
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

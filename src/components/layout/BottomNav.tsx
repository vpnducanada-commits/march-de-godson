import { Link, NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../Icon';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { demoMode } from '../../lib/api';

/**
 * Navigation basse mobile (app-like) : Accueil · Catalogue · Publier (FAB
 * central) · Messages · Compte. Visible ≤ 860 px, masquée sur les pages
 * « tunnel » (auth, publication, admin) où elle gênerait l'ergonomie.
 * Le badge Messages réutilise le compteur temps réel du centre de
 * notifications (données réelles, aucune donnée fictive).
 */
const HIDDEN = ['/publier', '/modifier', '/annonce', '/connexion', '/inscription', '/mot-de-passe', '/admin', '/auth'];

export function BottomNav() {
  const { pathname } = useLocation();
  const { session } = useAuth();
  const { unreadTotal } = useNotifications();

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  const authed = Boolean(session) && !demoMode;
  const msgTo = authed ? '/messages' : '/connexion';
  const accTo = authed ? '/compte' : '/connexion';

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <div className="bottom-nav__inner">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="bnav-ping" aria-hidden="true" />}
              <Icon name="home" size={20} />
              Accueil
            </>
          )}
        </NavLink>
        <NavLink
          to="/annonces"
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="bnav-ping" aria-hidden="true" />}
              <Icon name="grid" size={20} />
              Catalogue
            </>
          )}
        </NavLink>
        <Link to="/publier" className="bottom-nav__fab" aria-label="Publier une annonce">
          <Icon name="plus" size={24} />
        </Link>
        <NavLink
          to={msgTo}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="bnav-ping" aria-hidden="true" />}
              <Icon name="send" size={20} />
              Messages
              {unreadTotal > 0 && (
                <span className="bottom-nav__badge">{unreadTotal > 9 ? '9+' : unreadTotal}</span>
              )}
            </>
          )}
        </NavLink>
        <NavLink
          to={accTo}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="bnav-ping" aria-hidden="true" />}
              <Icon name="user" size={20} />
              {authed ? 'Compte' : 'Connexion'}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

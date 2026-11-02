import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useNotifications, type ListingEvent } from '../context/NotificationsContext';
import type { ListingStatus } from '../lib/types';
import { STATUS_LABELS } from '../lib/types';
import { timeAgo } from '../lib/format';
import { safeInternalPath, safeMediaUrl } from '../lib/security';

const STATUS_ICON: Record<ListingStatus, { name: string; cls: string }> = {
  draft: { name: 'pencil', cls: 'notif__icon--draft' },
  pending: { name: 'clock', cls: 'notif__icon--pending' },
  active: { name: 'check', cls: 'notif__icon--ok' },
  refused: { name: 'ban', cls: 'notif__icon--ko' },
  archived: { name: 'archive', cls: 'notif__icon--muted' },
};

function counterpartName(c: {
  counterpart: { display_name?: string | null; pseudonym?: string | null } | null;
}): string {
  const p = c.counterpart;
  return p?.display_name || p?.pseudonym || 'Un membre';
}

export function NotificationList() {
  const {
    unreadConversations,
    listingEvents,
    userNotifications,
    unreadFollowNotifs,
    markEventsRead,
    markFollowNotifRead,
    markAllFollowNotifsRead,
    clearFollowNotifs,
    refresh,
  } = useNotifications();

  if (
    unreadConversations.length === 0 &&
    listingEvents.length === 0 &&
    userNotifications.length === 0
  ) {
    return (
      <div className="notif notif--empty">
        <Icon name="check" size={22} />
        <p>Vous êtes à jour.</p>
        <span>
          Aucun nouveau message, aucune alerte de vendeur suivi ni changement sur vos annonces.
        </span>
      </div>
    );
  }

  return (
    <div className="notif">
      {userNotifications.length > 0 && (
        <div className="notif__group">
          <div className="notif__group-head">
            <h3 className="notif__group-title">
              Vendeurs suivis {unreadFollowNotifs > 0 ? `(${unreadFollowNotifs})` : ''}
            </h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {unreadFollowNotifs > 0 && (
                <button
                  type="button"
                  className="notif__group-action"
                  onClick={() => void markAllFollowNotifsRead()}
                >
                  Tout marquer lu
                </button>
              )}
              <button
                type="button"
                className="notif__group-action"
                onClick={() => void clearFollowNotifs()}
              >
                Effacer
              </button>
            </div>
          </div>
          {userNotifications.map((n) => {
            const unread = !n.read_at;
            return (
              <Link
                key={n.id}
                to={safeInternalPath(n.link, '/annonces')}
                className={`notif__item${unread ? ' notif__item--unread' : ''}`}
                onClick={() => {
                  if (unread) void markFollowNotifRead(n.id);
                }}
              >
                <span className="notif__icon notif__icon--ok">
                  <Icon name="bell" size={16} />
                </span>
                <span className="notif__item-body">
                  <span className="notif__item-title">{n.title}</span>
                  {n.body && <span className="notif__item-text">{n.body}</span>}
                </span>
                <span className="notif__item-side">
                  <span className="notif__item-time">{timeAgo(n.created_at)}</span>
                  {unread && <span className="notif__dot" aria-label="Non lue" />}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {unreadConversations.length > 0 && (
        <div className="notif__group">
          <div className="notif__group-head">
            <h3 className="notif__group-title">Messages</h3>
            <Link to="/messages" className="notif__group-action" onClick={() => void refresh()}>
              Ouvrir la messagerie
            </Link>
          </div>
          {unreadConversations.map((c) => {
            const name = counterpartName(c);
            const initial = (name.trim()[0] || 'U').toUpperCase();
            return (
              <Link key={c.id} to={`/messages/${c.id}`} className="notif__item">
                <span className="notif__avatar">
                  {safeMediaUrl(c.counterpart?.avatar_url) ? (
                    <img src={safeMediaUrl(c.counterpart?.avatar_url)!} alt="" />
                  ) : (
                    initial
                  )}
                </span>
                <span className="notif__item-body">
                  <span className="notif__item-title">
                    {name} <span className="notif__item-ctx">· {c.listingTitle}</span>
                  </span>
                  <span className="notif__item-text">
                    {c.lastMessage ? c.lastMessage.body : 'Nouvelle conversation'}
                  </span>
                </span>
                <span className="notif__item-side">
                  <span className="notif__item-time">
                    {c.lastMessage ? timeAgo(c.lastMessage.created_at) : '—'}
                  </span>
                  <span className="notif__dot" aria-label={`${c.unreadCount} non-lus`} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {listingEvents.length > 0 && (
        <div className="notif__group">
          <div className="notif__group-head">
            <h3 className="notif__group-title">Vos annonces</h3>
            <button type="button" className="notif__group-action" onClick={markEventsRead}>
              Tout marquer lu
            </button>
          </div>
          {listingEvents.map((e: ListingEvent) => {
            const s = STATUS_ICON[e.newStatus] ?? STATUS_ICON.pending;
            return (
              <Link key={e.key} to={`/annonce/${e.slug}`} className="notif__item">
                <span className={`notif__icon ${s.cls}`}>
                  <Icon name={s.name} size={16} />
                </span>
                <span className="notif__item-body">
                  <span className="notif__item-title">{e.title}</span>
                  <span className="notif__item-text">
                    {STATUS_LABELS[e.oldStatus]} → {STATUS_LABELS[e.newStatus]}
                  </span>
                </span>
                <span className="notif__item-side">
                  <span className="notif__item-time">{timeAgo(e.updatedAt)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

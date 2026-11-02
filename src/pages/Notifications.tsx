import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { NotificationList } from '../components/NotificationList';
import { FollowButton } from '../components/FollowButton';
import { Icon } from '../components/Icon';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { fetchFollowedUsers } from '../lib/api';
import type { Profile } from '../lib/types';

export default function Notifications() {
  usePageMeta('Notifications', 'Alertes des vendeurs suivis, messages non lus et statuts de vos annonces.');
  const { total } = useNotifications();
  const { session } = useAuth();
  const [followed, setFollowed] = useState<Profile[]>([]);

  useEffect(() => {
    if (!session?.user.id) return;
    fetchFollowedUsers(session.user.id)
      .then(setFollowed)
      .catch(() => setFollowed([]));
  }, [session?.user.id]);

  return (
    <div className="container page-narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Notifications
            {total > 0 && <span className="notif-page-badge">{total}</span>}
          </h1>
          <p className="page-sub">
            Nouvelles annonces des vendeurs suivis, messages et statuts de vos publications en temps réel.
          </p>
        </div>
        <Link to="/utilisateurs" className="btn btn--ghost btn--sm">
          <Icon name="search" size={15} /> Chercher un membre
        </Link>
      </div>

      <NotificationList />

      <section className="form-section" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 className="form-section__title" style={{ margin: 0 }}>
            <Icon name="users" size={18} /> Vendeurs que vous suivez ({followed.length})
          </h2>
          <Link to="/utilisateurs" className="btn btn--ghost btn--sm">
            <Icon name="user-plus" size={14} /> Trouver par @pseudo ou ID
          </Link>
        </div>
        {followed.length === 0 ? (
          <p className="form-hint" style={{ margin: 0 }}>
            Vous ne suivez encore aucun vendeur. Ouvrez un profil vendeur et appuyez sur <strong>Suivre</strong> pour recevoir une notification dès qu’il publie une annonce.
          </p>
        ) : (
          <div className="user-results-grid">
            {followed.map((u) => (
              <div key={u.id} className="user-card">
                <Link to={`/vendeur/${u.username || u.id}`} className="user-card__main">
                  <span className="user-card__avatar">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" />
                    ) : (
                      (u.display_name || u.username || 'M').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="user-card__info">
                    <strong className="user-card__name">{u.display_name || 'Membre'}</strong>
                    <span className="user-card__handle">
                      {u.username ? `@${u.username}` : ''}
                      {u.city ? ` · ${u.city}` : ''}
                    </span>
                  </span>
                </Link>
                <FollowButton
                  targetUserId={u.id}
                  targetName={u.display_name || (u.username ? `@${u.username}` : 'ce vendeur')}
                  size="sm"
                  showCount={false}
                  onChange={({ isFollowing }) => {
                    if (!isFollowing) {
                      setFollowed((prev) => prev.filter((p) => p.id !== u.id));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

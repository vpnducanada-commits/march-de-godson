import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { FollowButton } from '../components/FollowButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { searchUsers } from '../lib/api';
import type { SearchedUser } from '../lib/types';
import { ACCOUNT_TYPE_LABELS, shortUserId } from '../lib/types';
import { usePageMeta } from '../hooks/usePageMeta';

export default function UsersDirectory() {
  usePageMeta(
    'Rechercher un utilisateur',
    'Trouvez un vendeur ou membre GODSON Marketplace directement par son @nom_d_utilisateur ou son identifiant (ID).',
  );
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') || '';
  const [input, setInput] = useState(initial);
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initial));

  useEffect(() => {
    const q = params.get('q') || '';
    setInput(q);
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    let active = true;
    setLoading(true);
    setSearched(true);
    searchUsers(q.trim(), 24)
      .then((r) => {
        if (active) setResults(r);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (input.trim()) next.set('q', input.trim());
    setParams(next, { replace: true });
  };

  return (
    <div className="container page-narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Rechercher un utilisateur</h1>
          <p className="page-sub">
            Entrez un <strong>@nom_d’utilisateur</strong>, un nom affiché ou un <strong>ID</strong>{' '}
            (court ex. <code>#060958af</code> ou complet) pour accéder au profil et le suivre.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="user-finder-form">
        <div className="user-finder-form__input">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex. : @gedeon, #060958af ou identifiant complet…"
            aria-label="Nom d'utilisateur ou ID"
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={!input.trim()}>
          Rechercher
        </button>
      </form>

      {loading && <Spinner label="Recherche des profils…" />}

      {!loading && !searched && (
        <EmptyState
          icon="users"
          title="Trouvez directement un vendeur ou un proche"
          message="Saisissez son @nom_d’utilisateur ou son ID ci-dessus, puis appuyez sur « Suivre » pour recevoir une notification à chaque nouvelle annonce qu’il publie."
        />
      )}

      {!loading && searched && results.length === 0 && (
        <EmptyState
          icon="user"
          title="Aucun utilisateur trouvé"
          message={`Aucun profil actif ne correspond à « ${params.get('q') || input} ». Vérifiez l’orthographe du @pseudo ou les caractères de l’identifiant.`}
        />
      )}

      {!loading && results.length > 0 && (
        <div className="user-results-grid" style={{ marginTop: 18 }}>
          {results.map((u) => (
            <div key={u.id} className="user-card">
              <Link to={`/vendeur/${u.username || u.id}`} className="user-card__main">
                <span className="user-card__avatar">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" />
                  ) : (
                    (u.display_name || u.username || 'U').slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="user-card__info">
                  <strong className="user-card__name">
                    {u.display_name || 'Membre'}
                    {u.is_demo && <span className="badge badge--demo" style={{ marginLeft: 6 }}>Démo</span>}
                  </strong>
                  <span className="user-card__handle">
                    {u.username ? `@${u.username}` : ''} · ID #{shortUserId(u.id)}
                  </span>
                  <span className="user-card__meta">
                    {ACCOUNT_TYPE_LABELS[u.account_type] || 'Particulier'}
                    {u.city ? ` · ${u.city}` : ''} · {u.listings_count} annonce
                    {u.listings_count > 1 ? 's' : ''} · {u.followers_count} abonné
                    {u.followers_count > 1 ? 's' : ''}
                  </span>
                </span>
              </Link>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <FollowButton
                  targetUserId={u.id}
                  targetName={u.display_name || (u.username ? `@${u.username}` : 'ce vendeur')}
                  size="sm"
                />
                <Link to={`/vendeur/${u.username || u.id}`} className="btn btn--ghost btn--sm">
                  Profil
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { searchUsers } from '../lib/api';
import type { Locality, SearchedUser } from '../lib/types';
import { shortUserId } from '../lib/types';

const POPULAR = ['iPhone', 'Toyota', 'Terrain', 'Location', 'Prestation', 'Samsung', 'Maison'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function SearchBar({
  localities,
  initialQ,
  size = 'md',
  onDone,
}: {
  localities: Locality[];
  initialQ?: string;
  size?: 'md' | 'lg';
  onDone?: () => void;
}) {
  const [q, setQ] = useState(initialQ ?? '');
  const [city, setCity] = useState('');
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<SearchedUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  const recents: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('gm_recent_q') || '[]');
    } catch {
      return [];
    }
  })();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  // Recherche en direct des utilisateurs (@pseudo, nom ou ID)
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setUsers([]);
      setUserLoading(false);
      return;
    }
    let active = true;
    setUserLoading(true);
    const t = window.setTimeout(() => {
      searchUsers(trimmed, 5)
        .then((res) => {
          if (active) setUsers(res);
        })
        .catch(() => {
          if (active) setUsers([]);
        })
        .finally(() => {
          if (active) setUserLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [q]);

  const filteredLocs =
    q.length >= 1
      ? localities.filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
      : [];
  const filteredPop =
    q.length >= 1
      ? POPULAR.filter((p) => p.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
      : POPULAR.slice(0, 4);

  const showDrop =
    open &&
    (users.length > 0 ||
      userLoading ||
      filteredLocs.length > 0 ||
      filteredPop.length > 0 ||
      recents.length > 0 ||
      q.trim().startsWith('@') ||
      q.trim().startsWith('#'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const raw = q.trim();
    // Si l'utilisateur tape explicitement @pseudo, #id ou un UUID complet → accès direct au profil
    if (raw.startsWith('@') || raw.startsWith('#') || UUID_RE.test(raw)) {
      const clean = raw.replace(/^[@#]+/, '');
      if (clean) {
        setOpen(false);
        onDone?.();
        navigate(`/vendeur/${encodeURIComponent(clean)}`);
        return;
      }
    }

    const params = new URLSearchParams();
    if (raw) {
      params.set('q', raw);
      try {
        const r = JSON.parse(localStorage.getItem('gm_recent_q') || '[]');
        const n = [raw, ...r.filter((x: string) => x !== raw)].slice(0, 5);
        localStorage.setItem('gm_recent_q', JSON.stringify(n));
      } catch {
        /* ignore */
      }
    }
    if (city) params.set('city', city);
    navigate(`/annonces${params.toString() ? `?${params.toString()}` : ''}`);
    setOpen(false);
    onDone?.();
  };

  const pick = (val: string) => {
    setQ(val);
    setOpen(false);
    const params = new URLSearchParams();
    params.set('q', val);
    if (city) params.set('city', city);
    navigate(`/annonces?${params.toString()}`);
    onDone?.();
  };

  const pickUser = (u: SearchedUser) => {
    setOpen(false);
    onDone?.();
    navigate(`/vendeur/${u.username || u.id}`);
  };

  return (
    <form
      className={`searchbar searchbar--${size}`}
      role="search"
      onSubmit={submit}
      ref={ref}
      style={{ position: 'relative' }}
    >
      <div className="searchbar__field">
        <Icon name="search" size={size === 'lg' ? 20 : 17} className="searchbar__icon" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Produit, service, @utilisateur ou ID…"
          aria-label="Mot-clé, nom d'utilisateur ou ID"
          name="q"
          autoComplete="off"
        />
      </div>
      <div className="searchbar__city">
        <Icon name="map-pin" size={16} className="searchbar__icon" />
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Localité" name="city">
          <option value="">Tout le Gabon</option>
          {localities.map((l) => (
            <option key={l.id} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={`btn btn--primary${size === 'lg' ? ' btn--lg' : ''}`}>
        Rechercher
      </button>

      {showDrop && (
        <div className="searchbar__dropdown">
          {(users.length > 0 || userLoading || q.trim().startsWith('@') || q.trim().startsWith('#')) && (
            <div className="searchbar__group">
              <div className="searchbar__group-title">
                <span>Utilisateurs (@pseudo / ID)</span>
                <Link
                  to={`/utilisateurs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`}
                  onClick={() => {
                    setOpen(false);
                    onDone?.();
                  }}
                >
                  Recherche avancée
                </Link>
              </div>
              {userLoading && users.length === 0 && (
                <div className="searchbar__hint">Recherche d’utilisateurs…</div>
              )}
              {!userLoading && users.length === 0 && (
                <div className="searchbar__hint">
                  Aucun profil trouvé pour « {q.trim()} ». Vérifiez le @pseudo ou l’ID.
                </div>
              )}
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="searchbar__user-item"
                  onClick={() => pickUser(u)}
                >
                  <span className="searchbar__user-avatar">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" />
                    ) : (
                      (u.display_name || u.username || 'U').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="searchbar__user-info">
                    <strong>{u.display_name || 'Membre'}</strong>
                    <span>
                      {u.username ? `@${u.username}` : ''} · ID #{shortUserId(u.id)}
                      {u.city ? ` · ${u.city}` : ''}
                    </span>
                  </span>
                  <span className="searchbar__user-stats">
                    {u.listings_count} annonce{u.listings_count > 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredLocs.length > 0 && (
            <div className="searchbar__group">
              <div className="searchbar__group-title">
                <span>Localités</span>
              </div>
              {filteredLocs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="searchbar__item"
                  onClick={() => pick(l.name)}
                >
                  <Icon name="map-pin" size={14} />
                  {l.name}
                </button>
              ))}
            </div>
          )}

          {filteredPop.length > 0 && (
            <div className="searchbar__group">
              <div className="searchbar__group-title">
                <span>Populaires</span>
              </div>
              {filteredPop.map((p) => (
                <button key={p} type="button" className="searchbar__item" onClick={() => pick(p)}>
                  <Icon name="sparkles" size={14} />
                  {p}
                </button>
              ))}
            </div>
          )}

          {recents.length > 0 && (
            <div className="searchbar__group">
              <div className="searchbar__group-title">
                <span>Récentes</span>
              </div>
              {recents.slice(0, 3).map((r: string) => (
                <button key={r} type="button" className="searchbar__item" onClick={() => pick(r)}>
                  <Icon name="clock" size={14} />
                  {r}
                </button>
              ))}
            </div>
          )}

          <div className="searchbar__footer">
            <Link
              to={`/utilisateurs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`}
              onClick={() => {
                setOpen(false);
                onDone?.();
              }}
            >
              <Icon name="users" size={14} /> Chercher un membre par nom d’utilisateur ou ID →
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}

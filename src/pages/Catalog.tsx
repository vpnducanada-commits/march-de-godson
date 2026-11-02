import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { FollowButton } from '../components/FollowButton';
import { ListingCard } from '../components/ListingCard';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonListingGrid } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import {
  fetchCategories,
  fetchListings,
  fetchLocalities,
  searchUsers,
} from '../lib/api';
import { requestUserPosition } from '../lib/geolocation';
import type { Category, ListingFull, Locality, ListingCondition, SearchedUser } from '../lib/types';
import { CONDITION_LABELS, shortUserId } from '../lib/types';
import { SavedSearchBanner } from '../components/SavedSearchBanner';
import GeminiSearchAssistant from '../components/GeminiSearchAssistant';
import { usePageMeta } from '../hooks/usePageMeta';

const PAGE_SIZE = 12;

export default function Catalog({ fixedCat }: { fixedCat?: string }) {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [items, setItems] = useState<ListingFull[] | null>(null);
  const [matchedUsers, setMatchedUsers] = useState<SearchedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('gm_viewmode') as 'grid' | 'list') || 'grid',
  );

  const q = params.get('q') || '';
  const cat = fixedCat || params.get('cat') || '';
  const city = params.get('city') || '';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const cond = (params.get('cond') || '') as ListingCondition | '';
  const strictPublicOnly = params.get('live') === '1';
  const sort = (params.get('sort') || 'newest') as 'newest' | 'price_asc' | 'price_desc';
  const lat = params.get('lat') ? Number(params.get('lat')) : undefined;
  const lng = params.get('lng') ? Number(params.get('lng')) : undefined;
  const page = Math.max(1, Number(params.get('page') || '1'));
  const nearActive = Boolean(lat && lng);

  const catName = useMemo(
    () => categories.find((c) => c.slug === cat)?.name,
    [categories, cat],
  );

  usePageMeta(
    catName ? catName : q ? `Recherche : ${q}` : 'Catalogue des annonces',
    'Annonces au Gabon : filtrez par catégorie, localité, prix et état. Comparaison des offres en FCFA.',
  );

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => undefined);
    fetchLocalities().then(setLocalities).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!q.trim() || fixedCat || strictPublicOnly) {
      setMatchedUsers([]);
      return;
    }
    let active = true;
    searchUsers(q.trim(), 6)
      .then((res) => {
        if (active) setMatchedUsers(res);
      })
      .catch(() => {
        if (active) setMatchedUsers([]);
      });
    return () => {
      active = false;
    };
  }, [q, fixedCat, strictPublicOnly]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchListings({
      q: q || undefined,
      category: cat || undefined,
      city: city || undefined,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      condition: cond || undefined,
      strictPublicOnly,
      sort,
      lat,
      lng,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((r) => {
        if (!active) return;
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Erreur de recherche.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q, cat, city, min, max, cond, strictPublicOnly, sort, page, lat, lng]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const toggleView = (m: 'grid' | 'list') => {
    setViewMode(m);
    localStorage.setItem('gm_viewmode', m);
  };

  const toggleNearMe = async () => {
    if (nearActive) {
      const next = new URLSearchParams(params);
      next.delete('lat');
      next.delete('lng');
      localStorage.removeItem('gm_near');
      setParams(next, { replace: true });
      toast('info', 'Filtre de proximité désactivé.');
      return;
    }
    if (locating) return;
    setLocating(true);
    try {
      const coords = await requestUserPosition();
      const next = new URLSearchParams(params);
      next.set('lat', String(coords.latitude));
      next.set('lng', String(coords.longitude));
      next.delete('page');
      try {
        localStorage.setItem(
          'gm_near',
          JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
        );
      } catch {
        /* ignore */
      }
      setParams(next, { replace: true });
      toast('success', 'Localisation activée : affichage des annonces proches de vous.');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Position refusée ou indisponible.');
    } finally {
      setLocating(false);
    }
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    if (fixedCat) next.set('cat', fixedCat);
    localStorage.removeItem('gm_near');
    setParams(next, { replace: true });
  };

  const hasFilters = !!(q || cat || city || min || max || cond || nearActive);
  const activeFilterCount = [q, cat, city, min, max, cond, nearActive ? '1' : ''].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const subcats = cat ? categories.filter((c) => c.parent_id !== null && c.slug === cat) : [];
  const parentOfSelected = subcats.length
    ? categories.find((c) => c.id === subcats[0].parent_id)
    : null;

  return (
    <div className="container catalog">
      <div className="catalog__top">
        <div>
          <h1 className="page-title">
            {parentOfSelected
              ? parentOfSelected.name
              : catName || (q ? `Résultats pour « ${q} »` : 'Catalogue des annonces')}
          </h1>
          {!loading && !error && (
            <p className="catalog__count" aria-live="polite">
              {total} annonce{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
              {city && localities.length
                ? ` à ${localities.find((l) => l.slug === city)?.name}`
                : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${nearActive ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => void toggleNearMe()}
            disabled={locating}
          >
            <Icon name="map-pin" size={15} />{' '}
            {locating ? 'Localisation…' : nearActive ? 'Autour de moi ✓' : 'Autour de moi'}
          </button>
          <button
            type="button"
            className={`btn btn--ghost ${viewMode === 'list' ? '' : 'btn--primary'}`}
            style={{ padding: '8px 10px' }}
            onClick={() => toggleView('grid')}
            aria-label="Vue grille"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            className={`btn btn--ghost ${viewMode === 'list' ? 'btn--primary' : ''}`}
            style={{ padding: '8px 10px' }}
            onClick={() => toggleView('list')}
            aria-label="Vue liste"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="4" cy="6" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="18" r="1" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn--ghost catalog__filter-toggle"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <Icon name="filter" size={16} />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>
      </div>

      {hasFilters && (
        <div className="active-chips">
          {q && (
            <button className="active-chips__chip" onClick={() => setParam('q', '')}>
              <Icon name="search" size={13} /> {q} <Icon name="x" size={13} />
            </button>
          )}
          {cat && !fixedCat && (
            <button className="active-chips__chip" onClick={() => setParam('cat', '')}>
              <Icon name="package" size={13} /> {catName || cat} <Icon name="x" size={13} />
            </button>
          )}
          {city && (
            <button className="active-chips__chip" onClick={() => setParam('city', '')}>
              <Icon name="map-pin" size={13} /> {city} <Icon name="x" size={13} />
            </button>
          )}
          {(min || max) && (
            <button
              className="active-chips__chip"
              onClick={() => {
                setParam('min', '');
                setParam('max', '');
              }}
            >
              <Icon name="tag" size={13} /> {min || 0}–{max || '∞'} FCFA <Icon name="x" size={13} />
            </button>
          )}
          {cond && (
            <button className="active-chips__chip" onClick={() => setParam('cond', '')}>
              <Icon name="check" size={13} /> {cond} <Icon name="x" size={13} />
            </button>
          )}
          {nearActive && (
            <button className="active-chips__chip" onClick={() => void toggleNearMe()}>
              <Icon name="map-pin" size={13} /> Autour de moi <Icon name="x" size={13} />
            </button>
          )}
          <button className="active-chips__chip active-chips__clear" onClick={clearAll}>
            Effacer tout
          </button>
        </div>
      )}

      {/* RÉSULTATS UTILISATEURS CORRESPONDANTS (@username / ID / nom) */}
      {matchedUsers.length > 0 && (
        <section className="catalog-users-box">
          <div className="catalog-users-box__head">
            <h2 className="catalog-users-box__title">
              <Icon name="users" size={17} /> Profils & vendeurs trouvés ({matchedUsers.length})
            </h2>
            <Link to={`/utilisateurs?q=${encodeURIComponent(q)}`} className="btn btn--ghost btn--sm">
              Tous les membres →
            </Link>
          </div>
          <div className="user-results-grid">
            {matchedUsers.map((u) => (
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
                    <strong className="user-card__name">{u.display_name || 'Membre'}</strong>
                    <span className="user-card__handle">
                      {u.username ? `@${u.username}` : ''} · ID #{shortUserId(u.id)}
                      {u.city ? ` · ${u.city}` : ''}
                    </span>
                    <span className="user-card__meta">
                      {u.listings_count} annonce{u.listings_count > 1 ? 's' : ''} · {u.followers_count}{' '}
                      abonné{u.followers_count > 1 ? 's' : ''}
                    </span>
                  </span>
                </Link>
                <FollowButton
                  targetUserId={u.id}
                  targetName={u.display_name || (u.username ? `@${u.username}` : 'ce vendeur')}
                  size="sm"
                  showCount={false}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {!fixedCat && <GeminiSearchAssistant categories={categories} localities={localities} />}
      <SavedSearchBanner query={q} />

      <div className="catalog__layout">
        {/* FILTRES */}
        <aside className={`catalog__filters${filtersOpen ? ' catalog__filters--open' : ''}`}>
          <div className="filters">
            <div className="filters__row filters__row--clear">
              <button
                type="button"
                className="filters__clear"
                onClick={clearAll}
                disabled={!hasFilters}
              >
                <Icon name="x" size={13} /> Effacer les filtres
              </button>
            </div>

            {!fixedCat && (
              <div className="filters__group">
                <label className="filters__label" htmlFor="f-cat">
                  Catégorie
                </label>
                <select id="f-cat" value={cat} onChange={(e) => setParam('cat', e.target.value)}>
                  <option value="">Toutes les catégories</option>
                  {categories
                    .filter((c) => c.parent_id === null && c.status === 'active')
                    .map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {cat &&
              subcats.length === 0 &&
              (() => {
                const top = categories.find((c) => c.slug === cat && c.parent_id === null);
                const children = top ? categories.filter((c) => c.parent_id === top.id) : [];
                if (!children.length) return null;
                return (
                  <div className="filters__group">
                    <span className="filters__label">Sous-catégorie</span>
                    <div className="filters__chips">
                      <button
                        type="button"
                        className={`chip${!params.get('sub') ? ' chip--active' : ''}`}
                        onClick={() => setParam('sub', '')}
                      >
                        Toutes
                      </button>
                      {children.map((c) => (
                        <Link
                          key={c.id}
                          to={`/annonces?cat=${c.slug}${params.get('q') ? `&q=${params.get('q')}` : ''}`}
                          className="chip"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })()}

            <div className="filters__group">
              <label className="filters__label" htmlFor="f-city">
                Localité
              </label>
              <select id="f-city" value={city} onChange={(e) => setParam('city', e.target.value)}>
                <option value="">Tout le Gabon</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.slug}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filters__group">
              <span className="filters__label">Prix (FCFA)</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={2000000}
                  step={50000}
                  value={min ? Number(min) : 0}
                  onChange={(e) => setParam('min', e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="range"
                  min={0}
                  max={2000000}
                  step={50000}
                  value={max ? Number(max) : 2000000}
                  onChange={(e) => setParam('max', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div className="filters__price">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Min"
                  aria-label="Prix minimum"
                  value={min}
                  onChange={(e) => setParam('min', e.target.value)}
                />
                <span aria-hidden="true">—</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Max"
                  aria-label="Prix maximum"
                  value={max}
                  onChange={(e) => setParam('max', e.target.value)}
                />
              </div>
            </div>

            <div className="filters__group">
              <span className="filters__label">État</span>
              <div className="filters__chips">
                <button
                  type="button"
                  className={`chip${!cond ? ' chip--active' : ''}`}
                  onClick={() => setParam('cond', '')}
                >
                  Tous
                </button>
                {(Object.keys(CONDITION_LABELS) as ListingCondition[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip${cond === c ? ' chip--active' : ''}`}
                    onClick={() => setParam('cond', c)}
                  >
                    {CONDITION_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters__group">
              <label className="filters__label" htmlFor="f-sort">
                Trier par
              </label>
              <select id="f-sort" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
                <option value="newest">Plus récentes d'abord</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
              </select>
            </div>
          </div>
        </aside>

        {/* RÉSULTATS */}
        <div className="catalog__results">
          {error && <EmptyState icon="alert" title="Recherche impossible" message={error} />}
          {!error && loading && <SkeletonListingGrid count={8} />}
          {!error && !loading && items && items.length === 0 && (
            <EmptyState
              icon="search"
              title="Aucune annonce ne correspond à votre recherche"
              message={
                matchedUsers.length > 0
                  ? 'Aucune annonce active ne porte ce mot-clé, mais des profils utilisateurs correspondants sont affichés ci-dessus.'
                  : "Essayez d'élargir vos critères : retirez un filtre, élargissez la fourchette de prix ou choisissez « Tout le Gabon »."
              }
              action={
                <button type="button" className="btn btn--primary" onClick={clearAll}>
                  Effacer les filtres
                </button>
              }
            />
          )}
          {!error && !loading && items && items.length > 0 && (
            <>
              <div className={viewMode === 'list' ? 'listing-list' : 'listing-grid'}>
                {items.map((item) => (
                  <ListingCard key={item.listing.id} item={item} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={(p) => setParam('page', String(p))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ListingCard } from '../components/ListingCard';
import { Pagination } from '../components/ui/Pagination';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import {
  fetchCategories,
  fetchListings,
  fetchLocalities,
} from '../lib/api';
import type { Category, ListingFull, Locality, ListingCondition } from '../lib/types';
import { CONDITION_LABELS } from '../lib/types';
import { usePageMeta } from '../hooks/usePageMeta';

const PAGE_SIZE = 12;

export default function Catalog({ fixedCat }: { fixedCat?: string }) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [items, setItems] = useState<ListingFull[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') || '';
  const cat = fixedCat || params.get('cat') || '';
  const city = params.get('city') || '';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const cond = (params.get('cond') || '') as ListingCondition | '';
  const sort = (params.get('sort') || 'newest') as 'newest' | 'price_asc' | 'price_desc';
  const page = Math.max(1, Number(params.get('page') || '1'));

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
      sort,
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
  }, [q, cat, city, min, max, cond, sort, page]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const clearAll = () => {
    const next = new URLSearchParams();
    if (fixedCat) next.set('cat', fixedCat);
    setParams(next, { replace: true });
  };

  const hasFilters = !!(q || cat || city || min || max || cond);
  const activeFilterCount = [q, cat, city, min, max, cond].filter(Boolean).length;
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
            {parentOfSelected ? parentOfSelected.name : catName || (q ? `Résultats pour « ${q} »` : 'Catalogue des annonces')}
          </h1>
          {!loading && !error && (
            <p className="catalog__count" aria-live="polite">
              {total} annonce{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
              {city && localities.length ? ` à ${localities.find((l) => l.slug === city)?.name}` : ''}
            </p>
          )}
        </div>
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

      <div className="catalog__layout">
        {/* FILTRES */}
        <aside className={`catalog__filters${filtersOpen ? ' catalog__filters--open' : ''}`}>
          <div className="filters">
            <div className="filters__row filters__row--clear">
              <button type="button" className="filters__clear" onClick={clearAll} disabled={!hasFilters}>
                <Icon name="x" size={13} /> Effacer les filtres
              </button>
            </div>

            {!fixedCat && (
              <div className="filters__group">
                <label className="filters__label" htmlFor="f-cat">Catégorie</label>
                <select id="f-cat" value={cat} onChange={(e) => setParam('cat', e.target.value)}>
                  <option value="">Toutes les catégories</option>
                  {categories
                    .filter((c) => c.parent_id === null && c.status === 'active')
                    .map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                </select>
              </div>
            )}
            {cat && subcats.length === 0 && (() => {
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
                      <Link key={c.id} to={`/annonces?cat=${c.slug}${params.get('q') ? `&q=${params.get('q')}` : ''}`} className="chip">
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="filters__group">
              <label className="filters__label" htmlFor="f-city">Localité</label>
              <select id="f-city" value={city} onChange={(e) => setParam('city', e.target.value)}>
                <option value="">Tout le Gabon</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.slug}>{l.name}</option>
                ))}
              </select>
            </div>

            <div className="filters__group">
              <span className="filters__label">Prix (FCFA)</span>
              <div className="filters__price">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Min"
                  aria-label="Prix minimum en FCFA"
                  value={min}
                  onChange={(e) => setParam('min', e.target.value)}
                />
                <span aria-hidden="true">—</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Max"
                  aria-label="Prix maximum en FCFA"
                  value={max}
                  onChange={(e) => setParam('max', e.target.value)}
                />
              </div>
            </div>

            <div className="filters__group">
              <span className="filters__label">État du produit</span>
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
              <label className="filters__label" htmlFor="f-sort">Trier par</label>
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
          {error && (
            <EmptyState icon="alert" title="Recherche impossible" message={error} />
          )}
          {!error && loading && <Spinner label="Recherche en cours…" />}
          {!error && !loading && items && items.length === 0 && (
            <EmptyState
              icon="search"
              title="Aucune annonce ne correspond à votre recherche"
              message="Essayez d'élargir vos critères : retirez un filtre, élargissez la fourchette de prix ou choisissez « Tout le Gabon »."
              action={
                <button type="button" className="btn btn--primary" onClick={clearAll}>
                  Effacer les filtres
                </button>
              }
            />
          )}
          {!error && !loading && items && items.length > 0 && (
            <>
              <div className="listing-grid">
                {items.map((item) => (
                  <ListingCard key={item.listing.id} item={item} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onPage={(p) => setParam('page', String(p))} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

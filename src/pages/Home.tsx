import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SearchBar } from '../components/SearchBar';
import { ListingCard } from '../components/ListingCard';
import { OnboardingGuide } from '../components/OnboardingGuide';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCatGrid, SkeletonListingGrid } from '../components/ui/Skeleton';
import { useToast } from '../context/ToastContext';
import { fetchCategories, fetchLocalities, fetchListings, fetchListingBySlug } from '../lib/api';
import { requestUserPosition } from '../lib/geolocation';
import { clearViewedSlugs, getViewedSlugs } from '../lib/recentlyViewed';
import type { Category, ListingFull, Locality } from '../lib/types';
import { usePageMeta } from '../hooks/usePageMeta';
import { useReveal } from '../hooks/useReveal';

const TOP_CATEGORIES = [
  'telephones',
  'informatique',
  'vehicules',
  'immobilier',
  'maison',
  'mode',
  'electro',
  'services',
  'emploi',
  'travaux',
  'education',
  'autres',
];

const HOME_BOOT_KEY = 'gm:home-boot:v2';
const HOME_BOOT_TTL_MS = 20 * 60 * 1000;

interface HomeBootSnapshot {
  ts: number;
  categories: Category[];
  localities: Locality[];
  recent: ListingFull[];
}

function readHomeBoot(): HomeBootSnapshot | null {
  try {
    const raw = window.localStorage.getItem(HOME_BOOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeBootSnapshot;
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > HOME_BOOT_TTL_MS) return null;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.recent)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeHomeBoot(patch: Partial<Omit<HomeBootSnapshot, 'ts'>>) {
  try {
    const prev = readHomeBoot();
    const next: HomeBootSnapshot = {
      ts: Date.now(),
      categories: patch.categories ?? prev?.categories ?? [],
      localities: patch.localities ?? prev?.localities ?? [],
      recent: patch.recent ?? prev?.recent ?? [],
    };
    window.localStorage.setItem(HOME_BOOT_KEY, JSON.stringify(next));
  } catch {
    // Quota localStorage atteint ou mode privé : ignorer sans bloquer
  }
}

export default function Home() {
  usePageMeta(
    '',
    'Achetez, vendez et trouvez des services au Gabon : téléphones, véhicules, immobilier, mode, services… Annonces au FCFA à Libreville, Port-Gentil, Franceville et partout au Gabon.',
  );
  const navigate = useNavigate();
  const { toast } = useToast();
  const [boot] = useState<HomeBootSnapshot | null>(() => readHomeBoot());
  const [categories, setCategories] = useState<Category[]>(() => boot?.categories ?? []);
  const [localities, setLocalities] = useState<Locality[]>(() => boot?.localities ?? []);
  const [recent, setRecent] = useState<ListingFull[] | null>(() =>
    boot && boot.recent.length > 0 ? boot.recent : null,
  );
  const [viewedItems, setViewedItems] = useState<ListingFull[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        writeHomeBoot({ categories: cats });
      })
      .catch(() => {
        if (!boot?.categories?.length) setError('Impossible de charger les catégories.');
      });
    fetchLocalities()
      .then((locs) => {
        setLocalities(locs);
        writeHomeBoot({ localities: locs });
      })
      .catch(() => undefined);
    fetchListings({ pageSize: 8 })
      .then((r) => {
        setRecent(r.items);
        writeHomeBoot({ recent: r.items });
      })
      .catch((e) => {
        if (!boot?.recent?.length) {
          setError(e instanceof Error ? e.message : 'Chargement impossible.');
        }
      });

    const slugs = getViewedSlugs();
    if (slugs.length > 0) {
      Promise.all(slugs.map((s) => fetchListingBySlug(s).catch(() => null))).then((res) => {
        const valid = res.filter((x): x is ListingFull => Boolean(x && x.listing.status === 'active'));
        setViewedItems(valid);
      });
    }
  }, [boot]);

  const onNearMe = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await requestUserPosition();
      navigate(`/annonces?lat=${pos.latitude.toFixed(5)}&lng=${pos.longitude.toFixed(5)}`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Position GPS indisponible.');
    } finally {
      setLocating(false);
    }
  };

  const onClearViewed = () => {
    clearViewedSlugs();
    setViewedItems([]);
    toast('info', 'Historique des annonces consultées effacé.');
  };

  const revealCats = useReveal<HTMLElement>();
  const revealRecent = useReveal<HTMLElement>();
  const revealCta = useReveal<HTMLElement>();

  const topCats = categories
    .filter((c) => c.parent_id === null && c.status === 'active')
    .filter((c) => TOP_CATEGORIES.includes(c.slug));
  const displayCats = topCats.length
    ? topCats
    : categories.filter((c) => c.parent_id === null && c.status === 'active').slice(0, 12);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__text">
            <h1 className="hero__title">
              Le marché gabonais, <span>à portée de clic.</span>
            </h1>
            <p className="hero__sub">
              Recherchez, comparez et publiez des annonces partout au Gabon : produits,
              services, véhicules, immobilier et plus encore — en francs CFA.
            </p>
          </div>
          <div className="hero__search">
            <SearchBar localities={localities} size="lg" />
            <p className="hero__hint">
              <Link to="/annonces?cat=telephones">Téléphones</Link>
              <Link to="/annonces?cat=immobilier">Immobilier</Link>
              <Link to="/annonces?cat=vehicules">Véhicules</Link>
              <Link to="/annonces?cat=services">Services</Link>
            </p>
          </div>
        </div>
      </section>

      {/* ACCÈS RAPIDE VILLES DU GABON + AUTOUR DE MOI */}
      {localities.length > 0 && (
        <section className="city-strip-sec" aria-label="Filtrer rapidement par ville">
          <div className="container">
            <div className="city-strip">
              <button
                type="button"
                className="city-pill city-pill--gps"
                onClick={() => void onNearMe()}
                disabled={locating}
              >
                <Icon name="map-pin" size={14} />
                <span>{locating ? 'Localisation…' : 'Autour de moi'}</span>
              </button>
              {localities.slice(0, 10).map((loc) => (
                <Link
                  key={loc.id}
                  to={`/annonces?city=${encodeURIComponent(loc.slug)}`}
                  className="city-pill"
                >
                  {loc.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GUIDE INTERACTIF NOUVEL UTILISATEUR */}
      <OnboardingGuide />

      {/* CATÉGORIES */}
      <section className="section reveal" ref={revealCats}>
        <div className="container">
          <div className="section__head">
            <h2 className="section__title">Parcourir les catégories</h2>
            <Link to="/annonces" className="section__more">
              Tout le catalogue <Icon name="chevron-right" size={15} />
            </Link>
          </div>
          {displayCats.length ? (
            <div className="cat-grid">
              {displayCats.map((c) => (
                <Link key={c.id} to={`/annonces?cat=${c.slug}`} className="cat-card">
                  <span className="cat-card__icon">
                    <Icon name={c.icon || 'grid'} size={22} />
                  </span>
                  <span className="cat-card__name">{c.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            !error && <SkeletonCatGrid count={8} />
          )}
        </div>
      </section>

      {/* CONSULTÉES RÉCEMMENT (historique local réel de l'appareil) */}
      {viewedItems.length > 0 && (
        <section className="section recent-viewed-sec">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title">Consultées récemment</h2>
              <button type="button" className="recent-clear-btn" onClick={onClearViewed}>
                <Icon name="trash" size={14} /> Effacer
              </button>
            </div>
            <div className="listing-grid">
              {viewedItems.slice(0, 4).map((item) => (
                <ListingCard key={item.listing.id} item={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ANNONCES RÉCENTES */}
      <section className="section section--tint reveal" ref={revealRecent}>
        <div className="container">
          <div className="section__head">
            <h2 className="section__title">Annonces récentes</h2>
            <Link to="/annonces" className="section__more">
              Voir toutes les annonces <Icon name="chevron-right" size={15} />
            </Link>
          </div>
          {error && <EmptyState icon="alert" title="Chargement impossible" message={error} />}
          {!error && recent === null && <SkeletonListingGrid count={8} />}
          {recent && recent.length === 0 && (
            <EmptyState
              icon="tag"
              title="Aucune annonce pour le moment"
              message="Soyez le premier à publier sur GODSON Marketplace."
              action={
                <Link to="/publier" className="btn btn--gold">
                  <Icon name="plus" size={16} /> Publier une annonce
                </Link>
              }
            />
          )}
          {recent && recent.length > 0 && (
            <div className="listing-grid">
              {recent.map((item) => (
                <ListingCard key={item.listing.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA VENDEUR */}
      <section className="section reveal" ref={revealCta}>
        <div className="container">
          <div className="cta-band">
            <div className="cta-band__text">
              <h2 className="cta-band__title">Vous avez quelque chose à vendre ?</h2>
              <p className="cta-band__sub">
                Publiez votre annonce en quelques minutes, gratuitement. Décrivez votre
                produit ou service, ajoutez des photos, et laissez les acheteurs venir à
                vous.
              </p>
              <ul className="cta-band__list">
                <li><Icon name="check-circle" size={17} /> Publication gratuite et illimitée</li>
                <li><Icon name="check-circle" size={17} /> Contact direct avec les acheteurs</li>
                <li><Icon name="check-circle" size={17} /> Gestion de vos annonces depuis votre espace</li>
              </ul>
            </div>
            <div className="cta-band__action">
              <Link to="/publier" className="btn btn--gold btn--lg">
                <Icon name="plus" size={18} /> Publier une annonce
              </Link>
              <Link to="/faq" className="cta-band__help">
                Comment ça marche ?
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

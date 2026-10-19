import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SearchBar } from '../components/SearchBar';
import { ListingCard } from '../components/ListingCard';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCatGrid, SkeletonListingGrid } from '../components/ui/Skeleton';
import { fetchCategories, fetchLocalities, fetchListings } from '../lib/api';
import type { Category, ListingFull, Locality } from '../lib/types';
import { usePageMeta } from '../hooks/usePageMeta';

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

export default function Home() {
  usePageMeta(
    '',
    'Achetez, vendez et trouvez des services au Gabon : téléphones, véhicules, immobilier, mode, services… Annonces au FCFA à Libreville, Port-Gentil, Franceville et partout au Gabon.',
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [recent, setRecent] = useState<ListingFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setError('Impossible de charger les catégories.'));
    fetchLocalities().then(setLocalities).catch(() => undefined);
    fetchListings({ pageSize: 8 })
      .then((r) => setRecent(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, []);

  const topCats = categories
    .filter((c) => c.parent_id === null && c.status === 'active')
    .filter((c) => TOP_CATEGORIES.includes(c.slug));
  const displayCats = topCats.length ? topCats : categories.filter((c) => c.parent_id === null && c.status === 'active').slice(0, 12);

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

      {/* CATÉGORIES */}
      <section className="section">
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

      {/* ANNONCES RÉCENTES */}
      <section className="section section--tint">
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
      <section className="section">
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

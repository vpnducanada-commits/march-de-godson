import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchFavorites, toggleFavorite } from '../lib/api';
import type { ListingFull } from '../lib/types';
import { usePageMeta } from '../hooks/usePageMeta';

export default function Favorites() {
  usePageMeta('Mes favoris', 'Retrouvez les annonces que vous avez sauvegardées.');
  const { session } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ListingFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!session?.user) return;
    fetchFavorites(session.user.id)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Favoris indisponibles.'));
  };

  useEffect(load, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRemove = async (listingId: string) => {
    if (!session?.user) return;
    try {
      await toggleFavorite(session.user.id, listingId);
      setItems((prev) => prev?.filter((i) => i.listing.id !== listingId) ?? null);
      toast('success', 'Retirée de vos favoris.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">Mes favoris</h1>
      <p className="page-sub">Les annonces que vous avez sauvegardées pour plus tard.</p>

      {error && <EmptyState icon="alert" title="Favoris indisponibles" message={error} />}
      {!error && items === null && <Spinner label="Chargement de vos favoris…" />}
      {!error && items && items.length === 0 && (
        <EmptyState
          icon="heart"
          title="Aucun favori pour le moment"
          message="Touchez le cœur sur une annonce pour la retrouver ici, sur cet appareil et votre compte."
          action={<Link to="/annonces" className="btn btn--primary">Parcourir le catalogue</Link>}
        />
      )}
      {!error && items && items.length > 0 && (
        <div className="listing-grid">
          {items.map((item) => (
            <div key={item.listing.id} className="fav-wrap">
              <ListingCard item={item} />
              <button
                type="button"
                className="fav-remove"
                onClick={() => onRemove(item.listing.id)}
                aria-label={`Retirer ${item.listing.title} des favoris`}
              >
                <Icon name="x" size={14} /> Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

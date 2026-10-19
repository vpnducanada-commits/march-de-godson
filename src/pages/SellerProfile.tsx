import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ListingCard } from '../components/ListingCard';
import { fetchSeller, fetchSellerListings, isEmailConfirmed } from '../lib/api';
import type { ListingFull, Profile } from '../lib/types';
import { ACCOUNT_TYPE_LABELS } from '../lib/types';
import { formatDate } from '../lib/format';
import { usePageMeta } from '../hooks/usePageMeta';

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const [seller, setSeller] = useState<Profile | null | undefined>(undefined);
  const [items, setItems] = useState<ListingFull[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  usePageMeta(seller ? `Vendeur : ${seller.display_name || 'profil'}` : 'Profil vendeur');

  // Indicateur honnête : e-mail confirmé (Supabase Auth).
  useEffect(() => {
    if (!seller) {
      setVerified(false);
      return;
    }
    let active = true;
    isEmailConfirmed(seller.id)
      .then((v) => { if (active) setVerified(v); })
      .catch(() => { if (active) setVerified(false); });
    return () => { active = false; };
  }, [seller]);

  useEffect(() => {
    if (!id) return;
    fetchSeller(id)
      .then((s) => {
        if (!s) setError('Profil introuvable.');
        else setSeller(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Profil introuvable.'));
    fetchSellerListings(id, { pageSize: 24, status: 'active' })
      .then((r) => setItems(r.items))
      .catch(() => undefined);
  }, [id]);

  if (error) {
    return (
      <div className="container">
        <EmptyState icon="user" title="Profil introuvable" message={error} action={<Link to="/annonces" className="btn btn--primary">Retour au catalogue</Link>} />
      </div>
    );
  }
  if (seller === undefined || items === null) return <Spinner label="Chargement du profil…" />;

  return (
    <div className="container">
      <div className="seller-head">
        <span className="seller-head__avatar">
          {seller!.avatar_url ? (
            <img src={seller!.avatar_url} alt="" />
          ) : (
            (seller!.display_name || 'V').slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <h1 className="page-title">
            {seller!.display_name || 'Vendeur'}
            {seller!.is_demo && <span className="badge badge--demo">Compte démo</span>}
            {verified && !seller!.is_demo && (
              <span className="badge badge--verified">
                <Icon name="check" size={11} /> E-mail vérifié
              </span>
            )}
          </h1>
          <p className="seller-head__meta">
            <Icon name="store" size={15} /> {ACCOUNT_TYPE_LABELS[seller!.account_type] || 'Particulier'}
            {seller!.city && (
              <>
                <span className="dot">·</span>
                <Icon name="map-pin" size={14} /> {seller!.city}
              </>
            )}
            <span className="dot">·</span>
            Membre depuis le {formatDate(seller!.created_at)}
          </p>
        </div>
      </div>
      <p className="seller-head__notice">
        <Icon name="info" size={15} />
        Le vendeur n'est pas vérifié par GODSON Marketplace. Restez prudent lors des transactions
        et consultez nos <Link to="/securite">conseils de sécurité</Link>.
      </p>

      <h2 className="section__title">Annonces actives ({items.length})</h2>
      {items.length === 0 ? (
        <EmptyState icon="tag" title="Aucune annonce active" message="Ce vendeur n'a pas d'annonce en ligne actuellement." />
      ) : (
        <div className="listing-grid">
          {items.map((i) => (
            <ListingCard key={i.listing.id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

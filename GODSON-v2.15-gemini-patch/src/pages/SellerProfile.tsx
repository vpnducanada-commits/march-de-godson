import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { FollowButton } from '../components/FollowButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ListingCard } from '../components/ListingCard';
import { useToast } from '../context/ToastContext';
import { fetchSeller, fetchSellerListings, isEmailConfirmed } from '../lib/api';
import { safeMediaUrl } from '../lib/security';
import type { ListingFull, Profile } from '../lib/types';
import { ACCOUNT_TYPE_LABELS, shortUserId } from '../lib/types';
import { formatDate } from '../lib/format';
import { usePageMeta } from '../hooks/usePageMeta';

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [seller, setSeller] = useState<Profile | null | undefined>(undefined);
  const [items, setItems] = useState<ListingFull[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  usePageMeta(
    seller
      ? `${seller.display_name || 'Profil'}${seller.username ? ` (@${seller.username})` : ''}`
      : 'Profil vendeur',
  );

  // Indicateur honnête : e-mail confirmé (Supabase Auth).
  useEffect(() => {
    if (!seller) {
      setVerified(false);
      return;
    }
    let active = true;
    isEmailConfirmed(seller.id)
      .then((v) => {
        if (active) setVerified(v);
      })
      .catch(() => {
        if (active) setVerified(false);
      });
    return () => {
      active = false;
    };
  }, [seller]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setSeller(undefined);
    setError(null);
    setItems([]);

    (async () => {
      try {
        const s = await fetchSeller(id);
        if (!active) return;
        if (!s) {
          setError('Aucun utilisateur trouvé avec ce nom d’utilisateur ou cet identifiant.');
          return;
        }
        setSeller(s);
        const r = await fetchSellerListings(s.id, { pageSize: 24, status: 'active' });
        if (active) setItems(r.items);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Profil introuvable.');
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="container">
        <EmptyState
          icon="user"
          title="Profil introuvable"
          message={error}
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/utilisateurs" className="btn btn--primary">
                <Icon name="search" size={15} /> Chercher un utilisateur
              </Link>
              <Link to="/annonces" className="btn btn--ghost">
                Retour au catalogue
              </Link>
            </div>
          }
        />
      </div>
    );
  }
  if (seller === undefined) return <Spinner label="Chargement du profil…" />;

  const shortId = shortUserId(seller!.id);

  const copyId = async (txt: string, label: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast('success', `${label} copié.`);
    } catch {
      toast('error', 'Copie impossible sur cet appareil.');
    }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/vendeur/${seller!.username || seller!.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${seller!.display_name || 'Vendeur'} — GODSON Marketplace`,
          url,
        });
        return;
      } catch {
        /* annulé */
      }
    }
    await copyId(url, 'Lien du profil');
  };

  return (
    <div className="container">
      <div className="seller-head seller-head--rich">
        <span className="seller-head__avatar">
          {safeMediaUrl(seller!.avatar_url) ? (
            <img src={safeMediaUrl(seller!.avatar_url)!} alt={seller!.display_name || 'Photo de profil'} />
          ) : (
            (seller!.display_name || seller!.username || 'V').slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="seller-head__content">
          <div className="seller-head__top-row">
            <div>
              <h1 className="page-title" style={{ marginBottom: 4 }}>
                {seller!.display_name || 'Vendeur'}
                {seller!.is_demo && <span className="badge badge--demo">Compte démo</span>}
                {verified && !seller!.is_demo && (
                  <span className="badge badge--verified">
                    <Icon name="check" size={11} /> E-mail vérifié
                  </span>
                )}
              </h1>
              <div className="id-badges-row" style={{ marginTop: 4, marginBottom: 8 }}>
                {seller!.username && (
                  <button
                    type="button"
                    className="id-chip"
                    onClick={() => void copyId(`@${seller!.username}`, 'Nom d’utilisateur')}
                    title="Copier le nom d’utilisateur"
                  >
                    <Icon name="at-sign" size={12} />
                    <span>@{seller!.username}</span>
                    <Icon name="copy" size={11} />
                  </button>
                )}
                <button
                  type="button"
                  className="id-chip id-chip--muted"
                  onClick={() => void copyId(shortId, 'ID utilisateur')}
                  title="Copier l’ID de cet utilisateur"
                >
                  <span>ID #{shortId}</span>
                  <Icon name="copy" size={11} />
                </button>
              </div>
            </div>

            <div className="seller-head__actions">
              <FollowButton
                targetUserId={seller!.id}
                targetName={seller!.display_name || (seller!.username ? `@${seller!.username}` : 'ce vendeur')}
              />
              <button type="button" className="btn btn--ghost" onClick={() => void shareProfile()}>
                <Icon name="share" size={15} /> Partager
              </button>
            </div>
          </div>

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
        <span>
          Suivez ce vendeur pour recevoir une notification dès qu’il publie une nouvelle annonce. Restez prudent lors des transactions et consultez nos{' '}
          <Link to="/securite">conseils de sécurité</Link>.
        </span>
      </p>

      {seller && (seller.shop_label || (seller.shop_lat && seller.shop_lng)) ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            background: 'var(--surface)',
            marginBottom: 16,
          }}
        >
          <h2 className="section__title" style={{ marginBottom: 8 }}>
            <Icon name="store" size={16} /> Boutique / Point de retrait
          </h2>
          {seller.shop_label && <p style={{ margin: '0 0 8px' }}>{seller.shop_label}</p>}
          {seller.shop_lat && seller.shop_lng && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                className="btn btn--ghost"
                href={`https://www.openstreetmap.org/?mlat=${seller.shop_lat}&mlon=${seller.shop_lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir OSM
              </a>
              <a
                className="btn btn--primary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${seller.shop_lat},${seller.shop_lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                S’y rendre
              </a>
            </div>
          )}
        </div>
      ) : null}

      <h2 className="section__title">Annonces actives ({items.length})</h2>
      {items.length === 0 ? (
        <EmptyState
          icon="tag"
          title="Aucune annonce active"
          message="Ce vendeur n'a pas d'annonce en ligne actuellement. Suivez son profil pour être alerté dès sa prochaine publication."
        />
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

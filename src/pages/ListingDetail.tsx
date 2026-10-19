import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchListingBySlug,
  fetchSellerListings,
  fetchCategoryById,
  reportListing,
  toggleFavorite,
  fetchFavorites,
  renewListing,
  notifyEmail,
} from '../lib/api';
import type { ListingFull, Category } from '../lib/types';
import { ACCOUNT_TYPE_LABELS, CONDITION_LABELS, isListingExpired } from '../lib/types';
import { formatFCFA, timeAgo } from '../lib/format';
import { telLink, whatsappLink } from '../lib/phone';
import { usePageMeta } from '../hooks/usePageMeta';
import { useJsonLd } from '../hooks/useJsonLd';

const REPORT_REASONS = [
  'Produit ou service interdit / illégal',
  'Arnaque ou annonce frauduleuse',
  'Contenu inapproprié ou diffamatoire',
  'Annonce en double / usurpation de compte',
  'Catégorie inappropriée',
  'Autre',
];

export default function ListingDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { session, isAdmin } = useAuth();
  const { toast } = useToast();
  const [item, setItem] = useState<ListingFull | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [renewBusy, setRenewBusy] = useState(false);
  const [sellerItems, setSellerItems] = useState<ListingFull[]>([]);
  const [parentCat, setParentCat] = useState<Category | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadListing = useCallback(() => {
    if (!slug) return;
    setItem(undefined);
    setError(null);
    fetchListingBySlug(slug)
      .then((r) => {
        if (!r) {
          setError("Cette annonce est introuvable ou n'est plus disponible.");
          return;
        }
        if (r.listing.status !== 'active') {
          setError("Cette annonce n'est plus disponible.");
          return;
        }
        // Expirée : invisible au public (RLS), mais le propriétaire et les
        // admins la voient pour la reprendre.
        const expired = isListingExpired(r.listing);
        const privileged = session?.user.id === r.listing.seller_id || isAdmin;
        if (expired && !privileged) {
          setError("Cette annonce n'est plus disponible.");
          return;
        }
        setItem(r);
        if (!expired) {
          fetchSellerListings(r.listing.seller_id, { pageSize: 4, status: 'active' })
            .then((res) => setSellerItems(res.items.filter((i) => i.listing.slug !== r.listing.slug)))
            .catch(() => undefined);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Annonce introuvable.'));
  }, [slug, session, isAdmin]);

  useEffect(() => {
    setActiveImg(0);
    loadListing();
  }, [loadListing]);

  useEffect(() => {
    if (!item || !session) return;
    fetchFavorites(session.user.id)
      .then((favs) => setIsFav(favs.some((f) => f.listing.id === item.listing.id)))
      .catch(() => undefined);
  }, [item, session]);

  // Quand la catégorie de l'annonce est une sous-catégorie, on charge la
  // catégorie parente pour un fil d'Ariane propre (« … > Parent > Sous »).
  useEffect(() => {
    const pid = item?.category?.parent_id;
    if (pid == null) {
      setParentCat(null);
      return;
    }
    let active = true;
    fetchCategoryById(pid)
      .then((c) => { if (active) setParentCat(c); })
      .catch(() => { if (active) setParentCat(null); });
    return () => { active = false; };
  }, [item?.category?.parent_id]);

  usePageMeta(
    item ? item.listing.title : 'Annonce',
    item ? `${item.listing.description.slice(0, 150)}${item.listing.description.length > 150 ? '…' : ''}` : undefined,
    item?.images[0],
  );

  // JSON-LD « Product » : résultats enrichis Google (prix FCFA, photos, vendeur).
  const ldProduct = useMemo(() => {
    if (!item) return null;
    const origin = window.location.origin;
    const abs = (u: string) => (u.startsWith('http') ? u : `${origin}${u}`);
    const { listing: l, seller } = item;
    const url = `${origin}/annonce/${l.slug}`;
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      url,
      priceCurrency: l.currency || 'XAF',
      availability: 'https://schema.org/InStock',
    };
    if (l.price !== null) offer.price = l.price;
    if (l.condition) {
      offer.itemCondition =
        l.condition === 'neuf' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';
    }
    if (seller) {
      offer.seller = {
        '@type': l.seller_type === 'particulier' ? 'Person' : 'Organization',
        name: seller.display_name || 'Vendeur GODSON Marketplace',
      };
    }
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: l.title,
      description: l.description,
      image: item.images.map(abs),
      url,
      offers: offer,
    };
  }, [item]);

  // JSON-LD « BreadcrumbList » : fil d'Ariane pour Google.
  const ldBreadcrumb = useMemo(() => {
    if (!item) return null;
    const origin = window.location.origin;
    const crumbs: { name: string; item?: string }[] = [
      { name: 'Accueil', item: `${origin}/` },
      { name: 'Catalogue', item: `${origin}/annonces` },
    ];
    const crumbCat = parentCat ?? item.category;
    if (crumbCat) crumbs.push({ name: crumbCat.name, item: `${origin}/annonces?cat=${crumbCat.slug}` });
    if (item.subcategory) crumbs.push({ name: item.subcategory.name });
    crumbs.push({ name: item.listing.title });
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        ...(c.item ? { item: c.item } : {}),
      })),
    };
  }, [item, parentCat]);

  useJsonLd('product', ldProduct);
  useJsonLd('breadcrumb', ldBreadcrumb);

  const onFavorite = useCallback(async () => {
    if (!item) return;
    if (!session) {
      toast('info', 'Connectez-vous pour sauvegarder cette annonce dans vos favoris.');
      window.location.href = '/connexion';
      return;
    }
    setFavBusy(true);
    try {
      const on = await toggleFavorite(session.user.id, item.listing.id);
      setIsFav(on);
      toast('success', on ? 'Ajoutée à vos favoris.' : 'Retirée de vos favoris.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setFavBusy(false);
    }
  }, [item, session, toast]);

  const onShare = async () => {
    const url = window.location.href;
    const title = item?.listing.title || 'Annonce GODSON Marketplace';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* repli copie */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast('success', 'Lien copié dans le presse-papiers.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('error', 'Impossible de copier le lien.');
    }
  };

  const onReport = async () => {
    if (!session) {
      toast('info', 'Connectez-vous pour envoyer un signalement.');
      window.location.href = '/connexion';
      return;
    }
    if (!item) return;
    setReportBusy(true);
    try {
      const reportId = await reportListing(session.user.id, item.listing.id, reportReason, reportDetails);
      // Alerte e-mail à l'équipe de modération (silencieux si non configuré).
      if (reportId) {
        void notifyEmail(session.access_token, { kind: 'report_created', reportId }).catch(() => undefined);
      }
      toast('success', 'Signalement transmis. Merci, notre équipe va examiner la demande.');
      setReportOpen(false);
      setReportDetails('');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Signalement impossible.');
    } finally {
      setReportBusy(false);
    }
  };

  if (error) {
    return (
      <div className="container">
        <EmptyState
          icon="alert"
          title="Annonce introuvable"
          message={error}
          action={<Link to="/annonces" className="btn btn--primary">Retour au catalogue</Link>}
        />
      </div>
    );
  }
  if (!item) return <Spinner label="Chargement de l'annonce…" />;

  const { listing, category, subcategory, city, seller } = item;

  // ——— Annonce expirée : panneau dédié (propriétaire / admin) ———
  const isOwner = session?.user.id === listing.seller_id;
  const onRenew = async () => {
    if (!session?.user || renewBusy) return;
    setRenewBusy(true);
    try {
      await renewListing(session.user.id, listing.slug);
      toast('success', 'Annonce republiée : elle est visible dans le catalogue pendant 90 jours.');
      loadListing();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : "La reprise de l'annonce a échoué.");
    } finally {
      setRenewBusy(false);
    }
  };
  if (isListingExpired(listing)) {
    return (
      <div className="container">
        <EmptyState
          icon="clock"
          title="Annonce expirée"
          message={
            isOwner || isAdmin
              ? 'Cette annonce a atteint la fin de sa période de visibilité (90 jours). Reprenez-la gratuitement pour la remettre en ligne dans le catalogue.'
              : "Cette annonce a expiré et n'est plus disponible."
          }
          action={
            isOwner || isAdmin ? (
              <button type="button" className="btn btn--gold" onClick={onRenew} disabled={renewBusy}>
                <Icon name="refresh" size={16} /> {renewBusy ? 'Reprise en cours…' : 'Reprendre l’annonce (90 jours)'}
              </button>
            ) : (
              <Link to="/annonces" className="btn btn--primary">Retour au catalogue</Link>
            )
          }
        />
      </div>
    );
  }

  const price = formatFCFA(listing.price);
  const wa = whatsappLink(listing.contact_whatsapp, `Bonjour, je suis intéressé par votre annonce « ${listing.title} » sur GODSON Marketplace.`);
  const tel = telLink(listing.contact_phone || listing.contact_whatsapp);
  // Fil d'Ariane : si l'annonce est dans une sous-catégorie, le maillon
  // « catégorie » pointe vers la catégorie parente (pas de nom dupliqué).
  const crumbCat = parentCat ?? category;

  return (
    <div className="container detail">
      <nav className="breadcrumb" aria-label="Fil d'ariane">
        <Link to="/">Accueil</Link>
        <Icon name="chevron-right" size={13} />
        <Link to="/annonces">Catalogue</Link>
        {crumbCat && (
          <>
            <Icon name="chevron-right" size={13} />
            <Link to={`/annonces?cat=${crumbCat.slug}`}>
              {crumbCat.name}
            </Link>
          </>
        )}
        {subcategory && (
          <>
            <Icon name="chevron-right" size={13} />
            <span aria-current="page">{subcategory.name}</span>
          </>
        )}
      </nav>

      <div className="detail__layout">
        {/* GALERIE */}
        <div className="detail__gallery">
          <div className="detail__main-img">
            <img src={item.images[activeImg] || item.images[0]} alt={`${listing.title} — photo ${activeImg + 1}`} />
            {listing.is_demo && <span className="card__badge card__badge--demo">Annonce de démonstration</span>}
          </div>
          {item.images.length > 1 && (
            <div className="detail__thumbs">
              {item.images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className={`detail__thumb${i === activeImg ? ' detail__thumb--active' : ''}`}
                  onClick={() => setActiveImg(i)}
                  aria-label={`Voir la photo ${i + 1}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFOS */}
        <div className="detail__info">
          <div className="detail__head">
            <h1 className="detail__title">{listing.title}</h1>
            <div className="detail__price-row">
              {price ? (
                <p className="detail__price">
                  {price}
                  {listing.negotiable && <span className="detail__negotiable">Négociable</span>}
                </p>
              ) : (
                <p className="detail__price detail__price--na">Prix à discuter</p>
              )}
            </div>
            <div className="detail__facts">
              {city && (
                <span className="detail__fact">
                  <Icon name="map-pin" size={15} /> {city.name}
                  {city.province ? ` — ${city.province}` : ''}
                  {listing.area ? ` (${listing.area})` : ''}
                </span>
              )}
              {listing.condition && (
                <span className="detail__fact">
                  <Icon name="check" size={15} /> {CONDITION_LABELS[listing.condition]}
                </span>
              )}
              <span className="detail__fact">
                <Icon name="clock" size={15} /> {timeAgo(listing.created_at)}
              </span>
            </div>
          </div>

          {/* CONTACT */}
          <div className="detail__contact">
            <h2 className="detail__h">Contacter le vendeur</h2>
            <div className="detail__contact-btns">
              {wa && (
                <a className="btn btn--whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" size={19} /> Discuter sur WhatsApp
                </a>
              )}
              {tel && (
                <a className="btn btn--primary" href={tel}>
                  <Icon name="phone" size={17} /> Appeler
                </a>
              )}
              {!wa && !tel && (
                <p className="detail__contact-empty">
                  Le vendeur n'a pas communiqué de moyen de contact pour cette annonce.
                </p>
              )}
            </div>
            <div className="detail__actions">
              <button
                type="button"
                className={`btn btn--ghost${isFav ? ' btn--fav' : ''}`}
                onClick={onFavorite}
                disabled={favBusy}
                aria-pressed={isFav}
              >
                <Icon name="heart" size={17} /> {isFav ? 'Dans vos favoris' : 'Ajouter aux favoris'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onShare}>
                <Icon name={copied ? 'check' : 'share'} size={17} /> {copied ? 'Lien copié' : 'Partager'}
              </button>
              <button type="button" className="btn btn--ghost btn--report" onClick={() => setReportOpen(true)}>
                <Icon name="flag" size={17} /> Signaler
              </button>
            </div>
            <div className="detail__safety">
              <Icon name="shield" size={16} />
              <p>
                <strong>Transactez en toute sécurité.</strong> Ne payez jamais à l'avance par
                virement ou mobile money avant d'avoir vu l'article. Privilégiez les rencontres
                en lieu public et vérifiez le produit avant l'achat.
              </p>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="detail__desc">
            <h2 className="detail__h">Description</h2>
            <p className="detail__desc-text">{listing.description}</p>
          </div>

          {/* Vendeur */}
          {seller && (
            <div className="detail__seller">
              <h2 className="detail__h">Vendeur</h2>
              <div className="seller-box">
                <span className="seller-box__avatar">
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt="" />
                  ) : (
                    (seller.display_name || 'V').slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="seller-box__info">
                  <Link to={`/vendeur/${seller.id}`} className="seller-box__name">
                    {seller.display_name || 'Vendeur'}
                    {seller.is_demo && <span className="badge badge--demo">Démo</span>}
                  </Link>
                  <p className="seller-box__meta">
                    {ACCOUNT_TYPE_LABELS[seller.account_type] || 'Particulier'}
                    {seller.city ? ` · ${seller.city}` : ''}
                  </p>
                </div>
                <Link to={`/vendeur/${seller.id}`} className="btn btn--ghost btn--sm">
                  Voir le profil
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AUTRES ANNONCES DU VENDEUR */}
      {sellerItems.length > 0 && (
        <section className="section section--tight">
          <h2 className="section__title">Autres annonces de {seller?.display_name || 'ce vendeur'}</h2>
          <div className="listing-grid">
            {sellerItems.map((i) => (
              <ListingCard key={i.listing.id} item={i} />
            ))}
          </div>
        </section>
      )}

      {/* MODAL SIGNALEMENT */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Signaler cette annonce">
        <p className="form-hint">
          Décrivez le problème. Les signalements sont examinés par notre équipe de
          modération. Votre identité n'est pas révélée au vendeur.
        </p>
        <div className="form-group">
          <label htmlFor="rep-reason">Motif *</label>
          <select id="rep-reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="rep-details">Détails (facultatif)</label>
          <textarea
            id="rep-details"
            rows={4}
            maxLength={2000}
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Précisez ce qui pose problème…"
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setReportOpen(false)}>
            Annuler
          </button>
          <button type="button" className="btn btn--danger" onClick={onReport} disabled={reportBusy}>
            {reportBusy ? 'Envoi en cours…' : 'Envoyer le signalement'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

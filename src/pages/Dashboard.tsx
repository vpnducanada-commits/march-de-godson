import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { deleteListing, fetchSellerListings, updateListing, renewListing } from '../lib/api';
import type { ListingFull } from '../lib/types';
import { STATUS_LABELS, isListingExpired, daysUntilExpiry } from '../lib/types';
import { formatFCFA, timeAgo, formatDate } from '../lib/format';
import { usePageMeta } from '../hooks/usePageMeta';

type Tab = 'active' | 'draft' | 'archived' | 'refused';

export default function Dashboard() {
  usePageMeta('Mon espace', 'Gérez vos annonces : publication, modification, archivage.');
  const { session } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('active');
  const [items, setItems] = useState<ListingFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListingFull | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!session?.user) return;
    fetchSellerListings(session.user.id, { pageSize: 50 })
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [session]);

  useEffect(load, [load]);

  const filtered = (items || []).filter((i) => {
    if (tab === 'active') return i.listing.status === 'active';
    if (tab === 'draft') return i.listing.status === 'draft' || i.listing.status === 'pending';
    if (tab === 'archived') return i.listing.status === 'archived';
    return i.listing.status === 'refused';
  });

  const counts = {
    active: (items || []).filter((i) => i.listing.status === 'active').length,
    draft: (items || []).filter((i) => i.listing.status === 'draft' || i.listing.status === 'pending').length,
    archived: (items || []).filter((i) => i.listing.status === 'archived').length,
    refused: (items || []).filter((i) => i.listing.status === 'refused').length,
  };

  const onArchive = async (item: ListingFull) => {
    if (!session?.user) return;
    setBusy(true);
    try {
      await updateListing(session.user.id, item.listing.slug, {
        title: item.listing.title,
        category_id: item.listing.category_id,
        description: item.listing.description,
        price: item.listing.price,
        negotiable: item.listing.negotiable,
        city_id: item.listing.city_id,
        area: item.listing.area,
        condition: item.listing.condition,
        seller_type: item.listing.seller_type,
        contact_phone: item.listing.contact_phone,
        contact_whatsapp: item.listing.contact_whatsapp,
        status: tab === 'archived' ? 'active' : 'archived',
      });
      toast('success', tab === 'archived' ? 'Annonce republiée.' : 'Annonce archivée.');
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onRenew = async (item: ListingFull) => {
    if (!session?.user) return;
    setBusy(true);
    try {
      await renewListing(session.user.id, item.listing.slug);
      toast('success', 'Annonce republiée : visible dans le catalogue pendant 90 jours.');
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!session?.user || !deleteTarget) return;
    setBusy(true);
    try {
      await deleteListing(session.user.id, deleteTarget.listing.slug, false);
      toast('success', 'Annonce supprimée définitivement.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Mon espace</h1>
          <p className="page-sub">Gérez vos annonces publiées sur GODSON Marketplace.</p>
        </div>
        <Link to="/publier" className="btn btn--gold">
          <Icon name="plus" size={16} /> Nouvelle annonce
        </Link>
      </div>

      <div className="tabs" role="tablist" aria-label="Statuts des annonces">
        {(Object.keys(counts) as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab${tab === t ? ' tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'active' ? 'Actives' : t === 'draft' ? 'Brouillons' : t === 'archived' ? 'Archivées' : 'Refusées'}
            <span className="tab__count">{counts[t]}</span>
          </button>
        ))}
      </div>

      {error && <EmptyState icon="alert" title="Chargement impossible" message={error} />}
      {!error && items === null && <Spinner label="Chargement de vos annonces…" />}
      {!error && items && filtered.length === 0 && (
        <EmptyState
          icon="tag"
          title={
            tab === 'active'
              ? 'Aucune annonce active'
              : tab === 'archived'
                ? 'Aucune annonce archivée'
                : tab === 'refused'
                  ? 'Aucune annonce refusée'
                  : 'Aucun brouillon'
          }
          message={tab === 'active' ? 'Publiez votre première annonce pour commencer à être contacté par des acheteurs.' : undefined}
          action={
            tab === 'active' ? (
              <Link to="/publier" className="btn btn--gold">
                <Icon name="plus" size={16} /> Publier ma première annonce
              </Link>
            ) : undefined
          }
        />
      )}

      {!error && items && filtered.length > 0 && (
        <div className="manage-list">
          {filtered.map((item) => {
            const expired = item.listing.status === 'active' && isListingExpired(item.listing);
            const days = daysUntilExpiry(item.listing);
            return (
            <article key={item.listing.id} className="manage-item">
              <Link to={`/annonce/${item.listing.slug}`} className="manage-item__thumb">
                <img src={item.images[0]} alt="" loading="lazy" />
              </Link>
              <div className="manage-item__info">
                <div className="manage-item__title-row">
                  <Link to={`/annonce/${item.listing.slug}`} className="manage-item__title">
                    {item.listing.title}
                  </Link>
                  {expired ? (
                    <span className="status-badge status-badge--expired">Expirée</span>
                  ) : (
                    <span className={`status-badge status-badge--${item.listing.status}`}>
                      {STATUS_LABELS[item.listing.status]}
                    </span>
                  )}
                </div>
                <p className="manage-item__meta">
                  {item.category ? item.category.name : ''}
                  {item.city ? ` · ${item.city.name}` : ''} · {timeAgo(item.listing.created_at)}
                  {item.listing.price !== null ? ` · ${formatFCFA(item.listing.price)}` : ''}
                  {item.listing.status === 'active' && item.listing.expires_at && (
                    <>
                      {' · '}
                      {expired
                        ? `Expirée le ${formatDate(item.listing.expires_at)}`
                        : `Expire le ${formatDate(item.listing.expires_at)}`}
                      {!expired && days !== null && days <= 14 ? ` (${days} j restants)` : ''}
                    </>
                  )}
                </p>
              </div>
              <div className="manage-item__actions">
                {(item.listing.status === 'active' || item.listing.status === 'archived') && (
                  <Link to={`/modifier/${item.listing.slug}`} className="btn btn--ghost btn--sm">
                    <Icon name="pencil" size={14} /> Modifier
                  </Link>
                )}
                {expired && (
                  <button type="button" className="btn btn--gold btn--sm" onClick={() => onRenew(item)} disabled={busy}>
                    <Icon name="refresh" size={14} /> Reprendre (90 j)
                  </button>
                )}
                {item.listing.status === 'active' && !expired && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onArchive(item)} disabled={busy}>
                    <Icon name="archive" size={14} /> Archiver
                  </button>
                )}
                {item.listing.status === 'archived' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onArchive(item)} disabled={busy}>
                    <Icon name="check" size={14} /> Republier
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => setDeleteTarget(item)}>
                  <Icon name="trash" size={14} /> Supprimer
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Supprimer cette annonce ?">
        <p>
          <strong>{deleteTarget?.listing.title}</strong> sera supprimée définitivement, ainsi
          que ses photos. Cette action est irréversible.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setDeleteTarget(null)}>
            Annuler
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirmDelete} disabled={busy}>
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

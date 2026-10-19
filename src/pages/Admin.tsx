import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Pagination } from '../components/ui/Pagination';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import {
  adminFetchListings,
  adminFetchReports,
  adminFetchUsers,
  adminModerateListing,
  notifyEmail,
  adminUpdateReport,
  adminSetUserBanned,
  adminPromoteToAdmin,
  adminAddCategory,
  adminToggleCategory,
  adminAddLocality,
  fetchCategories,
  fetchLocalities,
} from '../lib/api';
import type { AdminUser, Category, ListingFull, Locality, Report } from '../lib/types';

type ReportExt = Report & { listings?: { title: string; slug: string } | null };
import { STATUS_LABELS, ACCOUNT_TYPE_LABELS } from '../lib/types';
import { timeAgo, formatDate } from '../lib/format';
import { slugify } from '../lib/normalize';
import { usePageMeta } from '../hooks/usePageMeta';

type Tab = 'listings' | 'reports' | 'users' | 'catalog' | 'log';

const LISTING_PAGE = 10;

export default function Admin() {
  usePageMeta('Administration', 'Panneau d\'administration GODSON Marketplace.');
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('listings');

  // Annonces
  const [listings, setListings] = useState<ListingFull[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Signalements
  const [reports, setReports] = useState<ReportExt[] | null>(null);

  // Utilisateurs
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  // Catalogue
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [localities, setLocalities] = useState<Locality[] | null>(null);
  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newProv, setNewProv] = useState('');

  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(() => {
    if (!session?.user) return;
    adminFetchListings({ status: statusFilter || undefined, page, pageSize: LISTING_PAGE })
      .then((r) => {
        setListings(r.items);
        setTotal(r.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Liste impossible.'));
  }, [session, statusFilter, page]);

  const loadReports = useCallback(() => {
    adminFetchReports().then((r) => setReports(r)).catch((e) => setError(e instanceof Error ? e.message : 'Signalements indisponibles.'));
  }, []);

  const loadUsers = useCallback(() => {
    adminFetchUsers().then(setUsers).catch((e) => setError(e instanceof Error ? e.message : 'Utilisateurs indisponibles.'));
  }, []);

  const loadCatalog = useCallback(() => {
    Promise.all([fetchCategories(), fetchLocalities()])
      .then(([c, l]) => {
        setCategories(c);
        setLocalities(l);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Catalogue indisponible.'));
  }, []);

  useEffect(() => {
    setError(null);
    if (tab === 'listings') loadListings();
    else if (tab === 'reports') loadReports();
    else if (tab === 'users') loadUsers();
    else if (tab === 'catalog') loadCatalog();
  }, [tab, loadListings, loadReports, loadUsers, loadCatalog]);

  if (!session || !profile) return null;

  const moderate = async (id: string, status: string, action: string) => {
    try {
      await adminModerateListing(id, status, session.user.id, action);
      toast('success', 'Statut de l\'annonce mis à jour.');
      // E-mail au vendeur (silencieux si le service mail n'est pas configuré).
      void notifyEmail(session.access_token, {
        kind: 'listing_status',
        listingId: id,
        status: status as 'active' | 'refused' | 'archived',
      }).catch(() => undefined);
      loadListings();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const reportAction = async (id: string, status: string) => {
    try {
      await adminUpdateReport(id, status, session.user.id);
      toast('success', 'Signalement traité.');
      loadReports();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const banUser = async (u: AdminUser) => {
    const banned = !u.is_banned;
    try {
      await adminSetUserBanned(u.id, banned, session.user.id);
      toast('success', banned ? 'Utilisateur suspendu.' : 'Utilisateur réactivé.');
      loadUsers();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const promote = async (u: AdminUser) => {
    try {
      await adminPromoteToAdmin(u.id, session.user.id);
      toast('success', 'Utilisateur promu administrateur.');
      loadUsers();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const addCategory = async () => {
    if (newCat.trim().length < 2) return;
    try {
      await adminAddCategory(newCat.trim(), slugify(newCat) || `cat-${Date.now()}`, 'grid', null);
      toast('success', 'Catégorie créée.');
      setNewCat('');
      loadCatalog();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Création impossible.');
    }
  };

  const addLocality = async () => {
    if (newLoc.trim().length < 2) return;
    try {
      await adminAddLocality(newLoc.trim(), slugify(newLoc) || `loc-${Date.now()}`, newProv.trim());
      toast('success', 'Localité ajoutée.');
      setNewLoc('');
      setNewProv('');
      loadCatalog();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Ajout impossible.');
    }
  };

  return (
    <div className="container admin">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <Icon name="shield" size={22} /> Administration
          </h1>
          <p className="page-sub">
            Modération, utilisateurs et catalogue. Toutes les actions sensibles sont
            consignées dans le journal d'audit.
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['listings', 'Annonces'],
            ['reports', 'Signalements'],
            ['users', 'Utilisateurs'],
            ['catalog', 'Catalogue'],
            ['log', 'Journal d\'audit'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab${tab === t ? ' tab--active' : ''}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {error && <EmptyState icon="alert" title="Erreur de chargement" message={error} />}

      {tab === 'listings' && (
        <>
          <div className="admin-toolbar">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              <option value="active">Publiées</option>
              <option value="draft">Brouillons</option>
              <option value="pending">En attente</option>
              <option value="refused">Refusées</option>
              <option value="archived">Archivées</option>
            </select>
            <span className="admin-toolbar__count">{total} annonces</span>
          </div>
          {!listings && <Spinner label="Chargement…" />}
          {listings && listings.length === 0 && <EmptyState icon="tag" title="Aucune annonce" />}
          {listings && listings.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Annonce</th>
                    <th>Vendeur</th>
                    <th>Statut</th>
                    <th>Publiée</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((item) => (
                    <tr key={item.listing.id}>
                      <td>
                        <Link to={`/annonce/${item.listing.slug}`} className="admin-table__link">
                          {item.listing.title}
                        </Link>
                        <span className="admin-table__sub">
                          {item.category?.name}{item.city ? ` · ${item.city.name}` : ''}
                        </span>
                      </td>
                      <td>{item.seller?.display_name || '—'}</td>
                      <td>
                        <span className={`status-badge status-badge--${item.listing.status}`}>
                          {STATUS_LABELS[item.listing.status]}
                        </span>
                      </td>
                      <td className="admin-table__sub">{timeAgo(item.listing.created_at)}</td>
                      <td className="admin-table__actions">
                        {item.listing.status !== 'active' && item.listing.status !== 'archived' && (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => moderate(item.listing.id, 'active', 'moderate_publish')}>
                            <Icon name="check" size={14} /> Publier
                          </button>
                        )}
                        {item.listing.status !== 'refused' && (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => moderate(item.listing.id, 'refused', 'moderate_refuse')}>
                            <Icon name="ban" size={14} /> Refuser
                          </button>
                        )}
                        {item.listing.status === 'active' && (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => moderate(item.listing.id, 'archived', 'moderate_archive')}>
                            <Icon name="archive" size={14} /> Archiver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / LISTING_PAGE))} onPage={setPage} />
            </div>
          )}
        </>
      )}

      {tab === 'reports' && (
        <>
          {!reports && <Spinner label="Chargement des signalements…" />}
          {reports && reports.length === 0 && <EmptyState icon="flag" title="Aucun signalement" message="Les signalements envoyés par les utilisateurs apparaîtront ici." />}
          {reports && reports.length > 0 && (
            <div className="admin-cards">
              {reports.map((r) => (
                <div key={r.id} className={`admin-card admin-card--${r.status}`}>
                  <div className="admin-card__head">
                    <strong>{r.reason}</strong>
                    <span className={`status-badge status-badge--${r.status === 'open' ? 'refused' : r.status === 'resolved' ? 'active' : 'pending'}`}>
                      {r.status === 'open' ? 'Ouvert' : r.status === 'in_review' ? 'En cours' : r.status === 'resolved' ? 'Résolu' : 'Classé'}
                    </span>
                  </div>
                  {r.details && <p className="admin-card__body">{r.details}</p>}
                  <p className="admin-card__meta">
                    {r.listings?.title ? (
                      <Link to={`/annonce/${r.listings.slug}`}>{r.listings.title}</Link>
                    ) : (
                      'Annonce supprimée'
                    )}{' '}
                    · {formatDate(r.created_at)}
                  </p>
                  {(r.status === 'open' || r.status === 'in_review') && (
                    <div className="admin-card__actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => reportAction(r.id, 'resolved')}>
                        <Icon name="check" size={14} /> Résolu
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => reportAction(r.id, 'dismissed')}>
                        <Icon name="x" size={14} /> Classer sans suite
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'users' && (
        <>
          {!users && <Spinner label="Chargement des utilisateurs…" />}
          {users && users.length === 0 && <EmptyState icon="users" title="Aucun utilisateur inscrit" />}
          {users && users.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Inscrit</th>
                    <th>Rôle</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={u.is_banned ? 'admin-table__row--banned' : ''}>
                      <td>
                        {u.display_name || '—'}
                        {u.is_demo && <span className="badge badge--demo">Démo</span>}
                      </td>
                      <td className="admin-table__sub">{u.email || '—'}</td>
                      <td>{ACCOUNT_TYPE_LABELS[u.account_type] || u.account_type}</td>
                      <td className="admin-table__sub">{formatDate(u.created_at)}</td>
                      <td>
                        {u.role === 'admin' ? (
                          <span className="badge badge--admin">Admin</span>
                        ) : (
                          <span className="badge">{u.is_banned ? 'Suspendu' : 'Utilisateur'}</span>
                        )}
                      </td>
                      <td className="admin-table__actions">
                        {u.id !== session.user.id && u.role !== 'admin' && !u.is_demo && (
                          <>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => banUser(u)}>
                              <Icon name={u.is_banned ? 'check' : 'ban'} size={14} />
                              {u.is_banned ? 'Réactiver' : 'Suspendre'}
                            </button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => promote(u)}>
                              <Icon name="shield" size={14} /> Promouvoir
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'catalog' && (
        <div className="admin-catalog">
          <div className="admin-catalog__col">
            <h3 className="admin-catalog__h">Catégories</h3>
            <div className="admin-form-row">
              <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie…" aria-label="Nom de la nouvelle catégorie" />
              <button type="button" className="btn btn--primary btn--sm" onClick={addCategory} disabled={!newCat.trim()}>
                <Icon name="plus" size={14} /> Ajouter
              </button>
            </div>
            {!categories && <Spinner label="Chargement…" />}
            {categories && (
              <ul className="admin-cat-list">
                {categories.filter((c) => c.parent_id === null).map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={async () => {
                        try {
                          await adminToggleCategory(c.id, c.status === 'active' ? 'disabled' : 'active', session.user.id);
                          toast('success', c.status === 'active' ? 'Catégorie désactivée.' : 'Catégorie réactivée.');
                          loadCatalog();
                        } catch (e) {
                          toast('error', e instanceof Error ? e.message : 'Action impossible.');
                        }
                      }}
                    >
                      {c.status === 'active' ? 'Désactiver' : 'Activer'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="admin-catalog__col">
            <h3 className="admin-catalog__h">Localités</h3>
            <div className="admin-form-row">
              <input type="text" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="Nouvelle localité…" aria-label="Nom de la nouvelle localité" />
              <input type="text" value={newProv} onChange={(e) => setNewProv(e.target.value)} placeholder="Province" aria-label="Province" />
              <button type="button" className="btn btn--primary btn--sm" onClick={addLocality} disabled={!newLoc.trim()}>
                <Icon name="plus" size={14} /> Ajouter
              </button>
            </div>
            {!localities && <Spinner label="Chargement…" />}
            {localities && (
              <ul className="admin-cat-list">
                {localities.map((l) => (
                  <li key={l.id}>
                    <span>{l.name}{l.province ? <em className="admin-table__sub"> — {l.province}</em> : null}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'log' && <AuditLog />}
    </div>
  );
}

function AuditLog() {
  const { session } = useAuth();
  const [log, setLog] = useState<{ action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown> | null; created_at: string }[] | null>(null);

  useEffect(() => {
    if (!session || !supabase) return;
    supabase
      .from('admin_audit_logs')
      .select('action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) return;
        setLog(data as { action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown> | null; created_at: string }[]);
      });
  }, [session]);

  if (!log) return <Spinner label="Chargement du journal…" />;
  if (log.length === 0) return <EmptyState icon="file-text" title="Journal vide" message="Les actions administratives apparaîtront ici." />;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Horodatage</th>
            <th>Action</th>
            <th>Cible</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {log.map((l, i) => (
            <tr key={i}>
              <td className="admin-table__sub">{new Date(l.created_at).toLocaleString('fr-FR')}</td>
              <td>{l.action}</td>
              <td className="admin-table__sub">{l.target_type || '—'}{l.target_id ? ` · ${l.target_id.slice(0, 13)}…` : ''}</td>
              <td className="admin-table__sub">{l.details ? JSON.stringify(l.details) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

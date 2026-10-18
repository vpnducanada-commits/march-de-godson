import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeText, escapeLike, slugify, randomSuffix } from './normalize';
import {
  demoCategories,
  demoLocalities,
  demoListings,
  demoSeller,
  demoImagesBySlug,
} from './demo-data';
import type {
  AdminUser,
  Category,
  Listing,
  ListingFull,
  ListingQuery,
  Locality,
  PageResult,
  Profile,
  Report,
} from './types';

export class ApiError extends Error {}

/** Mode démo : pas de variables Supabase → données locales d'exemple. */
export const demoMode = !isSupabaseConfigured;

function requireClient() {
  if (!supabase) throw new ApiError('Service indisponible. Vérifiez votre connexion.');
  return supabase;
}

function toApiError(err: unknown, fallback: string): ApiError {
  if (err instanceof ApiError) return err;
  const e = err as { message?: string; code?: string };
  if (e?.code === 'PGRST116') return new ApiError('Aucune annonce trouvée avec ces critères.');
  return new ApiError(e?.message ? `Erreur : ${e.message}` : fallback);
}

/** Résout l'image principale d'une annonce : stockage Supabase ou image démo locale. */
export function resolveListingImage(listing: Listing, storageUrl: string | null): string {
  if (storageUrl) return storageUrl;
  if (listing.is_demo) return demoImagesBySlug[listing.slug] || '/demo/placeholder.svg';
  return '/demo/placeholder.svg';
}

function storageUrlFor(path: string): string {
  const sb = requireClient();
  const { data } = sb.storage.from('listing-images').getPublicUrl(path);
  return data.publicUrl;
}

type RowWithJoins = Listing & {
  category: Category | null;
  city: Locality | null;
  listing_images: { storage_path: string | null; position: number }[];
};

function assembleFull(row: RowWithJoins, seller: Profile | null): ListingFull {
  const catRow = row.category;
  const isSub = catRow?.parent_id != null;
  const listing = row as unknown as Listing;
  const images = (row.listing_images || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => resolveListingImage(listing, img.storage_path ? storageUrlFor(img.storage_path) : null));
  return {
    listing,
    category: catRow ?? null,
    subcategory: isSub ? catRow : null,
    city: row.city ?? null,
    images: images.length ? images : [resolveListingImage(listing, null)],
    seller,
  };
}

const LISTING_SELECT = `
  *,
  category:categories!listings_category_id_fkey(*),
  city:localities!listings_city_id_fkey(*),
  listing_images(*)
`;

// ============================================================
// CATALOGUE : catégories & localités
// ============================================================

export async function fetchCategories(): Promise<Category[]> {
  if (demoMode) return demoCategories;
  const sb = requireClient();
  const { data, error } = await sb.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw toApiError(error, 'Impossible de charger les catégories.');
  return (data || []) as Category[];
}

export async function fetchCategoryById(id: number): Promise<Category | null> {
  if (demoMode) return demoCategories.find((c) => c.id === id) ?? null;
  const sb = requireClient();
  const { data, error } = await sb.from('categories').select('*').eq('id', id).maybeSingle();
  if (error) throw toApiError(error, 'Catégorie indisponible.');
  return (data as Category | null) ?? null;
}

export async function fetchLocalities(): Promise<Locality[]> {
  if (demoMode) return demoLocalities;
  const sb = requireClient();
  const { data, error } = await sb
    .from('localities')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw toApiError(error, 'Impossible de charger les localités.');
  return (data || []) as Locality[];
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  const map = new Map<string, Profile>();
  if (!ids.length) return map;
  if (demoMode) {
    for (const id of ids) map.set(id, demoSeller);
    return map;
  }
  const sb = requireClient();
  const { data } = await sb.from('profiles').select('*').in('id', ids);
  for (const p of data || []) map.set((p as Profile).id, p as Profile);
  return map;
}

// ============================================================
// ANNONCES : recherche paginée
// ============================================================

export async function fetchListings(query: ListingQuery): Promise<PageResult> {
  if (demoMode) return demoListingsQuery(query);
  const sb = requireClient();
  const pageSize = query.pageSize ?? 12;
  const page = query.page ?? 1;
  let q = sb
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (query.q) {
    const nq = escapeLike(normalizeText(query.q.trim()));
    if (nq) q = q.ilike('search_text', `%${nq}%`);
  }
  if (query.category) {
    const cats = await fetchCategories();
    const cat = cats.find((c) => c.slug === query.category);
    if (!cat) throw new ApiError('Catégorie inconnue.');
    const childIds = cats.filter((c) => c.parent_id === cat.id).map((c) => c.id);
    q = q.in('category_id', [cat.id, ...childIds]);
  }
  if (query.city) {
    const locs = await fetchLocalities();
    const loc = locs.find((l) => l.slug === query.city);
    if (!loc) throw new ApiError('Localité inconnue.');
    q = q.eq('city_id', loc.id);
  }
  if (query.minPrice !== undefined && !Number.isNaN(query.minPrice)) q = q.gte('price', query.minPrice);
  if (query.maxPrice !== undefined && !Number.isNaN(query.maxPrice)) q = q.lte('price', query.maxPrice);
  if (query.condition) q = q.eq('condition', query.condition);

  if (query.sort === 'price_asc') {
    q = q.order('price.asc.nullsfirst').order('created_at.desc');
  } else if (query.sort === 'price_desc') {
    q = q.order('price.desc.nullslast').order('created_at.desc');
  }

  const { data, error, count } = await q;
  if (error) throw toApiError(error, 'Recherche impossible.');
  const sellerIds = Array.from(new Set((data || []).map((r) => r.seller_id)));
  const sellers = await fetchProfilesByIds(sellerIds);
  const items = (data || []).map((row) =>
    assembleFull(row as RowWithJoins, sellers.get(row.seller_id) ?? null),
  );
  return { items, total: count ?? 0, page, pageSize };
}

function demoAssembleFull(l: Listing): ListingFull {
  return assembleFull(
    {
      ...l,
      category: demoCategories.find((c) => c.id === l.category_id) ?? null,
      city: demoLocalities.find((c) => c.id === l.city_id) ?? null,
      listing_images: [],
    } as RowWithJoins,
    demoSeller,
  );
}

function demoListingsQuery(query: ListingQuery): PageResult {
  let items = demoListings.map(demoAssembleFull);
  const cat = query.category ? demoCategories.find((c) => c.slug === query.category) : null;
  if (cat) {
    const childIds = demoCategories.filter((c) => c.parent_id === cat.id).map((c) => c.id);
    items = items.filter((f) => f.listing.category_id === cat.id || childIds.includes(f.listing.category_id));
  }
  const city = query.city ? demoLocalities.find((c) => c.slug === query.city) : null;
  if (city) items = items.filter((f) => f.listing.city_id === city.id);
  if (query.q) {
    const nq = normalizeText(query.q.trim());
    items = items.filter(
      (f) =>
        normalizeText(f.listing.title).includes(nq) || normalizeText(f.listing.description).includes(nq),
    );
  }
  if (query.minPrice !== undefined && !Number.isNaN(query.minPrice))
    items = items.filter((f) => f.listing.price !== null && f.listing.price >= (query.minPrice as number));
  if (query.maxPrice !== undefined && !Number.isNaN(query.maxPrice))
    items = items.filter((f) => f.listing.price !== null && f.listing.price <= (query.maxPrice as number));
  if (query.condition) items = items.filter((f) => f.listing.condition === query.condition);
  if (query.sort === 'price_asc') {
    items = [...items].sort((a, b) => (a.listing.price ?? -1) - (b.listing.price ?? -1));
  } else if (query.sort === 'price_desc') {
    items = [...items].sort((a, b) => (b.listing.price ?? -Infinity) - (a.listing.price ?? -Infinity));
  }
  const total = items.length;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

// ============================================================
// ANNONCES : détail & vendeur
// ============================================================

export async function fetchListingBySlug(slug: string): Promise<ListingFull | null> {
  if (demoMode) {
    const l = demoListings.find((x) => x.slug === slug);
    return l ? demoAssembleFull(l) : null;
  }
  const sb = requireClient();
  const { data, error } = await sb.from('listings').select(LISTING_SELECT).eq('slug', slug).maybeSingle();
  if (error) throw toApiError(error, 'Annonce introuvable.');
  if (!data) return null;
  const sellers = await fetchProfilesByIds([(data as RowWithJoins).seller_id]);
  return assembleFull(data as RowWithJoins, sellers.get((data as RowWithJoins).seller_id) ?? null);
}

export async function fetchSellerListings(
  sellerId: string,
  opts: { status?: string; page?: number; pageSize?: number } = {},
): Promise<PageResult> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 12;
  if (demoMode) {
    const items = demoListings.filter((l) => l.seller_id === sellerId).map(demoAssembleFull);
    return { items, total: items.length, page, pageSize };
  }
  const sb = requireClient();
  let q = sb
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error, count } = await q;
  if (error) throw toApiError(error, 'Chargement impossible.');
  const seller = (await fetchProfilesByIds([sellerId])).get(sellerId) ?? null;
  return {
    items: (data || []).map((row) => assembleFull(row as RowWithJoins, seller)),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function fetchSeller(id: string): Promise<Profile | null> {
  if (demoMode) return id === demoSeller.id ? demoSeller : null;
  const sb = requireClient();
  const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw toApiError(error, 'Profil introuvable.');
  return (data as Profile | null) ?? null;
}

// ============================================================
// FAVORIS
// ============================================================

const FAV_KEY = 'gm_favorites';

/** Favoris d'un visiteur (localStorage) — proposés avant connexion. */
export function getGuestFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

export function setGuestFavorite(listingId: string, on: boolean): void {
  const cur = new Set(getGuestFavorites());
  if (on) cur.add(listingId);
  else cur.delete(listingId);
  localStorage.setItem(FAV_KEY, JSON.stringify([...cur]));
}

export async function fetchFavorites(userId: string): Promise<ListingFull[]> {
  const sb = requireClient();
  const { data: favs, error } = await sb
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toApiError(error, 'Favoris indisponibles.');
  const ids = (favs || []).map((f) => f.listing_id as string);
  if (!ids.length) return [];
  const { data: rows, error: rowErr } = await sb.from('listings').select(LISTING_SELECT).in('id', ids);
  if (rowErr) throw toApiError(rowErr, 'Favoris indisponibles.');
  const byId = new Map<string, RowWithJoins>();
  const sellerIds: string[] = [];
  for (const r of rows || []) {
    byId.set((r as RowWithJoins).id, r as RowWithJoins);
    sellerIds.push((r as RowWithJoins).seller_id);
  }
  const sellers = await fetchProfilesByIds(sellerIds);
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is RowWithJoins => Boolean(r))
    .map((r) => assembleFull(r, sellers.get(r.seller_id) ?? null));
}

export async function toggleFavorite(userId: string, listingId: string): Promise<boolean> {
  const sb = requireClient();
  const { data: existing } = await sb
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();
  if (existing) {
    const { error } = await sb.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
    if (error) throw toApiError(error, 'Échec du retrait des favoris.');
    return false;
  }
  const { error } = await sb.from('favorites').insert({ user_id: userId, listing_id: listingId });
  if (error) throw toApiError(error, 'Échec de l\u2019ajout aux favoris.');
  return true;
}

// ============================================================
// PUBLICATION & GESTION D'ANNONCES
// ============================================================

export interface PublishInput {
  title: string;
  category_id: number;
  description: string;
  price: number | null;
  negotiable: boolean;
  city_id: number | null;
  area: string | null;
  condition: string | null;
  seller_type: string;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  imageFiles: (File | Blob)[];
}

export async function publishListing(userId: string, input: PublishInput): Promise<string> {
  const sb = requireClient();
  const slug = `${slugify(input.title) || 'annonce'}-${randomSuffix()}`;
  const { data: created, error: insErr } = await sb
    .from('listings')
    .insert({
      seller_id: userId,
      category_id: input.category_id,
      title: input.title.trim(),
      slug,
      description: input.description.trim(),
      price: input.price,
      negotiable: input.negotiable,
      city_id: input.city_id,
      area: input.area?.trim() || null,
      condition: input.condition || null,
      seller_type: input.seller_type,
      contact_phone: input.contact_phone?.trim() || null,
      contact_whatsapp: input.contact_whatsapp?.trim() || null,
      status: 'active',
    })
    .select('id')
    .single();
  if (insErr || !created) throw toApiError(insErr, 'La publication a échoué. Réessayez.');
  const listingId = (created as { id: string }).id;

  // L'annonce n'est complète que si le stockage confirme chaque image.
  const uploaded: string[] = [];
  try {
    for (let i = 0; i < input.imageFiles.length; i++) {
      const file = input.imageFiles[i];
      const path = `${userId}/${Date.now()}-${i}-${randomSuffix()}.jpg`;
      const { error: upErr } = await sb.storage
        .from('listing-images')
        .upload(path, file, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw toApiError(upErr, 'L\u2019envoi d\u2019une image a échoué.');
      uploaded.push(path);
      const { error: rowErr } = await sb
        .from('listing_images')
        .insert({ listing_id: listingId, storage_path: path, position: i });
      if (rowErr) throw toApiError(rowErr, 'L\u2019enregistrement d\u2019une image a échoué.');
    }
  } catch (e) {
    // Nettoyage : pas d'annonce incomplète laissée en base.
    if (uploaded.length) {
      await sb.storage.from('listing-images').remove(uploaded).then(() => undefined, () => undefined);
    }
    await sb.from('listings').delete().eq('id', listingId).then(() => undefined, () => undefined);
    throw e;
  }
  return slug;
}

export async function updateListing(
  userId: string,
  slug: string,
  input: Omit<PublishInput, 'imageFiles'> & {
    status?: string;
    newImages?: (File | Blob)[];
    removeImagePaths?: string[];
  },
): Promise<void> {
  const sb = requireClient();
  const { data: listing, error: selErr } = await sb
    .from('listings')
    .select('id, seller_id')
    .eq('slug', slug)
    .single();
  if (selErr || !listing) throw new ApiError('Annonce introuvable.');
  const row = listing as { id: string; seller_id: string };
  if (row.seller_id !== userId) throw new ApiError('Vous ne pouvez modifier que vos propres annonces.');

  const { error: upErr } = await sb
    .from('listings')
    .update({
      title: input.title.trim(),
      category_id: input.category_id,
      description: input.description.trim(),
      price: input.price,
      negotiable: input.negotiable,
      city_id: input.city_id,
      area: input.area?.trim() || null,
      condition: input.condition || null,
      seller_type: input.seller_type,
      contact_phone: input.contact_phone?.trim() || null,
      contact_whatsapp: input.contact_whatsapp?.trim() || null,
      ...(input.status ? { status: input.status } : {}),
    })
    .eq('id', row.id);
  if (upErr) throw toApiError(upErr, 'La modification a échoué.');

  for (const p of input.removeImagePaths || []) {
    await sb.storage.from('listing-images').remove([p]).then(() => undefined, () => undefined);
    await sb.from('listing_images').delete().eq('storage_path', p);
  }
  if (input.newImages?.length) {
    const { data: existing } = await sb
      .from('listing_images')
      .select('position')
      .eq('listing_id', row.id)
      .order('position', { ascending: true });
    const start = (existing || []).length;
    for (let i = 0; i < input.newImages.length; i++) {
      const path = `${userId}/${Date.now()}-${start + i}-${randomSuffix()}.jpg`;
      const { error: upErr2 } = await sb.storage
        .from('listing-images')
        .upload(path, input.newImages[i], { contentType: 'image/jpeg' });
      if (upErr2) throw toApiError(upErr2, 'L\u2019envoi d\u2019une image a échoué.');
      await sb.from('listing_images').insert({ listing_id: row.id, storage_path: path, position: start + i });
    }
  }
}

export async function deleteListing(userId: string, slug: string, soft: boolean): Promise<void> {
  const sb = requireClient();
  const { data: listing, error: selErr } = await sb
    .from('listings')
    .select('id, seller_id')
    .eq('slug', slug)
    .single();
  if (selErr || !listing) throw new ApiError('Annonce introuvable.');
  const row = listing as { id: string; seller_id: string };
  if (row.seller_id !== userId) throw new ApiError('Action non autorisée.');
  if (soft) {
    const { error } = await sb.from('listings').update({ status: 'archived' }).eq('id', row.id);
    if (error) throw toApiError(error, 'L\u2019archivage a échoué.');
  } else {
    const { error } = await sb.from('listings').delete().eq('id', row.id);
    if (error) throw toApiError(error, 'La suppression a échoué.');
  }
}

// ============================================================
// SIGNALEMENTS
// ============================================================

export async function reportListing(
  reporterId: string,
  listingId: string,
  reason: string,
  details: string,
): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('reports').insert({
    reporter_id: reporterId,
    listing_id: listingId,
    reason,
    details: details || null,
  });
  if (error) throw toApiError(error, 'Le signalement n\u2019a pas pu être envoyé.');
}

// ============================================================
// ADMINISTRATION (protégé côté base par RLS : rôle admin requis)
// ============================================================

export async function adminFetchListings(opts: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PageResult> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 15;
  const sb = requireClient();
  let q = sb
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error, count } = await q;
  if (error) throw toApiError(error, 'Liste des annonces indisponible.');
  const sellerIds = Array.from(new Set((data || []).map((r) => r.seller_id)));
  const sellers = await fetchProfilesByIds(sellerIds);
  return {
    items: (data || []).map((row) =>
      assembleFull(row as RowWithJoins, sellers.get(row.seller_id) ?? null),
    ),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function adminModerateListing(
  listingId: string,
  status: string,
  adminId: string,
  action: string,
): Promise<void> {
  const sb = requireClient();
  // Si l'annonce est refusée, on purge ses images du stockage (bucket public).
  let imagePaths: string[] = [];
  if (status === 'refused') {
    const { data: imgs } = await sb
      .from('listing_images')
      .select('storage_path')
      .eq('listing_id', listingId);
    imagePaths = (imgs || [])
      .map((img) => img.storage_path as string | null)
      .filter((p): p is string => Boolean(p));
  }
  const { error } = await sb.from('listings').update({ status }).eq('id', listingId);
  if (error) throw toApiError(error, 'La modération a échoué.');
  if (imagePaths.length) {
    await sb.storage.from('listing-images').remove(imagePaths).then(() => undefined, () => undefined);
  }
  await sb
    .from('admin_audit_logs')
    .insert({ admin_id: adminId, action, target_type: 'listing', target_id: listingId, details: { status } })
    .then(() => undefined, () => undefined);
}

export async function adminFetchReports(): Promise<(Report & { listings?: { title: string; slug: string } | null })[]> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('reports')
    .select('*, listings(title, slug)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw toApiError(error, 'Signalements indisponibles.');
  return (data || []) as (Report & { listings?: { title: string; slug: string } | null })[];
}

export async function adminUpdateReport(reportId: string, status: string, adminId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('reports').update({ status }).eq('id', reportId);
  if (error) throw toApiError(error, 'Le traitement du signalement a échoué.');
  await sb
    .from('admin_audit_logs')
    .insert({ admin_id: adminId, action: `report_${status}`, target_type: 'report', target_id: reportId, details: { status } })
    .then(() => undefined, () => undefined);
}

export async function adminAddCategory(
  name: string,
  slug: string,
  icon: string,
  parentSlug: string | null,
): Promise<void> {
  const sb = requireClient();
  let parent_id: number | null = null;
  if (parentSlug) {
    const { data } = await sb.from('categories').select('id').eq('slug', parentSlug).maybeSingle();
    parent_id = (data as { id: number } | null)?.id ?? null;
  }
  const { error } = await sb.from('categories').insert({ name, slug, icon, parent_id });
  if (error) throw toApiError(error, 'Catégorie non créée.');
}

export async function adminToggleCategory(
  categoryId: number,
  status: string,
  adminId: string,
): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('categories').update({ status }).eq('id', categoryId);
  if (error) throw toApiError(error, 'Modification de la catégorie impossible.');
  await sb
    .from('admin_audit_logs')
    .insert({ admin_id: adminId, action: 'category_status', target_type: 'category', target_id: String(categoryId), details: { status } })
    .then(() => undefined, () => undefined);
}

export async function adminAddLocality(name: string, slug: string, province: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('localities').insert({ name, slug, province });
  if (error) throw toApiError(error, 'Localité non ajoutée.');
}

export async function adminFetchUsers(): Promise<AdminUser[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc('admin_list_users');
  if (error) throw toApiError(error, 'Utilisateurs indisponibles.');
  return (data || []) as AdminUser[];
}

export async function adminSetUserBanned(userId: string, banned: boolean, adminId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('profiles').update({ is_banned: banned }).eq('id', userId);
  if (error) throw toApiError(error, banned ? 'Suspension impossible.' : 'Réactivation impossible.');
  await sb
    .from('admin_audit_logs')
    .insert({
      admin_id: adminId,
      action: banned ? 'user_banned' : 'user_unbanned',
      target_type: 'user',
      target_id: userId,
    })
    .then(() => undefined, () => undefined);
}

export async function adminPromoteToAdmin(userId: string, adminId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('profiles').update({ role: 'admin' }).eq('id', userId);
  if (error) throw toApiError(error, 'Promotion impossible.');
  await sb
    .from('admin_audit_logs')
    .insert({
      admin_id: adminId,
      action: 'user_promoted_admin',
      target_type: 'user',
      target_id: userId,
    })
    .then(() => undefined, () => undefined);
}

// ============================================================
// PROFIL
// ============================================================

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const sb = requireClient();
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw toApiError(error, 'Profil indisponible.');
  return (data as Profile | null) ?? null;
}

export async function updateOwnProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('profiles').update(patch).eq('id', userId);
  if (error) throw toApiError(error, 'La mise à jour du profil a échoué.');
}

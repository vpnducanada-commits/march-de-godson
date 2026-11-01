import { cacheListings, getCachedListings } from './idb';
import { supabase, isSupabaseConfigured, publishableKey, supabaseUrl } from './supabase';
import { normalizeText, escapeLike, slugify, randomSuffix } from './normalize';
import { isUuid, safeMediaUrl, verifyMagicBytes } from './security';
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
  Conversation,
  Listing,
  ListingFull,
  ListingQuery,
  Locality,
  Message,
  PageResult,
  Profile,
  Report,
  SearchedUser,
  UserNotification,
} from './types';
import { shortUserId } from './types';

export class ApiError extends Error {}
export class ListingModerationError extends ApiError {
  constructor(message: string, public readonly slug: string) {
    super(message);
    this.name = 'ListingModerationError';
  }
}

/** Mode démo : pas de variables Supabase → données locales d'exemple. */
export const demoMode = !isSupabaseConfigured;

function requireClient() {
  if (!supabase) throw new ApiError('Service indisponible. Vérifiez votre connexion.');
  return supabase;
}

function toApiError(err: unknown, fallback: string): ApiError {
  if (err instanceof ApiError) return err;
  const e = err as { message?: string; code?: string; details?: string };
  if (e?.code === 'PGRST116') return new ApiError('Aucune annonce trouvée avec ces critères.');
  if (e?.code === '23505' && `${e.message || ''} ${e.details || ''}`.toLowerCase().includes('username')) {
    return new ApiError('Ce nom d\u2019utilisateur est déjà pris. Choisissez-en un autre.');
  }
  if (e?.code === '23505' && `${e.message || ''} ${e.details || ''}`.toLowerCase().includes('reviews')) {
    return new ApiError('Vous avez déjà publié un avis pour ce vendeur.');
  }
  if (e?.code === '23505' && `${e.message || ''} ${e.details || ''}`.toLowerCase().includes('reports')) {
    return new ApiError('Vous avez déjà un signalement en cours d\u2019examen pour cette annonce.');
  }
  const msg = e?.message || '';
  for (const tag of [
    'DELAI_30_JOURS:',
    'NOM_UTILISATEUR_INVALIDE:',
    'NOM_UTILISATEUR_REQUIS:',
    'ACTION_INTERDITE:',
    'ANNONCE_REFUSEE:',
    'TROP_DE_MESSAGES:',
    'MESSAGE_IMMUABLE:',
    'LIMITE_IMAGES:',
    'AVATAR_INVALIDE:',
  ]) {
    if (msg.includes(tag)) {
      return new ApiError(msg.split(tag)[1]?.trim() || fallback);
    }
  }
  return new ApiError(msg ? `Erreur : ${msg}` : fallback);
}

/** Résout l'image principale d'une annonce : stockage Supabase ou image démo locale. */
export function resolveListingImage(listing: Listing, storageUrl: string | null): string {
  const safe = safeMediaUrl(storageUrl);
  if (safe) return safe;
  if (listing.is_demo) return demoImagesBySlug[listing.slug] || '/demo/placeholder.svg';
  return '/demo/placeholder.svg';
}

function sanitizeProfile(p: Profile): Profile {
  return {
    ...p,
    avatar_url: safeMediaUrl(p.avatar_url),
  };
}

function storageUrlForVideo(path: string | null): string | null { if(!path) return null; try{ const sb=requireClient(); const { data } = sb.storage.from('listing-videos').getPublicUrl(path); return data.publicUrl; }catch{ return null; } }
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
  const sortedImgs = (row.listing_images || []).slice().sort((a, b) => a.position - b.position);
  const images = sortedImgs.map((img) =>
    resolveListingImage(listing, img.storage_path ? storageUrlFor(img.storage_path) : null),
  );
  const imagePaths = sortedImgs.map((img) => img.storage_path ?? null);
  const rawVideoUrl = (listing as any).video_url
    ? storageUrlForVideo((listing as any).video_path) || (listing as any).video_url
    : null;
  return {
    listing,
    category: catRow ?? null,
    subcategory: isSub ? catRow : null,
    city: row.city ?? null,
    images: images.length ? images : [resolveListingImage(listing, null)],
    imagePaths: images.length ? imagePaths : [null],
    videoUrl: safeMediaUrl(rawVideoUrl),
    seller: seller ? sanitizeProfile(seller) : null,
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

export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  if (demoMode) {
    const m: Record<string, number> = {};
    for (const c of demoCategories) if (c.parent_id === null) { const items:any[] = (demoListings as any).items || (demoListings as any) || []; const arr = Array.isArray(items)?items:[]; m[c.slug] = arr.filter((i:any) => i.category?.slug === c.slug || i.listing.category_id === c.id).length; }
    return m;
  }
  const sb = requireClient();
  const cats = await sb.from('categories').select('id,slug,parent_id').eq('status','active');
  if (cats.error) return {};
  const counts: Record<string, number> = {};
  await Promise.all((cats.data||[]).filter(c=>c.parent_id===null).map(async (c)=>{
    const childIds = (cats.data||[]).filter(x=>x.parent_id===c.id).map(x=>x.id);
    const ids = [c.id, ...childIds];
    const { count } = await sb.from('listings').select('id', {count:'exact', head:true}).eq('status','active').gt('expires_at', new Date().toISOString()).in('category_id', ids);
    counts[c.slug] = count ?? 0;
  }));
  return counts;
}
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Coordonnées géographiques de référence des localités gabonaises (repli honnête quand l'annonce n'a pas de point GPS précis). */
const LOCALITY_COORDS: Record<string, [number, number]> = {
  libreville: [0.4162, 9.4673],
  owendo: [0.2958, 9.503],
  ntoum: [0.3853, 9.761],
  akanda: [0.543, 9.3947],
  kotto: [0.452, 9.442],
  komo: [0.15, 10.133],
  'cap-esterias': [0.6122, 9.3275],
  'port-gentil': [-0.7193, 8.7815],
  moebete: [-0.85, 8.92],
  makokou: [0.5738, 12.8642],
  franceville: [-1.6333, 13.5836],
  moanda: [-1.5665, 13.1987],
  mvengue: [-1.656, 13.43],
  bitanda: [-1.52, 13.31],
  lambarene: [-0.7001, 10.2406],
  tchibanga: [-2.9332, 10.9818],
  mouila: [-1.8685, 11.0559],
  kango: [0.1939, 10.103],
  'port-louis': [-0.75, 8.85],
  oyem: [1.5995, 11.5793],
  djambala: [-1.54, 13.75],
};

function resolveItemCoords(item: ListingFull): { lat: number; lng: number; exact: boolean } | null {
  if (
    item.listing.latitude != null &&
    item.listing.longitude != null &&
    Number.isFinite(item.listing.latitude) &&
    Number.isFinite(item.listing.longitude)
  ) {
    return { lat: item.listing.latitude, lng: item.listing.longitude, exact: true };
  }
  if (
    item.seller?.shop_lat != null &&
    item.seller?.shop_lng != null &&
    Number.isFinite(item.seller.shop_lat) &&
    Number.isFinite(item.seller.shop_lng)
  ) {
    return { lat: item.seller.shop_lat, lng: item.seller.shop_lng, exact: true };
  }
  const slug = item.city?.slug;
  if (slug && LOCALITY_COORDS[slug]) {
    return { lat: LOCALITY_COORDS[slug][0], lng: LOCALITY_COORDS[slug][1], exact: false };
  }
  return null;
}

const NEARBY_RADIUS_KM = 85;
async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  const map = new Map<string, Profile>();
  if (!ids.length) return map;
  if (demoMode) {
    for (const id of ids) map.set(id, demoSeller);
    return map;
  }
  const sb = requireClient();
  const validIds = ids.filter((id) => isUuid(id));
  if (!validIds.length) return map;
  const { data } = await sb.from('profiles').select('*').in('id', validIds);
  for (const p of data || []) map.set((p as Profile).id, sanitizeProfile(p as Profile));
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
  const hasNear =
    query.lat !== undefined &&
    query.lng !== undefined &&
    Number.isFinite(query.lat) &&
    Number.isFinite(query.lng);

  let q = sb
    .from('listings')
    .select(LISTING_SELECT, { count: 'exact' })
    .eq('status', 'active')
    // Double sécurité avec la politique RLS : jamais d'annonce expirée au catalogue.
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (hasNear) {
    // En mode proximité, on récupère l'ensemble des annonces actives filtrées pour trier par distance réelle
    q = q.range(0, 299);
  } else {
    q = q.range((page - 1) * pageSize, page * pageSize - 1);
  }

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

  if (!hasNear) {
    if (query.sort === 'price_asc') {
      q = q.order('price.asc.nullsfirst').order('created_at.desc');
    } else if (query.sort === 'price_desc') {
      q = q.order('price.desc.nullslast').order('created_at.desc');
    }
  }

  let data, error, count;
  try {
    const r = await q;
    data = r.data;
    error = r.error;
    count = r.count;
    if (error) throw error;
  } catch (e) {
    const cached = await getCachedListings();
    if (cached.length) return { items: cached.slice(0, pageSize), total: cached.length, page, pageSize };
    throw toApiError(e, 'Recherche impossible (hors ligne).');
  }
  if (error) throw toApiError(error, 'Recherche impossible.');
  const sellerIds = Array.from(new Set((data || []).map((r) => r.seller_id)));
  const sellers = await fetchProfilesByIds(sellerIds);
  const allItems = (data || []).map((row) =>
    assembleFull(row as RowWithJoins, sellers.get(row.seller_id) ?? null),
  );
  if (!hasNear) {
    void cacheListings(allItems).catch(() => {});
    return { items: allItems, total: count ?? 0, page, pageSize };
  }

  const uLat = query.lat as number;
  const uLng = query.lng as number;
  const enriched = allItems.map((it) => {
    const c = resolveItemCoords(it);
    const dist = c ? haversine(uLat, uLng, c.lat, c.lng) : null;
    return { ...it, distanceKm: dist };
  });
  const withinRadius = enriched.filter((it) => it.distanceKm !== null && it.distanceKm <= NEARBY_RADIUS_KM);
  const pool = withinRadius.length > 0 ? withinRadius : enriched.filter((it) => it.distanceKm !== null);
  pool.sort((a, b) => {
    if (query.sort === 'price_asc') return (a.listing.price ?? -1) - (b.listing.price ?? -1);
    if (query.sort === 'price_desc') return (b.listing.price ?? -Infinity) - (a.listing.price ?? -Infinity);
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });
  const paged = pool.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, total: pool.length, page, pageSize };
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
  if (
    query.lat !== undefined &&
    query.lng !== undefined &&
    Number.isFinite(query.lat) &&
    Number.isFinite(query.lng)
  ) {
    const uLat = query.lat;
    const uLng = query.lng;
    const enriched = items.map((it) => {
      const c = resolveItemCoords(it);
      return { ...it, distanceKm: c ? haversine(uLat, uLng, c.lat, c.lng) : null };
    });
    const near = enriched.filter((it) => it.distanceKm !== null && it.distanceKm <= NEARBY_RADIUS_KM);
    items = (near.length ? near : enriched).sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
  }
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
  let data, error, count;
  try {
    const r = await q;
    data = r.data;
    error = r.error;
    count = r.count;
    if (error) throw error;
  } catch (e) {
    const cached = (await getCachedListings()).filter(
      (c) => c.listing.seller_id === sellerId && (!opts.status || c.listing.status === opts.status),
    );
    if (cached.length) {
      return {
        items: cached.slice((page - 1) * pageSize, page * pageSize),
        total: cached.length,
        page,
        pageSize,
      };
    }
    throw toApiError(e, 'Chargement impossible (hors ligne).');
  }
  if (error) throw toApiError(error, 'Chargement impossible.');
  const seller = (await fetchProfilesByIds([sellerId])).get(sellerId) ?? null;
  return {
    items: (data || []).map((row) => assembleFull(row as RowWithJoins, seller)),
    total: count ?? 0,
    page,
    pageSize,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchSeller(idOrUsername: string): Promise<Profile | null> {
  const clean = decodeURIComponent(idOrUsername || '').trim().replace(/^[@#]+/, '');
  if (!clean) return null;
  if (demoMode) {
    if (
      clean === demoSeller.id ||
      shortUserId(demoSeller.id) === clean.toLowerCase() ||
      (demoSeller.username && demoSeller.username.toLowerCase() === clean.toLowerCase())
    ) {
      return demoSeller;
    }
    return null;
  }
  const sb = requireClient();
  if (UUID_RE.test(clean)) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', clean).maybeSingle();
    if (error) throw toApiError(error, 'Profil introuvable.');
    return data ? sanitizeProfile(data as Profile) : null;
  }
  // Recherche directe par @username exact (validation stricte sans jokers SQL % ou _)
  if (/^[a-z0-9_.-]{2,32}$/i.test(clean)) {
    const { data: byUsername, error: userErr } = await sb
      .from('profiles')
      .select('*')
      .eq('username', clean.toLowerCase())
      .maybeSingle();
    if (!userErr && byUsername) return sanitizeProfile(byUsername as Profile);
  }

  // Sinon, tentative via préfixe d'ID court (ex. 8 caractères)
  if (/^[0-9a-f-]{4,36}$/i.test(clean)) {
    const matches = await searchUsers(clean, 5).catch(() => []);
    const exactPrefix = matches.find(
      (u) =>
        u.id.toLowerCase() === clean.toLowerCase() ||
        u.id.replace(/-/g, '').toLowerCase().startsWith(clean.replace(/-/g, '').toLowerCase()),
    );
    if (exactPrefix) {
      const { data } = await sb.from('profiles').select('*').eq('id', exactPrefix.id).maybeSingle();
      return data ? sanitizeProfile(data as Profile) : null;
    }
  }
  return null;
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
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  imageFiles: (File | Blob)[];
  videoFile?: File | Blob | null;
}

async function runGeminiListingModeration(listingId: string): Promise<void> {
  const sb = requireClient();
  const { data, error } = await sb.functions.invoke('gemini-moderate-listing', { body: { listingId } });
  if (error) throw new ApiError('Le contrôle automatique est indisponible. Votre annonce reste masquée; réessayez plus tard.');
  const result = data as { outcome?: string; message?: string } | null;
  if (!result || result.outcome !== 'approved') {
    throw new ApiError(result?.message || 'Annonce bloquée par le contrôle automatique. Corrigez le contenu ou ajoutez une photo/vidéo plus claire.');
  }
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
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      location_label: input.location_label?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .single();
  if (insErr || !created) {
    if (insErr && /QUOTA_DEPASSE/i.test(insErr.message)) {
      throw new ApiError(
        'Limite atteinte : 20 annonces actives maximum par compte. Archivez ou supprimez une annonce pour en publier une nouvelle.',
      );
    }
    throw toApiError(insErr, 'La publication a échoué. Réessayez.');
  }
  const listingId = (created as { id: string }).id;

  // L'annonce n'est complète que si le stockage confirme chaque image.
  const uploadedImages: string[] = [];
  let uploadedVideo: string | null = null;
  try {
    for (let i = 0; i < input.imageFiles.length; i++) {
      const file = input.imageFiles[i];
      const path = `${userId}/${Date.now()}-${i}-${randomSuffix()}.jpg`;
      const { error: upErr } = await sb.storage
        .from('listing-images')
        .upload(path, file, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw toApiError(upErr, 'L\u2019envoi d\u2019une image a échoué.');
      uploadedImages.push(path);
      const { error: rowErr } = await sb
        .from('listing_images')
        .insert({ listing_id: listingId, storage_path: path, position: i });
      if (rowErr) throw toApiError(rowErr, 'L\u2019enregistrement d\u2019une image a échoué.');
    }
    // Vidéo optionnelle (≤180s, 80 Mo) -> bucket listing-videos
    if (input.videoFile) {
      const rawType = (input.videoFile as File).type || 'video/mp4';
      const safeVideoType = ['video/mp4', 'video/webm', 'video/quicktime'].includes(rawType)
        ? rawType
        : null;
      if (!safeVideoType || !(await verifyMagicBytes(input.videoFile, 'video'))) {
        throw new ApiError('Format vidéo non autorisé (utilisez MP4, WebM ou MOV).');
      }
      const ext = safeVideoType === 'video/webm' ? 'webm' : safeVideoType === 'video/quicktime' ? 'mov' : 'mp4';
      const vPath = `${userId}/${Date.now()}-video-${randomSuffix()}.${ext}`;
      const { error: vUpErr } = await sb.storage.from('listing-videos').upload(vPath, input.videoFile, { contentType: safeVideoType, upsert: false });
      if (vUpErr) throw toApiError(vUpErr, 'L\u2019envoi de la vidéo a échoué.');
      uploadedVideo = vPath;
      const vUrl = storageUrlForVideo(vPath) || '';
      const { error: vRowErr } = await sb.from('listings').update({ video_url: vUrl, video_path: vPath }).eq('id', listingId);
      if (vRowErr) throw toApiError(vRowErr, 'L\u2019enregistrement de la vidéo a échoué.');
    }
  } catch (e) {
    // Nettoyage : pas d'annonce ni de média orphelin laissés en base / Storage.
    if (uploadedImages.length) {
      await sb.storage.from('listing-images').remove(uploadedImages).then(() => undefined, () => undefined);
    }
    if (uploadedVideo) {
      await sb.storage.from('listing-videos').remove([uploadedVideo]).then(() => undefined, () => undefined);
    }
    await sb.from('listings').delete().eq('id', listingId).then(() => undefined, () => undefined);
    throw e;
  }
  // Publication is server-approved only. On rejection or AI outage the listing remains hidden.
  try {
    await runGeminiListingModeration(listingId);
  } catch (error) {
    throw new ListingModerationError(error instanceof Error ? error.message : 'Annonce en attente de contrôle.', slug);
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
    removeVideo?: boolean;
  },
): Promise<void> {
  const sb = requireClient();
  const { data: listing, error: selErr } = await sb
    .from('listings')
    .select('id, seller_id, video_path')
    .eq('slug', slug)
    .single();
  if (selErr || !listing) throw new ApiError('Annonce introuvable.');
  const row = listing as { id: string; seller_id: string; video_path?: string | null };
  if (row.seller_id !== userId) throw new ApiError('Vous ne pouvez modifier que vos propres annonces.');

  const patch: Record<string, unknown> = {
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
  };
  // Ne met à jour les coordonnées GPS que lorsqu'elles sont explicitement fournies (préserve le GPS à l'archivage)
  if (input.latitude !== undefined && input.longitude !== undefined) {
    patch.latitude = input.latitude;
    patch.longitude = input.longitude;
  }
  if (input.location_label !== undefined) {
    patch.location_label = input.location_label?.trim() || null;
  }
  // Any edited listing is hidden while Gemini rechecks its text and media.
  patch.status = 'pending';

  const { error: upErr } = await sb.from('listings').update(patch).eq('id', row.id);
  if (upErr) throw toApiError(upErr, 'La modification a échoué.');

  const toRemove = (input.removeImagePaths || []).filter((p): p is string => Boolean(p && p.trim()));
  if (toRemove.length) {
    const { data: ownedImgs } = await sb
      .from('listing_images')
      .select('storage_path')
      .eq('listing_id', row.id)
      .in('storage_path', toRemove);
    const verifiedPaths = (ownedImgs || [])
      .map((x) => x.storage_path as string | null)
      .filter((p): p is string => Boolean(p));
    if (verifiedPaths.length) {
      await sb.from('listing_images').delete().eq('listing_id', row.id).in('storage_path', verifiedPaths);
      await sb.storage.from('listing-images').remove(verifiedPaths).then(() => undefined, () => undefined);
    }
  }
  if (input.newImages?.length) {
    const { data: existing } = await sb
      .from('listing_images')
      .select('position')
      .eq('listing_id', row.id)
      .order('position', { ascending: true });
    const maxPos = (existing || []).reduce((m, r) => Math.max(m, Number((r as { position: number }).position) || 0), -1);
    const start = maxPos + 1;
    for (let i = 0; i < input.newImages.length; i++) {
      const path = `${userId}/${Date.now()}-${start + i}-${randomSuffix()}.jpg`;
      const { error: upErr2 } = await sb.storage
        .from('listing-images')
        .upload(path, input.newImages[i], { contentType: 'image/jpeg' });
      if (upErr2) throw toApiError(upErr2, 'L\u2019envoi d\u2019une image a échoué.');
      await sb.from('listing_images').insert({ listing_id: row.id, storage_path: path, position: start + i });
    }
  }
  // Vidéo en édition (remplacement ou suppression avec nettoyage du fichier précédent)
  const videoFileUpdate = input.videoFile;
  const removeVideo = input.removeVideo;
  if (videoFileUpdate) {
    const rawType = (videoFileUpdate as File).type || 'video/mp4';
    const safeVideoType = ['video/mp4', 'video/webm', 'video/quicktime'].includes(rawType)
      ? rawType
      : null;
    if (!safeVideoType || !(await verifyMagicBytes(videoFileUpdate, 'video'))) {
      throw new ApiError('Format vidéo non autorisé (utilisez MP4, WebM ou MOV).');
    }
    const ext = safeVideoType === 'video/webm' ? 'webm' : safeVideoType === 'video/quicktime' ? 'mov' : 'mp4';
    const vPath = `${userId}/${Date.now()}-video-${randomSuffix()}.${ext}`;
    const { error: vUpErr } = await sb.storage.from('listing-videos').upload(vPath, videoFileUpdate, { contentType: safeVideoType, upsert: false });
    if (vUpErr) throw toApiError(vUpErr, 'L\u2019envoi de la vidéo a échoué.');
    const vUrl = storageUrlForVideo(vPath) || '';
    const { error: vDbErr } = await sb.from('listings').update({ video_url: vUrl, video_path: vPath }).eq('id', row.id);
    if (!vDbErr && row.video_path && row.video_path !== vPath) {
      await sb.storage.from('listing-videos').remove([row.video_path]).then(() => undefined, () => undefined);
    }
  } else if (removeVideo) {
    const { error: vDelErr } = await sb.from('listings').update({ video_url: null, video_path: null }).eq('id', row.id);
    if (!vDelErr && row.video_path) {
      await sb.storage.from('listing-videos').remove([row.video_path]).then(() => undefined, () => undefined);
    }
  }
  await runGeminiListingModeration(row.id);
}

export async function deleteListing(userId: string, slug: string, soft: boolean): Promise<void> {
  const sb = requireClient();
  const { data: listing, error: selErr } = await sb
    .from('listings')
    .select('id, seller_id, video_path, listing_images(storage_path)')
    .eq('slug', slug)
    .single();
  if (selErr || !listing) throw new ApiError('Annonce introuvable.');
  const row = listing as {
    id: string;
    seller_id: string;
    video_path?: string | null;
    listing_images?: { storage_path: string | null }[];
  };
  if (row.seller_id !== userId) throw new ApiError('Action non autorisée.');
  if (soft) {
    const { error } = await sb.from('listings').update({ status: 'archived' }).eq('id', row.id);
    if (error) throw toApiError(error, 'L\u2019archivage a échoué.');
  } else {
    const imagePaths = (row.listing_images || [])
      .map((img) => img.storage_path)
      .filter((p): p is string => Boolean(p));
    const videoPath = row.video_path || null;
    const { error } = await sb.from('listings').delete().eq('id', row.id);
    if (error) throw toApiError(error, 'La suppression a échoué.');
    if (imagePaths.length) {
      await sb.storage.from('listing-images').remove(imagePaths).then(() => undefined, () => undefined);
    }
    if (videoPath) {
      await sb.storage.from('listing-videos').remove([videoPath]).then(() => undefined, () => undefined);
    }
  }
}

// ============================================================
// EXPIRATION / REPRISE D'ANNONCE
// ============================================================

/**
 * Reprend une annonce expirée : +90 jours de visibilité.
 * Propriétaire (ou admin) uniquement, annonce active uniquement —
 * contrôles refaits côté base par la RPC renew_listing.
 */
export async function renewListing(userId: string, slug: string): Promise<string> {
  if (demoMode) return new Date(Date.now() + 90 * 86400000).toISOString();
  const sb = requireClient();
  const { data: row, error: selErr } = await sb
    .from('listings')
    .select('id, seller_id, status')
    .eq('slug', slug)
    .maybeSingle();
  if (selErr || !row) throw new ApiError('Annonce introuvable.');
  const r = row as { id: string; seller_id: string; status: string };
  if (r.seller_id !== userId) throw new ApiError('Vous ne pouvez reprendre que vos propres annonces.');
  const { data, error } = await sb.rpc('renew_listing', { p_listing_id: r.id });
  if (error) throw toApiError(error, "La reprise de l'annonce a échoué.");
  // PostgREST ≥12 enveloppe la valeur scalaire : { renew_listing: '…' }.
  const value =
    typeof data === 'string'
      ? data
      : ((data as { renew_listing?: string } | null)?.renew_listing ?? null);
  if (!value) throw new ApiError("La reprise de l'annonce a échoué.");
  return value;
}

// ============================================================
// SIGNALEMENTS
// ============================================================

export async function reportListing(
  reporterId: string,
  listingId: string,
  reason: string,
  details: string,
): Promise<string | null> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('reports')
    .insert({
      reporter_id: reporterId,
      listing_id: listingId,
      reason,
      details: details || null,
    })
    .select('id')
    .maybeSingle();
  if (error) throw toApiError(error, 'Le signalement n\u2019a pas pu être envoyé.');
  return (data as { id: string } | null)?.id ?? null;
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
  // Refus d'annonce : purge les médias avant d'enregistrer le statut refusé.
  let imagePaths: string[] = [];
  let videoPath: string | null = null;
  if (status === 'refused') {
    const [{ data: imgs }, { data: listing }] = await Promise.all([
      sb.from('listing_images').select('storage_path').eq('listing_id', listingId),
      sb.from('listings').select('video_path').eq('id', listingId).maybeSingle(),
    ]);
    imagePaths = (imgs || [])
      .map((img) => img.storage_path as string | null)
      .filter((p): p is string => Boolean(p));
    videoPath = (listing as { video_path?: string | null } | null)?.video_path ?? null;
  }
  const { error } = await sb
    .from('listings')
    .update(status === 'refused' ? { status, video_path: null, video_url: null } : { status })
    .eq('id', listingId);
  if (error) throw toApiError(error, 'La modération a échoué.');
  if (imagePaths.length) {
    await sb.storage.from('listing-images').remove(imagePaths).then(() => undefined, () => undefined);
  }
  if (videoPath) {
    await sb.storage.from('listing-videos').remove([videoPath]).then(() => undefined, () => undefined);
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
// MESSAGERIE (acheteur ↔ vendeur, temps réel Supabase)
// ============================================================

/** Ouvre (ou retrouve) la conversation entre moi et le vendeur de l'annonce. */
export async function openConversation(
  userId: string,
  listingId: string,
  sellerId: string,
): Promise<string> {
  if (demoMode) throw new ApiError('La messagerie n\u2019est pas disponible en mode démo.');
  const sb = requireClient();
  const { data: existing } = await sb
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', userId)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data: created, error } = await sb
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: userId, seller_id: sellerId })
    .select('id')
    .maybeSingle();
  if (error || !created) throw toApiError(error ?? new ApiError('conflit'), 'Impossible de démarrer la conversation.');
  return (created as { id: string }).id;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  if (demoMode) return [];
  if (!isUuid(userId)) throw new ApiError('Identifiant utilisateur invalide.');
  const sb = requireClient();
  const { data, error } = await sb
    .from('conversations')
    .select(
      'id, listing_id, buyer_id, seller_id, created_at, listings(title, slug, listing_images(storage_path)), messages(body, sender_id, created_at, read_at)',
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw toApiError(error, 'Conversations indisponibles.');
  const rows = (data || []) as unknown as {
    id: string;
    listing_id: string;
    buyer_id: string;
    seller_id: string;
    created_at: string;
    listings: { title: string; slug: string; listing_images: { storage_path: string | null }[] } | null;
    messages: { body: string; sender_id: string; created_at: string; read_at: string | null }[];
  }[];
  const convs: Conversation[] = [];
  for (const c of rows) {
    const sorted = (c.messages || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    const imgs = (c.listings?.listing_images || []).map((im) => im.storage_path).filter(Boolean) as string[];
    convs.push({
      id: c.id,
      listing_id: c.listing_id,
      buyer_id: c.buyer_id,
      seller_id: c.seller_id,
      created_at: c.created_at,
      listingTitle: c.listings?.title ?? 'Annonce',
      listingSlug: c.listings?.slug ?? '',
      listingImage: imgs.length ? storageUrlFor(imgs[0]) : null,
      counterpart: null,
      lastMessage: sorted.length
        ? { body: sorted[sorted.length - 1].body, created_at: sorted[sorted.length - 1].created_at, sender_id: sorted[sorted.length - 1].sender_id }
        : null,
      unreadCount: c.messages.filter((m) => !m.read_at && m.sender_id !== userId).length,
    });
  }
  // Interlocuteurs (profil du vendeur ou de l'acheteur selon mon rôle).
  const counterpartIds = Array.from(
    new Set(convs.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id))),
  );
  const profiles = await fetchProfilesByIds(counterpartIds);
  for (const c of convs) {
    c.counterpart = profiles.get(c.buyer_id === userId ? c.seller_id : c.buyer_id) ?? null;
  }
  // Tri par dernier message (les conversations vides gardent leur date de création).
  return convs.sort((a, b) => (b.lastMessage?.created_at ?? b.created_at).localeCompare(a.lastMessage?.created_at ?? a.created_at));
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  if (demoMode) return [];
  const sb = requireClient();
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(0, 499);
  if (error) throw toApiError(error, 'Messages indisponibles.');
  return (data || []) as Message[];
}

export async function sendMessage(userId: string, conversationId: string, body: string): Promise<Message> {
  if (demoMode) throw new ApiError('La messagerie n\u2019est pas disponible en mode démo.');
  const sb = requireClient();
  const text = body.trim();
  if (!text) throw new ApiError('Le message est vide.');
  if (text.length > 2000) throw new ApiError('Message trop long (2000 caractères maximum).');
  const { data, error } = await sb
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: userId, body: text })
    .select('*')
    .single();
  if (error) throw toApiError(error, 'Envoi impossible.');
  return data as Message;
}

/** Marque la conversation comme lue (mes messages reçus non lus). */
export async function markConversationRead(conversationId: string): Promise<void> {
  if (demoMode) return;
  const sb = requireClient();
  await sb
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .then(() => undefined, () => undefined);
}

/** Nombre de messages non lus (toutes conversations confondues). */
export async function fetchUnreadCount(): Promise<number> {
  if (demoMode) return 0;
  const sb = requireClient();
  const { data, error } = await sb.rpc('unread_count');
  if (error) return 0;
  return typeof data === 'number' ? data : Number((data as { unread_count?: number } | null)?.unread_count ?? 0);
}

// ---------------------------------------------------------------------------
// Temps réel — canal unique + listeners multiples (refcounting).
//
// Supabase Realtime interdit d'ajouter un callback postgres_changes à un canal
// déjà abonné. Le header ET la page Messages s'abonnent aux nouveaux messages
// globaux : on partage donc UN canal, et chaque composant enregistre son
// listener. Le canal n'est supprimé que quand plus personne ne l'écoute.
// ---------------------------------------------------------------------------
type RealtimeChannel = ReturnType<ReturnType<typeof requireClient>['channel']>;
// Registres module-level : les callbacks de canal y distribuent les messages,
// ce qui permet de réutiliser un canal existant sans jamais appeler .on()
// après subscribe() (interdit par Supabase Realtime).
// Listeners globaux « il y a eu de l'activité en messagerie » (nouveaux messages
// OU nouvelles conversations) : les abonnés se contentent de rafraîchir.
const globalActivityListeners = new Set<() => void>();
let globalMsgChannel: RealtimeChannel | null = null;
const convListeners = new Map<string, Set<(m: Message) => void>>();
const convChannels = new Map<string, RealtimeChannel>();

function dispatch(listeners: Set<(m: Message) => void> | undefined, m: Message, ctx: string): void {
  if (!listeners) return;
  listeners.forEach((fn) => {
    try {
      fn(m);
    } catch (err) {
      console.error(`Erreur listener messagerie (${ctx})`, err);
    }
  });
}

function fireGlobal(ctx: string): void {
  globalActivityListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`Erreur listener messagerie (${ctx})`, err);
    }
  });
}

function ensureGlobalChannel(sb: ReturnType<typeof requireClient>): void {
  if (globalMsgChannel && sb.realtime.channels.includes(globalMsgChannel)) return;
  // Un canal du même topic existe déjà (fermeture en attente, StrictMode, etc.) :
  // on le réutilise tel quel — son callback distribue déjà vers le registre.
  const existing = sb.realtime.channels.find((ch) => ch.topic.endsWith('messages:global'));
  if (existing) {
    globalMsgChannel = existing;
    return;
  }
  // Nouveaux messages ET nouvelles conversations : le vendeur voit apparaître la
  // conversation dès son ouverture, même avant le premier message.
  globalMsgChannel = sb
    .channel('messages:global')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () =>
      fireGlobal('global messages'),
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () =>
      fireGlobal('global conversations'),
    )
    .subscribe();
}

/** Abonnement temps réel aux nouveaux messages d'une conversation. Retourne le désabonnement. */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (m: Message) => void,
): () => void {
  if (demoMode || !isUuid(conversationId)) return () => undefined;
  const sb = requireClient();
  let channel = convChannels.get(conversationId);
  if (!channel || !sb.realtime.channels.includes(channel)) {
    channel = sb.realtime.channels.find((ch) => ch.topic.endsWith(`messages:${conversationId}`));
  }
  if (!channel) {
    channel = sb
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => dispatch(convListeners.get(conversationId), payload.new as Message, `conversation ${conversationId}`),
      )
      .subscribe();
    convChannels.set(conversationId, channel);
  }
  let listeners = convListeners.get(conversationId);
  if (!listeners) {
    listeners = new Set();
    convListeners.set(conversationId, listeners);
  }
  listeners.add(onMessage);
  return () => {
    listeners.delete(onMessage);
    if (listeners.size === 0) {
      void sb.removeChannel(channel);
      convChannels.delete(conversationId);
    }
  };
}

/**
 * Abonnement temps réel global : déclenché à chaque nouvelle activité
 * (nouveau message OU nouvelle conversation). Alimente le badge « non lus »
 * du header et la liste de la page Messages. Retourne le désabonnement.
 */
export function subscribeToNewMessages(onActivity: () => void): () => void {
  if (demoMode) return () => undefined;
  const sb = requireClient();
  ensureGlobalChannel(sb);
  globalActivityListeners.add(onActivity);
  return () => {
    globalActivityListeners.delete(onActivity);
    if (globalActivityListeners.size === 0 && globalMsgChannel && sb.realtime.channels.includes(globalMsgChannel)) {
      void sb.removeChannel(globalMsgChannel);
      globalMsgChannel = null;
    }
  };
}

// ============================================================
// PROFIL
// ============================================================

/**
 * L'e-mail du profil est-il confirmé (Supabase Auth) ?
 * Indicateur honnête : basé sur la confirmation réelle de l'adresse,
 * jamais un badge marketing.
 */
export async function fetchReviews(sellerId: string): Promise<import('./types').Review[]> {
  if (!demoMode) {
    if (!isUuid(sellerId)) return [];
    const sb = requireClient();
    const { data, error } = await sb
      .from('reviews')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, 'Impossible de charger les avis.');
    return (data || []) as import('./types').Review[];
  }
  try {
    const raw = localStorage.getItem('gm_reviews_' + sellerId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
export async function addReview(sellerId: string, authorId: string, rating: number, comment: string): Promise<void> {
  const safeRating = Math.max(1, Math.min(5, Math.round(rating)));
  const cleanComment = comment.trim().slice(0, 1000);
  if (cleanComment.length < 10) {
    throw new ApiError('Votre avis doit contenir au moins 10 caractères.');
  }
  if (!demoMode) {
    if (!isUuid(sellerId) || !isUuid(authorId)) throw new ApiError('Identifiant invalide.');
    const sb = requireClient();
    const { error } = await sb.from('reviews').insert({
      seller_id: sellerId,
      author_id: authorId,
      rating: safeRating,
      comment: cleanComment,
    });
    if (error) throw toApiError(error, 'Impossible d\u2019enregistrer votre avis.');
    return;
  }
  const key = 'gm_reviews_' + sellerId;
  let arr: any[] = [];
  try {
    arr = JSON.parse(localStorage.getItem(key) || '[]');
  } catch {}
  arr.unshift({
    id: 'rv_' + Date.now(),
    seller_id: sellerId,
    author_id: authorId,
    rating: safeRating,
    comment: cleanComment,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
}
export async function isEmailConfirmed(profileId: string): Promise<boolean> {
  if (demoMode) return false;
  const sb = requireClient();
  const { data, error } = await sb.rpc('profile_email_confirmed', { p_profile_id: profileId });
  if (error) return false;
  return typeof data === 'boolean'
    ? data
    : Boolean((data as { profile_email_confirmed?: boolean } | null)?.profile_email_confirmed);
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  if (!isUuid(userId)) return null;
  const sb = requireClient();
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw toApiError(error, 'Profil indisponible.');
  return data ? sanitizeProfile(data as Profile) : null;
}

const ALLOWED_PROFILE_PATCH_KEYS = new Set([
  'display_name',
  'pseudonym',
  'username',
  'city',
  'account_type',
  'shop_lat',
  'shop_lng',
  'shop_label',
]);

export async function updateOwnProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  if (!isUuid(userId)) throw new ApiError('Identifiant utilisateur invalide.');
  const safePatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (ALLOWED_PROFILE_PATCH_KEYS.has(k)) safePatch[k] = v;
  }
  if (!Object.keys(safePatch).length) return;
  const sb = requireClient();
  const { error } = await sb.from('profiles').update(safePatch).eq('id', userId);
  if (error) throw toApiError(error, 'La mise à jour du profil a échoué.');
}

function extractAvatarStoragePath(userId: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/avatars/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) ? path : null;
}

/** Upload d'une photo de profil compressée dans le bucket public `avatars`. */
export async function uploadProfileAvatar(userId: string, blob: Blob): Promise<string> {
  if (demoMode) throw new ApiError('La photo de profil n\u2019est pas modifiable en mode démo.');
  const sb = requireClient();
  const { data: curProf } = await sb.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
  const oldPath = extractAvatarStoragePath(userId, (curProf as { avatar_url?: string | null } | null)?.avatar_url);

  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
    contentType: blob.type || 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) throw toApiError(upErr, 'L\u2019envoi de la photo de profil a échoué.');
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = data.publicUrl;
  const { error: profErr } = await sb
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  if (profErr) {
    await sb.storage.from('avatars').remove([path]).then(() => undefined, () => undefined);
    throw toApiError(profErr, 'Impossible d\u2019enregistrer la photo sur votre profil.');
  }
  if (oldPath && oldPath !== path) {
    await sb.storage.from('avatars').remove([oldPath]).then(() => undefined, () => undefined);
  }
  return avatarUrl;
}

export async function removeProfileAvatar(userId: string): Promise<void> {
  if (demoMode) return;
  const sb = requireClient();
  const { data: curProf } = await sb.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
  const oldPath = extractAvatarStoragePath(userId, (curProf as { avatar_url?: string | null } | null)?.avatar_url);
  const { error } = await sb.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw toApiError(error, 'Impossible de retirer la photo de profil.');
  if (oldPath) {
    await sb.storage.from('avatars').remove([oldPath]).then(() => undefined, () => undefined);
  }
}

// ============================================================
// RECHERCHE D'UTILISATEURS (@username, nom, UUID ou ID court)
// ============================================================

export async function searchUsers(query: string, limit = 12): Promise<SearchedUser[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (demoMode) {
    const q = trimmed.replace(/^[@#]+/, '').toLowerCase();
    const match =
      demoSeller.id.toLowerCase().includes(q) ||
      shortUserId(demoSeller.id).startsWith(q) ||
      (demoSeller.display_name || '').toLowerCase().includes(q) ||
      (demoSeller.pseudonym || '').toLowerCase().includes(q);
    return match
      ? [
          {
            id: demoSeller.id,
            username: demoSeller.pseudonym || 'demo',
            display_name: demoSeller.display_name,
            pseudonym: demoSeller.pseudonym,
            avatar_url: demoSeller.avatar_url,
            city: demoSeller.city,
            account_type: demoSeller.account_type,
            is_demo: true,
            created_at: demoSeller.created_at,
            followers_count: 0,
            listings_count: demoListings.length,
          },
        ]
      : [];
  }
  const sb = requireClient();
  const { data, error } = await sb.rpc('search_users', { p_query: trimmed, p_limit: limit });
  if (error) throw toApiError(error, 'Recherche d\u2019utilisateurs indisponible.');
  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    username: (row.username as string | null) ?? null,
    display_name: (row.display_name as string | null) ?? null,
    pseudonym: (row.pseudonym as string | null) ?? null,
    avatar_url: safeMediaUrl(row.avatar_url as string | null),
    city: (row.city as string | null) ?? null,
    account_type: (row.account_type as Profile['account_type']) ?? 'particulier',
    is_demo: Boolean(row.is_demo),
    created_at: String(row.created_at),
    followers_count: Number(row.followers_count ?? 0),
    listings_count: Number(row.listings_count ?? 0),
  }));
}

// ============================================================
// ABONNEMENTS VENDEURS (`follows`) & NOTIFICATIONS (`user_notifications`)
// ============================================================

export async function fetchFollowSummary(
  targetUserId: string,
  viewerUserId?: string | null,
): Promise<{ followersCount: number; followingCount: number; isFollowing: boolean }> {
  if (demoMode || !targetUserId) {
    return { followersCount: 0, followingCount: 0, isFollowing: false };
  }
  const sb = requireClient();
  const [followersRes, followingRes, meRes] = await Promise.all([
    sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', targetUserId),
    sb.from('follows').select('followed_id', { count: 'exact', head: true }).eq('follower_id', targetUserId),
    viewerUserId && viewerUserId !== targetUserId
      ? sb
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewerUserId)
          .eq('followed_id', targetUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
    isFollowing: Boolean(meRes.data),
  };
}

export async function toggleFollowUser(followerId: string, followedId: string): Promise<boolean> {
  if (demoMode) throw new ApiError('Le suivi de vendeurs nécessite le mode connecté.');
  if (followerId === followedId) throw new ApiError('Vous ne pouvez pas suivre votre propre profil.');
  const sb = requireClient();
  const { data: existing } = await sb
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)
    .maybeSingle();
  if (existing) {
    const { error } = await sb
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followed_id', followedId);
    if (error) throw toApiError(error, 'Impossible de retirer cet abonnement.');
    return false;
  }
  const { error } = await sb
    .from('follows')
    .insert({ follower_id: followerId, followed_id: followedId });
  if (error) throw toApiError(error, 'Impossible de suivre cet utilisateur.');
  return true;
}

export async function fetchFollowedUsers(userId: string): Promise<Profile[]> {
  if (demoMode) return [];
  const sb = requireClient();
  const { data, error } = await sb
    .from('follows')
    .select('followed_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data?.length) return [];
  const ids = data.map((r) => r.followed_id as string);
  const map = await fetchProfilesByIds(ids);
  return ids.map((id) => map.get(id)).filter((p): p is Profile => Boolean(p));
}

export async function fetchUserNotifications(userId: string): Promise<UserNotification[]> {
  if (demoMode) return [];
  const sb = requireClient();
  const { data, error } = await sb
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data || []) as UserNotification[];
}

export async function markUserNotificationRead(userId: string, notifId: string): Promise<void> {
  if (demoMode) return;
  const sb = requireClient();
  await sb
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId)
    .eq('user_id', userId)
    .then(() => undefined, () => undefined);
}

export async function markAllUserNotificationsRead(userId: string): Promise<void> {
  if (demoMode) return;
  const sb = requireClient();
  await sb
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .then(() => undefined, () => undefined);
}

export async function clearUserNotifications(userId: string): Promise<void> {
  if (demoMode) return;
  const sb = requireClient();
  await sb
    .from('user_notifications')
    .delete()
    .eq('user_id', userId)
    .then(() => undefined, () => undefined);
}

export function subscribeToUserNotifications(
  userId: string,
  onInsert: (n: UserNotification) => void,
): () => void {
  if (demoMode || !isUuid(userId)) return () => undefined;
  const sb = requireClient();
  const topic = `user-notifs:${userId}`;
  const existing = sb.realtime.channels.find((ch) => ch.topic.endsWith(topic));
  if (existing) {
    void sb.removeChannel(existing);
  }
  const channel = sb
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload?.new) onInsert(payload.new as UserNotification);
      },
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

// ============================================================
// NOTIFICATIONS E-MAIL (edge function « notify-email »)
// Dégradé gracieux : si la clé Brevo n'est pas configurée côté
// serveur, l'appel échoue silencieusement — l'expérience utilisateur
// (modération, signalement) n'en dépend pas.
// ============================================================

export type EmailNotify =
  | { kind: 'listing_status'; listingId: string; status: 'active' | 'refused' | 'archived' }
  | { kind: 'report_created'; reportId: string };

/**
 * Déclenche un e-mail transactionnel. Retourne false sans lever d'erreur
 * quand le service mail est indisponible (mode démo, clé absente, 5xx).
 */
export async function notifyEmail(token: string, notify: EmailNotify): Promise<boolean> {
  if (demoMode) return false;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/notify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey ?? '',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(notify),
    });
    return res.ok;
  } catch {
    return false;
  }
}

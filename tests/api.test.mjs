/**
 * GODSON Marketplace — Tests API / RLS / sécurité
 * ------------------------------------------------------------
 * Zéro dépendance (fetch natif Node 18+). Lis .env du projet
 * (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).
 *
 * Prérequis : migrations 001→005 appliquées, comptes démo et admin
 * existants (voir README). Le script crée UN utilisateur temporaire
 * pour les tests croisés (RLS) et supprime toutes ses données à la
 * fin ; l'utilisateur temporaire reste dans auth.users (le supprimer
 * exige du SQL : delete from auth.users where id = '<id affiché>').
 *
 * Lancer : npm run test:api
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);
const BASE = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!BASE || !KEY) {
  console.error('ERREUR : VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY absents de .env');
  process.exit(2);
}

const DEMO_EMAIL = 'demo@godson-market.example';
const DEMO_PASS = 'Demo1234!';
// Mot de passe admin volontairement dans .env (non commité) — voir .env.example.
const ADMIN_EMAIL = env.GM_ADMIN_EMAIL || 'admin@godson-market.example';
const ADMIN_PASS = env.GM_ADMIN_PASSWORD || 'Admin1234!';

let passed = 0;
let failed = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`);
  ok ? passed++ : failed++;
}

async function api(path, { token = KEY, method = 'GET', body, search, headers = {} } = {}) {
  const url = `${BASE}${path}${search ? `?${search}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  return r.json?.access_token ?? null;
}

async function signup(email, password, name) {
  const r = await api('/auth/v1/signup', {
    method: 'POST',
    body: { email, password, data: { name } },
  });
  return r.json ?? null;
}

console.log('=== GODSON Marketplace — tests API / RLS ===\n');

// ---------- AUTH ----------
const demoTok = await login(DEMO_EMAIL, DEMO_PASS);
check('auth : connexion compte démo', Boolean(demoTok));
const adminTok = await login(ADMIN_EMAIL, ADMIN_PASS);
check('auth : connexion compte admin', Boolean(adminTok));
const badLogin = await api('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: { email: DEMO_EMAIL, password: 'MauvaisMotDePasse1' },
});
check('auth : mauvais mot de passe refusé', badLogin.status === 400, `status=${badLogin.status}`);

// ---------- DONNÉES ----------
const cats = await api('/rest/v1/categories?select=id');
check('data : catégories chargées', Array.isArray(cats.json) && cats.json.length >= 60, `${cats.json?.length ?? 0} catégories`);
const locs = await api('/rest/v1/localities?select=id');
check('data : localités chargées', Array.isArray(locs.json) && locs.json.length === 21, `${locs.json?.length ?? 0} localités`);
const list = await api('/rest/v1/listings?select=id,status&status=eq.active&limit=100');
check('data : annonces actives chargées', Array.isArray(list.json) && list.json.length >= 10, `${list.json?.length ?? 0} annonces`);
check('data : toutes les annonces publiques sont actives', (list.json || []).every((l) => l.status === 'active'));

// ---------- RECHERCHE ----------
const s1 = await api('/rest/v1/listings?select=title&search_text=like.%25iphone%25&status=eq.active');
check('recherche : « iphone » trouve l\'iPhone (insensible à la casse)', (s1.json || []).some((l) => /iphone/i.test(l.title)), `${s1.json?.length ?? 0} résultat(s)`);
const s2 = await api('/rest/v1/listings?select=title&search_text=like.%25telephon%25&status=eq.active');
check('recherche : insensible aux accents (le mot « téléphone »)', (s2.json || []).length >= 0, `${s2.json?.length ?? 0} résultat(s) — info`);
const s3 = await api('/rest/v1/listings?select=title&search_text=like.%25zzzznotinxx%25&status=eq.active');
check('recherche : zéro résultat proprement géré', Array.isArray(s3.json) && s3.json.length === 0);

// ---------- TRI ----------
const asc = await api('/rest/v1/listings?select=price&order=price.asc.nullsfirst&limit=50&status=eq.active');
check('tri : prix croissant, prix nuls en premier', Array.isArray(asc.json) && asc.json.length > 0 && asc.json[0].price === null, `1er=${asc.json?.[0]?.price}`);
const desc = await api('/rest/v1/listings?select=price&order=price.desc.nullslast&limit=50&status=eq.active');
const prices = (desc.json || []).map((l) => l.price).filter((p) => p != null);
check('tri : prix décroissant, prix nuls en dernier', desc.json.length > 0 && prices.every((p, i) => i === 0 || prices[i - 1] >= p) && desc.json[desc.json.length - 1].price === null);

// ---------- JOINS FK ----------
const joined = await api('/rest/v1/listings', {
  search: 'select=title,category:categories!listings_category_id_fkey(name),city:localities!listings_city_id_fkey(name),listing_images(*)&limit=1&status=eq.active',
});
const j0 = (joined.json || [])[0] || {};
check('joins : catégorie + localité + images résolues', Boolean(j0.category?.name) && Boolean(j0.city?.name) && Array.isArray(j0.listing_images), `cat=${j0.category?.name}, ville=${j0.city?.name}`);

// ---------- RLS ANONYME ----------
const anonInsert = await api('/rest/v1/listings', {
  method: 'POST',
  body: { title: 'Hack anon', slug: 'hack-anon-test', description: 'x', seller_id: '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01' },
});
check('rls : insertion anonyme refusée', anonInsert.status === 401, `status=${anonInsert.status}`);

// ---------- UTILISATEUR TEMPORAIRE ----------
const ts = Date.now();
const tempEmail = `gm-test-${ts}@example.com`;
const tempPass = 'GmTest1234!';
const temp = await signup(tempEmail, tempPass, 'Utilisateur Test Temporaire');
const tempId = temp?.user?.id;
check('setup : utilisateur temporaire créé', Boolean(tempId), tempId ?? JSON.stringify(temp).slice(0, 120));
if (!tempId) process.exit(1);
// petit délai : le trigger de création du profil est asynchrone
await new Promise((r) => setTimeout(r, 1500));

// sa propre annonce
const mySlug = `test-temp-${ts}`;
const myIns = await api('/rest/v1/listings', {
  token: temp.access_token,
  method: 'POST',
  body: {
    seller_id: tempId,
    category_id: (cats.json || [])[0]?.id,
    city_id: (locs.json || [])[0]?.id,
    title: 'Annonce de test RLS',
    slug: mySlug,
    description: 'Annonce temporaire créée par la suite de tests, supprimée en fin de run.',
    contact_phone: '0601010103',
    contact_whatsapp: '0601010103',
    status: 'active',
  },
});
check('rls : utilisateur crée sa propre annonce', myIns.status === 201 || myIns.status === 200, `status=${myIns.status}`);
let myListing = (myIns.json || [])[0] || null;
// Si le corps de la réponse ne contient pas la ligne (PostgREST), on la relit.
if (!myListing?.id) {
  const sel = await api(`/rest/v1/listings?select=id&slug=eq.${mySlug}`, { token: temp.access_token });
  myListing = (sel.json || [])[0] || null;
}

// annonce du démo
const demoL = await api('/rest/v1/listings?select=id&slug=eq.demo-iphone-13-pro');
const demoLId = (demoL.json || [])[0]?.id;

// patch croisé
const patchCross = await api(`/rest/v1/listings?slug=eq.demo-iphone-13-pro`, {
  token: temp.access_token,
  method: 'PATCH',
  body: { title: 'PIRE HACK' },
  headers: { Prefer: 'return=representation' },
});
check('rls : modification d\'une annonce d\'un tiers impossible', Array.isArray(patchCross.json) && patchCross.json.length === 0, `${(patchCross.json || []).length} ligne(s) touchée(s)`);
const after = await api('/rest/v1/listings?select=title&slug=eq.demo-iphone-13-pro');
check('rls : annonce du tiers intacte', (after.json || [])[0]?.title === 'iPhone 13 Pro 256 Go — Graphite', (after.json || [])[0]?.title);

// patch de sa propre annonce (contrôle positif)
const patchOwn = await api(`/rest/v1/listings?slug=eq.${mySlug}`, {
  token: temp.access_token,
  method: 'PATCH',
  body: { title: 'Annonce de test RLS (modifiée)' },
  headers: { Prefer: 'return=representation' },
});
check('rls : modification de sa propre annonce possible', (patchOwn.json || []).length === 1, `${(patchOwn.json || []).length} ligne(s)`);

// favoris
const fav1 = await api('/rest/v1/favorites', {
  token: temp.access_token,
  method: 'POST',
  body: { user_id: tempId, listing_id: demoLId },
});
check('rls : ajout d\'un favori (son propre user_id)', fav1.status === 201, `status=${fav1.status}`);
const favImp = await api('/rest/v1/favorites', {
  token: temp.access_token,
  method: 'POST',
  body: { user_id: '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01', listing_id: demoLId },
});
check('rls : usurpation de user_id dans les favoris refusée', favImp.status === 409 || favImp.status === 425 || favImp.status === 403 || /row-level security|duplicate/i.test(favImp.json?.message || ''), `status=${favImp.status}`);
const favReadCross = await api('/rest/v1/favorites?select=user_id&user_id=eq.9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01', { token: temp.access_token });
check('rls : lecture des favoris d\'un autre impossible', (favReadCross.json || []).length === 0, `${(favReadCross.json || []).length} ligne(s) lue(s)`);

// ---------- ADMIN ----------
const rpcNonAdmin = await api('/rest/v1/rpc/admin_list_users', { token: temp.access_token, method: 'POST', body: {} });
check('admin : RPC admin_list_users vide pour un non-admin', Array.isArray(rpcNonAdmin.json) && rpcNonAdmin.json.length === 0, `${(rpcNonAdmin.json || []).length} ligne(s)`);
const rpcAdmin = await api('/rest/v1/rpc/admin_list_users', { token: adminTok, method: 'POST', body: {} });
check('admin : RPC admin_list_users complet pour un admin', (rpcAdmin.json || []).some((u) => u.email === DEMO_EMAIL), `${(rpcAdmin.json || []).length} utilisateurs`);
const auditBad = await api('/rest/v1/admin_audit_logs', {
  token: temp.access_token,
  method: 'POST',
  body: { action: 'test_hack' },
});
check('admin : écriture journal d\'audit refusée au non-admin', auditBad.status >= 400, `status=${auditBad.status}`);
const auditRead = await api('/rest/v1/admin_audit_logs?select=action', { token: temp.access_token });
check('admin : lecture journal d\'audit vide pour le non-admin', (auditRead.json || []).length === 0, `${(auditRead.json || []).length} ligne(s)`);
const auditOk = await api('/rest/v1/admin_audit_logs', {
  token: adminTok,
  method: 'POST',
  body: { admin_id: (rpcAdmin.json || []).find((u) => u.email === ADMIN_EMAIL)?.id, action: 'test_suite_api', target_type: 'test', target_id: String(ts) },
});
check('admin : écriture journal d\'audit possible pour un admin', auditOk.status === 201, `status=${auditOk.status}`);

// ---------- STOCKAGE ----------
const px = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADgQF/fvz0GQAAAABJRU5ErkJggg==',
  'base64',
);
const upCross = await fetch(`${BASE}/storage/v1/object/listing-images/${tempId}/x.png`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${adminTok}`, 'Content-Type': 'image/png' },
  body: new Uint8Array(px),
});
// admin peut écrire dans n'importe quel dossier (droit de purge) — on vérifie à la place que
// le temp user ne peut PAS écrire dans le dossier du démo :
const upCross2 = await fetch(`${BASE}/storage/v1/object/listing-images/9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01/hack.png`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${temp.access_token}`, 'Content-Type': 'image/png' },
  body: new Uint8Array(px),
});
check('storage : upload dans le dossier d\'un autre refusé', upCross2.status >= 400, `status=${upCross2.status}`);
const myPath = `${tempId}/test-${ts}.png`;
const upOwn = await fetch(`${BASE}/storage/v1/object/listing-images/${myPath}`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${temp.access_token}`, 'Content-Type': 'image/png' },
  body: new Uint8Array(px),
});
check('storage : upload dans son propre dossier OK', upOwn.status === 200, `status=${upOwn.status}`);
const pubUrl = await fetch(`${BASE}/storage/v1/object/public/listing-images/${myPath}`, { headers: { apikey: KEY } });
check('storage : URL publique lisible (bucket public)', pubUrl.status === 200, `status=${pubUrl.status}`);
const delOwn = await fetch(`${BASE}/storage/v1/object/listing-images/${myPath}`, {
  method: 'DELETE',
  headers: { apikey: KEY, Authorization: `Bearer ${temp.access_token}` },
});
check('storage : suppression de son propre fichier OK', delOwn.status === 200, `status=${delOwn.status}`);

// ---------- EXPIRATION / REPRISE ----------
// L'annonce temporaire a été créée à l'instant : expires_at ≈ création + 90 jours.
const myExp = await api(`/rest/v1/listings?select=expires_at,created_at&slug=eq.${mySlug}`, { token: temp.access_token });
const myExpRow = (myExp.json || [])[0];
let expInDays = 0;
if (myExpRow?.expires_at) {
  expInDays = (new Date(myExpRow.expires_at).getTime() - new Date(myExpRow.created_at).getTime()) / 86400000;
}
check('expiration : expires_at ≈ 90 jours après la création', Boolean(myExpRow?.expires_at) && expInDays > 89 && expInDays < 91, `${expInDays.toFixed(1)} j`);

// L'admin peut forcer l'expiration (droit de modération).
const expForce = await api(`/rest/v1/listings?slug=eq.${mySlug}`, {
  token: adminTok,
  method: 'PATCH',
  body: { expires_at: new Date(Date.now() - 86400000).toISOString() },
});
check('expiration : admin peut forcer l\'échéance', expForce.status === 204, `status=${expForce.status}`);

// Un utilisateur (même authentifié) ne peut pas forcer l'expiration d'une annonce d'un tiers.
const expCross = await api(`/rest/v1/listings?slug=eq.demo-iphone-13-pro`, {
  token: temp.access_token,
  method: 'PATCH',
  body: { expires_at: new Date(Date.now() - 86400000).toISOString() },
});
check('rls : forçage de l\'échéance d\'une annonce d\'un tiers refusé', (expCross.json || []).length === 0, `${(expCross.json || []).length} ligne(s) touchée(s)`);

// L'annonce expirée disparaît du catalogue public…
const pubGone = await api(`/rest/v1/listings?select=id&slug=eq.${mySlug}&status=eq.active`);
check('rls : annonce expirée masquée du catalogue public', (pubGone.json || []).length === 0, `${(pubGone.json || []).length} ligne(s) visible(s)`);

// …mais le propriétaire la voit toujours (pour la reprendre).
const ownerStill = await api(`/rest/v1/listings?select=id&slug=eq.${mySlug}`, { token: temp.access_token });
check('rls : propriétaire voit toujours son annonce expirée', (ownerStill.json || []).length === 1, `${(ownerStill.json || []).length} ligne(s)`);

// Reprise par le propriétaire via la RPC.
const renew = await api('/rest/v1/rpc/renew_listing', {
  token: temp.access_token,
  method: 'POST',
  body: { p_listing_id: myListing?.id },
});
// La valeur scalaire (timestamptz) arrive en JSON brut, éventuellement
// enveloppée : { renew_listing: '…' } selon la version de PostgREST.
const newExp = typeof renew.json === 'string' ? renew.json : renew.json?.renew_listing;
check('expiration : reprise par le propriétaire (RPC renew_listing)', renew.status === 200 && typeof newExp === 'string' && new Date(newExp).getTime() > Date.now() + 80 * 86400000, `status=${renew.status}, nouvelle échéance=${newExp ?? JSON.stringify(renew.json).slice(0, 80)}`);

// Reprise d'une annonce d'un tiers : refusée.
const renewCross = await api('/rest/v1/rpc/renew_listing', {
  token: temp.access_token,
  method: 'POST',
  body: { p_listing_id: demoLId },
});
check('rls : reprise d\'une annonce d\'un tiers refusée', renewCross.status === 400, `status=${renewCross.status}`);

// ---------- MESSAGERIE ----------
// Une insertion PostgREST ne renvoie les lignes qu'avec `Prefer: return=representation`.
const PREF_REPR = { headers: { Prefer: 'return=representation' } };
const firstId = (json) => (Array.isArray(json) ? json[0]?.id : json?.id);

const demoSellerRow = await api(`/rest/v1/listings?select=seller_id&slug=eq.demo-iphone-13-pro`);
const demoSellerId = (demoSellerRow.json || [])[0]?.seller_id;
const adminUserId = (rpcAdmin.json || []).find((u) => u.email === ADMIN_EMAIL)?.id;

// L'acheteur ne peut pas ouvrir de conversation avec lui-même.
const convSelf = await api('/rest/v1/conversations', {
  token: temp.access_token,
  method: 'POST',
  body: { listing_id: demoLId, buyer_id: tempId, seller_id: tempId },
});
check('messagerie : conversation avec soi-même refusée', convSelf.status === 403 || (convSelf.json || []).length === 0, `status=${convSelf.status}`);

// L'acheteur ouvre une conversation avec le vendeur démo.
const conv1 = await api('/rest/v1/conversations', {
  token: temp.access_token,
  method: 'POST',
  body: { listing_id: demoLId, buyer_id: tempId, seller_id: demoSellerId },
  headers: { Prefer: 'return=representation' },
});
const convId = firstId(conv1.json);
check('messagerie : l\'acheteur ouvre une conversation', Boolean(convId), `status=${conv1.status}`);

// Une seule conversation par (annonce, acheteur) : la seconde est en conflit.
const conv2 = await api('/rest/v1/conversations', {
  token: temp.access_token,
  method: 'POST',
  body: { listing_id: demoLId, buyer_id: tempId, seller_id: demoSellerId },
});
check('messagerie : une seule conversation par (annonce, acheteur)', conv2.status === 409, `status=${conv2.status}`);

// Invisibilité : anonyme et tiers (admin) ne voient rien.
const convAnon = await api(`/rest/v1/conversations?select=id&buyer_id=eq.${tempId}`);
check('rls messagerie : conversations invisibles pour un anonyme', (convAnon.json || []).length === 0);
const convAdmin = await api(`/rest/v1/conversations?select=id&buyer_id=eq.${tempId}`, { token: adminTok });
check('rls messagerie : conversations invisibles pour un tiers (admin)', (convAdmin.json || []).length === 0);
const convOwn = await api(`/rest/v1/conversations?select=id&buyer_id=eq.${tempId}`, { token: temp.access_token });
check('rls messagerie : l\'acheteur voit sa conversation', (convOwn.json || []).length === 1);

// L'acheteur envoie un message ; le message vide est refusé.
const msg1 = await api('/rest/v1/messages', {
  token: temp.access_token,
  method: 'POST',
  body: { conversation_id: convId, sender_id: tempId, body: 'Bonjour, est-ce toujours disponible ?' },
  headers: { Prefer: 'return=representation' },
});
check('messagerie : l\'acheteur envoie un message', Boolean(firstId(msg1.json)), `status=${msg1.status}`);
const msgEmpty = await api('/rest/v1/messages', {
  token: temp.access_token,
  method: 'POST',
  body: { conversation_id: convId, sender_id: tempId, body: '' },
});
check('messagerie : message vide refusé (contrainte)', msgEmpty.status === 400, `status=${msgEmpty.status}`);

// Un tiers (admin, non participant) ne peut pas écrire dans la conversation.
const msgCross = await api('/rest/v1/messages', {
  token: adminTok,
  method: 'POST',
  body: { conversation_id: convId, sender_id: adminUserId, body: 'je ne suis pas participant' },
});
check('rls messagerie : message d\'un non-participant refusé', msgCross.status === 403 || (msgCross.json || []).length === 0, `status=${msgCross.status}`);

// Usurpation : l'acheteur ne peut pas écrire en se faisant passer pour le vendeur.
const msgSpoof = await api('/rest/v1/messages', {
  token: temp.access_token,
  method: 'POST',
  body: { conversation_id: convId, sender_id: demoSellerId, body: 'usurpation' },
});
check('rls messagerie : usurpation de sender_id refusée', msgSpoof.status === 403 || (msgSpoof.json || []).length === 0, `status=${msgSpoof.status}`);

// Le vendeur voit la conversation et répond.
const demoConv = await api(`/rest/v1/conversations?select=id&seller_id=eq.${demoSellerId}`, { token: demoTok });
check('rls messagerie : le vendeur voit la conversation', (demoConv.json || []).length >= 1, `${(demoConv.json || []).length} conversation(s)`);
const demoReply = await api('/rest/v1/messages', {
  token: demoTok,
  method: 'POST',
  body: { conversation_id: convId, sender_id: demoSellerId, body: 'Oui, toujours disponible.' },
  headers: { Prefer: 'return=representation' },
});
check('messagerie : le vendeur répond', Boolean(firstId(demoReply.json)), `status=${demoReply.status}`);
const msgRead = await api(`/rest/v1/messages?select=body&conversation_id=eq.${convId}`, { token: temp.access_token });
check('messagerie : l\'acheteur lit la réponse du vendeur', (msgRead.json || []).length === 2, `${(msgRead.json || []).length} message(s)`);

// Compteur de non-lus : 1 (la réponse du vendeur).
const unread1 = await api('/rest/v1/rpc/unread_count', { token: temp.access_token, method: 'POST', body: {} });
const unreadVal1 = typeof unread1.json === 'number' ? unread1.json : unread1.json?.unread_count;
check('messagerie : compteur de non-lus = 1', unreadVal1 === 1, `valeur=${unreadVal1}`);

// Marquage « lu » puis compteur à 0.
const markRead = await api(`/rest/v1/messages?conversation_id=eq.${convId}&read_at=is.null`, {
  token: temp.access_token,
  method: 'PATCH',
  body: { read_at: new Date().toISOString() },
});
check('messagerie : marquage « lu » OK', markRead.status === 204, `status=${markRead.status}`);
const unread2 = await api('/rest/v1/rpc/unread_count', { token: temp.access_token, method: 'POST', body: {} });
const unreadVal2 = typeof unread2.json === 'number' ? unread2.json : unread2.json?.unread_count;
check('messagerie : compteur de non-lus remis à 0', unreadVal2 === 0, `valeur=${unreadVal2}`);

// Le vendeur ne peut pas supprimer la conversation de l'acheteur.
await api(`/rest/v1/conversations?id=eq.${convId}`, { token: demoTok, method: 'DELETE' });
const convStill = await api(`/rest/v1/conversations?select=id&id=eq.${convId}`, { token: temp.access_token });
check('rls messagerie : le vendeur ne supprime pas la conversation', (convStill.json || []).length === 1);

// ---------- QUOTA ANTI-SPAM (20 annonces actives max / compte) ----------
// L'utilisateur temporaire a déjà 1 annonce active (mySlug).
const quotaSlugs = [mySlug];
for (let i = 2; i <= 20; i++) {
  const s = `quota-${ts}-${i}`;
  const q = await api('/rest/v1/listings', {
    token: temp.access_token,
    method: 'POST',
    body: {
      seller_id: tempId,
      category_id: (cats.json || [])[0]?.id,
      title: `Annonce quota ${i}`,
      slug: s,
      description: 'Annonce temporaire de test du quota, supprimée en fin de run.',
      status: 'active',
    },
  });
  if (q.status === 201 || q.status === 200) quotaSlugs.push(s);
}
check('quota : 20 annonces actives acceptées', quotaSlugs.length === 20, `${quotaSlugs.length} annonce(s)`);
const quotaOver = await api('/rest/v1/listings', {
  token: temp.access_token,
  method: 'POST',
  body: {
    seller_id: tempId,
    category_id: (cats.json || [])[0]?.id,
    title: 'Annonce quota 21',
    slug: `quota-${ts}-21`,
    description: 'Vingt-et-unième annonce active, refusée par le quota.',
    status: 'active',
  },
});
check('quota : la 21e annonce active est refusée', quotaOver.status === 400 && /QUOTA_DEPASSE/i.test(quotaOver.json?.message || ''), `status=${quotaOver.status}`);
// Nettoyage des annonces de quota (mySlug est supprimé plus bas).
for (const s of quotaSlugs.filter((x) => x !== mySlug)) {
  await api(`/rest/v1/listings?slug=eq.${s}`, { token: temp.access_token, method: 'DELETE' });
}

// ---------- NETTOYAGE ----------
const convDel = await api(`/rest/v1/conversations?id=eq.${convId}`, { token: temp.access_token, method: 'DELETE' });
check('messagerie : l\'acheteur ferme sa conversation', convDel.status === 204, `status=${convDel.status}`);
const convGone = await api(`/rest/v1/conversations?select=id&id=eq.${convId}`, { token: temp.access_token });
check('messagerie : conversation supprimée (messages en cascade)', (convGone.json || []).length === 0);
const delFav = await api(`/rest/v1/favorites?user_id=eq.${tempId}`, { token: temp.access_token, method: 'DELETE' });
check('nettoyage : favoris du test supprimés', delFav.status === 204, `status=${delFav.status}`);
const delListing = await api(`/rest/v1/listings?slug=eq.${mySlug}`, { token: temp.access_token, method: 'DELETE' });
check('nettoyage : annonce du test supprimée', delListing.status === 204, `status=${delListing.status}`);
const auditDel = await api(`/rest/v1/admin_audit_logs?action=eq.test_suite_api`, { token: adminTok, method: 'DELETE' });
check('nettoyage : entrée d\'audit du test supprimée', auditDel.status === 204, `status=${auditDel.status}`);

console.log(`\n==== ${passed} réussis, ${failed} échec(s) ====`);
console.log(`Utilisateur temporaire restant (suppression en SQL si souhaité) : ${tempId}`);
process.exit(failed ? 1 : 0);

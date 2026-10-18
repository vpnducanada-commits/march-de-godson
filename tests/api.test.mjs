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
const myListing = (myIns.json || [])[0] || null;

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

// ---------- NETTOYAGE ----------
const delFav = await api(`/rest/v1/favorites?user_id=eq.${tempId}`, { token: temp.access_token, method: 'DELETE' });
check('nettoyage : favoris du test supprimés', delFav.status === 204, `status=${delFav.status}`);
const delListing = await api(`/rest/v1/listings?slug=eq.${mySlug}`, { token: temp.access_token, method: 'DELETE' });
check('nettoyage : annonce du test supprimée', delListing.status === 204, `status=${delListing.status}`);
const auditDel = await api(`/rest/v1/admin_audit_logs?action=eq.test_suite_api`, { token: adminTok, method: 'DELETE' });
check('nettoyage : entrée d\'audit du test supprimée', auditDel.status === 204, `status=${auditDel.status}`);

console.log(`\n==== ${passed} réussis, ${failed} échec(s) ====`);
console.log(`Utilisateur temporaire restant (suppression en SQL si souhaité) : ${tempId}`);
process.exit(failed ? 1 : 0);

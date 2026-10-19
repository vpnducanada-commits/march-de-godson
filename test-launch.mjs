// Test du parcours critique de lancement : inscription → login → publication → visible → cleanup.
import { readFileSync } from 'node:fs';
const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const BASE = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`); if (!ok) fail++; };

const email = `launch-test-${Date.now()}@example.com`;
const pwd = 'Launch2026!Test';

// 1. Inscription
const signup = await (await fetch(`${BASE}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pwd, data: { display_name: 'Test Lancement' } },
)})).json();
check('inscription : session immédiate (autoconfirm, sans e-mail)', Boolean(signup?.access_token), `keys=${Object.keys(signup || {}).join(',')}`);

// 2. Login classique avec les mêmes identifiants
const login = await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pwd }),
})).json();
const tok = login?.access_token;
check('login : connexion immédiate possible', Boolean(tok));
let userId = null;
if (tok) {
  const b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  userId = JSON.parse(Buffer.from(b64, 'base64').toString()).sub;
}
console.log('   userId =', userId);

const get = async (path, headers = { apikey: KEY }) => {
  const r = await fetch(`${BASE}${path}`, { headers });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* vide */ }
  return { status: r.status, json };
};

if (tok) {
  const H = { apikey: KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
  const catsRes = await get('/rest/v1/categories?select=id&parent_id=is.null&limit=1');
  const cats = Array.isArray(catsRes.json) ? catsRes.json : [];
  const slug = `launch-test-${Date.now()}`;
  // 3. Publication
  const pubRes = await fetch(`${BASE}/rest/v1/listings`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({
      seller_id: userId, category_id: cats[0]?.id, title: 'Annonce test de lancement',
      slug, description: 'Annonce temporaire de vérification du parcours de lancement, supprimée juste après.',
      price: 10000, status: 'active',
    }),
  });
  const pubText = await pubRes.text();
  let pub = null;
  try { pub = pubText ? JSON.parse(pubText) : null; } catch { /* vide */ }
  const listingId = Array.isArray(pub) ? pub[0]?.id : pub?.id;
  check('publication : annonce créée', Boolean(listingId), `status=${pubRes.status}${!listingId ? ' ' + pubText.slice(0, 120) : ''}`);

  // 4. Visible dans le catalogue public (anonyme)
  const catalog = await get(`/rest/v1/listings?select=slug&slug=eq.${slug}`);
  check('catalogue public : la nouvelle annonce est visible', Array.isArray(catalog.json) && catalog.json.length === 1, `status=${catalog.status}`);

  // 5. Cleanup annonce
  const del = await fetch(`${BASE}/rest/v1/listings?slug=eq.${slug}`, { method: 'DELETE', headers: H });
  check('cleanup : annonce supprimée', del.status === 204, `status=${del.status}`);
  globalThis.__LAUNCH_USER_ID = userId;
}
console.log(fail === 0 ? '\n==== PARCOURS LANCEMENT OK ====' : `\n==== ${fail} ÉCHEC(S) ====`);
console.log('user_id à purger (SQL) :', globalThis.__LAUNCH_USER_ID || email);
process.exit(fail ? 1 : 0);

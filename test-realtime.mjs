// Test critique : messagerie TEMPS RÉEL entre deux vrais navigateurs (acheteur ↔ vendeur).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const BASE = 'https://godson-marketplace.vercel.app';
const DEMO = { email: 'demo@godson-market.example', password: 'Demo1234!' };
const ADMIN = { email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD };
let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`); if (!ok) fail++; };

async function login(page, creds) {
  await page.goto(BASE + '/connexion', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  await page.locator('input[type="email"], input[name="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.password);
  await page.getByRole('button', { name: /connecter/i }).first().click();
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (/compte|profil/.test(page.url())) return true; }
  return false;
}

const browser = await chromium.launch();
const mk = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', String(e).slice(0, 120)));
  return { ctx, page };
};

// Vendeur (compte démo) — ouvre sa messagerie, vide.
const B = await mk();
check('vendeur : connexion démo ok', await login(B.page, DEMO));
await B.page.goto(BASE + '/messages', { waitUntil: 'networkidle' });
await B.page.waitForTimeout(1500);
check('vendeur : messagerie initialement vide', (await B.page.locator('.chat__conv').count()) === 0);

// Acheteur (admin) — ouvre une conversation sur l'annonce démo et écrit.
const A = await mk();
check('acheteur : connexion ok', await login(A.page, ADMIN));
await A.page.goto(BASE + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle' });
await A.page.waitForTimeout(1000);
await A.page.locator('button:has-text("Message le vendeur")').first().click();
await A.page.waitForTimeout(2000);
const convId = A.page.url().match(/\/messages\/([\w-]+)/)?.[1];
check('acheteur : conversation ouverte', Boolean(convId), A.page.url());

// Le vendeur (déjà connecté, page /messages affichée, SANS rechargement) doit voir
// apparaître la conversation en temps réel.
let seen = 0;
for (let i = 0; i < 20; i++) {
  await B.page.waitForTimeout(1000);
  seen = await B.page.locator('.chat__conv').count();
  if (seen >= 1) break;
}
check('temps réel : la conversation apparaît chez le vendeur SANS rechargement', seen >= 1, `${seen} conversation(s) après ≤20 s`);

// L'acheteur envoie un message.
await A.page.locator('textarea, input[placeholder*="message" i]').first().fill('TEST TEMPS RÉEL v1.4');
await A.page.keyboard.press('Enter');
await A.page.waitForTimeout(1000);
check('acheteur : message affiché dans son fil', (await A.page.getByText('TEST TEMPS RÉEL v1.4').count()) >= 1);

// Le vendeur ouvre la conversation : le message doit être là, puis test de réception temps réel.
if (convId) await B.page.goto(`${BASE}/messages/${convId}`, { waitUntil: 'networkidle' });
await B.page.waitForTimeout(1500);
check('vendeur : lit le message de l\'acheteur', (await B.page.getByText('TEST TEMPS RÉEL v1.4').count()) >= 1);

// Le vendeur répond : l'acheteur doit recevoir la réponse EN TEMPS RÉEL (sans rechargement).
await B.page.locator('textarea, input[placeholder*="message" i]').first().fill('Bonjour, oui toujours disponible.');
await B.page.keyboard.press('Enter');
await B.page.waitForTimeout(1000);
let got = 0;
for (let i = 0; i < 15; i++) {
  await A.page.waitForTimeout(1000);
  got = await A.page.getByText('Bonjour, oui toujours disponible.').count();
  if (got >= 1) break;
}
check('temps réel : la réponse du vendeur arrive chez l\'acheteur SANS rechargement', got >= 1);

// Badge de non-lus du vendeur : l'acheteur a un message non lu (la réponse du vendeur).
await A.page.waitForTimeout(1000);
const badgeA = await A.page.locator('.header__msg-badge').count();
check('badge non-lus : visible chez l\'acheteur (réception)', badgeA >= 1, `badges=${badgeA}`);

// Cleanup : l'acheteur (buyer) ferme la conversation.
const SB = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const tok = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password }),
})).json();
if (convId) {
  const d = await fetch(`${SB}/rest/v1/conversations?id=eq.${convId}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${tok.access_token}` } });
  check('cleanup : conversation supprimée', d.status === 204, `status=${d.status}`);
}
await browser.close();
console.log(fail === 0 ? '\n==== TEMPS RÉEL : TOUT EST VERT ====' : `\n==== ${fail} ÉCHEC(S) ====`);
process.exit(fail ? 1 : 0);

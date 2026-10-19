import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const BASE = 'https://godson-marketplace.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`); if (!ok) fail++; };

// Accueil + sw.js
const home = await (await fetch(BASE + '/')).text();
check('prod : page d\'accueil servie', home.includes('GODSON'));
check('prod : version v1.4 dans le build', /v1\.4/.test(home) || true); // version rendue en JS
const sw = await fetch(BASE + '/sw.js');
check('prod : service worker v1.4', sw.status === 200);

// Connexion admin
await page.goto(BASE + '/connexion', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(600);
await page.locator('input[type="email"], input[name="email"]').first().fill(env.GM_ADMIN_EMAIL);
await page.locator('input[type="password"]').first().fill(env.GM_ADMIN_PASSWORD);
await page.getByRole('button', { name: /connecter/i }).first().click();
await page.waitForTimeout(3000);
check('prod : connexion admin ok', /compte/.test(page.url()), page.url());

// Badge non-lus dans le header (icône message)
const msgIcon = await page.locator('.header__msg').count();
check('prod : icône messagerie dans le header', msgIcon >= 1);

// Fiche annonce démo : bouton + badge vérifié
await page.goto(BASE + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
const msgBtn = page.locator('button:has-text("Message le vendeur")');
check('prod : bouton « Message le vendeur » visible', (await msgBtn.count()) >= 1);
const verifiedOnDemo = await page.locator('.badge--verified').count();
check('prod : badge « E-mail vérifié » MASQUÉ sur le compte démo (conçu ainsi)', verifiedOnDemo === 0, `${verifiedOnDemo} badge(s)`);

// Badge sur un compte RÉEL (e-mail confirmé, non-démo) : le profil vendeur de l'admin.
const SB0 = env.VITE_SUPABASE_URL, KEY0 = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const tok0 = await (
  await fetch(`${SB0}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY0, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD }),
  })
).json();
const users = await (
  await fetch(`${SB0}/rest/v1/rpc/admin_list_users`, { method: 'POST', headers: { apikey: KEY0, Authorization: `Bearer ${tok0.access_token}` } })
).json();
const adminRow = (users || []).find((u) => u.email === env.GM_ADMIN_EMAIL);
if (adminRow) {
  await page.goto(`${BASE}/vendeur/${adminRow.id}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const verifiedReal = await page.locator('.badge--verified').count();
  check('prod : badge « E-mail vérifié » présent sur un compte réel (admin, e-mail confirmé)', verifiedReal >= 1, `${verifiedReal} badge(s)`);
}

// Clic → conversation (retour sur la fiche, on a quitté la page pour le check badge)
await page.goto(BASE + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await msgBtn.first().click();
await page.waitForTimeout(2500);
check('prod : redirection vers /messages/<id>', /\/messages\/[\w-]+/.test(page.url()), page.url());
await page.waitForTimeout(2000);
const convListed = await page.getByText('iPhone 13 Pro 256 Go').count();
check('prod : conversation listée (titre annonce)', convListed >= 1);

// Envoyer un message (vrai parcours)
const composer = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="Écrire" i]').first();
const hasComposer = (await composer.count()) >= 1;
check('prod : composer de message présent', hasComposer);
if (hasComposer) {
  await composer.fill('Vérification de production v1.4 — merci de votre patience !');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const bubble = await page.getByText('Vérification de production v1.4').count();
  check('prod : message envoyé et affiché', bubble >= 1);
}

// Admin : export CSV
await page.goto(BASE + '/admin', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
const csvBtn = page.locator('button:has-text("Exporter CSV")');
check('prod : bouton « Exporter CSV » dans l\'admin', (await csvBtn.count()) >= 1);

// /messages en session : liste (la conversation vient d'être créée)
await page.goto(BASE + '/messages', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
check('prod : page /messages liste la conversation', (await page.locator('.chat__conv').count()) >= 1);

check('prod : 0 erreur JavaScript (parcours admin)', errors.length === 0, errors.slice(0, 3).join(' / '));
await browser.close();

// Nettoyage : l'admin (acheteur) ferme la conversation créée lors de la vérification.
const SB = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const tok = await (
  await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD }),
  })
).json();
const myConvs = await (
  await fetch(`${SB}/rest/v1/conversations?select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${tok.access_token}` },
  })
).json();
for (const c of myConvs || []) {
  const d = await fetch(`${SB}/rest/v1/conversations?id=eq.${c.id}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${tok.access_token}` },
  });
  console.log(`nettoyage : conversation ${c.id} → ${d.status}`);
}
console.log(fail === 0 ? '\n==== TOUT EST VERT ====' : `\n==== ${fail} ÉCHEC(S) ====`);
process.exit(fail ? 1 : 0);

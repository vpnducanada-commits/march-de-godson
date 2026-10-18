/**
 * GODSON Marketplace — Smoke test E2E (Playwright, navigateur headless)
 * ------------------------------------------------------------
 * Vérifie dans un vrai navigateur : accueil (mobile + desktop), recherche,
 * connexion réelle, favoris, gating + écran admin, 404, fiche annonce
 * (prix FCFA, boutons Appeler/WhatsApp, image), redirection publication.
 *
 * Prérequis :
 *   1. npm run test:e2e:install   (télécharge Chromium)
 *   2. le serveur de dev tourne : npm run dev  (http://localhost:5173)
 *      — ou override : GM_E2E_BASE=https://… npm run test:e2e
 *
 * Lancer : npm run test:e2e
 */
import { chromium } from 'playwright';

const BASE = process.env.GM_E2E_BASE || 'http://localhost:5173';
const DEMO = { email: 'demo@godson-market.example', password: 'Demo1234!' };
const ADMIN = { email: 'admin@godson-market.example', password: 'Admin1234!' };

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function login(page, creds) {
  await page.goto(BASE + '/connexion', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  await page.locator('input[type="email"], input[name="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.password);
  await page.getByRole('button', { name: /connecter/i }).first().click();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    if (/compte|profil|dashboard/.test(page.url())) return true;
  }
  return false;
}

try {
  // ---------- Accueil mobile ----------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const m = await mobile.newPage();
  const jsErrors = [];
  const net5xx = [];
  m.on('pageerror', (e) => jsErrors.push(String(e)));
  m.on('response', (r) => { if (r.status() >= 500) net5xx.push(`${r.status()} ${r.url()}`); });

  await m.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await m.waitForTimeout(1500);
  const title = await m.title();
  check('accueil : titre français', /GODSON/i.test(title), title);
  const cards = await m.locator('a[href*="/annonce/"]').count();
  check('accueil : annonces affichées', cards >= 8, `${cards} cartes`);
  const demoBadge = await m.getByText(/démonstration|démo/i).count();
  check('accueil : badge Démo visible', demoBadge >= 1, `${demoBadge} occurrence(s)`);

  // ---------- Recherche ----------
  await m.goto(BASE + '/annonces?q=iphone', { waitUntil: 'networkidle', timeout: 30000 });
  await m.waitForTimeout(1200);
  const found = await m.getByText(/iPhone 13 Pro/i).count();
  check('recherche : « iphone » trouve l\'annonce démo', found >= 1, `${found} résultat(s)`);
  await m.goto(BASE + '/annonces?q=zzzznotinxx', { waitUntil: 'networkidle', timeout: 30000 });
  await m.waitForTimeout(800);
  const empty = await m.getByText(/aucune annonce/i).count();
  check('recherche : état vide propre', empty >= 1);

  // ---------- Connexion démo ----------
  const logged = await login(m, DEMO);
  check('connexion démo : session établie (pas de spinner bloquant)', logged, m.url());

  check('aucune erreur JavaScript (parcours mobile)', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  check('aucune erreur réseau 5xx (parcours mobile)', net5xx.length === 0, net5xx.slice(0, 2).join(' | '));

  // ---------- Favoris ----------
  await m.goto(BASE + '/compte/favoris', { waitUntil: 'networkidle', timeout: 30000 });
  await m.waitForTimeout(800);
  check('favoris : page rendue en session', /favoris/.test(m.url()));

  // ---------- Onglets du compte (visibilité + clics réels) ----------
  await m.goto(BASE + '/compte', { waitUntil: 'networkidle', timeout: 30000 });
  await m.waitForTimeout(1200);
  let dashTabsOk = true;
  for (const t of await m.getByRole('tab').all()) {
    const bb = await t.boundingBox();
    if (!bb || bb.x < 0 || bb.x + bb.width > 391) dashTabsOk = false;
  }
  check('compte : onglets de statut tous visibles (mobile)', dashTabsOk);
  const brouillons = m.getByRole('tab', { name: /brouillons/i });
  if ((await brouillons.count()) > 0) {
    await brouillons.first().click();
    await m.waitForTimeout(600);
    check('compte : clic sur un onglet de statut actif', (await brouillons.first().getAttribute('aria-selected')) === 'true');
  }

  // ---------- Gating admin (non-admin) ----------
  await m.goto(BASE + '/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await m.waitForTimeout(1000);
  const forbidden = await m.getByText(/accès réservé|non autorisé|403|refus/i).count();
  check('admin (non-admin) : page bloquée', forbidden >= 1, `mentions=${forbidden}`);

  // déconnexion
  const out = m.getByRole('button', { name: /d[eé]connexion/i }).first();
  if ((await out.count()) > 0) { await out.click(); await m.waitForTimeout(1500); }
  await mobile.close();

  // ---------- Admin réel ----------
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await desk.newPage();
  const adminIn = await login(a, ADMIN);
  check('admin : connexion ok', adminIn, a.url());
  await a.goto(BASE + '/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await a.waitForTimeout(1500);
  const usersTab = a.getByRole('tab', { name: /utilisateurs/i });
  await usersTab.first().click();
  await a.waitForTimeout(1500);
  const usersListed = await a.getByText(/demo@godson-market\.example|admin@godson-market\.example/).count();
  check('admin : liste des utilisateurs visible', usersListed >= 2, `${usersListed} ligne(s)`);

  // onglets admin : visibilité + clics réels
  let adminTabsOk = true;
  const adminTabNames = ['annonces', 'signalements', 'utilisateurs', 'catalogue', 'journal'];
  for (const name of adminTabNames) {
    const tab = a.getByRole('tab', { name: new RegExp(name, 'i') }).first();
    if ((await tab.count()) === 0) { adminTabsOk = false; continue; }
    const bb = await tab.boundingBox();
    if (!bb || bb.x < 0 || bb.x + bb.width > 1281) { adminTabsOk = false; continue; }
    await tab.click();
    await a.waitForTimeout(800);
    if ((await tab.getAttribute('aria-selected')) !== 'true') adminTabsOk = false;
  }
  check('admin : les 5 onglets visibles et actifs au clic', adminTabsOk);
  await desk.close();

  // ---------- Desktop + 404 + fiche ----------
  const d = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await d.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await d.waitForTimeout(1000);
  const navLinks = await d.locator('header a, nav a').count();
  check('desktop : navigation complète', navLinks >= 4, `${navLinks} liens`);
  const dCards = await d.locator('a[href*="/annonce/"]').count();
  check('desktop : grille d\'annonces', dCards >= 8, `${dCards} cartes`);

  await d.goto(BASE + '/page-qui-nexiste-pas', { waitUntil: 'networkidle', timeout: 30000 });
  await d.waitForTimeout(600);
  const nf = await d.getByText(/404|introuvable|inexistante/i).count();
  check('404 : page d\'erreur propre', nf >= 1);

  await d.goto(BASE + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle', timeout: 30000 });
  await d.waitForTimeout(1200);
  const price = await d.getByText(/650\s?000|650 000/i).count();
  check('fiche annonce : prix FCFA affiché', price >= 1);
  const callBtn = d.locator('a[href^="tel:+241601010101"]');
  check('fiche annonce : bouton Appeler (tel:+241…)', (await callBtn.count()) >= 1);
  const waBtn = await d.locator('a[href*="wa.me/241601010101"]').count();
  check('fiche annonce : bouton WhatsApp (wa.me/241…)', waBtn >= 1);
  const img = await d.locator('img').first().getAttribute('src').catch(() => '');
  check('fiche annonce : image chargée (svg démo)', /\/demo\//.test(img || ''), (img || '').slice(0, 60));

  await d.goto(BASE + '/publier', { waitUntil: 'networkidle', timeout: 30000 });
  await d.waitForTimeout(800);
  check('publication (anonyme) : redirection vers connexion', /connexion/.test(d.url()), d.url());
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} OK ====`);
process.exit(failed.length ? 1 : 0);

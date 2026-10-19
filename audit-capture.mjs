// Audit UI/UX : captures systématiques + métriques de chargement + test d'onglets.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const env = {};
for (const line of readFileSync('/home/user/godson-marketplace/.env', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const BASE = 'https://godson-marketplace.vercel.app';
const OUT = '/home/user/audit-shots';
mkdirSync(OUT + '/mobile', { recursive: true });
mkdirSync(OUT + '/desktop', { recursive: true });
mkdirSync(OUT + '/tablet', { recursive: true });

const metrics = [];
const addMetric = (tag, m) => { metrics.push({ tag, ...m }); };

async function shot(page, name, { full = false } = {}) {
  await page.screenshot({ path: `${OUT}/${page.__vp}/${name}.png`, fullPage: full });
}

async function perf(page, tag) {
  const t0 = Date.now();
  await page.goto(page.__nextUrl, { waitUntil: 'load', timeout: 30000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(900); // stabilisation (image, polices)
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
    const res = performance.getEntriesByType('resource');
    const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0);
    const imgs = res.filter((r) => (r.initiatorType || '').includes('img')).length;
    const fonts = res.filter((r) => (r.initiatorType === 'css' && /fonts/i.test(r.name))).length;
    return {
      dcl: Math.round(nav?.domContentLoadedEventEnd || 0),
      fcp: Math.round(fcp?.startTime || 0),
      transferKB: Math.round(bytes / 1024),
      requests: res.length,
      imgs,
    };
  });
  addMetric(tag, { loadMs, ...m });
  return m;
}

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

// ---------- MOBILE 390×844 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.__vp = 'mobile'; page.__nextUrl = '';
  const pages = [
    ['01-accueil', '/'],
    ['02-catalogue', '/annonces'],
    ['03-categorie', '/categorie/electronique'],
    ['04-fiche', '/annonce/demo-iphone-13-pro'],
    ['05-vendeur', '/vendeur/9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01'],
    ['06-connexion', '/connexion'],
    ['07-inscription', '/inscription'],
    ['08-apropos', '/apropos'],
    ['09-404', '/non-existant'],
  ];
  for (const [name, path] of pages) {
    page.__nextUrl = BASE + path;
    await perf(page, `mobile ${name}`);
    await shot(page, name);
    console.log('📱', name);
  }
  // session : compte + onglets + admin
  const ok = await login(page, { email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD });
  console.log('login admin:', ok);
  await page.waitForTimeout(800);
  await perf(page, 'mobile 10-compte');
  await shot(page, '10-compte');
  // onglets du compte
  const tabs = page.locator('[role="tab"], .tabs button, nav__tabs button, .tabs__tab, [class*="tab"] button');
  const tabCount = await tabs.count();
  console.log('onglets détectés (sélecteur large):', tabCount);
  // Admin : onglets
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await perf(page, 'mobile 11-admin');
  await shot(page, '11-admin');
  await ctx.close();
}

// ---------- TABLETTE 768×1024 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.__vp = 'tablet';
  for (const [name, path] of [['01-accueil', '/'], ['04-fiche', '/annonce/demo-iphone-13-pro'], ['02-catalogue', '/annonces']]) {
    page.__nextUrl = BASE + path;
    await perf(page, `tablet ${name}`);
    await shot(page, name);
    console.log('📲', name);
  }
  await ctx.close();
}

// ---------- DESKTOP 1280×900 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.__vp = 'desktop';
  for (const [name, path, full] of [
    ['01-accueil', '/', true],
    ['02-catalogue', '/annonces', false],
    ['04-fiche', '/annonce/demo-iphone-13-pro', true],
  ]) {
    page.__nextUrl = BASE + path;
    await perf(page, `desktop ${name}`);
    await shot(page, name, { full });
    console.log('🖥️', name);
  }
  // session
  await login(page, { email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD });
  await page.waitForTimeout(600);
  page.__nextUrl = BASE + '/compte';
  await perf(page, 'desktop 10-compte');
  await shot(page, '10-compte');
  page.__nextUrl = BASE + '/admin';
  await perf(page, 'desktop 11-admin');
  await shot(page, '11-admin');
  await ctx.close();
}

// ---------- TEST ONGLETS (desktop) : réactivité + rendu ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, { email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD });
  console.log('— test onglets compte —');
  await page.goto(BASE + '/compte', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // trouver les vrais boutons d'onglets (conteneur au-dessus du contenu)
  const candidates = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role="tab"]')];
    return btns.filter((b) => b.closest('[class*="tab"]') || b.getAttribute('role') === 'tab').map((b, i) => ({ i, text: b.textContent.trim().slice(0, 24), cls: b.className.slice(0, 60) }));
  });
  console.log('candidates:', JSON.stringify(candidates.slice(0, 12)));
  await ctx.close();
}

await browser.close();

console.log('\n===== MÉTRIQUES CHARGEMENT =====');
for (const m of metrics) {
  console.log(`${m.tag.padEnd(26)} | load=${m.loadMs} ms | DCL=${m.dcl} ms | FCP=${m.fcp} ms | ${m.transferKB} KB | ${m.requests} req`);
}

// Audit phase 2 : onglets, pages session, home après chargement complet.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = {};
for (const line of readFileSync('/home/user/godson-marketplace/.env', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const BASE = 'https://godson-marketplace.vercel.app';
const OUT = '/home/user/audit-shots';

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

// ---- Mobile : pages session + tous les onglets ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 120)));
  console.log('login:', await login(page, { email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD }));
  await page.waitForTimeout(1200);

  // Compte : onglets (mesure de réactivité par onglet)
  const tabTexts = ['Actives', 'Brouillons', 'Archivées', 'Refusées'];
  for (const t of tabTexts) {
    const btn = page.locator(`.tab:has-text("${t}")`).first();
    if ((await btn.count()) === 0) { console.log('onglet introuvable:', t); continue; }
    const t0 = Date.now();
    await btn.click();
    await page.waitForTimeout(700);
    const ms = Date.now() - t0;
    await page.screenshot({ path: `${OUT}/mobile/c-compte-${t.toLowerCase()}.png` });
    const activeCls = await btn.getAttribute('class');
    console.log(`onglet ${t} → ${ms} ms | classe: ${activeCls}`);
  }

  // Paramètres
  await page.goto(BASE + '/compte/parametres', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/mobile/c-parametres.png`, fullPage: true });
  console.log('parametres capturé');

  // Publier (formulaire)
  await page.goto(BASE + '/publier', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/mobile/c-publier.png`, fullPage: true });
  console.log('publier capturé');

  // Messages (vide)
  await page.goto(BASE + '/messages', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/mobile/c-messages-vide.png` });
  console.log('messages vide capturé');

  // Admin : 5 onglets
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/mobile/c-admin.png`, fullPage: true });
  const adminTabs = await page.locator('.tab').allTextContents();
  console.log('onglets admin:', JSON.stringify(adminTabs));
  for (const t of adminTabs) {
    const btn = page.locator(`.tab:has-text("${t.trim()}")`).first();
    const t0 = Date.now();
    await btn.click();
    await page.waitForTimeout(700);
    const ms = Date.now() - t0;
    const slug = t.trim().toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: `${OUT}/mobile/c-admin-${slug}.png` });
    console.log(`admin onglet ${t.trim()} → ${ms} ms`);
  }
  await ctx.close();
}

// ---- Desktop : home après chargement complet + admin onglets ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror desktop]', String(e).slice(0, 120)));
  // Home : attendre que les annonces se chargent
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
  const cards = await page.locator('.listing-card, a[href^="/annonce/"]').count();
  const spinnerLeft = await page.getByText(/Chargement des annonces|Préparation de la recherche/i).count();
  console.log('desktop home : cartes visibles =', cards, '| spinners restants =', spinnerLeft);
  await page.screenshot({ path: `${OUT}/desktop/d-accueil-charge.png`, fullPage: true });

  // Admin onglets desktop
  console.log('login desktop:', await login(page, { email: env.GM_ADMIN_EMAIL, password: env.GM_ADMIN_PASSWORD }));
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const adminTabs = await page.locator('.tab').allTextContents();
  for (const t of adminTabs) {
    const btn = page.locator(`.tab:has-text("${t.trim()}")`).first();
    await btn.click();
    await page.waitForTimeout(700);
    const slug = t.trim().toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: `${OUT}/desktop/d-admin-${slug}.png` });
    console.log('admin desktop onglet:', t.trim());
  }
  await ctx.close();
}

await browser.close();
console.log('DONE');

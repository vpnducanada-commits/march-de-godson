// Vérifications finales de lancement : /auth/callback, mot de passe oublié, PWA offline, perf.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const BASE = 'https://godson-marketplace.vercel.app';
let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`); if (!ok) fail++; };

const browser = await chromium.launch();

// 1. /auth/callback sans session : page dédiée (pas une 404)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/auth/callback', { waitUntil: 'networkidle' });
  const title = await page.locator('h1').first().textContent();
  check('/auth/callback : page dédiée « Session non restaurée » (pas de 404)', /session non restaurée/i.test(title || ''), title?.trim());
  await ctx.close();
}

// 2. Mot de passe oublié : soumission propre (le lien pointe désormais vers la prod)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)));
  await page.goto(BASE + '/mot-de-passe', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('demo@godson-market.example');
  await page.getByRole('button', { name: /envoyer|réinitialiser/i }).first().click();
  await page.waitForTimeout(3000);
  const body = await page.locator('.auth-card').first().textContent();
  const okMsg = /si cet email existe|vient de vous être envoyé/i.test(body || '');
  check('mot de passe oublié : soumission OK + message de confirmation', okMsg && errors.length === 0, errors[0] || (body || '').slice(0, 110).replace(/\s+/g, ' '));
  await ctx.close();
}

// 3. PWA offline : le service worker pré-cache l'app shell
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const swRegistered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg);
  });
  check('PWA : service worker enregistré', swRegistered);
  // Mode offline puis rechargement : l'app shell doit rester affichée
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.reload({ waitUntil: 'load', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const offlineTitle = await page.title();
  check('PWA : app shell affichée HORS LIGNE (précache)', /GODSON/i.test(offlineTitle), `title="${offlineTitle}"`);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ctx.close();
}

// 4. Performance : temps de chargement + poids (page d'accueil, desktop)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  let tStart = 0, tDom = 0, tLoad = 0;
  page.on('load', () => { tLoad = Date.now(); });
  page.on('domcontentloaded', () => { tDom = Date.now(); });
  tStart = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0));
  check('perf : page d\'accueil chargée en < 8 s (réseau sandbox → prod)', tLoad - tStart < 8000, `${((tLoad - tStart) / 1000).toFixed(1)} s (DOM ${((tDom - tStart) / 1000).toFixed(1)} s)`);
  check('perf : transfert total < 3 Mo', bytes < 3 * 1024 * 1024, `${(bytes / 1048576).toFixed(2)} Mo`);
  await ctx.close();
}

await browser.close();
console.log(fail === 0 ? '\n==== VÉRIFICATIONS FINALES : TOUT EST VERT ====' : `\n==== ${fail} ÉCHEC(S) ====`);
process.exit(fail ? 1 : 0);

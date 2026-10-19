import { chromium } from 'playwright';
const B = 'http://localhost:4176';
const b = await chromium.launch();
let errs = 0;

// --- 1. Squelettes (latence simulée 3 s sur l'API) ---
let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
let p = await ctx.newPage();
p.on('pageerror', (e) => { errs++; console.log('PAGEERROR:', e.message.slice(0, 100)); });
await p.route('**/rest/v1/**', (r) => setTimeout(() => r.continue(), 3000));
await p.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(1200);
const sk = await p.evaluate(() => ({
  cats: document.querySelectorAll('.skeleton-cat').length,
  cards: document.querySelectorAll('.skeleton-card').length,
}));
console.log('SQUELETTES:', JSON.stringify(sk));
await p.screenshot({ path: '/home/user/audit-shots/prod-final/skeletons-mobile.png' });
await p.waitForTimeout(3500);
const final = await p.evaluate(() => document.querySelectorAll('.card').length);
console.log('Cartes finales:', final);
await ctx.close();

// --- 2. Bandeau hors-ligne (chargement online puis offline) ---
ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
p = await ctx.newPage();
p.on('pageerror', (e) => { errs++; });
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3000); // laisser le SW enregistrer + précaucher
const sw = await p.evaluate(() => navigator.serviceWorker?.ready ? 'ok' : 'non');
console.log('SW:', sw);
await ctx.setOffline(true);
await p.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(1500);
const off = await p.evaluate(() => ({
  banner: !!document.querySelector('.offline-banner'),
  text: document.querySelector('.offline-banner')?.textContent?.slice(0, 60),
  appLoaded: !!document.querySelector('.hero'),
}));
console.log('HORS-LIGNE:', JSON.stringify(off));
await p.screenshot({ path: '/home/user/audit-shots/prod-final/offline-banner.png', clip: { x: 0, y: 0, width: 390, height: 160 } });
await ctx.close();

console.log('pageerrors:', errs);
await b.close();
process.exit(0);

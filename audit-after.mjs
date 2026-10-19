import { chromium } from 'playwright';
const B = 'http://localhost:4173';
const out = '/home/user/audit-shots/after';
import { mkdirSync } from 'fs';
mkdirSync(out + '/mobile', { recursive: true });
mkdirSync(out + '/desktop', { recursive: true });
mkdirSync(out + '/tablet', { recursive: true });
const b = await chromium.launch();

// ---------- MOBILE (anon) ----------
let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
let p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/mobile/01-accueil.png' });
// header déconnecté (top crop)
await p.screenshot({ path: out + '/mobile/02-header-anon.png', clip: { x: 0, y: 0, width: 390, height: 120 } });
// fiche
await p.goto(B + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/mobile/04-fiche.png' });
// vendeur
await p.goto(B + '/vendeur/9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: out + '/mobile/05-vendeur.png' });
await ctx.close();

// ---------- MOBILE (admin) ----------
ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
p = await ctx.newPage();
await p.goto(B + '/connexion', { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'gedeonokana06@gmail.com');
await p.fill('input[type="password"]', 'Gedeon06');
await p.click('button[type="submit"]');
await p.waitForURL('**/compte**', { timeout: 20000 });
await p.waitForTimeout(1500);
await p.goto(B + '/admin', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: out + '/mobile/c-admin-annonces.png' });
// onglet utilisateurs
const tabUser = p.locator('.tab', { hasText: 'Utilisateurs' }).first();
if (await tabUser.count()) { await tabUser.click(); await p.waitForTimeout(1500); }
await p.screenshot({ path: out + '/mobile/c-admin-utilisateurs.png' });
await ctx.close();

// ---------- TABLET ----------
ctx = await b.newContext({ viewport: { width: 768, height: 1024 } });
p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/tablet/01-accueil.png' });
await ctx.close();

// ---------- DESKTOP ----------
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: out + '/desktop/d-accueil.png', fullPage: true });
await p.goto(B + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
await p.screenshot({ path: out + '/desktop/d-fiche.png' });
await ctx.close();

await b.close();
console.log('APRÈS captures OK');

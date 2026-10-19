import { chromium } from 'playwright';
const B = 'http://localhost:4173';
const out = '/home/user/audit-shots/after';
const b = await chromium.launch();

// ---------- MOBILE (admin) ----------
let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
let p = await ctx.newPage();
await p.goto(B + '/connexion', { waitUntil: 'networkidle', timeout: 30000 });
await p.fill('input[type="email"]', 'gedeonokana06@gmail.com');
await p.fill('input[type="password"]', 'Gedeon06');
await p.click('button:has-text("Se connecter")');
await p.waitForURL('**/compte**', { timeout: 25000 });
await p.waitForTimeout(1500);
await p.goto(B + '/admin', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/mobile/c-admin-annonces.png' });
const tabUser = p.locator('.tab', { hasText: 'Utilisateurs' }).first();
if (await tabUser.count()) { await tabUser.click(); await p.waitForTimeout(2000); }
await p.screenshot({ path: out + '/mobile/c-admin-utilisateurs.png' });
await ctx.close();

// ---------- TABLET ----------
ctx = await b.newContext({ viewport: { width: 768, height: 1024 } });
p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: out + '/tablet/01-accueil.png' });
await ctx.close();

// ---------- DESKTOP ----------
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3500);
await p.screenshot({ path: out + '/desktop/d-accueil.png', fullPage: true });
await p.goto(B + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle' });
await p.waitForTimeout(3500);
await p.screenshot({ path: out + '/desktop/d-fiche.png' });
await ctx.close();

await b.close();
console.log('APRÈS captures 2 OK');

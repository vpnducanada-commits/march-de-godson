import { chromium } from 'playwright';
const B = 'http://localhost:4173';
const out = '/home/user/audit-shots/after';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/mobile/01-accueil.png' });
// tiroir mobile
await p.click('.header__burger');
await p.waitForTimeout(600);
await p.screenshot({ path: out + '/mobile/drawer.png' });
// catégorie avec filtre actif → « Filtres (1) »
await p.goto(B + '/annonces?cat=telephones', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.screenshot({ path: out + '/mobile/c-categorie.png' });
await b.close();
process.exit(0);

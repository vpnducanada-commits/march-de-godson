import { chromium } from 'playwright';
const B = 'http://localhost:4173';
const routes = ['/', '/annonces', '/annonces?cat=telephones', '/annonce/demo-iphone-13-pro',
  '/connexion', '/inscription', '/publier', '/faq', '/apropos', '/conditions', '/confidentialite', '/securite'];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
let errs = 0;
p.on('pageerror', (e) => { errs++; console.log('PAGEERROR:', e.message.slice(0, 120)); });
for (const r of routes) {
  await p.goto(B + r, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('NAV FAIL', r, e.message.slice(0, 80)));
  await p.waitForTimeout(700);
}
console.log(`Routes: ${routes.length}, pageerrors: ${errs}`);
await b.close();
process.exit(0);

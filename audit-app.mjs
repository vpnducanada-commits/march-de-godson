import { chromium } from 'playwright';
const B = 'http://localhost:4174';
const b = await chromium.launch();
let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
let p = await ctx.newPage();
let errs = 0;
p.on('pageerror', (e) => { errs++; console.log('PAGEERROR:', e.message.slice(0, 100)); });
await p.goto(B + '/application', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: '/home/user/audit-shots/prod-final/app-mobile.png', fullPage: true });
await ctx.close();
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
p = await ctx.newPage();
p.on('pageerror', (e) => { errs++; });
await p.goto(B + '/application', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path: '/home/user/audit-shots/prod-final/app-desktop.png', fullPage: true });
// 13 routes (dont /application)
const routes = ['/', '/application', '/annonces', '/annonce/demo-iphone-13-pro', '/connexion', '/inscription', '/publier', '/faq', '/apropos', '/conditions', '/confidentialite', '/securite', '/messages'];
for (const r of routes) {
  await p.goto(B + r, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(400);
}
console.log('13 routes, pageerrors:', errs);
await b.close();
process.exit(0);

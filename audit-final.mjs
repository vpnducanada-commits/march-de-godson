import { chromium } from 'playwright';
const B = 'https://godson-marketplace.vercel.app';
const out = '/home/user/audit-shots/prod-final';
import { mkdirSync } from 'fs';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
// mobile
let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
let p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/mobile-accueil.png' });
await p.click('.header__burger');
await p.waitForTimeout(700);
await p.screenshot({ path: out + '/mobile-drawer.png' });
await ctx.close();
// desktop
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
p = await ctx.newPage();
await p.goto(B + '/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3500);
await p.screenshot({ path: out + '/desktop-accueil.png', fullPage: true });
await p.goto(B + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
await p.screenshot({ path: out + '/desktop-fiche.png' });
await ctx.close();
await b.close();
console.log('PROD FINAL OK');

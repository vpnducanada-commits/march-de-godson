import { chromium } from 'playwright';
const B = 'https://godson-marketplace.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
let errs = 0;
p.on('pageerror', (e) => { errs++; console.log('PAGEERROR:', e.message.slice(0, 100)); });
// squelettes en prod (latence simulée)
await p.route('**/rest/v1/**', (r) => setTimeout(() => r.continue(), 2500));
await p.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(1000);
const sk = await p.evaluate(() => ({
  cats: document.querySelectorAll('.skeleton-cat').length,
  cards: document.querySelectorAll('.skeleton-card').length,
  version: document.body.innerText.match(/v1\.\d/)?.[0],
}));
console.log('PROD SQUELETTES:', JSON.stringify(sk));
await ctx.close();
// test final
await b.close();
process.exit(0);

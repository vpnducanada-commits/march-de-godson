import { chromium } from 'playwright';
const B = 'https://godson-marketplace.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
let errs = 0;
p.on('pageerror', (e) => { errs++; console.log('PAGEERROR:', e.message.slice(0, 120)); });
await p.goto(B + '/application', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2500);
const v = await p.evaluate(() => document.body.innerText.match(/v1\.\d/)?.[0] ?? 'n/a');
const qr = await p.evaluate(() => {
  const img = document.querySelector('.download__qr-img');
  return img ? { ok: true, w: img.naturalWidth } : { ok: false };
});
const foot = await p.locator('.footer a:has-text("Télécharger")').count();
console.log(`version=${v} qr=${JSON.stringify(qr)} footerLien=${foot} pageerrors=${errs}`);
await p.screenshot({ path: '/home/user/audit-shots/prod-final/app-prod.png', fullPage: true });
await b.close();
process.exit(0);

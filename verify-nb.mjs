import { chromium } from 'playwright';
const B = 'http://localhost:4175';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
let errs = 0;
p.on('pageerror', (e) => { errs++; console.log('PAGEERROR:', e.message.slice(0, 100)); });
// fiche : le NB est affiché ?
await p.goto(B + '/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);
const fiche = await p.evaluate(() => {
  const el = document.querySelector('.detail__safety');
  return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 300) : null;
});
console.log('FICHE:', fiche);
// sécurité
await p.goto(B + '/securite', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
const sec = await p.evaluate(() => document.body.innerText.includes('NB : ne payez que si vous avez confiance'));
console.log('SECURITE NB:', sec);
// faq
await p.goto(B + '/faq', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
const faq = await p.evaluate(() => document.body.innerText.includes('Quel moyen de paiement est recommandé'));
console.log('FAQ question:', faq);
console.log('pageerrors:', errs);
await b.close();
process.exit(0);

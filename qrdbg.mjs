import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('CONSOLE:', m.type(), m.text().slice(0, 160)); });
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));
await p.goto('http://localhost:4174/application', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const img = document.querySelector('.download__qr-img');
  return img ? { ok: true, src: img.src.slice(0, 40), w: img.naturalWidth } : { ok: false, fallback: !!document.querySelector('.download__qr-fallback') };
});
console.log('QR:', JSON.stringify(r));
await b.close();
process.exit(0);

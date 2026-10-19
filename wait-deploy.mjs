import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
for (let i = 0; i < 12; i++) {
  try {
    await p.goto('https://godson-marketplace.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(3000);
    const v = await p.evaluate(() => document.body.innerText.match(/v1\.\d/)?.[0] ?? 'n/a');
    console.log(`essai ${i + 1}: version = ${v}`);
    if (v === 'v1.5') { console.log('DEPLOY v1.5 CONFIRMÉ'); await b.close(); process.exit(0); }
  } catch (e) { console.log(`essai ${i + 1}: ${e.message.slice(0, 60)}`); }
  await new Promise(r => setTimeout(r, 25000));
}
console.log('TIMEOUT — déploiement non confirmé');
await b.close();
process.exit(1);

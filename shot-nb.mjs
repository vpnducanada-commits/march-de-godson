import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto('http://localhost:4175/annonce/demo-iphone-13-pro', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);
const el = p.locator('.detail__safety');
await el.screenshot({ path: '/home/user/audit-shots/prod-final/nb-fiche-mobile.png' });
await b.close();
process.exit(0);

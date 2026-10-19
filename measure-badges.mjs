import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);
const t = await p.evaluate(() => {
  const sb = document.querySelector('.hero .searchbar');
  const field = sb.querySelector('.searchbar__field');
  const btn = sb.querySelector('.btn');
  const r = (el) => { const b2 = el.getBoundingClientRect(); return { l: Math.round(b2.left), t: Math.round(b2.top), w: Math.round(b2.width), h: Math.round(b2.height) }; };
  return { sbClass: sb.className, sb: r(sb), field: r(field), btn: r(btn),
    btnWidth: getComputedStyle(btn).width, btnFlex: getComputedStyle(btn).flex,
    sbWrap: getComputedStyle(sb).flexWrap };
});
console.log(JSON.stringify(t, null, 1));
await b.close();
process.exit(0);

import { chromium } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';
const BASE = 'https://godson-market-place.vercel.app';
const OUT = 'audit';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const issues = [];
const checks = [];
function log(section, ok, detail) {
  checks.push({ section, ok, detail });
  console.log(`${ok ? '✅' : '❌'} [${section}] ${detail}`);
}
function issue(sev, where, what, fix) { issues.push({ sev, where, what, fix }); }

// 1. perf + bundle
{
  const t0 = Date.now();
  const res = await fetch(BASE + '/');
  const html = await res.text();
  const ms = Date.now() - t0;
  const hasBundle = /assets\/index-[^"]+\.css/.test(html);
  log('PERF', ms < 2000, `TTFB ${ms}ms (html ${html.length} bytes, bundle CSS ${hasBundle ? 'OK' : 'MANQUE'})`);
  if (ms > 1500) issue('majeur','PERF','TTFB '+ms+'ms','Vérifier CDN Vercel, réduire JS');
  if (!hasBundle) issue('bloquant','BUILD','Bundle CSS non trouvé','Rebuild');
}

// 2. mobile audit
const ctxM = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const pageM = await ctxM.newPage();
let errs=[];
pageM.on('pageerror', e=>errs.push(e.message));
await pageM.goto(BASE+'/',{waitUntil:'networkidle',timeout:30000});
await pageM.waitForTimeout(1000);
const vp = await pageM.evaluate(()=>document.querySelector('meta[name="viewport"]')?.content||'');
log('MOBILE', !!vp, `viewport meta: ${vp||'MANQUE'}`);
if(!vp) issue('majeur','MOBILE','viewport manquant','Ajouter meta viewport');
const imgs = await pageM.$$eval('img', els=>els.map(e=>({src:e.src.slice(0,60),alt:e.alt||''})));
const noAlt = imgs.filter(i=>!i.alt);
log('A11Y', noAlt.length===0, `images sans alt: ${noAlt.length}/${imgs.length}`);
if(noAlt.length>0) issue('mineur','A11Y',`${noAlt.length} images sans alt`,'Ajouter alt');
const h1s = await pageM.$$eval('h1', els=>els.length);
log('A11Y', h1s===1, `h1 count: ${h1s} (attendu 1)`);
if(h1s!==1) issue('mineur','A11Y',`${h1s} h1`,`Corriger hiérarchie`);
const searchLabel = await pageM.evaluate(()=>document.querySelector('input[type="search"]')?.ariaLabel || document.querySelector('input[placeholder]')?.placeholder || '');
log('A11Y', !!searchLabel, `search input label: "${searchLabel.slice(0,50)}"`);
if(!searchLabel) issue('majeur','A11Y','input recherche sans label','Ajouter aria-label');
await pageM.goto(BASE+'/annonce/demo-iphone-13-pro',{waitUntil:'networkidle',timeout:30000});
await pageM.waitForTimeout(800);
const hasBar = await pageM.evaluate(()=>!!document.querySelector('.detail__actionbar'));
const hasBottom = await pageM.evaluate(()=>!!document.querySelector('nav'));
log('MOBILE-FICHE', hasBar, `actionbar fiche: ${hasBar ? 'présente' : 'MANQUE'}`);
if(!hasBar) issue('majeur','MOBILE','actionbar manquante','Vérifier .detail__actionbar');
const actions = await pageM.$$eval('.detail__actionbar a, .detail__actionbar button', els=>els.map(e=>e.textContent.trim()));
log('MOBILE-FICHE', actions.length>=3, `boutons actionbar: ${actions.join(' | ')}`);
if(actions.length<3) issue('majeur','FICHE','boutons actionbar incomplets','Vérifier 3 boutons');

// 3. catalogue
await pageM.goto(BASE+'/catalogue',{waitUntil:'networkidle',timeout:30000});
await pageM.waitForTimeout(800);
const catCount = await pageM.$$eval('a[href*="/annonce/"], [class*="card"]', els=>els.length);
log('CATALOGUE', catCount>0, `cartes catalogue: ${catCount}`);
if(catCount===0) issue('bloquant','CATALOGUE','0 annonces rendues','Vérifier fetch Supabase');

// 4. desktop
const ctxD = await browser.newContext({ viewport:{width:1280,height:720} });
const pageD = await ctxD.newPage();
await pageD.goto(BASE+'/',{waitUntil:'networkidle',timeout:30000});
await pageD.waitForTimeout(800);
const navH = await pageD.$('header nav');
log('DESKTOP', !!navH, `header nav desktop ${navH?'OK':'manque'}`);
const cols = await pageD.evaluate(()=>document.querySelector('.cat-grid') ? getComputedStyle(document.querySelector('.cat-grid')).gridTemplateColumns : 'none');
log('DESKTOP', true, `cat-grid columns: ${cols.slice(0,60)}`);

// 5. dark mode
await pageM.goto(BASE+'/',{waitUntil:'networkidle',timeout:30000});
await pageM.waitForTimeout(800);
const darkBtn = pageM.locator('button[aria-label*="hème" i]').first();
let darkOK=false;
try { await darkBtn.click({timeout:2000}); await pageM.waitForTimeout(500); darkOK = await pageM.evaluate(()=>document.documentElement.classList.contains('dark')); } catch {}
log('THEME', darkOK, `dark mode toggle ${darkOK?'OK':'échec'}`);
if(!darkOK) issue('mineur','THEME','dark mode non fonctionnel','Vérifier toggle');

// 6. PWA
let manifest='';
try { const r=await fetch(BASE+'/manifest.webmanifest'); manifest=r.ok?'OK '+r.headers.get('content-type'):String(r.status); } catch(e){ manifest=e.message }
log('PWA', manifest.startsWith('OK'), `manifest: ${manifest}`);
if(!manifest.startsWith('OK')) issue('mineur','PWA','manifest manquant','Vérifier public/manifest');

// 7. liens morts (12 premiers)
const links = [...new Set(await pageM.$$eval('a[href]', els=>els.map(e=>e.href).filter(h=>h.startsWith('https://godson-market-place.vercel.app'))))];
let broken=[];
for(const u of links.slice(0,12)){
  try{ const r=await fetch(u,{method:'HEAD'}); if(!r.ok) broken.push(u+' '+r.status); }catch{ broken.push(u+' err'); }
}
log('LIENS', broken.length===0, `liens testés ${links.length}, cassés ${broken.length} ${broken.join(' | ').slice(0,120)}`);
if(broken.length) issue('majeur','LIENS',broken.join(', '),'Corriger routes');

// 8. video audit
import FF from 'ffmpeg-static';
for(const f of ['video/godson-marketplace-VIDEO-MANIP-1080x1920.mp4','video/godson-marketplace-VIDEO-MANIP-1920x1080.mp4']){
  if(fs.existsSync(f)){
    const probe=execSync(`"${FF}" -i "${f}" 2>&1 | grep -E "Duration|Video:|Audio:" | head -3`,{encoding:'utf8'});
    console.log(`VIDEO ${f} -> ${probe.replace(/\n/g,' | ')} (size ${(fs.statSync(f).size/1024/1024).toFixed(1)}MB)`);
    log('VIDEO', true, `${f.split('/').pop()} ${probe.match(/Duration:[^,]+/)?.[0]||''}`.trim());
  }
}

await browser.close();
fs.writeFileSync(OUT+'/checks.json', JSON.stringify({checks,issues},null,2));
console.log(`\n=== ${checks.filter(c=>c.ok).length}/${checks.length} checks OK, ${issues.length} issues ===`);
fs.writeFileSync(OUT+'/summary.txt', checks.map(c=>`${c.ok?'✅':'❌'} ${c.section} ${c.detail}`).join('\n')+'\n\nISSUES:\n'+issues.map(i=>`- [${i.sev}] ${i.where}: ${i.what} => ${i.fix||''}`).join('\n'));
process.exit(0);

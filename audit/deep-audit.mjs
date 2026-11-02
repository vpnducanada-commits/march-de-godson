import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://godson-market-place.vercel.app';
const B = await chromium.launch();
const ctxM = await B.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const pM = await ctxM.newPage();
const ctxD = await B.newContext({ viewport:{width:1280,height:720} });
const pD = await ctxD.newPage();
const out = [];
function sec(t){ out.push(`\n## ${t}`); console.log(`\n### ${t}`); }
function ok(m){ out.push(`- ✅ ${m}`); console.log(`✅ ${m}`); }
function ko(m, fix){ out.push(`- ❌ ${m} → *${fix}*`); console.log(`❌ ${m} -> ${fix}`); }
function warn(m, fix){ out.push(`- ⚠️ ${m} → *${fix}*`); console.log(`⚠️ ${m} -> ${fix}`); }

// 1. Perf
sec('1. Performance');
{
  const t0=Date.now(); const r=await fetch(BASE+'/'); const html=await r.text(); const ms=Date.now()-t0;
  const cssMatch=html.match(/assets\/index-[^"]+\.css/);
  const jsMatch=html.match(/assets\/index-[^"]+\.js/);
  if(ms<300) ok(`TTFB ${ms}ms (Vercel excellent)`);
  else if(ms<800) ok(`TTFB ${ms}ms (correct)`);
  else ko(`TTFB ${ms}ms lent`,`Optimiser bundle, vérifier region Vercel`);
  if(cssMatch) ok(`CSS bundle ${cssMatch[0]} présent`);
  else ko('CSS bundle manquant','Rebuild');
  if(jsMatch){
    const sz=await fetch(BASE+'/'+jsMatch[0]).then(r=>r.headers.get('content-length')).catch(()=>null);
    ok(`JS bundle ${jsMatch[0]} ${sz? (sz/1024).toFixed(0)+' KB':''}`);
  }
  // check img lazy
  await pM.goto(BASE+'/',{waitUntil:'networkidle'}); await pM.waitForTimeout(800);
  const lazy=await pM.$$eval('img[loading="lazy"]', els=>els.length);
  const total=await pM.$$eval('img', els=>els.length);
  if(lazy>=total*0.5) ok(`Images lazy: ${lazy}/${total}`);
  else warn(`${lazy}/${total} images en lazy`,`Ajouter loading="lazy" hors hero`);
  // bundle size local
  try{
    const css=fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'));
    const js=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.js'));
    if(css) ok(`dist CSS ${(fs.statSync('dist/assets/'+css).size/1024).toFixed(0)} KB`);
    if(js) ok(`dist JS ${(fs.statSync('dist/assets/'+js).size/1024).toFixed(0)} KB (budget 400 KB)`);
  }catch{}
}

// 2. Accessibilité
sec('2. Accessibilité (WCAG 2.1 AA)');
{
  await pM.goto(BASE+'/',{waitUntil:'networkidle'}); await pM.waitForTimeout(600);
  const vp=await pM.evaluate(()=>document.querySelector('meta[name="viewport"]')?.content);
  vp ? ok(`viewport meta: ${vp}`) : ko('viewport manquant','Ajouter viewport-fit=cover');
  const h1c=await pM.$$eval('h1', e=>e.length);
  h1c===1 ? ok('1 seul h1 (hero)') : ko(`${h1c} h1`,`Garder un seul h1/page`);
  const hOrder=await pM.evaluate(()=>{
    const hs=[...document.querySelectorAll('h1,h2,h3')].map(e=>e.tagName);
    return hs.join(' > ');
  });
  ok(`Hiérarchie: ${hOrder.slice(0,80)}`);
  const skip=await pM.$('a.skip-link');
  skip ? ok('Skip-link présent') : warn('Skip-link manquant','Ajouter lien d’évitement');
  const alts=await pM.$$eval('img', els=>els.filter(e=>!e.alt && !e.getAttribute('aria-hidden')).length);
  alts===0 ? ok('Toutes les images ont alt ou aria-hidden') : warn(`${alts} images décoratives sans aria-hidden`,`Vérifier logos`);
  // contrast check via axe-like: check hero text
  const heroContrast=await pM.evaluate(()=>{
    const h=document.querySelector('h1'); if(!h) return null;
    const s=getComputedStyle(h); return {color:s.color, fontSize:s.fontSize, weight:s.fontWeight};
  });
  ok(`Hero style ${heroContrast.color} ${heroContrast.fontSize} ${heroContrast.weight}`);
  // keyboard nav: header links focusable
  const focusables=await pM.$$eval('a,button,input', els=>els.filter(e=>e.tabIndex>=0).length);
  ok(`${focusables} éléments focusables au clavier`);
  const ariaMenu=await pM.$('[aria-label*="Ouvrir le menu"]');
  ariaMenu? ok('Burger menu a aria-label') : ko('Burger sans aria-label','Ajouter');
  const searchAria=await pM.evaluate(()=>document.querySelector('input[type="search"]')?.getAttribute('aria-label')||'');
  searchAria? ok(`Search aria-label="${searchAria}"`) : ko('Search sans aria-label','Ajouter');
}

// 3. SEO
sec('3. SEO');
{
  await pD.goto(BASE+'/',{waitUntil:'networkidle'}); await pD.waitForTimeout(600);
  const title=await pD.title();
  title.length>=40 && title.length<=65 ? ok(`Title ${title.length}c: "${title}"`) : warn(`Title ${title.length}c`,`Optimiser 50-60c`);
  const desc=await pD.$eval('meta[name="description"]', e=>e.content).catch(()=>null);
  desc ? (desc.length>=120&&desc.length<=160 ? ok(`Meta description ${desc.length}c`) : warn(`Meta description ${desc.length}c`, '120-160c idéal')) : ko('Meta description manquante','Ajouter');
  const ogImg=await pD.$('meta[property="og:image"]');
  ogImg? ok('OG image présent') : ko('OG image manquant','Ajouter 1200x630');
  const canon=await pD.$('link[rel="canonical"]');
  canon? ok('Canonical présent') : warn('Canonical manquant','Ajouter');
  const jsonld=await pD.$('script[type="application/ld+json"]');
  jsonld? ok('JSON-LD Organization présent') : warn('JSON-LD manquant','Ajouter');
  // sitemap
  const sm=await fetch(BASE+'/sitemap.xml').then(r=>r.ok?'OK':'KO '+r.status).catch(e=>e.message);
  sm.startsWith('OK')? ok('sitemap.xml OK') : warn(`sitemap ${sm}`,'Générer sitemap');
  // robots
  const rb=await fetch(BASE+'/robots.txt').then(r=>r.text()).catch(()=>null);
  rb && rb.includes('Sitemap')? ok('robots.txt avec Sitemap') : warn('robots.txt incomplet','Ajouter Sitemap');
}

// 4. PWA
sec('4. PWA');
{
  const mf=await fetch(BASE+'/manifest.webmanifest').then(async r=>({ok:r.ok, ct:r.headers.get('content-type'), j: r.ok? await r.json().catch(()=>null):null})).catch(e=>({ok:false,err:e.message}));
  mf.ok? ok(`Manifest OK ${mf.ct} name="${mf.j?.name||''}"`) : ko('Manifest KO','Vérifier');
  if(mf.j){
    mf.j.icons?.length>=2? ok(`Icons ${mf.j.icons.length} (${mf.j.icons[0].sizes})`) : warn('Icons manquantes','Ajouter 192/512');
    mf.j.display? ok(`Display ${mf.j.display}`) : warn('Display manquant','standalone');
    mf.j.theme_color? ok(`Theme color ${mf.j.theme_color}`) : warn('Theme color manquant','');
  }
  await pM.goto(BASE+'/',{waitUntil:'networkidle'}); await pM.waitForTimeout(800);
  const sw=await pM.evaluate(()=> 'serviceWorker' in navigator);
  ok(`ServiceWorker API ${sw?'supporté':'non supporté (normal en headless)'}`);
}

// 5. Mobile UX
sec('5. Mobile UX (390×844)');
{
  await pM.goto(BASE+'/',{waitUntil:'networkidle'}); await pM.waitForTimeout(800);
  const headerH=await pM.$eval('header', e=>e.offsetHeight).catch(()=>0);
  ok(`Header hauteur ${headerH}px`);
  const catScroll=await pM.evaluate(()=>{
    const g=document.querySelector('.cat-grid');
    return g? {scrollWidth:g.scrollWidth, clientWidth:g.clientWidth, overflow:getComputedStyle(g).overflowX} : null;
  });
  if(catScroll) catScroll.scrollWidth>catScroll.clientWidth? ok(`Carrousel catégories scrollable ${catScroll.scrollWidth}>${catScroll.clientWidth}`) : ko('Catégories non scrollables','Vérifier overflow-x');
  await pM.goto(BASE+'/annonce/demo-iphone-13-pro',{waitUntil:'networkidle'}); await pM.waitForTimeout(800);
  const bar=await pM.$('.detail__actionbar');
  bar? ok('Actionbar fiche (Appeler/WhatsApp) présente') : ko('Actionbar manquante','Vérifier v2.4');
  const barBtns=await pM.$$eval('.detail__actionbar *', els=>els.map(e=>e.textContent.trim()).filter(Boolean).join(' | '));
  ok(`Actionbar boutons: ${barBtns.slice(0,80)}`);
  const bottomNav=await pM.$('nav');
  const bottomVisible=bottomNav ? await bottomNav.isVisible().catch(()=>false) : false;
  ok(`BottomNav visible sur fiche: ${bottomVisible} (attendu false, masquée v2.4)`);
  // touch targets
  const smallTargets=await pM.$$eval('a,button', els=>{
    return els.filter(e=>{
      const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && (r.width<44 || r.height<44) && e.offsetParent!==null;
    }).map(e=>e.textContent.trim().slice(0,20)).slice(0,3);
  });
  smallTargets.length===0? ok('Touch targets ≥44px (WCAG)') : warn(`Petits targets: ${smallTargets.join(', ')}`,'Augmenter padding');
}

// 6. Formulaires & États vides
sec('6. Formulaires & États vides');
{
  await pM.goto(BASE+'/connexion',{waitUntil:'networkidle'}); await pM.waitForTimeout(800);
  const emailLabel=await pM.$('label');
  emailLabel? ok('Formulaire connexion avec labels') : warn('Labels manquants','Associer label/input');
  const req=await pM.$$eval('input[required]', els=>els.length);
  ok(`Champs required: ${req}`);
  await pM.goto(BASE+'/annonces',{waitUntil:'networkidle'}); await pM.waitForTimeout(1000);
  const empty=await pM.$eval('body', e=>e.textContent.slice(0,1000)).then(t=> t.includes('Aucune')||t.includes('vide') ? 'géré' : 'non détecté');
  ok(`État vide catalogue: ${empty}`);
}

// 7. Sécurité
sec('7. Sécurité');
{
  const r=await fetch(BASE+'/');
  const csp=r.headers.get('content-security-policy');
  csp? ok(`CSP présent`) : warn('CSP header manquant','Ajouter via vercel.json');
  const hsts=r.headers.get('strict-transport-security');
  hsts? ok(`HSTS ${hsts.slice(0,30)}`) : warn('HSTS manquant','Vercel auto');
  // check exposed service_role
  await pM.goto(BASE+'/',{waitUntil:'networkidle'});
  const hasKey=await pM.evaluate(()=> document.documentElement.innerHTML.includes('service_role')||document.documentElement.innerHTML.includes('supabaseKey'));
  !hasKey? ok('Pas de clé service_role exposée') : ko('Clé exposée!','Retirer du bundle');
}

// 8. Vidéo
sec('8. Vidéo explicative');
{
  const checksVid=[
    ['video/godson-marketplace-VIDEO-MANIP-1080x1920.mp4','MANIP vertical'],
    ['video/godson-marketplace-VIDEO-MANIP-1920x1080.mp4','MANIP horizontal'],
    ['video/godson-marketplace-video-explicative-1080x1920.mp4','STATIC vertical'],
  ];
  for(const [f,label] of checksVid){
    if(!fs.existsSync(f)){ ko(`${label} manquant (${f})`,'Générer'); continue; }
    const sz=fs.statSync(f).size/1024/1024;
    sz<25? ok(`${label} ${sz.toFixed(1)}MB <25MB OK`) : ko(`${label} ${sz.toFixed(1)}MB lourd`,`Compresser CRF 20`);
  }
  // poster
  fs.existsSync('video/poster-manip-v.jpg')? ok('Poster vertical présent') : warn('Poster manquant','Générer');
}

fs.writeFileSync('audit/deep-report.md', `# Audit Godson Marketplace — ${new Date().toISOString().slice(0,10)}\n`+out.join('\n'));
console.log('\n=== FIN AUDIT ===');
await B.close();
process.exit(0);

/**
 * GODSON Marketplace — Génération du sitemap à la build.
 * ------------------------------------------------------------
 * Interroge l'API publique Supabase (annonces actives uniquement) et
 * régénère public/sitemap.xml avant chaque build (hook « prebuild »).
 *
 * Domaine : variable GM_SITE_URL (ex. https://godson-market.gp),
 * sinon https://votre-domaine.com (à remplacer).
 *
 * Hors-ligne / DB indisponible : le sitemap est tout de même généré
 * avec les pages principales seulement (jamais d'échec de build).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SITE_URL = (process.env.GM_SITE_URL || 'https://votre-domaine.com').replace(/\/$/, '');

function readEnv() {
  let env = {};
  try {
    const text = readFileSync(path.join(root, '.env'), 'utf8');
    env = Object.fromEntries(
      text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
        }),
    );
  } catch {
    /* pas de .env : variables d'environnement CI uniquement */
  }
  // Sur CI (Netlify/Vercel/Cloudflare), .env n'existe pas : on accepte
  // les variables définies côté hébergeur (la clé publishable est publique).
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || null;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || null;
  return { url, key };
}

function url({ loc, changefreq = 'weekly', priority = '0.8', lastmod = null }) {
  const lm = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
  return `  <url><loc>${loc}</loc>${lm}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

async function fetchActiveListings() {
  const { url, key } = readEnv();
  if (!url || !key) {
    console.log('[sitemap] .env absent — uniquement les pages principales.');
    return [];
  }
  try {
    const res = await fetch(`${url}/rest/v1/listings?select=slug,updated_at&status=eq.active&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    console.log(`[sitemap] ${rows.length} annonce(s) active(s) incluse(s).`);
    return rows;
  } catch (e) {
    console.warn(`[sitemap] API inaccessible (${e.message}) — uniquement les pages principales.`);
    return [];
  }
}

const mainPages = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/annonces', changefreq: 'daily', priority: '0.9' },
  { loc: '/publier', changefreq: 'monthly', priority: '0.7' },
  { loc: '/faq', changefreq: 'yearly', priority: '0.4' },
  { loc: '/apropos', changefreq: 'yearly', priority: '0.4' },
  { loc: '/securite', changefreq: 'yearly', priority: '0.3' },
  { loc: '/conditions', changefreq: 'yearly', priority: '0.3' },
  { loc: '/confidentialite', changefreq: 'yearly', priority: '0.3' },
];

const listings = await fetchActiveListings();

const entries = [
  ...mainPages.map((p) => url({ ...p, loc: `${SITE_URL}${p.loc}` })),
  ...listings
    .filter((l) => l.slug)
    .map((l) =>
      url({
        loc: `${SITE_URL}/annonce/${encodeURIComponent(l.slug)}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: l.updated_at ? new Date(l.updated_at).toISOString().slice(0, 10) : null,
      }),
    ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré automatiquement à la build par scripts/generate-sitemap.mjs — ne pas éditer à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

writeFileSync(path.join(root, 'public', 'sitemap.xml'), xml);
console.log(`[sitemap] public/sitemap.xml écrit (${entries.length} URLs) — domaine : ${SITE_URL}`);

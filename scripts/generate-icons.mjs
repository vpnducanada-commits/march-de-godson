/**
 * Génère les icônes PNG de l'application (monogramme GM) sans dépendance
 * externe : encodeur PNG minimal (zlib natif) + super-échantillonnage 4x.
 *
 * Geometry (viewBox 64×64) :
 *  - G : anneau (centre 25,32 · r 16.5 · demi-largeur 3) ouvert de ±60° à droite
 *    + barre (25,32)→(38.5,32)
 *  - M : polyligne (43,48)(43,16)(52,38)(61,16)(61,48) · demi-largeur 2.75
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- encodeur PNG minimal ----------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtre None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- géométrie ----------
const NAVY = [10, 22, 51];
const WHITE = [255, 255, 255];
const GOLD = [245, 184, 46];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Distance point-segment. */
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp01(t);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const M_SEGS = [
  [43, 48, 43, 16],
  [43, 16, 52, 38],
  [52, 38, 61, 16],
  [61, 16, 61, 48],
];

function coverage(x, y) {
  // Anneau du G (centre 25,32, r 16.5, demi-largeur 3)
  const dx = x - 25;
  const dy = y - 32;
  const dist = Math.hypot(dx, dy);
  const ringD = Math.abs(dist - 16.5);
  let gCov = clamp01(3 - ringD + 0.5);
  if (gCov > 0) {
    // Ouverture à droite : angle ±60°, fondu 6°
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
    const a = Math.abs(ang);
    gCov *= clamp01((a - 60) / 6);
  }
  // Barre du G
  const tongue = clamp01(3 - segDist(x, y, 25, 32, 38.5, 32) + 0.5);
  const white = Math.max(gCov, tongue);

  // M
  let mD = Infinity;
  for (const [x1, y1, x2, y2] of M_SEGS) {
    const d = segDist(x, y, x1, y1, x2, y2);
    if (d < mD) mD = d;
  }
  const mCov = clamp01(2.75 - mD + 0.5);
  return { white, gold: mCov };
}

function roundedTileCov(x, y, radius) {
  // 64×64, coins arrondis ; 1 = à l'intérieur
  const r = radius;
  let cov = 1;
  if (x < r && y < r) cov = Math.min(cov, clamp01(r - Math.hypot(x - r, y - r) + 0.5));
  else if (x > 64 - r && y < r) cov = Math.min(cov, clamp01(r - Math.hypot(x - (64 - r), y - r) + 0.5));
  else if (x < r && y > 64 - r) cov = Math.min(cov, clamp01(r - Math.hypot(x - r, y - (64 - r)) + 0.5));
  else if (x > 64 - r && y > 64 - r) cov = Math.min(cov, clamp01(r - Math.hypot(x - (64 - r), y - (64 - r)) + 0.5));
  if (x < -0.6 || x > 64.6 || y < -0.6 || y > 64.6) cov = 0;
  return cov;
}

/**
 * Rend l'icône.
 * @param size pixels de sortie
 * @param rounded rayon des coins (0 = pleine surface, pour maskable)
 * @param scale échelle du monogramme (safe zone maskable)
 */
function renderIcon(size, rounded, scale = 1) {
  const SS = 4; // super-échantillonnage
  const rgba = Buffer.alloc(size * size * 4);
  const inv = 64 / size; // unités du viewBox par pixel
  let o = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // position dans le viewBox 64 (centré, mis à l'échelle)
          const vu = (px + (sx + 0.5) / SS) * inv;
          const vv = (py + (sy + 0.5) / SS) * inv;
          const x = (vu - 32) / scale + 32;
          const y = (vv - 32) / scale + 32;
          const tile = rounded > 0 ? roundedTileCov(x, y, rounded) : x >= -0.5 && x <= 64.5 && y >= -0.5 && y <= 64.5 ? 1 : 0;
          if (tile <= 0) continue;
          const { white, gold } = coverage(x, y);
          let cr = NAVY[0], cg = NAVY[1], cb = NAVY[2];
          const w = Math.min(1, white);
          cr += (WHITE[0] - cr) * w;
          cg += (WHITE[1] - cg) * w;
          cb += (WHITE[2] - cb) * w;
          cr += (GOLD[0] - cr) * gold;
          cg += (GOLD[1] - cg) * gold;
          cb += (GOLD[2] - cb) * gold;
          r += cr; g += cg; b += cb; a += tile;
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      rgba[o] = alpha > 0 ? Math.round(r / n) : 0;
      rgba[o + 1] = alpha > 0 ? Math.round(g / n) : 0;
      rgba[o + 2] = alpha > 0 ? Math.round(b / n) : 0;
      rgba[o + 3] = Math.round(alpha * 255);
      o += 4;
    }
  }
  return encodePNG(size, size, rgba);
}

const out = (p) => `${__dirname}/../public/${p}`;
mkdirSync(out('icons'), { recursive: true });

const jobs = [
  ['icons/icon-192.png', 192, 14, 1],
  ['icons/icon-512.png', 512, 14, 1],
  ['icons/icon-maskable-512.png', 512, 0, 0.74],
  ['icons/apple-touch-icon-180.png', 180, 0, 0.8],
];

for (const [path, size, radius, scale] of jobs) {
  const png = renderIcon(size, radius, scale);
  writeFileSync(out(path), png);
  console.log(`✓ ${path} (${png.length} octets)`);
}

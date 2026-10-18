/**
 * GODSON Marketplace — régénère les icônes PWA / favicon à partir du logo.
 * ------------------------------------------------------------
 * Source : public/logo-symbol.png (symbole du logo, fond clair).
 * Cible  : public/favicon.png (64), public/icons/icon-192.png, icon-512.png,
 *          icon-maskable-512.png (safe zone 76 %), apple-touch-icon-180.png.
 *
 * Nécessite ImageMagick (`magick`) dans le PATH.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SRC = path.join(root, 'public', 'logo-symbol.png');

if (!existsSync(SRC)) {
  console.error('public/logo-symbol.png introuvable — placez d’abord le logo.');
  process.exit(1);
}

function run(args) {
  execFileSync('magick', args, { stdio: 'inherit' });
}

// Centre un symbole sur un carré de fond #FDFDFD avec un padding relatif.
function square(out, size, padPct) {
  const pad = Math.round((size * padPct) / 100);
  const max = size - 2 * pad;
  run([
    '-size', `${size}x${size}`, 'xc:#FDFDFD',
    '(', SRC, '-resize', `${max}x${max}`, ')',
    '-gravity', 'center', '-composite',
    '-depth', '8', '-strip', out,
  ]);
  console.log(`✓ ${path.relative(root, out)} (${size}×${size}, padding ${padPct} %)`);
}

const icons = path.join(root, 'public', 'icons');
square(path.join(root, 'public', 'favicon.png'), 64, 6);
square(path.join(icons, 'icon-192.png'), 192, 8);
square(path.join(icons, 'icon-512.png'), 512, 8);
square(path.join(icons, 'icon-maskable-512.png'), 512, 12);
square(path.join(icons, 'apple-touch-icon-180.png'), 180, 8);
console.log('Icônes de marque régénérées depuis logo-symbol.png.');

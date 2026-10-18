/**
 * Génère les images de démonstration (SVG) des annonces démo.
 * Visuellement identifiées comme placeholders (« Annonce de démonstration »).
 * Les icônes sont dessinées dans une boîte de 140 unités.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dirname}/../public/demo`;
mkdirSync(OUT, { recursive: true });

const ICONS = {
  smartphone: '<rect x="68" y="26" width="44" height="96" rx="9"/><path d="M84 108h12"/>',
  monitor: '<rect x="40" y="40" width="100" height="66" rx="6"/><path d="M80 106v14M60 120h40"/>',
  car: '<g transform="scale(5.83)"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></g>',
  moto: '<circle cx="52" cy="104" r="16"/><circle cx="128" cy="104" r="16"/><path d="M52 104 78 62h20l14 26M78 62 66 44h16M98 62l16-18h12l12 24"/>',
  sofa: '<path d="M40 78V58a10 10 0 0 1 10-10h60a10 10 0 0 1 10 10v20"/><path d="M20 88v16a8 8 0 0 0 8 8h84a8 8 0 0 0 8-8V88a10 10 0 0 0-20 0v8H40v-8a10 10 0 0 0-20 0Z"/><path d="M30 112v10M130 112v10"/>',
  shirt: '<g transform="translate(8,6) scale(0.85)"><path d="M128 36l-16-9a16 16 0 0 1-32 0L64 36a10 10 0 0 0-7 12l5 18a6 6 0 0 0 6 5h10v42a8 8 0 0 0 8 8h42a8 8 0 0 0 8-8V71h10a6 6 0 0 0 6-5l5-18a10 10 0 0 0-7-12Z"/></g>',
  camera: '<g transform="translate(8,4)"><path d="M122 52h-24l-10-14H42a12 12 0 0 0-12 12v52a12 12 0 0 0 12 12h80a12 12 0 0 0 12-12V50a12 12 0 0 0-12-12Z"/><circle cx="84" cy="82" r="20"/></g>',
  book: '<path d="M84 60v64M28 116a8 8 0 0 1-8-8V44a8 8 0 0 1 8-8h26a22 22 0 0 1 22 22 22 22 0 0 1 22-22h26a8 8 0 0 1 8 8v64a8 8 0 0 1-8 8h-32a16 16 0 0 0-16 16 16 16 0 0 0-16-16Z"/>',
  home: '<path d="M28 66 84 22l56 44v56a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10Z"/><path d="M64 132V92h40v40"/>',
  wrench: '<g transform="translate(18,18) scale(4.5)"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></g>',
  tag: '<path d="M122 30h-40a10 10 0 0 0-7 3L20 88a10 10 0 0 0 0 14l42 42a10 10 0 0 0 14 0l55-55a10 10 0 0 0 3-7V38a8 8 0 0 0-8-8Z"/><circle cx="62" cy="62" r="7"/>',
};

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svg({ icon, title, tint1, tint2, tag }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint1}"/>
      <stop offset="1" stop-color="${tint2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <g transform="translate(232,56) scale(2.4)" stroke="#0A1633" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
    ${ICONS[icon] || ICONS.tag}
  </g>
  <text x="400" y="452" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#0A1633">${escapeXml(title)}</text>
  <text x="400" y="492" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="19" fill="#667085">Image d'exemple — ${escapeXml(tag)}</text>
  <g>
    <rect x="24" y="24" width="236" height="40" rx="20" fill="#F5B82E"/>
    <text x="142" y="50" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15.5" font-weight="800" fill="#0A1633">ANNONCE DE DÉMONSTRATION</text>
  </g>
  <g transform="translate(704,544) scale(0.9)">
    <rect x="0" y="0" width="52" height="52" rx="11" fill="#0A1633"/>
    <path d="M 27.1 38.2 A 13.4 13.4 0 1 1 27.1 15.2" stroke="#fff" stroke-width="4.8" stroke-linecap="round" fill="none"/>
    <line x1="20.5" y1="26" x2="31" y2="26" stroke="#fff" stroke-width="4.8" stroke-linecap="round"/>
    <path d="M 35.2 40 L 35.2 14 L 42.4 31.6 L 49.6 14 L 49.6 40" stroke="#F5B82E" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

const items = [
  ['iphone.svg', 'smartphone', 'iPhone 13 Pro 256 Go', '#EEF3FC', '#DCE7F8', 'Téléphones'],
  ['dell.svg', 'monitor', 'Dell Latitude 5420', '#EDF7F0', '#D8EEE0', 'Informatique'],
  ['corolla.svg', 'car', 'Toyota Corolla 2016', '#FDF4E7', '#F8E4C4', 'Véhicules'],
  ['yamaha.svg', 'moto', 'Yamaha DT 125 — 2021', '#F0F3F8', '#DDE4F0', 'Motos'],
  ['canape.svg', 'sofa', 'Canapé 3 places', '#F7F1EA', '#EFE3D3', 'Maison'],
  ['robe.svg', 'shirt', 'Robe wax — taille M', '#FBF0F4', '#F4DDE8', 'Mode'],
  ['canon.svg', 'camera', 'Canon EOS 250D', '#F1F0FA', '#E0DEF4', 'Photo'],
  ['cours.svg', 'book', 'Cours Maths & Physique', '#EDF6FA', '#D9ECF5', 'Éducation'],
  ['appartement.svg', 'home', 'Appartement 2 chambres', '#F3F2EE', '#E6E4DA', 'Immobilier'],
  ['reparation.svg', 'wrench', 'Réparation informatique', '#F5F5F5', '#E4E6EA', 'Services'],
];

for (const [file, icon, title, t1, t2, tag] of items) {
  writeFileSync(`${OUT}/${file}`, svg({ icon, title, tint1: t1, tint2: t2, tag }));
  console.log(`✓ demo/${file}`);
}

writeFileSync(
  `${OUT}/placeholder.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#EDF1F7"/>
  <g stroke="#B6C0D4" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="320" y="220" width="160" height="120" rx="12"/>
    <circle cx="365" cy="265" r="14"/>
    <path d="M455 320l-38-34a12 12 0 0 0-17 0l-55 50"/>
  </g>
  <text x="400" y="420" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" fill="#8A94AB">Pas d'image</text>
</svg>`,
);
console.log('✓ demo/placeholder.svg');

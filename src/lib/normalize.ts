/**
 * Normalisation des accents côté client — DOIT rester strictement
 * identique à la fonction SQL `public.normalize_text()` pour que la
 * recherche insensible aux accents fonctionne (le client normalise la
 * requête, la colonne générée normalise les annonces).
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[ïî]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
    .replace(/œ/g, 'e');
}

/** Génère un slug URL propre à partir d'un titre. */
export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function randomSuffix(len = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Échappe les caractères spéciaux LIKE pour un motif sécurisé. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => '\\' + c);
}

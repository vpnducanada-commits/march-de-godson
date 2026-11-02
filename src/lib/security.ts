/**
 * Utilitaires centraux de sécurité applicative (défense en profondeur côté client).
 * Complètent les politiques RLS, contraintes et triggers PostgreSQL côté Supabase.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vérifie strictement qu'une valeur est un UUID canonique (anti-injection PostgREST `.or()`). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

/**
 * Garantit qu'un chemin de redirection/navigation reste strictement interne à l'application.
 * Bloque `//domaine-externe`, `/\domaine-externe` (CVE-2025-68470), `javascript:`, `data:` et les caractères de contrôle.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = '/annonces'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//') || trimmed.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;
  return trimmed;
}

/**
 * Valide une URL de média (image, avatar, vidéo) avant affichage dans `src` / `href`.
 * Autorise uniquement HTTPS, les aperçus locaux `blob:` et les ressources statiques internes `/...`.
 */
export function safeMediaUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return trimmed;
  }
  if (trimmed.startsWith('blob:')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

/**
 * Protège l'export CSV contre l'injection de formules tableur (Excel / LibreOffice / Sheets — CWE-1236).
 * Tout champ débutant par `=`, `+`, `-`, `@`, tabulation ou retour chariot est neutralisé par `'`.
 */
export function escapeCsvCell(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Politique de robustesse pour les nouveaux mots de passe (inscription & changement).
 * N'affecte pas la connexion des comptes existants.
 */
export function validateStrongPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (password.length > 128) {
    return 'Le mot de passe ne doit pas dépasser 128 caractères.';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return null;
}

/**
 * Inspecte l'en-tête binaire réel (magic bytes) d'un fichier avant envoi vers Supabase Storage,
 * afin de bloquer tout fichier HTML/SVG/exécutable renommé en `.jpg` ou `.mp4`.
 */
export async function verifyMagicBytes(
  file: Blob,
  kind: 'image' | 'video',
): Promise<boolean> {
  try {
    const slice = file.slice(0, 16);
    const buf = new Uint8Array(await slice.arrayBuffer());
    if (buf.length < 12) return false;

    if (kind === 'image') {
      // JPEG : FF D8 FF
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      // PNG : 89 50 4E 47 0D 0A 1A 0A
      const isPng =
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a;
      // WebP : RIFF....WEBP
      const isWebp =
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50;
      return isJpeg || isPng || isWebp;
    }

    // Vidéo : MP4 / QuickTime (box 'ftyp' aux octets 4..7) ou WebM/Matroska (1A 45 DF A3)
    const isIsoBmff =
      buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    const isWebm =
      buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    return isIsoBmff || isWebm;
  } catch {
    return false;
  }
}

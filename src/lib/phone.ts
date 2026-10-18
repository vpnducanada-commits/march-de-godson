/**
 * Normalisation des numéros gabonais pour les liens de contact.
 * Formats acceptés : « 06 01 23 45 67 », « +241 06 01 23 45 67 », « 241 06 01 23 45 67 ».
 * Résultat : chiffres uniquement, préfixe international (241).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  // Format local gabonais : commence par 0 → on remplace par l'indicatif 241
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
    digits = '241' + digits.slice(1);
  }
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < 9 || digits.length > 13) return null;
  return digits;
}

/** Lien WhatsApp (wa.me) correctement construit, ou null si numéro invalide. */
export function whatsappLink(raw: string | null | undefined, message?: string): string | null {
  const num = normalizePhone(raw);
  if (!num) return null;
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Lien d'appel tel: ou null si numéro invalide. */
export function telLink(raw: string | null | undefined): string | null {
  const num = normalizePhone(raw);
  return num ? `tel:+${num}` : null;
}

/** Vérifie si un numéro saisi semble valide (pour le formulaire). */
export function isValidPhoneInput(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

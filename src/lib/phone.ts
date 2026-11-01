/**
 * Normalisation E.164 des numéros gabonais (+241) et internationaux pour WhatsApp et appels.
 * Formats acceptés :
 *  - Local gabonais 9 chiffres (plan ARCEP) : « 066 19 64 14 », « 074 66 95 38 », « 011 72 12 34 »
 *  - Local gabonais 8 chiffres sans le 0 : « 66 19 64 14 », « 74 66 95 38 »
 *  - Indicatif +241 avec ou sans le 0 national : « +241 66 19 64 14 », « +241 066 19 64 14 », « 00241 066 19 64 14 »
 * Résultat : chiffres E.164 uniquement sans « + » ni « 0 » national après 241 (ex. « 24166196414 »).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  // +241 suivi du 0 national gabonais (ex. 241 066 19 64 14 -> 24166196414)
  if (/^2410\d{7,8}$/.test(digits)) {
    digits = '241' + digits.slice(4);
  } else if (/^0\d{7,8}$/.test(digits)) {
    // Numéro gabonais local commençant par 0 (8 ou 9 chiffres -> 241 + reste)
    digits = '241' + digits.slice(1);
  } else if (/^[167]\d{7}$/.test(digits)) {
    // Numéro gabonais local saisi sans le 0 initial (ex. 66 19 64 14 / 74 66 95 38 / 11 72 12 34)
    digits = '241' + digits;
  } else if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
    digits = '241' + digits.slice(1);
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** Lien WhatsApp (wa.me) correctement construit en E.164, ou null si numéro invalide. */
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

/** Vérifie si un numéro saisi est valide (pour les formulaires d'annonce). */
export function isValidPhoneInput(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

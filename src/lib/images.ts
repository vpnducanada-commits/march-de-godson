const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 Mo avant compression
export const MAX_IMAGES = 6;

export function isAllowedImage(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type);
}

export function validateImage(file: File): string | null {
  if (!isAllowedImage(file)) return 'Format non accepté. Utilisez une image JPG, PNG ou WebP.';
  if (file.size > MAX_IMAGE_SIZE) return 'Image trop lourde (maximum 4 Mo).';
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire cette image.'));
    };
    img.src = url;
  });
}

/**
 * Compresse l'image côté navigateur (dimension max + qualité JPEG)
 * pour alléger l'envoi et l'affichage sur réseaux mobiles.
 */
export async function processImage(file: File, maxDim = 1400, quality = 0.82): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Compression non supportée par ce navigateur.');
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Échec de la compression de l\'image.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

export function objectUrlFor(file: File | Blob): string {
  return URL.createObjectURL(file);
}

export function revokeUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

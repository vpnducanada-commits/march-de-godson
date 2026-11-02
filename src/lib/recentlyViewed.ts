const KEY = 'gm:recent_slugs';
const MAX_RECENT = 6;

export function getViewedSlugs(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordViewedSlug(slug: string): void {
  if (!slug) return;
  try {
    const prev = getViewedSlugs().filter((s) => s !== slug);
    const next = [slug, ...prev].slice(0, MAX_RECENT);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function clearViewedSlugs(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore
  }
}

const DB_NAME = 'gm_offline';
const STORE = 'listings';
const DB_VERSION = 1;
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slug' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function cacheListings(items: any[]) {
  try { const db = await open(); const tx = db.transaction(STORE, 'readwrite'); const s = tx.objectStore(STORE); for (const it of items) { s.put({ slug: it.listing.slug, data: it, ts: Date.now() }); } db.close(); } catch {}
}
export async function getCachedListings(): Promise<any[]> {
  try { const db = await open(); return await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readonly'); const s = tx.objectStore(STORE); const req = s.getAll(); req.onsuccess = () => res((req.result || []).map((r: any) => r.data)); req.onerror = () => rej(req.error); }); } catch { return []; }
}

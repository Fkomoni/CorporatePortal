// Server-side in-memory cache with 24-hour TTL and midnight auto-bust.
// Works on a single Render instance. Pass fresh=true to bypass the cache.

interface CacheEntry<T> {
  data: T;
  cachedDate: string; // 'YYYY-MM-DD' in UTC — busted automatically at midnight
  expiresAt: number;  // ms timestamp — 24 hr hard cap
}

const store = new Map<string, CacheEntry<unknown>>();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  // Bust if a new UTC day has started OR the 24-hr hard cap has passed
  if (entry.cachedDate !== todayUTC() || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, {
    data,
    cachedDate: todayUTC(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
}

export function cacheBust(keyPrefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export function cacheStats(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of store.entries()) {
    out[k] = `cached ${v.cachedDate}, expires ${new Date(v.expiresAt).toISOString()}`;
  }
  return out;
}

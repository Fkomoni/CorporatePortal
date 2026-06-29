interface CacheEntry<T> {
  data: T;
  cachedDate: string; // 'YYYY-MM-DD' UTC — for midnight auto-bust
  expiresAt: number;  // ms timestamp — 24hr hard cap
}

const store = new Map<string, CacheEntry<unknown>>();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const TTL_MS = 24 * 60 * 60 * 1000;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.cachedDate !== todayUTC() || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, cachedDate: todayUTC(), expiresAt: Date.now() + TTL_MS } as CacheEntry<unknown>);
}

export function cacheBust(keyPrefix: string): void {
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}

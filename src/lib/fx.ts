// Foreign-exchange rate lookup. Uses exchangerate.host (free, no key).
// 24-hour in-memory cache keyed by base currency. Falls back to last cached
// rate on provider failure; falls back to 1 if nothing cached.

interface RateSet {
  ts: number
  base: string
  rates: Record<string, number>
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'ee_fx_cache_v2'

// Module-level cache, per base. Survives within a single page load; persists
// across loads via localStorage on the browser.
const memoryCache: Map<string, RateSet> = new Map()

function readPersistedCache(base: string): RateSet | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${base}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RateSet
    if (!parsed || typeof parsed.ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writePersistedCache(entry: RateSet): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_KEY}:${entry.base}`, JSON.stringify(entry))
  } catch {
    /* quota / unavailable — ignore */
  }
}

async function fetchRates(base: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`)
    if (!res.ok) return null
    const data = await res.json()
    const rates = data?.rates
    if (!rates || typeof rates !== 'object') return null
    return rates as Record<string, number>
  } catch {
    return null
  }
}

// In-flight promise per base — dedupes concurrent calls.
const inflight: Map<string, Promise<RateSet | null>> = new Map()

async function loadRateSet(base: string): Promise<RateSet | null> {
  const now = Date.now()

  const mem = memoryCache.get(base)
  if (mem && now - mem.ts < CACHE_TTL_MS) return mem

  const persisted = readPersistedCache(base)
  if (persisted && now - persisted.ts < CACHE_TTL_MS) {
    memoryCache.set(base, persisted)
    return persisted
  }

  const existing = inflight.get(base)
  if (existing) return existing

  const p = (async (): Promise<RateSet | null> => {
    const rates = await fetchRates(base)
    if (!rates) {
      if (persisted) return persisted
      if (mem) return mem
      console.warn(`[fx] rate fetch failed for base=${base}; no cache available`)
      return null
    }
    const entry: RateSet = { ts: Date.now(), base, rates }
    memoryCache.set(base, entry)
    writePersistedCache(entry)
    return entry
  })().finally(() => inflight.delete(base))

  inflight.set(base, p)
  return p
}

/**
 * Get exchange rate from `from` → `to`. Returns 1 for same currency.
 * On fetch failure with no cache, returns 1 (pass-through) and logs a warning.
 */
export async function getRate(from: string, to: string): Promise<number> {
  if (!from || !to) return 1
  const a = from.toUpperCase()
  const b = to.toUpperCase()
  if (a === b) return 1

  const set = await loadRateSet(a)
  if (!set) return 1

  const rate = set.rates[b]
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    // Try inverse: load the target base, invert.
    const inverse = await loadRateSet(b)
    if (inverse && inverse.rates[a]) return 1 / inverse.rates[a]
    console.warn(`[fx] no rate for ${a}->${b}`)
    return 1
  }
  return rate
}

/**
 * Synchronous version for render-time use. Returns the cached rate if present,
 * else 1. Callers that need fresh rates should call `getRate()` in an effect
 * or server action and seed the cache.
 */
export function getCachedRate(from: string, to: string): number {
  if (!from || !to) return 1
  const a = from.toUpperCase()
  const b = to.toUpperCase()
  if (a === b) return 1
  const set = memoryCache.get(a) ?? readPersistedCache(a)
  if (!set) return 1
  const rate = set.rates[b]
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return 1
  if (!memoryCache.has(a) && set) memoryCache.set(a, set)
  return rate
}

/**
 * Warm the cache for a base currency. Fire-and-forget in effects.
 */
export async function prefetchRates(base: string = 'USD'): Promise<void> {
  await loadRateSet(base.toUpperCase())
}

export function convertAmount(amount: number, from: string, to: string): number {
  const r = getCachedRate(from, to)
  return amount * r
}

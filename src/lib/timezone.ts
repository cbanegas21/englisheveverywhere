/**
 * Validate an IANA time-zone string before it is persisted or used to format
 * dates. An unchecked value would otherwise either silently corrupt a profile
 * (AUTH-02) or throw a RangeError deep inside a `toLocale`/`Intl` call at render
 * time (DASH-01). Uses the constructor's own validation so it stays correct as
 * the ICU zone database evolves (no hardcoded list).
 */
export function isValidTimeZone(tz: string | null | undefined): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// First-of-month at Honduras midnight (America/Tegucigalpa, UTC-6, no DST), as a
// UTC instant. THE canonical "this month" boundary, shared by the teacher
// dashboard, the earnings page, and the student progress page so all three bucket
// a month-edge class (e.g. the 1st at 02:00 UTC = the 31st 20:00 HN) identically
// in business time. Previously each computed its own boundary — ganancias in HN,
// teacher-home + progreso in server-UTC midnight — so they disagreed by one month
// on an HN-evening month-edge session (§7.7 cross-view count divergence).
export function hnStartOfMonthUtc(now: Date = new Date()): Date {
  const nowHn = new Date(now.toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }))
  return new Date(Date.UTC(nowHn.getFullYear(), nowHn.getMonth(), 1, 6, 0, 0))
}

export interface ZonedParts {
  year: number
  /** 0-indexed, matching Date.getMonth() / Date.UTC(). */
  month: number
  day: number
  hour: number
  minute: number
}

const PARTS_FMT_CACHE = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = PARTS_FMT_CACHE.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    PARTS_FMT_CACHE.set(tz, f)
  }
  return f
}

function rawParts(instant: Date, tz: string) {
  const map: Record<string, string> = {}
  for (const p of partsFormatter(tz).formatToParts(instant)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  // hourCycle h23 yields 00-23, but some engines emit '24' for midnight — normalize.
  const hour = Number(map.hour) % 24
  return {
    year: Number(map.year),
    month: Number(map.month) - 1,
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** Break a UTC instant into its wall-clock parts in `tz` (month 0-indexed). */
export function getZonedParts(instant: Date, tz: string): ZonedParts {
  const p = rawParts(instant, tz)
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute }
}

function offsetMs(instant: Date, tz: string): number {
  const p = rawParts(instant, tz)
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second)
  // Compare against the instant truncated to whole seconds (Date.UTC drops ms).
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Convert a wall-clock time expressed in `tz` to the absolute UTC instant.
 * Two-pass so it stays correct across DST transitions (the offset at the naive
 * guess can differ from the offset at the corrected instant). Month is 0-indexed.
 */
export function zonedWallTimeToUtc(
  year: number, month: number, day: number, hour: number, minute: number, tz: string,
): Date {
  // First guess: treat the wall-clock as if it were UTC, then back out the offset.
  const guess = Date.UTC(year, month, day, hour, minute, 0)
  const o1 = offsetMs(new Date(guess), tz)
  let utc = guess - o1
  const o2 = offsetMs(new Date(utc), tz)
  if (o2 !== o1) utc = guess - o2
  return new Date(utc)
}

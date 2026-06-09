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

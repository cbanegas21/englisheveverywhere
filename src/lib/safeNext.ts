// Validate a post-login redirect target ("next") to prevent open-redirect
// attacks. Only same-origin, root-relative locale paths (/es/… or /en/…) are
// allowed — never protocol-relative (//evil.com), absolute URLs, or backslash
// tricks browsers normalise to "/". Returns the safe path or null.
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  if (!/^\/(es|en)(\/|$)/.test(next)) return null
  return next
}

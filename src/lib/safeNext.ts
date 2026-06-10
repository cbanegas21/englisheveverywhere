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

// Role-scoped areas. A validated next= target is only honored post-login if it
// belongs to the signed-in user's own area — or the shared /sala room, which
// every role can join. Stops a teacher being deep-linked to a student-only path
// (and vice-versa); defense-in-depth on top of each area's own auth guard
// (Auth-LOW-next-path). Unknown role → not allowed → caller falls back to the
// role's default home.
const ROLE_AREAS: Record<string, RegExp> = {
  student: /^\/(es|en)\/(dashboard|sala)(\/|$)/,
  teacher: /^\/(es|en)\/(maestro|sala)(\/|$)/,
  admin: /^\/(es|en)\/(admin|sala)(\/|$)/,
}

export function pathAllowedForRole(path: string, role: string | null | undefined): boolean {
  if (!role) return false
  const area = ROLE_AREAS[role]
  return area ? area.test(path) : false
}

// Single source of truth for the proxy-level role fast-path cookie name.
// auth.ts SETS it, profile.ts CLEARS it on account deletion, and proxy.ts READS
// it. Keeping the name here prevents the kind of drift (ee-role vs ek_role) that
// previously left a deleted account's cookie alive. Layout guards remain the
// canonical auth source; this cookie is only a fast-path hint.
export const ROLE_COOKIE = 'ee-role'

// Inactivity-timeout marker — holds the last-seen timestamp. proxy.ts arms/reads
// it; auth.ts signOut + profile.ts deleteMyAccount CLEAR it so a stale marker
// can never outlive a session and pre-date the next login. Centralized here for
// the same reason as ROLE_COOKIE: to stop name drift between writer and reader.
export const SEEN_COOKIE = 'ee-seen'

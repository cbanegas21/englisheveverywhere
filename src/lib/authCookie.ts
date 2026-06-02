// Single source of truth for the proxy-level role fast-path cookie name.
// auth.ts SETS it, profile.ts CLEARS it on account deletion, and proxy.ts READS
// it. Keeping the name here prevents the kind of drift (ee-role vs ek_role) that
// previously left a deleted account's cookie alive. Layout guards remain the
// canonical auth source; this cookie is only a fast-path hint.
export const ROLE_COOKIE = 'ee-role'

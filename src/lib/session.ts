import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Request-scoped memoization (React `cache`). A dashboard load renders the layout
// AND the page in the SAME server request; before this, each independently called
// supabase.auth.getUser() — a NETWORK round-trip to Supabase Auth to validate the
// JWT — and each re-read the profiles row. That's 2× getUser + 2× profiles per
// load. Wrapping them in cache() collapses each to ONCE per request: the second
// caller gets the memoized result, no extra network hop.
//
// Auth semantics are unchanged — this is still getUser() validation, just not
// repeated within one render. The proxy's own getUser (src/proxy.ts) is a separate
// middleware pass that React cache() does not span, and it is required there for
// refresh-token rotation, so it stays as-is.

export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// The canonical profile row, selecting every column the dashboards need in one
// read (role + name for the layout's role-guard, timezone for the page). Returns
// null when unauthenticated.
export const getSessionProfile = cache(async () => {
  const user = await getSessionUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role, full_name, timezone')
    .eq('id', user.id)
    .maybeSingle()
  return data as { role: string | null; full_name: string | null; timezone: string | null } | null
})

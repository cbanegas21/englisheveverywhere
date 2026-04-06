import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses ALL RLS policies.
 * Use ONLY in server-side admin code after verifying role = 'admin'.
 * Never expose this to the browser or client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Match the Secure attribute the SERVER writers (server.ts, proxy.ts) force
      // on the same chunked sb-* cookie name in production. Without this the
      // browser client writes a non-Secure cookie that conflicts with the server's
      // Secure rewrite, which can make the server's getUser() miss a just-written
      // session. sameSite/path mirror @supabase/ssr's own defaults.
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      },
    }
  )
}

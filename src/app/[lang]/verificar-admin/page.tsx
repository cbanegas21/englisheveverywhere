import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VerifyAdminClient from './VerifyAdminClient'
import { locales, type Locale } from '@/lib/i18n/translations'

// AAL1 -> AAL2 step-up for admins with 2FA enrolled. Sits OUTSIDE /admin so the
// admin layout's 2FA gate can't loop back into it.
export default async function VerifyAdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Layout notFound() does not protect pages (they render in parallel) — a
  // dotted path skips the locale proxy and lands here with an invalid lang
  // (same class as the landing eyebrow crash, Sentry ENGLISHKOLAB-3/4/G).
  if (!locales.includes(lang as Locale)) notFound()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/${lang}/dashboard`)

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  // Already stepped up — nothing to do.
  if (aal?.currentLevel === 'aal2') redirect(`/${lang}/admin`)
  // No verified factor — there's nothing to challenge; send to enrollment.
  if (aal?.nextLevel !== 'aal2') redirect(`/${lang}/admin/seguridad`)

  return <VerifyAdminClient lang={lang as Locale} />
}

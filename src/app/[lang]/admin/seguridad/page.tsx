import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SeguridadClient from './SeguridadClient'
import type { Locale } from '@/lib/i18n/translations'

// Admin 2FA enrollment / management. The /admin layout already enforces the admin
// role (and the 2FA step-up), so reaching here means a verified admin.
export default async function SeguridadPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/${lang}/dashboard`)
  return <SeguridadClient lang={lang as Locale} />
}

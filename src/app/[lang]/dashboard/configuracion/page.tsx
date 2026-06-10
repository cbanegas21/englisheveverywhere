import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ConfigStudentClient from './ConfigStudentClient'
import type { Locale } from '@/lib/i18n/translations'
import type { NotificationPreferences } from '@/app/actions/profile'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function ConfiguracionPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Read own profile via the service-role client (scoped to user.id — own data
  // only). profiles.phone is column-revoked from the authenticated role (it
  // leaked to matched students through the "Students can read teacher profiles"
  // RLS policy, migration 033), so the user-scoped client can no longer select
  // it. Email comes from auth (user.email), never from profiles.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, avatar_url, timezone, phone, preferred_language, preferred_currency, notification_preferences')
    .eq('id', user.id)
    .single()

  // Billing history — read via the RLS-scoped client; the "Students read own
  // purchases" policy (migration 035) scopes rows to this user's student record.
  const { data: purchaseRows } = await supabase
    .from('student_purchases')
    .select('id, plan_key, amount_usd, classes_added, created_at')
    .order('created_at', { ascending: false })

  const purchases = (purchaseRows || []).map((p) => ({
    id: p.id as string,
    planKey: p.plan_key as string,
    amountUsd: Number(p.amount_usd) || 0,
    classesAdded: (p.classes_added as number) || 0,
    createdAt: p.created_at as string,
  }))

  return (
    <ConfigStudentClient
      lang={lang as Locale}
      fullName={(profile?.full_name as string) || ''}
      timezone={(profile?.timezone as string) || ''}
      email={user.email || ''}
      phone={(profile?.phone as string) || ''}
      avatarUrl={(profile?.avatar_url as string) || ''}
      preferredLanguage={((profile?.preferred_language as string) as 'es' | 'en') || lang as 'es' | 'en'}
      preferredCurrency={(profile?.preferred_currency as string) || 'USD'}
      notificationPreferences={(profile?.notification_preferences as NotificationPreferences) || {}}
      purchases={purchases}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTeacherAvailable } from '@/lib/teacherEarnings'
import PayoutsClient from './PayoutsClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

function getName(profile: unknown): string | null {
  if (!profile) return null
  if (Array.isArray(profile)) return (profile as { full_name: string | null }[])[0]?.full_name ?? null
  return (profile as { full_name: string | null }).full_name ?? null
}

export default async function AdminPayoutsPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // The payout ledger (pending + history), newest first.
  const { data: payoutRows } = await admin
    .from('teacher_payouts')
    .select('id, amount_usd, veem_email, status, created_at, paid_at, note, teacher:teachers(profile:profiles(full_name))')
    .order('created_at', { ascending: false })
    .limit(200)

  const payouts = (payoutRows || []).map((p) => ({
    id: p.id as string,
    teacherName: getName((p as { teacher?: { profile?: unknown } }).teacher?.profile),
    veemEmail: (p as { veem_email: string | null }).veem_email,
    amountUsd: Number((p as { amount_usd: number }).amount_usd || 0),
    status: (p as { status: string }).status,
    createdAt: (p as { created_at: string }).created_at,
    paidAt: (p as { paid_at: string | null }).paid_at,
    note: (p as { note: string | null }).note,
  }))

  // Ready-to-sweep preview: active teachers with a Veem email + an available
  // (cleared, uncommitted) balance — what the next "Run weekly sweep" will create.
  const { data: teachers } = await admin
    .from('teachers')
    .select('id, profile:profiles(full_name)')
    .not('payout_veem_email', 'is', null)
    .eq('is_active', true)

  const ready: { teacherId: string; name: string | null; veemEmail: string | null; availableUsd: number }[] = []
  for (const t of teachers || []) {
    const { availableUsd, veemEmail, hasPendingPayout } = await computeTeacherAvailable(admin, t.id as string)
    // Exclude teachers with an unpaid payout already queued — the sweep skips them
    // too (one pending per teacher), so the preview matches what the sweep creates.
    if (availableUsd >= 1 && !hasPendingPayout) ready.push({ teacherId: t.id as string, name: getName(t.profile), veemEmail, availableUsd })
  }
  ready.sort((a, b) => b.availableUsd - a.availableUsd)

  return <PayoutsClient lang={lang as Locale} ready={ready} payouts={payouts} />
}

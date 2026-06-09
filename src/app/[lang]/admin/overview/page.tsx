import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatLedger } from '@/components/ui/StatLedger'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

// Component-local bilingual copy — keeps admin overview in sync with the active
// locale without touching the shared translations file.
const STR = {
  en: {
    headerKicker: '↳ Admin · Platform snapshot',
    overview: 'Overview',
    thisMonth: 'this month',
    totalStudents: 'Total students',
    activeTeachers: 'Active teachers',
    pendingApplications: 'Pending applications',
    pendingBookings: 'Pending bookings',
    sessionsThisMonth: 'Sessions this month',
    teacherPayouts: 'Teacher payouts',
    recentBookings: 'Recent bookings',
    student: 'Student',
    teacher: 'Teacher',
    scheduled: 'Scheduled',
    status: 'Status',
    noBookings: 'No bookings yet.',
    statusLabel: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
    } as Record<string, string>,
  },
  es: {
    headerKicker: '↳ Admin · Resumen de la plataforma',
    overview: 'Resumen',
    thisMonth: 'de este mes',
    totalStudents: 'Total de estudiantes',
    activeTeachers: 'Maestros activos',
    pendingApplications: 'Solicitudes pendientes',
    pendingBookings: 'Reservas pendientes',
    sessionsThisMonth: 'Clases este mes',
    teacherPayouts: 'Pagos a maestros',
    recentBookings: 'Reservas recientes',
    student: 'Estudiante',
    teacher: 'Maestro',
    scheduled: 'Programada',
    status: 'Estado',
    noBookings: 'Aún no hay reservas.',
    statusLabel: {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      completed: 'Completada',
      cancelled: 'Cancelada',
    } as Record<string, string>,
  },
}

export default async function AdminOverviewPage({ params }: Props) {
  const { lang } = await params
  const locale = (lang === 'en' ? 'en' : 'es') as Locale
  const t = STR[locale]
  // Intl locale for user-visible date/time formatting.
  const dateLocale = locale === 'es' ? 'es-HN' : 'en-US'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Run all stat queries in parallel
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: totalStudents },
    { count: totalTeachers },
    { count: pendingApplications },
    { count: pendingBookings },
    { count: completedThisMonth },
    { data: revenueData },
  ] = await Promise.all([
    admin.from('students').select('id', { count: 'exact', head: true }),
    admin.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    // "Pending" = not yet approved. Includes both is_active=false AND
    // is_active IS NULL (which can happen if a pre-default row exists or
    // a migration didn't backfill). .eq('is_active', false) skips NULLs
    // and silently undercounts.
    admin.from('teachers').select('id', { count: 'exact', head: true }).not('is_active', 'is', true),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('bookings').select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('scheduled_at', startOfMonth.toISOString()),
    // Teacher payouts, not student-paid revenue. `payments.amount_usd` stores
    // the teacher's take-home ($14/session with platform_fee_usd=0 today) —
    // Stripe flow is deferred, so no student-paid rows exist to sum.
    admin.from('payments').select('amount_usd')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString()),
  ])

  const teacherPayoutsThisMonth = (revenueData || []).reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0)

  // Recent activity: last 8 bookings
  const { data: recentBookings } = await admin
    .from('bookings')
    .select(`
      id, scheduled_at, status,
      student:students(profile:profiles(full_name)),
      teacher:teachers(profile:profiles(full_name))
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  // Editorial ledger: box-less stats divided by hairline rules. The two
  // actionable/at-attention figures (pending applications + pending bookings)
  // read in the red accent; the rest stay ink. No colored icon tiles.
  const ledgerItems = [
    { kicker: t.totalStudents, value: totalStudents ?? 0, href: `/${lang}/admin/students` },
    { kicker: t.activeTeachers, value: totalTeachers ?? 0, href: `/${lang}/admin/teachers` },
    { kicker: t.pendingApplications, value: pendingApplications ?? 0, accent: (pendingApplications ?? 0) > 0, href: `/${lang}/admin/teachers` },
    { kicker: t.pendingBookings, value: pendingBookings ?? 0, accent: (pendingBookings ?? 0) > 0, href: `/${lang}/admin/bookings` },
    { kicker: t.sessionsThisMonth, value: completedThisMonth ?? 0 },
    { kicker: t.teacherPayouts, value: `$${teacherPayoutsThisMonth.toFixed(0)}` },
  ]

  // Status reads CRIMSON for anything needing attention (pending), INK for the
  // settled states. No green/amber/blue pills.
  const statusLabel = t.statusLabel
  function statusStyle(status: string): React.CSSProperties {
    const attention = status === 'pending'
    return {
      fontFamily: 'var(--ek-font-mono)',
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontWeight: 600,
      color: attention ? 'var(--ek-red)' : 'var(--ek-text-muted)',
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div
          style={{
            fontFamily: 'var(--ek-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ek-text-muted)',
            marginBottom: 6,
          }}
        >
          {t.headerKicker}
        </div>
        <h1
          style={{
            fontFamily: 'var(--ek-font-sans)',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: 'var(--ek-text)',
            lineHeight: 1.1,
          }}
        >
          {t.overview} <span style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ek-text-muted)' }}>{t.thisMonth}</span>
        </h1>
        <p style={{ fontSize: 13, marginTop: 6, color: 'var(--ek-text-muted)' }}>
          {new Date().toLocaleDateString(dateLocale, { month: 'long', year: 'numeric', timeZone: 'America/Tegucigalpa' })}
        </p>
      </div>

      {/* Stat ledger — editorial, box-less */}
      <div className="mb-10">
        <StatLedger items={ledgerItems} />
      </div>

      {/* Recent bookings — hairline-ruled table, no boxes */}
      <section>
        <SectionHeader title={t.recentBookings} />
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t.student, t.teacher, t.scheduled, t.status].map(h => (
                  <th
                    key={h}
                    className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      color: 'var(--ek-text-muted)',
                      fontFamily: 'var(--ek-font-mono)',
                      letterSpacing: '0.1em',
                      borderBottom: '1px solid var(--ek-border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentBookings || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-[15px] italic"
                    style={{ fontFamily: 'var(--ek-font-serif)', color: 'var(--ek-text-muted)' }}
                  >
                    {t.noBookings}
                  </td>
                </tr>
              ) : (recentBookings || []).map((b: any) => {
                // Supabase can return a nested to-one join as an array — guard both
                // shapes so names don't silently render as "—" (audit EK-050).
                const sp = Array.isArray(b.student?.profile) ? b.student.profile[0] : b.student?.profile
                const tp = Array.isArray(b.teacher?.profile) ? b.teacher.profile[0] : b.teacher?.profile
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--ek-border-soft)' }}>
                    <td className="py-3.5 text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>
                      {sp?.full_name || '—'}
                    </td>
                    <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>
                      {tp?.full_name || '—'}
                    </td>
                    <td className="py-3.5 text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>
                      {new Date(b.scheduled_at).toLocaleString(dateLocale, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        timeZone: 'America/Tegucigalpa',
                      })}
                    </td>
                    <td className="py-3.5">
                      <span style={statusStyle(b.status)}>
                        {statusLabel[b.status] || statusLabel.pending}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

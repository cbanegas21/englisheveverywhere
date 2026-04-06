import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Users, GraduationCap, CalendarClock, DollarSign, Clock, UserCheck } from 'lucide-react'

interface Props { params: Promise<{ lang: string }> }

export default async function AdminOverviewPage({ params }: Props) {
  const { lang } = await params
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
    admin.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', false),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('bookings').select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('scheduled_at', startOfMonth.toISOString()),
    admin.from('payments').select('amount_usd')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString()),
  ])

  const revenueThisMonth = (revenueData || []).reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0)

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

  const stats = [
    {
      label: 'Total Students',
      value: totalStudents ?? 0,
      icon: Users,
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.08)',
    },
    {
      label: 'Active Teachers',
      value: totalTeachers ?? 0,
      icon: GraduationCap,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
    },
    {
      label: 'Pending Applications',
      value: pendingApplications ?? 0,
      icon: UserCheck,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
    },
    {
      label: 'Pending Bookings',
      value: pendingBookings ?? 0,
      icon: CalendarClock,
      color: '#C41E3A',
      bg: 'rgba(196,30,58,0.08)',
    },
    {
      label: 'Sessions This Month',
      value: completedThisMonth ?? 0,
      icon: Clock,
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.08)',
    },
    {
      label: 'Revenue This Month',
      value: `$${revenueThisMonth.toFixed(0)}`,
      icon: DollarSign,
      color: '#059669',
      bg: 'rgba(5,150,105,0.08)',
    },
  ]

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: 'rgba(245,158,11,0.1)',  color: '#D97706', label: 'Pending' },
    confirmed: { bg: 'rgba(16,185,129,0.1)',  color: '#059669', label: 'Confirmed' },
    completed: { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Completed' },
    cancelled: { bg: 'rgba(107,114,128,0.1)', color: '#6B7280', label: 'Cancelled' },
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-black" style={{ color: '#111111' }}>Overview</h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
          Platform snapshot — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl p-5 flex items-start gap-4"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: bg }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[24px] font-black leading-none" style={{ color: '#111111' }}>{value}</p>
              <p className="text-[12px] mt-1.5 font-medium" style={{ color: '#6B7280' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #E5E7EB' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>Recent Bookings</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Student', 'Teacher', 'Scheduled', 'Status'].map(h => (
                <th
                  key={h}
                  className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(recentBookings || []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                  No bookings yet.
                </td>
              </tr>
            ) : (recentBookings || []).map((b: any) => {
              const sc = statusColors[b.status] || statusColors.pending
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="px-6 py-3.5 text-[13px] font-medium" style={{ color: '#111111' }}>
                    {b.student?.profile?.full_name || '—'}
                  </td>
                  <td className="px-6 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {b.teacher?.profile?.full_name || '—'}
                  </td>
                  <td className="px-6 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {new Date(b.scheduled_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {sc.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

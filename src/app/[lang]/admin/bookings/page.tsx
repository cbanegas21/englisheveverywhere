import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BookingAssign from './BookingAssign'

interface Props { params: Promise<{ lang: string }> }

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.1)',  color: '#D97706', label: 'Pending' },
  confirmed: { bg: 'rgba(16,185,129,0.1)',  color: '#059669', label: 'Confirmed' },
  completed: { bg: 'rgba(59,130,246,0.1)',  color: '#2563EB', label: 'Completed' },
  cancelled: { bg: 'rgba(107,114,128,0.1)', color: '#6B7280', label: 'Cancelled' },
}

export default async function AdminBookingsPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  // Pending bookings that need assignment/confirmation
  const { data: pendingBookings } = await admin
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(id, profile:profiles(full_name, email)),
      teacher:teachers(id, profile:profiles(full_name))
    `)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })

  // All active teachers (for the assignment dropdown)
  const { data: allTeachers } = await admin
    .from('teachers')
    .select('id, profile:profiles(full_name)')
    .eq('is_active', true)

  const teachers = (allTeachers || []).map((t: any) => ({
    id: t.id,
    name: t.profile?.full_name || 'Unknown',
  }))

  // Recent confirmed/completed bookings for context
  const { data: recentBookings } = await admin
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, status,
      student:students(profile:profiles(full_name)),
      teacher:teachers(profile:profiles(full_name))
    `)
    .in('status', ['confirmed', 'completed', 'cancelled'])
    .order('scheduled_at', { ascending: false })
    .limit(10)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-black" style={{ color: '#111111' }}>Bookings</h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
          {pendingBookings?.length ?? 0} pending assignment
        </p>
      </div>

      {/* Pending — needs assignment */}
      <section className="mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          {(pendingBookings?.length ?? 0) > 0 && (
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#C41E3A' }} />
          )}
          <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>Needs Assignment</h2>
          {(pendingBookings?.length ?? 0) > 0 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(196,30,58,0.1)', color: '#C41E3A' }}
            >
              {pendingBookings?.length}
            </span>
          )}
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Student', 'Scheduled', 'Duration', 'Current Teacher', 'Assign & Confirm'].map(h => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(pendingBookings || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                    No pending bookings. All caught up!
                  </td>
                </tr>
              ) : (pendingBookings || []).map((b: any) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-medium" style={{ color: '#111111' }}>
                      {b.student?.profile?.full_name || '—'}
                    </p>
                    <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{b.student?.profile?.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[13px]" style={{ color: '#111111' }}>
                      {new Date(b.scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </p>
                    <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                      {new Date(b.scheduled_at).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {b.duration_minutes} min
                  </td>
                  <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {b.teacher?.profile?.full_name || (
                      <span style={{ color: '#9CA3AF' }}>Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <BookingAssign
                      bookingId={b.id}
                      currentTeacherId={b.teacher?.id || null}
                      teachers={teachers}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="text-[14px] font-bold mb-4" style={{ color: '#111111' }}>Recent Activity</h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Student', 'Teacher', 'Scheduled', 'Duration', 'Status'].map(h => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
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
                  <td colSpan={5} className="px-5 py-8 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                    No booking history yet.
                  </td>
                </tr>
              ) : (recentBookings || []).map((b: any) => {
                const sc = STATUS_COLORS[b.status] || STATUS_COLORS.pending
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td className="px-5 py-3.5 text-[13px] font-medium" style={{ color: '#111111' }}>
                      {b.student?.profile?.full_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                      {b.teacher?.profile?.full_name || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px]" style={{ color: '#111111' }}>
                        {new Date(b.scheduled_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })}
                      </p>
                      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {new Date(b.scheduled_at).toLocaleTimeString('en-US', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                      {b.duration_minutes} min
                    </td>
                    <td className="px-5 py-3.5">
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
      </section>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ lang: string }> }

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  A1: { bg: 'rgba(156,163,175,0.15)', color: '#6B7280' },
  A2: { bg: 'rgba(96,165,250,0.15)',  color: '#2563EB' },
  B1: { bg: 'rgba(52,211,153,0.15)',  color: '#059669' },
  B2: { bg: 'rgba(167,139,250,0.15)', color: '#7C3AED' },
  C1: { bg: 'rgba(251,146,60,0.15)',  color: '#EA580C' },
  C2: { bg: 'rgba(196,30,58,0.15)',   color: '#C41E3A' },
}

export default async function AdminStudentsPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  const { data: students } = await admin
    .from('students')
    .select(`
      id,
      level,
      classes_remaining,
      created_at,
      profile:profiles(id, full_name, email, created_at)
    `)
    .order('created_at', { ascending: false })

  const { count: total } = await admin
    .from('students')
    .select('id', { count: 'exact', head: true })

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black" style={{ color: '#111111' }}>Students</h1>
          <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
            {total ?? 0} registered student{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #E5E7EB' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Name', 'Email', 'Level', 'Classes Left', 'Joined'].map(h => (
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
            {(students || []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                  No students yet.
                </td>
              </tr>
            ) : (students || []).map((s: any) => {
              const lc = LEVEL_COLORS[s.level] || { bg: 'rgba(156,163,175,0.1)', color: '#6B7280' }
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: '#C41E3A' }}
                      >
                        {(s.profile?.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: '#111111' }}>
                        {s.profile?.full_name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {s.profile?.email || '—'}
                  </td>
                  <td className="px-6 py-3.5">
                    {s.level ? (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold"
                        style={{ background: lc.bg, color: lc.color }}
                      >
                        {s.level}
                      </span>
                    ) : (
                      <span className="text-[12px]" style={{ color: '#9CA3AF' }}>Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {s.classes_remaining ?? 0}
                  </td>
                  <td className="px-6 py-3.5 text-[12px]" style={{ color: '#9CA3AF' }}>
                    {new Date(s.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
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

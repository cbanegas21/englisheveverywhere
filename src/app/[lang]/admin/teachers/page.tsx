import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Star } from 'lucide-react'
import { ApproveRejectButtons, ActiveToggle } from './TeacherActions'

interface Props { params: Promise<{ lang: string }> }

export default async function AdminTeachersPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()

  const { data: activeTeachers } = await admin
    .from('teachers')
    .select(`
      id, bio, specializations, hourly_rate, rating, total_sessions, is_active,
      profile:profiles(id, full_name, email)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const { data: pendingTeachers } = await admin
    .from('teachers')
    .select(`
      id, bio, specializations, hourly_rate, created_at,
      profile:profiles(id, full_name, email)
    `)
    .eq('is_active', false)
    .order('created_at', { ascending: false })

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-black" style={{ color: '#111111' }}>Teachers</h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7280' }}>
          {activeTeachers?.length ?? 0} active · {pendingTeachers?.length ?? 0} pending review
        </p>
      </div>

      {/* Pending Applications */}
      {(pendingTeachers?.length ?? 0) > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ background: '#F59E0B' }}
            />
            <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>
              Pending Applications
            </h2>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}
            >
              {pendingTeachers?.length}
            </span>
          </div>

          <div className="space-y-3">
            {(pendingTeachers || []).map((t: any) => (
              <div
                key={t.id}
                className="rounded-xl p-5"
                style={{ background: '#fff', border: '1px solid #E5E7EB' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    {/* Avatar */}
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                      style={{ background: '#C41E3A' }}
                    >
                      {(t.profile?.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold" style={{ color: '#111111' }}>
                        {t.profile?.full_name || 'Unknown'}
                      </p>
                      <p className="text-[12px]" style={{ color: '#6B7280' }}>{t.profile?.email}</p>
                      {/* Bio */}
                      <p className="text-[12px] mt-2 leading-relaxed" style={{ color: '#4B5563' }}>
                        {t.bio ? (t.bio.length > 200 ? t.bio.slice(0, 200) + '…' : t.bio) : 'No bio provided.'}
                      </p>
                      {/* Specs + rate */}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {(t.specializations || []).map((s: string) => (
                          <span
                            key={s}
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(196,30,58,0.07)', color: '#C41E3A' }}
                          >
                            {s}
                          </span>
                        ))}
                        {t.hourly_rate && (
                          <span className="text-[12px] font-semibold" style={{ color: '#111111' }}>
                            ${t.hourly_rate}/hr
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <ApproveRejectButtons
                      teacherId={t.id}
                      profileId={t.profile?.id}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Teachers */}
      <section>
        <h2 className="text-[14px] font-bold mb-4" style={{ color: '#111111' }}>Active Teachers</h2>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Teacher', 'Specializations', 'Rate', 'Rating', 'Sessions', 'Status'].map(h => (
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
              {(activeTeachers || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                    No active teachers yet.
                  </td>
                </tr>
              ) : (activeTeachers || []).map((t: any) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: '#C41E3A' }}
                      >
                        {(t.profile?.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: '#111111' }}>
                          {t.profile?.full_name || 'Unknown'}
                        </p>
                        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{t.profile?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(t.specializations || []).slice(0, 2).map((s: string) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(196,30,58,0.07)', color: '#C41E3A' }}
                        >
                          {s}
                        </span>
                      ))}
                      {(t.specializations || []).length > 2 && (
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                          +{t.specializations.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium" style={{ color: '#111111' }}>
                    ${t.hourly_rate}/hr
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                      <span className="text-[13px]" style={{ color: '#111111' }}>
                        {Number(t.rating).toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {t.total_sessions}
                  </td>
                  <td className="px-5 py-3.5">
                    <ActiveToggle teacherId={t.id} initialActive={t.is_active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

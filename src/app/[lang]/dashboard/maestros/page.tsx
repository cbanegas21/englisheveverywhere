import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

const t = {
  en: {
    title: 'My teacher',
    subtitle: 'Your teacher is personally assigned by our team based on your level and goals.',
    assignedLabel: 'Your assigned teacher',
    specialties: 'Specialties',
    viewProfile: 'View full profile',
    pendingTitle: 'Your teacher is being assigned',
    pendingBody: "Our team is matching you with the best teacher for your level and goals. You'll receive an email within 24 hours.",
    pendingNote: 'Questions? Write us at hola@englisheverywhere.com',
    sessions: 'sessions taught',
    rating: 'rating',
  },
  es: {
    title: 'Mi maestro',
    subtitle: 'Tu maestro es asignado personalmente por nuestro equipo según tu nivel y objetivos.',
    assignedLabel: 'Tu maestro asignado',
    specialties: 'Especialidades',
    viewProfile: 'Ver perfil completo',
    pendingTitle: 'Tu maestro está siendo asignado',
    pendingBody: 'Nuestro equipo te está emparejando con el mejor maestro para tu nivel y objetivos. Recibirás un correo en menos de 24 horas.',
    pendingNote: '¿Preguntas? Escríbenos a hola@englisheverywhere.com',
    sessions: 'clases impartidas',
    rating: 'calificación',
  },
}

export default async function MiMaestroPage({ params }: Props) {
  const { lang } = await params
  const tx = t[lang as Locale]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Get student's UUID first
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  const studentId = student?.id || ''

  // Get student's assigned teacher via bookings (most recent)
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      teacher:teachers(
        id,
        bio,
        specializations,
        rating,
        total_sessions,
        profile:profiles(full_name, avatar_url)
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const teacher = (booking?.teacher as any) || null

  function getInitials(name?: string) {
    if (!name) return '?'
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-2xl mx-auto">
        {teacher ? (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            {/* Card header label */}
            <div className="px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB', background: '#F3F4F6' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                {tx.assignedLabel}
              </p>
            </div>

            {/* Teacher info */}
            <div className="px-6 py-6">
              <div className="flex items-start gap-5 mb-6">
                {/* Avatar */}
                <div
                  className="h-16 w-16 rounded flex-shrink-0 flex items-center justify-center text-[18px] font-black overflow-hidden"
                  style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                >
                  {teacher.profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={teacher.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(teacher.profile?.full_name)
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-[18px] font-black mb-1" style={{ color: '#111111' }}>
                    {teacher.profile?.full_name || 'Your Teacher'}
                  </h2>
                  <div className="flex items-center gap-4 flex-wrap">
                    {teacher.rating && (
                      <span className="text-[13px]" style={{ color: '#4B5563' }}>
                        ★ {teacher.rating.toFixed(1)} {tx.rating}
                      </span>
                    )}
                    {teacher.total_sessions > 0 && (
                      <span className="text-[13px]" style={{ color: '#9CA3AF' }}>
                        {teacher.total_sessions} {tx.sessions}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio */}
              {teacher.bio && (
                <p className="text-[14px] leading-relaxed mb-5" style={{ color: '#4B5563' }}>
                  {teacher.bio}
                </p>
              )}

              {/* Specialties */}
              {teacher.specializations?.length > 0 && (
                <div className="mb-6">
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
                    {tx.specialties}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.specializations.map((s: string) => (
                      <span
                        key={s}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded"
                        style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.15)' }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/${lang}/dashboard/maestros/${teacher.id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded font-bold text-[13px] transition-all"
                style={{ background: '#C41E3A', color: '#fff' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
              >
                {tx.viewProfile} →
              </Link>
            </div>
          </div>
        ) : (
          /* No teacher assigned yet */
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div
              className="h-14 w-14 rounded mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'rgba(196,30,58,0.08)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <h2 className="text-[18px] font-black mb-2" style={{ color: '#111111' }}>{tx.pendingTitle}</h2>
            <p className="text-[14px] leading-relaxed max-w-sm mx-auto mb-4" style={{ color: '#4B5563' }}>
              {tx.pendingBody}
            </p>
            <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.pendingNote}</p>
          </div>
        )}
      </div>
    </div>
  )
}

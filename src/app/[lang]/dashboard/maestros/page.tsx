import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

interface TeacherProfile {
  full_name: string | null
  avatar_url: string | null
}

// Supabase PostgREST returns foreign-key joins as arrays; we normalize to single object after fetch
interface TeacherRow {
  id: string
  bio: string | null
  specializations: string[] | null
  profile: TeacherProfile | null
}

interface TeacherQueryResult {
  id: string
  bio: string | null
  specializations: string[] | null
  profile: TeacherProfile[] | TeacherProfile | null
}

const t = {
  en: {
    title: 'My teacher',
    subtitle: 'Your teacher is personally assigned by our team based on your level and goals.',
    assignedLabel: 'Your assigned teacher',
    specialties: 'Specialties',
    viewProfile: 'View full profile',
    pendingTitle: 'Your teacher is being assigned',
    pendingBody: 'Our team is matching you with the best teacher for your level and goals.',
    pendingNote: 'Questions? Write us at hola@englisheverywhere.com',
    assignedSoonTitle: 'Your teacher will be assigned soon',
    assignedSoonBody: "Once you complete your diagnostic call and purchase classes, we'll assign the perfect teacher for you based on your level and goals.",
    placementTitle: 'Schedule your free placement call',
    placementBody: 'Before we assign your teacher, complete your placement call so we can match you with the right level.',
    placementCta: 'Schedule placement call',
    placementScheduledTitle: 'Your placement call is scheduled',
    placementScheduledBody: 'After your placement call we\'ll match you with the right teacher for your level.',
    placementScheduledLabel: 'Scheduled for',
    sessions: 'sessions taught',
    rating: 'rating',
    errorMsg: 'Something went wrong. Please try again.',
  },
  es: {
    title: 'Mi maestro',
    subtitle: 'Tu maestro es asignado personalmente por nuestro equipo según tu nivel y objetivos.',
    assignedLabel: 'Tu maestro asignado',
    specialties: 'Especialidades',
    viewProfile: 'Ver perfil completo',
    pendingTitle: 'Tu maestro está siendo asignado',
    pendingBody: 'Nuestro equipo te está emparejando con el mejor maestro para tu nivel y objetivos.',
    pendingNote: '¿Preguntas? Escríbenos a hola@englisheverywhere.com',
    assignedSoonTitle: 'Tu maestra será asignada pronto',
    assignedSoonBody: 'Una vez que completes tu llamada diagnóstica y paguéis por clases, asignaremos a la mejor maestra para ti según tu nivel y objetivos.',
    placementTitle: 'Agenda tu llamada de diagnóstico gratuita',
    placementBody: 'Antes de asignarte un maestro, completa tu llamada de diagnóstico para poder emparejarte con el nivel correcto.',
    placementCta: 'Agendar llamada de diagnóstico',
    placementScheduledTitle: 'Tu llamada de diagnóstico está agendada',
    placementScheduledBody: 'Después de tu llamada te emparejaremos con la maestra adecuada para tu nivel.',
    placementScheduledLabel: 'Programada para',
    sessions: 'clases impartidas',
    rating: 'calificación',
    errorMsg: 'Ocurrió un error. Intenta de nuevo.',
  },
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

export default async function MiMaestroPage({ params }: Props) {
  const { lang } = await params
  const tx = t[lang as Locale]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  try {
    const { data: student } = await supabase
      .from('students')
      .select('id, placement_test_done, level')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!student) redirect(`/${lang}/onboarding`)

    const studentId = student.id
    const placementDone = student.placement_test_done ?? false
    const level = student.level || null

    // Detect a scheduled-but-not-yet-completed placement call
    const { data: placementBooking } = await supabase
      .from('bookings')
      .select('scheduled_at, status')
      .eq('student_id', studentId)
      .eq('type', 'placement_test')
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const placementScheduledAt = placementBooking?.scheduled_at || null

    let teacher: TeacherRow | null = null
    if (level && studentId) {
      // Get teacher ID from most recent confirmed/completed class booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('teacher_id')
        .eq('student_id', studentId)
        .eq('type', 'class')
        .in('status', ['confirmed', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (bookingError) {
        console.error('[maestros] Booking lookup error:', bookingError.code, bookingError.message)
      } else if (booking?.teacher_id) {
        // RLS policy "Students can read teacher profiles" allows this join for enrolled students
        const { data: teacherRow, error: teacherError } = await supabase
          .from('teachers')
          .select('id, bio, specializations, profile:profiles(full_name, avatar_url)')
          .eq('id', booking.teacher_id)
          .maybeSingle()
        if (teacherError) {
          console.error('[maestros] Teacher fetch error:', teacherError.message)
        } else if (teacherRow) {
          const raw = teacherRow as TeacherQueryResult
          // Normalize profile: PostgREST may return array or object depending on relationship type
          const profileData = Array.isArray(raw.profile) ? (raw.profile[0] ?? null) : raw.profile
          teacher = { ...raw, profile: profileData } as TeacherRow
        }
      }
    }

    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
        </div>

        <div className="px-8 py-6 max-w-2xl mx-auto">
          {!placementDone && !placementScheduledAt ? (
            /* State 1a: No placement call scheduled yet */
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="h-14 w-14 rounded mx-auto mb-5 flex items-center justify-center"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <h2 className="text-[18px] font-black mb-2" style={{ color: '#111111' }}>{tx.placementTitle}</h2>
              <p className="text-[14px] leading-relaxed max-w-sm mx-auto mb-6" style={{ color: '#4B5563' }}>
                {tx.placementBody}
              </p>
              <Link
                href={`/${lang}/dashboard/placement`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded font-bold text-[14px] transition-colors bg-[#C41E3A] hover:bg-[#9E1830] text-white"
              >
                {tx.placementCta} →
              </Link>
            </div>
          ) : !placementDone && placementScheduledAt ? (
            /* State 1b: Placement scheduled but not yet completed */
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="h-14 w-14 rounded mx-auto mb-5 flex items-center justify-center"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h2 className="text-[18px] font-black mb-2" style={{ color: '#111111' }}>{tx.placementScheduledTitle}</h2>
              <p className="text-[14px] leading-relaxed max-w-sm mx-auto mb-4" style={{ color: '#4B5563' }}>
                {tx.placementScheduledBody}
              </p>
              <div
                className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded"
                style={{ background: 'rgba(196,30,58,0.06)', border: '1px solid rgba(196,30,58,0.15)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#C41E3A' }}>
                  {tx.placementScheduledLabel}
                </p>
                <p className="text-[14px] font-bold" style={{ color: '#111111' }}>
                  {new Date(placementScheduledAt).toLocaleString(lang === 'es' ? 'es-HN' : 'en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                    timeZone: 'America/Tegucigalpa',
                  })}
                </p>
              </div>
            </div>
          ) : !level ? (
            /* State 2: Placement done, waiting for level + teacher assignment */
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
          ) : teacher ? (
            /* State 3: Level set AND teacher assigned */
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB', background: '#F3F4F6' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  {tx.assignedLabel}
                </p>
              </div>

              <div className="px-6 py-6">
                <div className="flex items-start gap-5 mb-6">
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
                  </div>
                </div>

                {teacher.bio && (
                  <p className="text-[14px] leading-relaxed mb-5" style={{ color: '#4B5563' }}>
                    {teacher.bio}
                  </p>
                )}

                {(teacher.specializations?.length ?? 0) > 0 && (
                  <div className="mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
                      {tx.specialties}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {teacher.specializations!.map((s) => (
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

              </div>
            </div>
          ) : (
            /* Level set but no confirmed teacher booking yet */
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
              <h2 className="text-[18px] font-black mb-2" style={{ color: '#111111' }}>{tx.assignedSoonTitle}</h2>
              <p className="text-[14px] leading-relaxed max-w-sm mx-auto mb-4" style={{ color: '#4B5563' }}>
                {tx.assignedSoonBody}
              </p>
              <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.pendingNote}</p>
            </div>
          )}
        </div>
      </div>
    )
  } catch (err) {
    console.error('[maestros] Unexpected error:', err)
    return (
      <div className="min-h-full" style={{ background: '#F9F9F9' }}>
        <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        </div>
        <div className="px-8 py-6 max-w-2xl mx-auto">
          <div className="rounded-xl p-8 text-center" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
            <p className="text-[14px] mb-4" style={{ color: '#9CA3AF' }}>{tx.errorMsg}</p>
            <Link
              href={`/${lang}/dashboard/maestros`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded font-bold text-[13px] transition-colors bg-[#C41E3A] hover:bg-[#9E1830] text-white"
            >
              {lang === 'es' ? 'Intentar de nuevo' : 'Try again'}
            </Link>
          </div>
        </div>
      </div>
    )
  }
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'
import { StatLedger } from '@/components/ui/StatLedger'

interface Props {
  params: Promise<{ lang: string }>
}

interface TeacherProfile {
  full_name: string | null
  avatar_url: string | null
}

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
    flourish: 'yours',
    subtitle: 'Hand-matched to your level and schedule · One teacher · Yours',
    assignedKicker: '↳ Your assigned teacher',
    specialties: 'Specialties',
    bioKicker: 'Bio',
    levelKicker: 'Your level',
    backupKicker: '↳ Backup coverage',
    backupBody:
      "When your teacher isn't free at a time you picked, another available teacher covers that class — so you're never stuck waiting.",
    pendingTitle: 'Your teacher is being assigned',
    pendingBody: 'Our team is matching you with the best teacher for your level and goals.',
    pendingNote: 'Questions? Write us at hola@englishkolab.com',
    assignedSoonTitle: 'A teacher is matched after you book',
    assignedSoonBody:
      "Once you book a class, we'll match you with an available teacher for that time based on your level and goals.",
    placementTitle: 'Schedule your free placement call',
    placementBody:
      'Take your free placement call so we can set your level and match you with the right teacher.',
    placementCta: 'Schedule placement call',
    placementScheduledTitle: 'Your placement call is scheduled',
    placementScheduledBody:
      "After your placement call we'll match you with the right teacher for your level.",
    placementScheduledLabel: 'Scheduled for',
    errorMsg: 'Something went wrong. Please try again.',
    tryAgain: 'Try again',
    yourTeacherFallback: 'Your teacher',
  },
  es: {
    title: 'Mi maestro',
    flourish: 'el tuyo',
    subtitle: 'Emparejado a mano con tu nivel y horario · Un maestro · El tuyo',
    assignedKicker: '↳ Tu maestro asignado',
    specialties: 'Especialidades',
    bioKicker: 'Bio',
    levelKicker: 'Tu nivel',
    backupKicker: '↳ Cobertura de respaldo',
    backupBody:
      'Si tu maestro no está libre a una hora que elegiste, otro maestro disponible cubre esa clase — para que nunca te quedes esperando.',
    pendingTitle: 'Tu maestro está siendo asignado',
    pendingBody:
      'Nuestro equipo te está emparejando con el mejor maestro para tu nivel y objetivos.',
    pendingNote: '¿Preguntas? Escríbenos a hola@englishkolab.com',
    assignedSoonTitle: 'Asignamos un maestro después de que reservas',
    assignedSoonBody:
      'Una vez que reserves una clase, te asignaremos un maestro disponible para esa hora según tu nivel y metas.',
    placementTitle: 'Agenda tu llamada de diagnóstico gratuita',
    placementBody:
      'Toma tu llamada de diagnóstico gratuita para definir tu nivel y emparejarte con el maestro adecuado.',
    placementCta: 'Agendar llamada de diagnóstico',
    placementScheduledTitle: 'Tu llamada de diagnóstico está agendada',
    placementScheduledBody:
      'Después de tu llamada te emparejaremos con el maestro adecuado para tu nivel.',
    placementScheduledLabel: 'Programada para',
    errorMsg: 'Ocurrió un error. Intenta de nuevo.',
    tryAgain: 'Intentar de nuevo',
    yourTeacherFallback: 'Tu maestro',
  },
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function EmptyStateCard({
  kicker,
  title,
  body,
  cta,
  ctaHref,
  detail,
}: {
  kicker?: string
  title: string
  body: string
  cta?: string
  ctaHref?: string
  detail?: { label: string; value: string }
}) {
  return (
    <div
      style={{
        background: 'var(--ek-card)',
        border: '1px solid var(--ek-border)',
        borderRadius: 16,
        padding: 'clamp(24px, 6vw, 40px)',
        textAlign: 'center',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      {kicker && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ek-text-muted)',
            marginBottom: 14,
            fontFamily: 'var(--ek-font-mono)',
          }}
        >
          {kicker}
        </div>
      )}
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--ek-text)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '12px auto 0',
          fontSize: 14,
          color: 'var(--ek-text-soft)',
          lineHeight: 1.55,
          maxWidth: 380,
        }}
      >
        {body}
      </p>
      {detail && (
        <div
          style={{
            display: 'inline-flex',
            gap: 14,
            marginTop: 22,
            textAlign: 'left',
          }}
        >
          {/* thin red hairline left-rule — quiet editorial accent, no tinted box */}
          <span
            aria-hidden="true"
            style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', flexShrink: 0 }}
          />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span
              className="ek-microlabel"
              style={{ color: 'var(--ek-red)' }}
            >
              {detail.label}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)' }}>
              {detail.value}
            </span>
          </span>
        </div>
      )}
      {cta && ctaHref && (
        <Link
          href={ctaHref}
          className="ek-btn ek-btn-red ek-btn-square"
          style={{ marginTop: 24, padding: '12px 22px', fontSize: 14 }}
        >
          {cta} →
        </Link>
      )}
    </div>
  )
}

export default async function MiMaestroPage({ params }: Props) {
  const { lang: rawLang } = await params
  const lang = (rawLang as Locale) || 'es'
  const tx = t[lang]

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  try {
    const { data: student } = await supabase
      .from('students')
      .select('id, placement_test_done, level, primary_teacher_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!student) redirect(`/${lang}/onboarding`)

    const studentId = student.id
    const placementDone = student.placement_test_done ?? false
    const level = student.level || null

    // Show times in the student's own timezone, not hardcoded Honduras (EK-012/044).
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle()
    const studentTz = (profileRow as { timezone?: string | null } | null)?.timezone || 'America/Tegucigalpa'

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
      // Prefer the student's designated primary teacher; fall back to the most
      // recent confirmed/completed booking's teacher only if none is set yet
      // (a one-off substitute should not show as "your teacher"). Audit EK-012.
      let teacherId: string | null = student.primary_teacher_id || null
      if (!teacherId) {
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
        } else {
          teacherId = booking?.teacher_id || null
        }
      }

      if (teacherId) {
        const { data: teacherRow, error: teacherError } = await supabase
          .from('teachers')
          .select('id, bio, specializations, profile:profiles(full_name, avatar_url)')
          .eq('id', teacherId)
          .maybeSingle()
        if (teacherError) {
          console.error('[maestros] Teacher fetch error:', teacherError.message)
        } else if (teacherRow) {
          const raw = teacherRow as TeacherQueryResult
          const profileData = Array.isArray(raw.profile) ? raw.profile[0] ?? null : raw.profile
          teacher = { ...raw, profile: profileData } as TeacherRow
        }
      }
    }

    return (
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar
          title={
            <span>
              {tx.title} <TitleFlourish>{tx.flourish}</TitleFlourish>
            </span>
          }
          sub={tx.subtitle}
        />

        <div style={{ padding: '28px clamp(16px, 4vw, 36px)', maxWidth: 1280, margin: '0 auto' }}>
          {!placementDone && !placementScheduledAt && (
            <EmptyStateCard
              kicker={tx.placementTitle.toUpperCase()}
              title={tx.placementTitle}
              body={tx.placementBody}
              cta={tx.placementCta}
              ctaHref={`/${lang}/dashboard/placement`}
            />
          )}

          {!placementDone && placementScheduledAt && (
            <EmptyStateCard
              kicker={tx.placementScheduledTitle.toUpperCase()}
              title={tx.placementScheduledTitle}
              body={tx.placementScheduledBody}
              detail={{
                label: tx.placementScheduledLabel,
                value: new Date(placementScheduledAt).toLocaleString(
                  lang === 'es' ? 'es-HN' : 'en-US',
                  {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                    timeZone: studentTz,
                  }
                ),
              }}
            />
          )}

          {placementDone && !level && (
            <EmptyStateCard
              title={tx.pendingTitle}
              body={`${tx.pendingBody}\n\n${tx.pendingNote}`}
            />
          )}

          {placementDone && level && !teacher && (
            <EmptyStateCard
              title={tx.assignedSoonTitle}
              body={`${tx.assignedSoonBody}\n\n${tx.pendingNote}`}
            />
          )}

          {placementDone && level && teacher && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
              {/* Teacher profile dark hero */}
              <DarkHeroCard
                ghost={getInitials(teacher.profile?.full_name)}
                ghostSize={280}
                ghostStyle={{ right: -20, top: -40 }}
                padding="32px 36px"
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ek-on-dark-muted)',
                    fontWeight: 700,
                    marginBottom: 14,
                    fontFamily: 'var(--ek-font-mono)',
                  }}
                >
                  {tx.assignedKicker}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #C41E3A, #8B1529)',
                      color: '#fff',
                      fontSize: 22,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {teacher.profile?.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={teacher.profile.avatar_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getInitials(teacher.profile?.full_name)
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
                        fontWeight: 800,
                        letterSpacing: '-0.025em',
                        color: 'var(--ek-on-dark)',
                        lineHeight: 1,
                      }}
                    >
                      {teacher.profile?.full_name || tx.yourTeacherFallback}
                    </h2>
                  </div>
                </div>

                {teacher.bio && (
                  <p
                    style={{
                      fontSize: 14.5,
                      color: 'var(--ek-on-dark-soft)',
                      lineHeight: 1.6,
                      marginBottom: 20,
                      maxWidth: 580,
                    }}
                  >
                    {teacher.bio}
                  </p>
                )}

                {(teacher.specializations?.length ?? 0) > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--ek-on-dark-muted)',
                        marginBottom: 10,
                        fontFamily: 'var(--ek-font-mono)',
                      }}
                    >
                      {tx.specialties}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {teacher.specializations!.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontFamily: 'var(--ek-font-mono)',
                            fontSize: 11,
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            padding: '5px 10px',
                            borderRadius: 'var(--ek-radius-xs)',
                            background: 'var(--ek-on-dark-faint)',
                            color: 'var(--ek-on-dark)',
                            border: '1px solid rgba(244,239,230,0.18)',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </DarkHeroCard>

              {/* Right: level (editorial ledger) + backup coverage (hairline rule) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'flex-start' }}>
                {level && (
                  <StatLedger
                    items={[
                      {
                        kicker: tx.levelKicker,
                        value: level,
                        href: `/${lang}/dashboard/progreso`,
                        accent: true,
                      },
                    ]}
                  />
                )}

                {/* Backup coverage — quiet 3px red hairline left-rule, no box */}
                <div style={{ display: 'flex', gap: 16 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', flexShrink: 0 }}
                  />
                  <div>
                    <div className="ek-microlabel" style={{ color: 'var(--ek-red)', marginBottom: 10 }}>
                      {tx.backupKicker}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13.5,
                        color: 'var(--ek-text-soft)',
                        lineHeight: 1.6,
                      }}
                    >
                      {tx.backupBody}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  } catch (err) {
    console.error('[maestros] Unexpected error:', err)
    return (
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar title={tx.title} />
        <div style={{ padding: '28px clamp(16px, 4vw, 36px)', maxWidth: 1280, margin: '0 auto' }}>
          <EmptyStateCard
            title={tx.errorMsg}
            body=""
            cta={tx.tryAgain}
            ctaHref={`/${lang}/dashboard/maestros`}
          />
        </div>
      </div>
    )
  }
}

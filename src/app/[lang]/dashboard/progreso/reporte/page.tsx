import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/translations'
import { planName } from '@/lib/pricing'
import ReportActions from './ReportActions'

interface Props { params: Promise<{ lang: string }> }

const STR = {
  en: {
    report: 'Progress report', student: 'Student', generated: 'Generated',
    level: 'Current level', completed: 'Classes completed', thisMonth: 'This month',
    upcoming: 'Upcoming', remaining: 'Classes remaining', plan: 'Current plan',
    recent: 'Recent classes', date: 'Date', duration: 'Duration', min: 'min',
    none: 'No completed classes yet.', goals: 'Goals', noPlan: 'No active plan',
    footer: 'Keep going — every class counts. — EnglishKolab',
    back: 'Back to My Progress', print: 'Print / Save as PDF', notSet: 'Not set yet',
  },
  es: {
    report: 'Informe de progreso', student: 'Estudiante', generated: 'Generado',
    level: 'Nivel actual', completed: 'Clases completadas', thisMonth: 'Este mes',
    upcoming: 'Próximas', remaining: 'Clases restantes', plan: 'Plan actual',
    recent: 'Clases recientes', date: 'Fecha', duration: 'Duración', min: 'min',
    none: 'Aún no tienes clases completadas.', goals: 'Objetivos', noPlan: 'Sin plan activo',
    footer: 'Sigue adelante — cada clase cuenta. — EnglishKolab',
    back: 'Volver a Mi Progreso', print: 'Imprimir / Guardar PDF', notSet: 'Aún sin definir',
  },
}

const LEVEL_LABEL: Record<string, { en: string; es: string }> = {
  A0: { en: 'Complete beginner', es: 'Principiante completo' },
  A1: { en: 'Beginner', es: 'Principiante' },
  A2: { en: 'Elementary', es: 'Elemental' },
  B1: { en: 'Intermediate', es: 'Intermedio' },
  B2: { en: 'Upper intermediate', es: 'Intermedio alto' },
  C1: { en: 'Advanced', es: 'Avanzado' },
  C2: { en: 'Mastery', es: 'Maestría' },
}
const GOAL_LABEL: Record<string, { en: string; es: string }> = {
  work: { en: 'Work', es: 'Trabajo' }, travel: { en: 'Travel', es: 'Viajes' },
  studies: { en: 'Studies', es: 'Estudios' }, growth: { en: 'Personal growth', es: 'Crecimiento personal' },
  emigrate: { en: 'Move abroad', es: 'Emigrar' }, other: { en: 'Other', es: 'Otro' },
}

export default async function ProgressReportPage({ params }: Props) {
  const { lang } = await params
  const locale = (lang === 'en' ? 'en' : 'es') as Locale
  const t = STR[locale]
  const loc = locale === 'es' ? 'es-HN' : 'en-US'

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, level, classes_remaining, current_plan, survey_answers')
    .eq('profile_id', user.id)
    .single()
  if (!student) redirect(`/${lang}/dashboard`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: completedTotal },
    { count: completedThisMonth },
    { count: upcomingClasses },
    { data: recentBookings },
  ] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('student_id', student.id).eq('type', 'class').eq('status', 'completed'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('student_id', student.id).eq('type', 'class').eq('status', 'completed').gte('scheduled_at', startOfMonth.toISOString()),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('student_id', student.id).eq('type', 'class').in('status', ['confirmed', 'pending']).gte('scheduled_at', new Date().toISOString()),
    supabase.from('bookings').select('scheduled_at, duration_minutes').eq('student_id', student.id).eq('type', 'class').eq('status', 'completed').order('scheduled_at', { ascending: false }).limit(8),
  ])

  const name = (profile?.full_name as string) || user.email || ''
  const level = (student.level as string) || null
  const levelLabel = level && LEVEL_LABEL[level] ? LEVEL_LABEL[level][locale] : t.notSet
  const planLabel = student.current_plan ? planName(student.current_plan as string, locale) : t.noPlan
  const generatedStr = new Date().toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Tegucigalpa' })

  const sa = (student.survey_answers as Record<string, unknown>) || {}
  const goalIds = Array.isArray(sa.goals) ? (sa.goals as unknown[]).filter((g): g is string => typeof g === 'string') : []
  const goalsText = goalIds.map(g => (GOAL_LABEL[g] ? GOAL_LABEL[g][locale] : g)).join(', ')

  const fmtRowDate = (iso: string) => new Date(iso).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Tegucigalpa' })

  const label = { fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700 as const, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--ek-text-muted)' }
  const statBox: React.CSSProperties = { border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-md)', padding: '14px 16px' }
  const statNum: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: 'var(--ek-text)', lineHeight: 1, fontFeatureSettings: '"tnum"' }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px 64px' }}>
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          #ek-report, #ek-report * { visibility: visible; }
          #ek-report { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 620 }}>
        <div id="ek-report" style={{ background: '#fff', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-md)', padding: '36px 40px', boxShadow: '0 4px 32px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 22, borderBottom: '1px solid var(--ek-border)' }}>
            <div>
              <div style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ek-text)' }}>EnglishKolab</div>
              <div style={{ ...label, marginTop: 4 }}>{t.generated} {generatedStr}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--ek-text)' }}>{t.report}</div>
              <div style={{ fontSize: 13, color: 'var(--ek-text-soft)', marginTop: 4 }}>{t.student}: {name}</div>
            </div>
          </div>

          {/* Level + goals */}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', padding: '20px 0', borderBottom: '1px solid var(--ek-border)' }}>
            <div>
              <div style={label}>{t.level}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)', marginTop: 4 }}>{level ? `${level} · ${levelLabel}` : t.notSet}</div>
            </div>
            {goalsText && (
              <div>
                <div style={label}>{t.goals}</div>
                <div style={{ fontSize: 14, color: 'var(--ek-text)', marginTop: 4 }}>{goalsText}</div>
              </div>
            )}
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '20px 0', borderBottom: '1px solid var(--ek-border)' }}>
            <div style={statBox}><div style={statNum}>{completedTotal || 0}</div><div style={{ ...label, marginTop: 6 }}>{t.completed}</div></div>
            <div style={statBox}><div style={statNum}>{completedThisMonth || 0}</div><div style={{ ...label, marginTop: 6 }}>{t.thisMonth}</div></div>
            <div style={statBox}><div style={statNum}>{upcomingClasses || 0}</div><div style={{ ...label, marginTop: 6 }}>{t.upcoming}</div></div>
            <div style={statBox}><div style={statNum}>{student.classes_remaining || 0}</div><div style={{ ...label, marginTop: 6 }}>{t.remaining}</div></div>
          </div>

          {/* Plan */}
          <div style={{ padding: '18px 0', borderBottom: '1px solid var(--ek-border)' }}>
            <div style={label}>{t.plan}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ek-text)', marginTop: 4 }}>{planLabel}</div>
          </div>

          {/* Recent classes */}
          <div style={{ paddingTop: 18 }}>
            <div style={{ ...label, marginBottom: 10 }}>{t.recent}</div>
            {(!recentBookings || recentBookings.length === 0) ? (
              <p style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>{t.none}</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {recentBookings.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--ek-border-soft)' }}>
                      <td style={{ padding: '9px 0', fontSize: 13, color: 'var(--ek-text)' }}>{fmtRowDate(b.scheduled_at as string)}</td>
                      <td style={{ padding: '9px 0', fontSize: 13, textAlign: 'right', color: 'var(--ek-text-soft)', fontFamily: 'var(--ek-font-mono)' }}>{(b.duration_minutes as number) || 60} {t.min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--ek-border)', fontSize: 12, color: 'var(--ek-text-soft)' }}>{t.footer}</div>
        </div>

        <ReportActions backHref={`/${lang}/dashboard/progreso`} printLabel={t.print} backLabel={t.back} />
      </div>
    </div>
  )
}

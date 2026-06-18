'use client'

import { useState, useTransition } from 'react'
import type { Locale } from '@/lib/i18n/translations'
import { teacherSetStudentLevel } from '@/app/actions/placement'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { Spinner } from '@/components/ui/Spinner'
import { StatLedger } from '@/components/ui/StatLedger'
import Drawer from '@/components/dashboard/Drawer'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const t = {
  en: {
    title: 'My Students',
    subtitle: 'Students who have had sessions with you.',
    noStudents: 'No students yet.',
    noStudentsSub: 'Students will appear here once they book a session with you.',
    sessions: 'sessions',
    level: 'Level',
    noLevel: 'No level',
    lastSession: 'Last session',
    totalStudents: 'Total students',
    totalSessions: 'Total sessions',
    active: 'Active',
    // Detail panel
    profile: 'Learning Profile',
    goal: 'Learning Goal',
    work: 'Occupation',
    style: 'Learning Style',
    age: 'Age Range',
    noIntake: 'This student has not completed their learning profile yet.',
    styles: { visual: 'Visual', auditory: 'Auditory', reading: 'Reading / Writing', mixed: 'Mixed' },
    ages: { under_18: 'Under 18', '18_25': '18–25', '26_40': '26–40', '40_plus': '40+' },
    setLevel: 'CEFR Level',
    setLevelHint: 'Update after the diagnostic call.',
    saveLevel: 'Save',
    savingLevel: 'Saving…',
    levelSaved: 'Level updated',
    studentKicker: 'Student',
  },
  es: {
    title: 'Mis Estudiantes',
    subtitle: 'Estudiantes que han tenido sesiones contigo.',
    noStudents: 'Todavía no tienes estudiantes.',
    noStudentsSub: 'Los estudiantes aparecerán aquí una vez que agenden una sesión contigo.',
    sessions: 'sesiones',
    level: 'Nivel',
    noLevel: 'Sin nivel',
    lastSession: 'Última sesión',
    totalStudents: 'Total estudiantes',
    totalSessions: 'Total sesiones',
    active: 'Activo',
    profile: 'Perfil de Aprendizaje',
    goal: 'Objetivo',
    work: 'Ocupación',
    style: 'Estilo de aprendizaje',
    age: 'Rango de edad',
    noIntake: 'Este estudiante aún no ha completado su perfil de aprendizaje.',
    styles: { visual: 'Visual', auditory: 'Auditivo', reading: 'Lectura / Escritura', mixed: 'Mixto' },
    ages: { under_18: 'Menos de 18', '18_25': '18–25', '26_40': '26–40', '40_plus': '40+' },
    setLevel: 'Nivel CEFR',
    setLevelHint: 'Actualízalo después de la llamada de diagnóstico.',
    saveLevel: 'Guardar',
    savingLevel: 'Guardando…',
    levelSaved: 'Nivel actualizado',
    studentKicker: 'Estudiante',
  },
}

interface Booking {
  student_id: string
  scheduled_at: string
  status: string
  student?: {
    level?: string | null
    learning_goal?: string | null
    work_description?: string | null
    learning_style?: string | null
    age_range?: string | null
    profile?: { full_name?: string; avatar_url?: string } | null
  } | null
}

interface StudentSummary {
  student_id: string
  name: string
  level: string | null
  learning_goal: string | null
  work_description: string | null
  learning_style: string | null
  age_range: string | null
  totalSessions: number
  lastSessionDate: string
}

function groupByStudent(bookings: Booking[]): StudentSummary[] {
  const map = new Map<string, StudentSummary>()

  for (const b of bookings) {
    const sid = b.student_id
    const existing = map.get(sid)
    const s = b.student as any
    const name = s?.profile?.full_name || 'Student'

    if (!existing) {
      map.set(sid, {
        student_id: sid,
        name,
        level: s?.level || null,
        learning_goal: s?.learning_goal || null,
        work_description: s?.work_description || null,
        learning_style: s?.learning_style || null,
        age_range: s?.age_range || null,
        totalSessions: 1,
        lastSessionDate: b.scheduled_at,
      })
    } else {
      existing.totalSessions += 1
      if (new Date(b.scheduled_at) > new Date(existing.lastSessionDate)) {
        existing.lastSessionDate = b.scheduled_at
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    new Date(b.lastSessionDate).getTime() - new Date(a.lastSessionDate).getTime()
  )
}

function formatDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    timeZone: 'America/Tegucigalpa', year: 'numeric', month: 'short', day: 'numeric',
  })
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

interface Props { lang: Locale; bookings: Booking[] }

export default function EstudiantesClient({ lang, bookings }: Props) {
  const tx = t[lang]
  const [localStudents, setLocalStudents] = useState(() => groupByStudent(bookings))
  const students = localStudents
  const totalSessionsAll = bookings.length
  const [detailStudent, setDetailStudent] = useState<StudentSummary | null>(null)
  const [levelInput, setLevelInput] = useState('')
  const [levelError, setLevelError] = useState('')
  const [levelSaved, setLevelSaved] = useState(false)
  const [isPendingLevel, startLevelTransition] = useTransition()

  // When the detail panel switches to a different student, reset the level
  // editor state. Using "adjust-state-on-change" (prev-value state) instead
  // of useEffect keeps this compiler-clean under react-hooks/set-state-in-effect.
  const currentDetailId = detailStudent?.student_id ?? null
  const [prevDetailId, setPrevDetailId] = useState<string | null>(currentDetailId)
  if (prevDetailId !== currentDetailId) {
    setPrevDetailId(currentDetailId)
    setLevelInput(detailStudent?.level || '')
    setLevelError('')
    setLevelSaved(false)
  }

  function handleSaveLevel() {
    if (!detailStudent || !levelInput) return
    setLevelError('')
    setLevelSaved(false)
    const targetId = detailStudent.student_id
    const targetLevel = levelInput
    startLevelTransition(async () => {
      const result = await teacherSetStudentLevel(targetId, targetLevel)
      if (result?.error) {
        setLevelError(result.error)
        return
      }
      setLevelSaved(true)
      setLocalStudents(prev => prev.map(s =>
        s.student_id === targetId ? { ...s, level: targetLevel } : s
      ))
      setDetailStudent(prev => prev ? { ...prev, level: targetLevel } : prev)
    })
  }

  const saveDisabled =
    isPendingLevel || !levelInput || levelInput === (detailStudent?.level || '')

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>

      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="px-4 sm:px-8 py-6 max-w-4xl mx-auto space-y-7">

        {/* Summary stats — editorial ledger: big numbers + hairline rules, no boxes. */}
        {students.length > 0 && (
          <StatLedger
            items={[
              { kicker: tx.totalStudents, value: students.length, accent: true },
              { kicker: tx.totalSessions, value: totalSessionsAll },
            ]}
          />
        )}

        {/* Students list */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--ek-border)',
              marginBottom: 18,
            }}
          >
            <div className="ek-microlabel">{tx.title}</div>
            {students.length > 0 && (
              <span
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 12,
                  color: 'var(--ek-text-muted)',
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {students.length}
              </span>
            )}
          </div>

          {students.length === 0 ? (
            <div className="py-14 text-center">
              <p
                className="text-[15px]"
                style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', color: 'var(--ek-text-soft)' }}
              >
                {tx.noStudents}
              </p>
              <p className="text-[12px] mt-2" style={{ color: 'var(--ek-text-muted)' }}>
                {tx.noStudentsSub}
              </p>
            </div>
          ) : (
            <ul style={{ borderTop: '1px solid var(--ek-border)' }}>
              {students.map((student) => (
                <li
                  key={student.student_id}
                  className="ek-row flex items-center gap-4 px-3 py-4 cursor-pointer"
                  style={{ borderBottom: '1px solid var(--ek-border-soft)' }}
                  onClick={() => setDetailStudent(student)}
                >
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-[13px] font-bold"
                    style={{
                      background: 'var(--ek-red-tint-2)',
                      color: 'var(--ek-red)',
                      borderRadius: 'var(--ek-radius-xs)',
                    }}
                  >
                    {getInitials(student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ek-text)' }}>
                      {student.name}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
                        {student.totalSessions} {tx.sessions}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
                        {tx.lastSession}: {formatDate(student.lastSessionDate, lang)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {student.level ? (
                      <span
                        className="text-[11px] font-bold"
                        style={{
                          fontFamily: 'var(--ek-font-mono)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ek-red)',
                        }}
                      >
                        {student.level}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.noLevel}</span>
                    )}
                    <span style={{ color: 'var(--ek-text-faint)', fontSize: 16, lineHeight: 1 }}>›</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Student detail slide-over */}
      <Drawer
        open={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        kicker={detailStudent ? tx.studentKicker : undefined}
        title={detailStudent?.name}
        footer={
          detailStudent ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-h-[18px] text-[11px]">
                {levelError ? (
                  <span style={{ color: 'var(--ek-red)' }}>{levelError}</span>
                ) : levelSaved ? (
                  <span style={{ color: 'var(--ek-text-soft)' }}>{tx.levelSaved}</span>
                ) : null}
              </div>
              <button
                onClick={handleSaveLevel}
                disabled={saveDisabled}
                className="ek-red-btn inline-flex items-center px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
                style={{ background: 'var(--ek-red)', color: '#fff', borderRadius: 'var(--ek-radius-xs)', border: 'none', cursor: saveDisabled ? 'default' : 'pointer' }}
              >
                {isPendingLevel ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner size={14} stroke="#fff" />
                    {tx.savingLevel}
                  </span>
                ) : (
                  tx.saveLevel
                )}
              </button>
            </div>
          ) : undefined
        }
      >
        {detailStudent && (
          <div className="space-y-6">
            <div className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>
              {detailStudent.totalSessions} {tx.sessions}
              {detailStudent.level && ` · ${detailStudent.level}`}
            </div>

            {/* CEFR level editor */}
            <div>
              <div className="ek-microlabel" style={{ color: 'var(--ek-red)', marginBottom: 4 }}>
                {tx.setLevel}
              </div>
              <p className="text-[11px] mb-2" style={{ color: 'var(--ek-text-muted)' }}>{tx.setLevelHint}</p>
              <select
                value={levelInput}
                onChange={e => { setLevelInput(e.target.value); setLevelSaved(false); setLevelError('') }}
                disabled={isPendingLevel}
                className="ek-input w-full px-2.5 py-2 text-[12px]"
                style={{ color: 'var(--ek-text)', background: 'var(--ek-card)', borderRadius: 'var(--ek-radius-xs)' }}
              >
                <option value="">—</option>
                {CEFR_LEVELS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div style={{ borderTop: '1px solid var(--ek-border-soft)' }} />

            {/* Intake panel */}
            <div>
              <div className="ek-microlabel" style={{ marginBottom: 14 }}>
                {tx.profile}
              </div>

              {!detailStudent.learning_goal && !detailStudent.work_description && !detailStudent.learning_style ? (
                <p
                  className="text-[14px]"
                  style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', color: 'var(--ek-text-soft)' }}
                >
                  {tx.noIntake}
                </p>
              ) : (
                <div className="space-y-5">
                  {detailStudent.learning_goal && (
                    <div>
                      <div className="ek-microlabel" style={{ marginBottom: 4 }}>{tx.goal}</div>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                        {detailStudent.learning_goal}
                      </p>
                    </div>
                  )}

                  {detailStudent.work_description && (
                    <div>
                      <div className="ek-microlabel" style={{ marginBottom: 4 }}>{tx.work}</div>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                        {detailStudent.work_description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    {detailStudent.learning_style && (
                      <div>
                        <div className="ek-microlabel" style={{ marginBottom: 4 }}>{tx.style}</div>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--ek-text)' }}>
                          {tx.styles[detailStudent.learning_style as keyof typeof tx.styles] || detailStudent.learning_style}
                        </p>
                      </div>
                    )}
                    {detailStudent.age_range && (
                      <div>
                        <div className="ek-microlabel" style={{ marginBottom: 4 }}>{tx.age}</div>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--ek-text)' }}>
                          {tx.ages[detailStudent.age_range as keyof typeof tx.ages] || detailStudent.age_range}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

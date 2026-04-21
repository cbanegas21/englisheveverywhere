'use client'

import { useState, useTransition } from 'react'
import { Users, TrendingUp, Calendar, ChevronRight, X, Briefcase, Target, Brain, User, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Locale } from '@/lib/i18n/translations'
import { teacherSetStudentLevel } from '@/app/actions/placement'

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
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
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

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-5">

        {/* Summary stats */}
        {students.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: tx.totalStudents, value: students.length, icon: Users },
              { label: tx.totalSessions, value: totalSessionsAll, icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded mb-3"
                  style={{ background: 'rgba(196,30,58,0.08)' }}
                >
                  <Icon className="h-4 w-4" style={{ color: '#C41E3A' }} />
                </div>
                <div className="text-[26px] font-black" style={{ color: '#111111' }}>{value}</div>
                <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Students list */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <Users className="h-6 w-6" style={{ color: '#C41E3A' }} />
              </div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: '#111111' }}>{tx.noStudents}</p>
              <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.noStudentsSub}</p>
            </div>
          ) : (
            <ul>
              {students.map((student, idx) => (
                <li
                  key={student.student_id}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
                  style={{ borderBottom: idx < students.length - 1 ? '1px solid #E5E7EB' : 'none' }}
                  onClick={() => setDetailStudent(student)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-[13px] font-bold"
                    style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                  >
                    {getInitials(student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: '#111111' }}>
                      {student.name}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {student.totalSessions} {tx.sessions}
                      </span>
                      <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        {tx.lastSession}: {formatDate(student.lastSessionDate, lang)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {student.level ? (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" style={{ color: '#9CA3AF' }} />
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded"
                          style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                        >
                          {student.level}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.noLevel}</span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: '#D1D5DB' }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Student detail slide-over */}
      <AnimatePresence>
        {detailStudent && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailStudent(null)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(17,17,17,0.4)' }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed right-0 top-0 h-full w-full max-w-[380px] z-50 overflow-y-auto"
              style={{ background: '#fff', boxShadow: '-4px 0 40px rgba(0,0,0,0.12)' }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-6 py-5 sticky top-0"
                style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                    style={{ background: '#C41E3A' }}
                  >
                    {getInitials(detailStudent.name)}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: '#111111' }}>{detailStudent.name}</p>
                    <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
                      {detailStudent.totalSessions} {tx.sessions}
                      {detailStudent.level && ` · ${detailStudent.level}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailStudent(null)}
                  className="transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* CEFR level editor */}
              <div className="px-6 pt-6">
                <div
                  className="rounded-xl p-4"
                  style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: '#C41E3A' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                      {tx.setLevel}
                    </span>
                  </div>
                  <p className="text-[11px] mb-3" style={{ color: '#9CA3AF' }}>{tx.setLevelHint}</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={levelInput}
                      onChange={e => { setLevelInput(e.target.value); setLevelSaved(false); setLevelError('') }}
                      disabled={isPendingLevel}
                      className="flex-1 rounded px-2 py-1.5 text-[12px] outline-none"
                      style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#fff' }}
                    >
                      <option value="">—</option>
                      {CEFR_LEVELS.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveLevel}
                      disabled={isPendingLevel || !levelInput || levelInput === (detailStudent.level || '')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all disabled:opacity-50"
                      style={{ background: '#C41E3A', color: '#fff' }}
                    >
                      {isPendingLevel ? tx.savingLevel : tx.saveLevel}
                    </button>
                  </div>
                  {levelError && (
                    <p className="text-[11px] mt-2" style={{ color: '#DC2626' }}>{levelError}</p>
                  )}
                  {levelSaved && !levelError && (
                    <p className="text-[11px] mt-2 inline-flex items-center gap-1" style={{ color: '#059669' }}>
                      <Check className="h-3 w-3" /> {tx.levelSaved}
                    </p>
                  )}
                </div>
              </div>

              {/* Intake panel */}
              <div className="p-6">
                <h3 className="text-[13px] font-bold uppercase tracking-wide mb-4" style={{ color: '#9CA3AF' }}>
                  {tx.profile}
                </h3>

                {!detailStudent.learning_goal && !detailStudent.work_description && !detailStudent.learning_style ? (
                  <div
                    className="rounded-xl p-5 text-center"
                    style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                  >
                    <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.noIntake}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {detailStudent.learning_goal && (
                      <div
                        className="rounded-xl p-4"
                        style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-3.5 w-3.5" style={{ color: '#C41E3A' }} />
                          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                            {tx.goal}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
                          {detailStudent.learning_goal}
                        </p>
                      </div>
                    )}

                    {detailStudent.work_description && (
                      <div
                        className="rounded-xl p-4"
                        style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="h-3.5 w-3.5" style={{ color: '#C41E3A' }} />
                          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                            {tx.work}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
                          {detailStudent.work_description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {detailStudent.learning_style && (
                        <div
                          className="rounded-xl p-4"
                          style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Brain className="h-3.5 w-3.5" style={{ color: '#C41E3A' }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                              {tx.style}
                            </span>
                          </div>
                          <p className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                            {tx.styles[detailStudent.learning_style as keyof typeof tx.styles] || detailStudent.learning_style}
                          </p>
                        </div>
                      )}
                      {detailStudent.age_range && (
                        <div
                          className="rounded-xl p-4"
                          style={{ background: '#F9F9F9', border: '1px solid #E5E7EB' }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <User className="h-3.5 w-3.5" style={{ color: '#C41E3A' }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>
                              {tx.age}
                            </span>
                          </div>
                          <p className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                            {tx.ages[detailStudent.age_range as keyof typeof tx.ages] || detailStudent.age_range}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

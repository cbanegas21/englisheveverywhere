'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentRow } from './page'

interface Props {
  students: StudentRow[]
  lang: string
}

const STR = {
  en: {
    searchPlaceholder: 'Search name or email...',
    allPlans: 'All plans',
    allLevels: 'All levels',
    allTeachers: 'All teachers',
    clearFilters: 'Clear filters',
    placementCompleted: 'Completed',
    placementScheduled: 'Scheduled',
    placementNotDone: 'Not done',
    headers: {
      name: 'Name',
      email: 'Email',
      plan: 'Plan',
      classesLeft: 'Classes Left',
      scheduled: 'Scheduled',
      completed: 'Completed',
      level: 'Level',
      teacher: 'Teacher',
      placement: 'Placement',
      joined: 'Joined',
    },
    noMatch: 'No students match your filters.',
    unknown: 'Unknown',
    noPlan: 'No plan',
    pending: 'Pending',
    unassigned: 'Unassigned',
    showing: (shown: number, total: number) => `Showing ${shown} of ${total} students`,
  },
  es: {
    searchPlaceholder: 'Buscar nombre o correo...',
    allPlans: 'Todos los planes',
    allLevels: 'Todos los niveles',
    allTeachers: 'Todos los maestros',
    clearFilters: 'Limpiar filtros',
    placementCompleted: 'Completado',
    placementScheduled: 'Agendado',
    placementNotDone: 'Pendiente',
    headers: {
      name: 'Nombre',
      email: 'Correo',
      plan: 'Plan',
      classesLeft: 'Clases restantes',
      scheduled: 'Agendadas',
      completed: 'Completadas',
      level: 'Nivel',
      teacher: 'Maestro',
      placement: 'Nivelación',
      joined: 'Ingreso',
    },
    noMatch: 'Ningún estudiante coincide con los filtros.',
    unknown: 'Desconocido',
    noPlan: 'Sin plan',
    pending: 'Pendiente',
    unassigned: 'Sin asignar',
    showing: (shown: number, total: number) => `Mostrando ${shown} de ${total} estudiantes`,
  },
}

export default function StudentsTableClient({ students, lang }: Props) {
  const router = useRouter()
  const t = lang === 'es' ? STR.es : STR.en
  const dateLocale = lang === 'es' ? 'es-HN' : 'en-US'
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')

  // Unique options for filters
  const plans = useMemo(
    () => Array.from(new Set(students.map((s) => s.current_plan).filter(Boolean))) as string[],
    [students]
  )
  const levels = useMemo(
    () => Array.from(new Set(students.map((s) => s.level).filter(Boolean))) as string[],
    [students]
  )
  const teachers = useMemo(
    () => Array.from(new Set(students.map((s) => s.teacherName).filter(Boolean))) as string[],
    [students]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter((s) => {
      if (q) {
        const name = (s.profile?.full_name || '').toLowerCase()
        const email = (s.profile?.email || '').toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      if (filterPlan && s.current_plan !== filterPlan) return false
      if (filterLevel && s.level !== filterLevel) return false
      if (filterTeacher && s.teacherName !== filterTeacher) return false
      return true
    })
  }, [students, search, filterPlan, filterLevel, filterTeacher])

  // Placement status reads as mono micro-text — crimson when complete (the
  // signal admins act on), ink-muted for scheduled / not-done. No status pills.
  function placementBadge(s: StudentRow) {
    const label = s.placement_test_done ? t.placementCompleted : s.placement_scheduled ? t.placementScheduled : t.placementNotDone
    const accent = s.placement_test_done
    return (
      <span
        style={{
          fontFamily: 'var(--ek-font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: accent ? 'var(--ek-red)' : 'var(--ek-text-muted)',
        }}
      >
        {label}
      </span>
    )
  }

  const selectStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '7px 12px',
    borderRadius: 'var(--ek-radius-md)',
    border: '1px solid var(--ek-border-mid)',
    background: 'var(--ek-card)',
    color: 'var(--ek-text-soft)',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: '13px',
            padding: '7px 12px',
            borderRadius: 'var(--ek-radius-md)',
            border: '1px solid var(--ek-border-mid)',
            background: 'var(--ek-card)',
            color: 'var(--ek-text)',
            outline: 'none',
            minWidth: '220px',
          }}
        />
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} style={selectStyle}>
          <option value="">{t.allPlans}</option>
          {plans.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={selectStyle}>
          <option value="">{t.allLevels}</option>
          {levels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} style={selectStyle}>
          <option value="">{t.allTeachers}</option>
          {teachers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(search || filterPlan || filterLevel || filterTeacher) && (
          <button
            onClick={() => { setSearch(''); setFilterPlan(''); setFilterLevel(''); setFilterTeacher('') }}
            style={{ fontSize: '12px', color: 'var(--ek-red)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {/* Table — hairline-ruled, box-less editorial surface */}
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full" style={{ minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[t.headers.name, t.headers.email, t.headers.plan, t.headers.classesLeft, t.headers.scheduled, t.headers.completed, t.headers.level, t.headers.teacher, t.headers.placement, t.headers.joined].map((h) => (
                <th
                  key={h}
                  className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{
                    color: 'var(--ek-text-muted)',
                    fontFamily: 'var(--ek-font-mono)',
                    letterSpacing: '0.1em',
                    borderBottom: '1px solid var(--ek-border)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-12 text-center text-[15px] italic"
                  style={{ fontFamily: 'var(--ek-font-serif)', color: 'var(--ek-text-muted)' }}
                >
                  {t.noMatch}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const upcoming = s.upcomingCount
                const initials = (s.profile?.full_name || '?')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/${lang}/admin/students/${s.id}`)}
                    style={{ borderBottom: '1px solid var(--ek-border-soft)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--ek-red-tint)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    {/* Name */}
                    <td className="py-3.5 pr-5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: 'var(--ek-red)', color: 'var(--ek-on-dark)' }}
                        >
                          {initials}
                        </div>
                        <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: 'var(--ek-text)' }}>
                          {s.profile?.full_name || t.unknown}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 pr-5 text-[13px] whitespace-nowrap" style={{ color: 'var(--ek-text-soft)' }}>
                      {s.profile?.email || '—'}
                    </td>

                    {/* Plan */}
                    <td className="py-3.5 pr-5">
                      {s.current_plan ? (
                        <span
                          className="text-[13px] font-medium capitalize"
                          style={{ color: 'var(--ek-text)' }}
                        >
                          {s.current_plan}
                        </span>
                      ) : (
                        <span className="text-[13px]" style={{ color: 'var(--ek-text-muted)' }}>{t.noPlan}</span>
                      )}
                    </td>

                    {/* Classes left */}
                    <td
                      className="py-3.5 pr-5 text-[13px] font-semibold"
                      style={{ color: s.classes_remaining === 0 ? 'var(--ek-red)' : 'var(--ek-text)', fontFeatureSettings: '"tnum"' }}
                    >
                      {s.classes_remaining}
                    </td>

                    {/* Scheduled */}
                    <td
                      className="py-3.5 pr-5 text-[13px]"
                      style={{ color: upcoming > 0 ? 'var(--ek-text)' : 'var(--ek-text-muted)', fontWeight: upcoming > 0 ? 600 : 400, fontFeatureSettings: '"tnum"' }}
                    >
                      {upcoming}
                    </td>

                    {/* Completed */}
                    <td className="py-3.5 pr-5 text-[13px]" style={{ color: 'var(--ek-text-soft)', fontFeatureSettings: '"tnum"' }}>
                      {s.completedCount}
                    </td>

                    {/* Level */}
                    <td className="py-3.5 pr-5">
                      {s.level ? (
                        <span
                          className="text-[12px] font-bold"
                          style={{ fontFamily: 'var(--ek-font-mono)', letterSpacing: '0.04em', color: 'var(--ek-text)' }}
                        >
                          {s.level}
                        </span>
                      ) : (
                        <span className="text-[13px]" style={{ color: 'var(--ek-text-muted)' }}>{t.pending}</span>
                      )}
                    </td>

                    {/* Teacher */}
                    <td className="py-3.5 pr-5 text-[13px] whitespace-nowrap" style={{ color: s.teacherName ? 'var(--ek-text-soft)' : 'var(--ek-text-muted)' }}>
                      {s.teacherName || t.unassigned}
                    </td>

                    {/* Placement */}
                    <td className="py-3.5 pr-5">
                      {placementBadge(s)}
                    </td>

                    {/* Joined */}
                    <td className="py-3.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--ek-text-muted)' }}>
                      {new Date(s.created_at).toLocaleDateString(dateLocale, {
                        timeZone: 'America/Tegucigalpa',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>
        {t.showing(filtered.length, students.length)}
      </p>
    </>
  )
}

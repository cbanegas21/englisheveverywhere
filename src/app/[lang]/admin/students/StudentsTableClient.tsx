'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentRow } from './page'

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  A1: { bg: 'rgba(156,163,175,0.15)', color: '#6B7280' },
  A2: { bg: 'rgba(96,165,250,0.15)', color: '#2563EB' },
  B1: { bg: 'rgba(52,211,153,0.15)', color: '#059669' },
  B2: { bg: 'rgba(167,139,250,0.15)', color: '#7C3AED' },
  C1: { bg: 'rgba(251,146,60,0.15)', color: '#EA580C' },
  C2: { bg: 'rgba(196,30,58,0.15)', color: '#C41E3A' },
}

interface Props {
  students: StudentRow[]
  lang: string
}

export default function StudentsTableClient({ students, lang }: Props) {
  const router = useRouter()
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

  function placementBadge(s: StudentRow) {
    if (s.placement_test_done) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ background: 'rgba(52,211,153,0.12)', color: '#059669' }}
        >
          Completed
        </span>
      )
    }
    if (s.placement_scheduled) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ background: 'rgba(59,130,246,0.12)', color: '#2563EB' }}
        >
          Scheduled
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
        style={{ background: 'rgba(156,163,175,0.12)', color: '#9CA3AF' }}
      >
        Not done
      </span>
    )
  }

  const selectStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#374151',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            fontSize: '13px',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            background: '#fff',
            color: '#111',
            outline: 'none',
            minWidth: '220px',
          }}
        />
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} style={selectStyle}>
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={selectStyle}>
          <option value="">All levels</option>
          {levels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} style={selectStyle}>
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(search || filterPlan || filterLevel || filterTeacher) && (
          <button
            onClick={() => { setSearch(''); setFilterPlan(''); setFilterLevel(''); setFilterTeacher('') }}
            style={{ fontSize: '12px', color: '#C41E3A', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #E5E7EB' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Name', 'Email', 'Plan', 'Classes Left', 'Completed', 'Level', 'Teacher', 'Placement', 'Joined'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}
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
                    colSpan={9}
                    className="px-6 py-12 text-center text-[13px]"
                    style={{ color: '#9CA3AF' }}
                  >
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const lc = LEVEL_COLORS[s.level || ''] || { bg: 'rgba(156,163,175,0.1)', color: '#6B7280' }
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
                      style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F9FAFB' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ background: '#C41E3A' }}
                          >
                            {initials}
                          </div>
                          <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: '#111111' }}>
                            {s.profile?.full_name || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3.5 text-[13px] whitespace-nowrap" style={{ color: '#4B5563' }}>
                        {s.profile?.email || '—'}
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-3.5">
                        {s.current_plan ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                          >
                            {s.current_plan}
                          </span>
                        ) : (
                          <span className="text-[12px]" style={{ color: '#9CA3AF' }}>No plan</span>
                        )}
                      </td>

                      {/* Classes left */}
                      <td className="px-5 py-3.5 text-[13px] font-semibold" style={{ color: s.classes_remaining === 0 ? '#C41E3A' : '#111' }}>
                        {s.classes_remaining}
                      </td>

                      {/* Completed */}
                      <td className="px-5 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                        {s.completedCount}
                      </td>

                      {/* Level */}
                      <td className="px-5 py-3.5">
                        {s.level ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold"
                            style={{ background: lc.bg, color: lc.color }}
                          >
                            {s.level}
                          </span>
                        ) : (
                          <span className="text-[12px]" style={{ color: '#9CA3AF' }}>Pending</span>
                        )}
                      </td>

                      {/* Teacher */}
                      <td className="px-5 py-3.5 text-[13px] whitespace-nowrap" style={{ color: s.teacherName ? '#4B5563' : '#9CA3AF' }}>
                        {s.teacherName || 'Unassigned'}
                      </td>

                      {/* Placement */}
                      <td className="px-5 py-3.5">
                        {placementBadge(s)}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-3.5 text-[12px] whitespace-nowrap" style={{ color: '#9CA3AF' }}>
                        {new Date(s.created_at).toLocaleDateString('en-US', {
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
      </div>

      <p className="mt-3 text-[12px]" style={{ color: '#9CA3AF' }}>
        Showing {filtered.length} of {students.length} students
      </p>
    </>
  )
}

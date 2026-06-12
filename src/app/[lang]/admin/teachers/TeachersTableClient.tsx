'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { ApproveRejectButtons, ActiveToggle, RateEditor } from './TeacherActions'

export interface EnrichedTeacher {
  id: string
  profile_id: string
  full_name: string | null
  email: string | null
  bio: string | null
  specializations: string[] | null
  certifications: string[] | null
  hourly_rate: number | null
  rating: number | null
  total_sessions: number | null
  is_active: boolean
  created_at: string
  activeStudentCount: number
}

type Lang = 'es' | 'en'

interface Props {
  teachers: EnrichedTeacher[]
  lang: string
}

const ALL_SPECS = ['Business English', 'Conversational', 'Grammar', 'IELTS', 'TOEFL', 'Kids', 'Pronunciation']

const STR = {
  en: {
    searchPlaceholder: 'Search name or email…',
    allStatus: 'All Status',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    allSpecializations: 'All Specializations',
    awaitingReview: 'Awaiting review',
    pendingApplications: 'Pending applications',
    unknown: 'Unknown',
    noBio: 'No bio provided.',
    onThePlatform: 'On the platform',
    activeTeachers: 'Active teachers',
    noActiveTeachers: 'No active teachers found.',
    cols: {
      teacher: 'Teacher',
      specializations: 'Specializations',
      certifications: 'Certifications',
      rate: 'Rate',
      rating: 'Rating',
      sessions: 'Sessions',
      students: 'Students',
      joined: 'Joined',
      status: 'Status',
    },
    locale: 'en-US',
  },
  es: {
    searchPlaceholder: 'Buscar nombre o correo…',
    allStatus: 'Todos los estados',
    active: 'Activo',
    inactive: 'Inactivo',
    pending: 'Pendiente',
    allSpecializations: 'Todas las especialidades',
    awaitingReview: 'En espera de revisión',
    pendingApplications: 'Solicitudes pendientes',
    unknown: 'Desconocido',
    noBio: 'Sin biografía.',
    onThePlatform: 'En la plataforma',
    activeTeachers: 'Maestros activos',
    noActiveTeachers: 'No se encontraron maestros activos.',
    cols: {
      teacher: 'Maestro',
      specializations: 'Especialidades',
      certifications: 'Certificaciones',
      rate: 'Tarifa',
      rating: 'Calificación',
      sessions: 'Sesiones',
      students: 'Estudiantes',
      joined: 'Ingreso',
      status: 'Estado',
    },
    locale: 'es-HN',
  },
} as const

export default function TeachersTableClient({ teachers, lang }: Props) {
  const t = STR[(lang as Lang) === 'en' ? 'en' : 'es']
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all')
  const [specFilter, setSpecFilter] = useState('')

  const pending = teachers.filter(t => !t.is_active)
  const active = teachers.filter(t => t.is_active)

  function matches(t: EnrichedTeacher) {
    const q = search.toLowerCase()
    if (q && !(t.full_name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q))) return false
    if (statusFilter === 'active' && !t.is_active) return false
    if (statusFilter === 'inactive' && t.is_active) return false
    if (statusFilter === 'pending' && t.is_active) return false
    if (specFilter && !(t.specializations || []).includes(specFilter)) return false
    return true
  }

  const filteredPending = pending.filter(matches)
  const filteredActive = active.filter(matches)

  const selectStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '8px 12px',
    borderRadius: 'var(--ek-radius-md)',
    border: '1px solid var(--ek-border-mid)',
    background: 'var(--ek-card)',
    color: 'var(--ek-text-soft)',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div>
      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ek-text-muted)' }} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-[13px] outline-none"
            style={{ border: '1px solid var(--ek-border-mid)', borderRadius: 'var(--ek-radius-md)', background: 'var(--ek-card)', color: 'var(--ek-text)' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          style={selectStyle}
        >
          <option value="all">{t.allStatus}</option>
          <option value="active">{t.active}</option>
          <option value="inactive">{t.inactive}</option>
          <option value="pending">{t.pending}</option>
        </select>
        <select
          value={specFilter}
          onChange={e => setSpecFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">{t.allSpecializations}</option>
          {ALL_SPECS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Pending Applications */}
      {filteredPending.length > 0 && (
        <section className="mb-10">
          <div
            className="flex items-center justify-between flex-wrap gap-3 pb-3 mb-5"
            style={{ borderBottom: '1px solid var(--ek-border)' }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: 'var(--ek-red)',
                  marginBottom: 6,
                }}
              >
                {t.awaitingReview} · {filteredPending.length}
              </div>
              <h2 className="text-[17px] font-extrabold" style={{ color: 'var(--ek-text)', letterSpacing: '-0.015em' }}>
                {t.pendingApplications}
              </h2>
            </div>
          </div>
          <div className="space-y-px">
            {filteredPending.map(teacher => (
              <div
                key={teacher.id}
                className="py-5 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid var(--ek-border-soft)', borderLeft: '2px solid var(--ek-red)', paddingLeft: 18 }}
                onClick={() => router.push(`/${lang}/admin/teachers/${teacher.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--ek-red-tint)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                      style={{ background: 'var(--ek-red)', color: 'var(--ek-on-dark)' }}
                    >
                      {(teacher.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold" style={{ color: 'var(--ek-text)' }}>{teacher.full_name || t.unknown}</p>
                      <p className="text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{teacher.email}</p>
                      <p className="text-[12px] mt-2 leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                        {teacher.bio ? (teacher.bio.length > 200 ? teacher.bio.slice(0, 200) + '…' : teacher.bio) : t.noBio}
                      </p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {(teacher.specializations || []).map(s => (
                          <span key={s}
                            style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ek-red)' }}>
                            {s}
                          </span>
                        ))}
                        {teacher.hourly_rate && (
                          <span className="text-[12px] font-semibold" style={{ color: 'var(--ek-text)' }}>${teacher.hourly_rate}/hr</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <ApproveRejectButtons
                      teacherId={teacher.id}
                      profileId={teacher.profile_id}
                      teacherName={teacher.full_name || ''}
                      teacherEmail={teacher.email || ''}
                      lang={(lang as Lang) === 'en' ? 'en' : 'es'}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Teachers Table — hairline-ruled, box-less */}
      <section>
        <div
          className="pb-3 mb-5"
          style={{ borderBottom: '1px solid var(--ek-border)' }}
        >
          <div
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: 'var(--ek-text-muted)',
              marginBottom: 6,
            }}
          >
            {t.onThePlatform} · {filteredActive.length}
          </div>
          <h2 className="text-[17px] font-extrabold" style={{ color: 'var(--ek-text)', letterSpacing: '-0.015em' }}>
            {t.activeTeachers}
          </h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t.cols.teacher, t.cols.specializations, t.cols.certifications, t.cols.rate, t.cols.rating, t.cols.sessions, t.cols.students, t.cols.joined, t.cols.status].map(h => (
                  <th
                    key={h}
                    className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', letterSpacing: '0.1em', borderBottom: '1px solid var(--ek-border)', whiteSpace: 'nowrap' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredActive.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-[15px] italic"
                    style={{ fontFamily: 'var(--ek-font-serif)', color: 'var(--ek-text-muted)' }}
                  >
                    {t.noActiveTeachers}
                  </td>
                </tr>
              ) : filteredActive.map(teacher => (
                <tr
                  key={teacher.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--ek-border-soft)' }}
                  onClick={() => router.push(`/${lang}/admin/teachers/${teacher.id}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--ek-red-tint)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                        style={{ background: 'var(--ek-red)', color: 'var(--ek-on-dark)' }}
                      >
                        {(teacher.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>{teacher.full_name || t.unknown}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>{teacher.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {(teacher.specializations || []).slice(0, 2).map(s => (
                        <span key={s}
                          style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ek-red)' }}>{s}</span>
                      ))}
                      {(teacher.specializations || []).length > 2 && (
                        <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>+{(teacher.specializations || []).length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {(teacher.certifications || []).slice(0, 2).map(c => (
                        <span key={c}
                          style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ek-text-soft)' }}>{c}</span>
                      ))}
                      {(teacher.certifications || []).length > 2 && (
                        <span className="text-[11px]" style={{ color: 'var(--ek-text-muted)' }}>+{(teacher.certifications || []).length - 2}</span>
                      )}
                      {!(teacher.certifications || []).length && <span className="text-[11px]" style={{ color: 'var(--ek-text-faint)' }}>—</span>}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4" onClick={e => e.stopPropagation()}>
                    <RateEditor teacherId={teacher.id} initialRate={teacher.hourly_rate || 0} lang={(lang as Lang) === 'en' ? 'en' : 'es'} />
                  </td>
                  <td className="py-3.5 pr-4 text-[13px]" style={{ color: 'var(--ek-text)', fontFeatureSettings: '"tnum"' }}>
                    {teacher.rating ? Number(teacher.rating).toFixed(1) : '—'}
                  </td>
                  <td className="py-3.5 pr-4 text-[13px]" style={{ color: 'var(--ek-text-soft)', fontFeatureSettings: '"tnum"' }}>
                    {teacher.total_sessions ?? 0}
                  </td>
                  <td className="py-3.5 pr-4 text-[13px]" style={{ color: 'var(--ek-text-soft)', fontFeatureSettings: '"tnum"' }}>
                    {teacher.activeStudentCount}
                  </td>
                  <td className="py-3.5 pr-4 text-[12px]" style={{ color: 'var(--ek-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(teacher.created_at).toLocaleDateString(t.locale, { timeZone: 'America/Tegucigalpa', month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3.5" onClick={e => e.stopPropagation()}>
                    <ActiveToggle teacherId={teacher.id} initialActive={teacher.is_active} lang={(lang as Lang) === 'en' ? 'en' : 'es'} />
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

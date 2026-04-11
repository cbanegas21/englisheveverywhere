'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Search } from 'lucide-react'
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

interface Props {
  teachers: EnrichedTeacher[]
  lang: string
}

const ALL_SPECS = ['Business English', 'Conversational', 'Grammar', 'IELTS', 'TOEFL', 'Kids', 'Pronunciation']

export default function TeachersTableClient({ teachers, lang }: Props) {
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

  return (
    <div>
      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none"
            style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 rounded-lg text-[13px] outline-none"
          style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#374151' }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={specFilter}
          onChange={e => setSpecFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] outline-none"
          style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#374151' }}
        >
          <option value="">All Specializations</option>
          {ALL_SPECS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Pending Applications */}
      {filteredPending.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#F59E0B' }} />
            <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>
              Pending Applications
            </h2>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}
            >
              {filteredPending.length}
            </span>
          </div>
          <div className="space-y-3">
            {filteredPending.map(t => (
              <div
                key={t.id}
                className="rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow"
                style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                onClick={() => router.push(`/${lang}/admin/teachers/${t.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                      style={{ background: '#C41E3A' }}
                    >
                      {(t.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold" style={{ color: '#111111' }}>{t.full_name || 'Unknown'}</p>
                      <p className="text-[12px]" style={{ color: '#6B7280' }}>{t.email}</p>
                      <p className="text-[12px] mt-2 leading-relaxed" style={{ color: '#4B5563' }}>
                        {t.bio ? (t.bio.length > 200 ? t.bio.slice(0, 200) + '…' : t.bio) : 'No bio provided.'}
                      </p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {(t.specializations || []).map(s => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(196,30,58,0.07)', color: '#C41E3A' }}>
                            {s}
                          </span>
                        ))}
                        {t.hourly_rate && (
                          <span className="text-[12px] font-semibold" style={{ color: '#111111' }}>${t.hourly_rate}/hr</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <ApproveRejectButtons
                      teacherId={t.id}
                      profileId={t.profile_id}
                      teacherName={t.full_name || ''}
                      teacherEmail={t.email || ''}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Teachers Table */}
      <section>
        <h2 className="text-[14px] font-bold mb-4" style={{ color: '#111111' }}>Active Teachers</h2>
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Teacher', 'Specializations', 'Certifications', 'Rate', 'Rating', 'Sessions', 'Students', 'Joined', 'Status'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredActive.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
                    No active teachers found.
                  </td>
                </tr>
              ) : filteredActive.map(t => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: '1px solid #F3F4F6' }}
                  onClick={() => router.push(`/${lang}/admin/teachers/${t.id}`)}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: '#C41E3A' }}
                      >
                        {(t.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: '#111111' }}>{t.full_name || 'Unknown'}</p>
                        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{t.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(t.specializations || []).slice(0, 2).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(196,30,58,0.07)', color: '#C41E3A' }}>{s}</span>
                      ))}
                      {(t.specializations || []).length > 2 && (
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>+{(t.specializations || []).length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(t.certifications || []).slice(0, 2).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(59,130,246,0.07)', color: '#2563EB' }}>{c}</span>
                      ))}
                      {(t.certifications || []).length > 2 && (
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>+{(t.certifications || []).length - 2}</span>
                      )}
                      {!(t.certifications || []).length && <span className="text-[11px]" style={{ color: '#D1D5DB' }}>—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <RateEditor teacherId={t.id} initialRate={t.hourly_rate || 0} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                      <span className="text-[13px]" style={{ color: '#111111' }}>
                        {t.rating ? Number(t.rating).toFixed(1) : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {t.total_sessions ?? 0}
                  </td>
                  <td className="px-4 py-3.5 text-[13px]" style={{ color: '#4B5563' }}>
                    {t.activeStudentCount}
                  </td>
                  <td className="px-4 py-3.5 text-[12px]" style={{ color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
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

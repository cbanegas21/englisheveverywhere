'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, Clock, Save, CheckCircle2, AlertCircle, Layers, X } from 'lucide-react'
import { saveAvailabilitySlots } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'

interface Slot {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
}

interface Props {
  lang: Locale
  existingSlots: Slot[]
}

const t = {
  en: {
    title: 'Set your availability',
    subtitle: 'Define your weekly recurring availability. Students will be able to book within these windows.',
    addSlot: 'Add time slot',
    save: 'Save availability',
    saving: 'Saving...',
    saved: 'Availability saved!',
    error: 'An error occurred. Please try again.',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayLabel: 'Day',
    startTime: 'Start time',
    endTime: 'End time',
    remove: 'Remove',
    booked: 'Booked',
    noSlots: 'No availability set. Add your first time slot.',
    tipTitle: 'How it works',
    tipBody: 'Students see these slots and can book any open window. Booked slots are locked until the session is complete.',
    weeklySummary: 'Weekly summary',
    noSlotsConfigured: 'No slots configured',
    slots: 'slots',
    bulkAdd: 'Bulk add',
    bulkTitle: 'Add availability for multiple days',
    bulkSub: 'Pick the days and a time window. One slot will be created per selected day.',
    bulkPresetWeekdays: 'Mon–Fri',
    bulkPresetWeekends: 'Weekends',
    bulkPresetAll: 'All week',
    bulkPickDaysError: 'Select at least one day.',
    bulkTimeError: 'End time must be after start time.',
    bulkApply: (n: number) => `Add ${n} slot${n === 1 ? '' : 's'}`,
    bulkCancel: 'Cancel',
  },
  es: {
    title: 'Configura tu disponibilidad',
    subtitle: 'Define tus horarios semanales recurrentes. Los estudiantes podrán reservar dentro de estas ventanas.',
    addSlot: 'Agregar horario',
    save: 'Guardar disponibilidad',
    saving: 'Guardando...',
    saved: '¡Disponibilidad guardada!',
    error: 'Ocurrió un error. Por favor intenta de nuevo.',
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayLabel: 'Día',
    startTime: 'Hora de inicio',
    endTime: 'Hora de fin',
    remove: 'Eliminar',
    booked: 'Reservado',
    noSlots: 'Sin disponibilidad. Agrega tu primer horario.',
    tipTitle: 'Cómo funciona',
    tipBody: 'Los estudiantes ven estos horarios y pueden reservar cualquier ventana disponible. Los horarios reservados se bloquean hasta completar la sesión.',
    weeklySummary: 'Resumen semanal',
    noSlotsConfigured: 'Sin slots configurados',
    slots: 'slots',
    bulkAdd: 'Agregar en grupo',
    bulkTitle: 'Agregar disponibilidad en varios días',
    bulkSub: 'Elige los días y una ventana horaria. Se creará un horario por cada día seleccionado.',
    bulkPresetWeekdays: 'Lun–Vie',
    bulkPresetWeekends: 'Fines de semana',
    bulkPresetAll: 'Toda la semana',
    bulkPickDaysError: 'Selecciona al menos un día.',
    bulkTimeError: 'La hora de fin debe ser después del inicio.',
    bulkApply: (n: number) => `Agregar ${n} horario${n === 1 ? '' : 's'}`,
    bulkCancel: 'Cancelar',
  },
}

const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}
TIME_OPTIONS.push('23:59')

const selectStyle = {
  border: '1px solid #E5E7EB',
  color: '#111111',
  background: '#F9F9F9',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 500,
  outline: 'none',
  width: '100%',
}

export default function AvailabilityClient({ lang, existingSlots }: Props) {
  const tx = t[lang]
  const [isPending, startTransition] = useTransition()
  const [slots, setSlots] = useState<Slot[]>(existingSlots)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkDays, setBulkDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [bulkStart, setBulkStart] = useState('09:00')
  const [bulkEnd, setBulkEnd] = useState('17:00')
  const [bulkError, setBulkError] = useState('')

  function addSlot() {
    setSlots(prev => [...prev, { day_of_week: 1, start_time: '09:00', end_time: '10:00' }])
    setSaveStatus('idle')
  }

  function toggleBulkDay(d: number) {
    setBulkDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
    setBulkError('')
  }

  function applyBulkPreset(kind: 'weekdays' | 'weekends' | 'all') {
    if (kind === 'weekdays') setBulkDays(new Set([1, 2, 3, 4, 5]))
    else if (kind === 'weekends') setBulkDays(new Set([0, 6]))
    else setBulkDays(new Set([0, 1, 2, 3, 4, 5, 6]))
    setBulkError('')
  }

  function handleBulkApply() {
    if (bulkDays.size === 0) { setBulkError(tx.bulkPickDaysError); return }
    if (bulkEnd <= bulkStart) { setBulkError(tx.bulkTimeError); return }
    const newSlots: Slot[] = Array.from(bulkDays)
      .sort((a, b) => a - b)
      .map(d => ({ day_of_week: d, start_time: bulkStart, end_time: bulkEnd }))
    setSlots(prev => [...prev, ...newSlots])
    setSaveStatus('idle')
    setBulkOpen(false)
    setBulkError('')
  }

  function removeSlot(index: number) {
    setSlots(prev => prev.filter((_, i) => i !== index))
    setSaveStatus('idle')
  }

  function updateSlot(index: number, field: keyof Slot, value: string | number) {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
    setSaveStatus('idle')
  }

  function handleSave() {
    setSaveStatus('idle')
    const toSave = slots
      .map(s => ({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }))

    startTransition(async () => {
      const result = await saveAvailabilitySlots(toSave, lang)
      if (result?.error) {
        setSaveStatus('error')
      } else {
        setSaveStatus('saved')
      }
    })
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Slots editor */}
          <div
            className="lg:col-span-2 rounded-xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <h2 className="text-[13px] font-bold" style={{ color: '#111111' }}>
                {lang === 'es' ? 'Mis horarios' : 'My time slots'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setBulkError(''); setBulkOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold text-[12px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                >
                  <Layers className="h-3.5 w-3.5" />
                  {tx.bulkAdd}
                </button>
                <button
                  onClick={addSlot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold text-[12px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {tx.addSlot}
                </button>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {slots.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-14 text-center"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                    style={{ background: '#F3F4F6' }}
                  >
                    <Clock className="h-6 w-6" style={{ color: '#9CA3AF' }} />
                  </div>
                  <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.noSlots}</p>
                </motion.div>
              ) : (
                <div>
                  {slots.map((slot, index) => (
                    <motion.div
                      key={index}
                      layout
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 py-4"
                      style={{
                        borderBottom: '1px solid #E5E7EB',
                        opacity: 1,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Day */}
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9CA3AF' }}>
                            {tx.dayLabel}
                          </label>
                          <select
                            value={slot.day_of_week}
                            onChange={(e) => updateSlot(index, 'day_of_week', parseInt(e.target.value))}
                            style={selectStyle}
                          >
                            {tx.days.map((day, i) => (
                              <option key={i} value={i}>{day}</option>
                            ))}
                          </select>
                        </div>

                        {/* Start time */}
                        <div className="w-28 flex-shrink-0">
                          <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9CA3AF' }}>
                            {tx.startTime}
                          </label>
                          <select
                            value={slot.start_time}
                            onChange={(e) => updateSlot(index, 'start_time', e.target.value)}
                            style={selectStyle}
                          >
                            {TIME_OPTIONS.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        {/* End time */}
                        <div className="w-28 flex-shrink-0">
                          <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9CA3AF' }}>
                            {tx.endTime}
                          </label>
                          <select
                            value={slot.end_time}
                            onChange={(e) => updateSlot(index, 'end_time', e.target.value)}
                            style={selectStyle}
                          >
                            {TIME_OPTIONS.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        {/* Action */}
                        <div className="flex-shrink-0 mt-4 sm:mt-4">
                          <button
                            onClick={() => removeSlot(index)}
                            className="p-2 rounded transition-all"
                            style={{ color: '#E5E7EB' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#E5E7EB'; e.currentTarget.style.background = 'transparent' }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Save bar */}
            <div className="px-5 py-4 flex items-center gap-4" style={{ borderTop: '1px solid #E5E7EB' }}>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-[13px] transition-all disabled:opacity-60"
                style={{ background: '#C41E3A', color: '#fff' }}
                onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
              >
                {isPending ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {tx.saving}
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    {tx.save}
                  </>
                )}
              </button>

              <AnimatePresence>
                {saveStatus === 'saved' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: '#16A34A' }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {tx.saved}
                  </motion.div>
                )}
                {saveStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: '#DC2626' }}
                  >
                    <AlertCircle className="h-4 w-4" />
                    {tx.error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Info sidebar */}
          <div className="lg:col-span-1 space-y-4">

            {/* How it works */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded mb-4"
                style={{ background: '#F3F4F6' }}
              >
                <Clock className="h-4 w-4" style={{ color: '#9CA3AF' }} />
              </div>
              <h3 className="text-[13px] font-bold mb-2" style={{ color: '#111111' }}>{tx.tipTitle}</h3>
              <p className="text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>{tx.tipBody}</p>
            </div>

            {/* Weekly summary */}
            <div
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <h3
                className="text-[12px] uppercase tracking-wider font-semibold mb-3"
                style={{ color: '#9CA3AF' }}
              >
                {tx.weeklySummary}
              </h3>
              {[0,1,2,3,4,5,6].map(day => {
                const daySlots = slots.filter(s => s.day_of_week === day)
                if (daySlots.length === 0) return null
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between py-2 last:border-0"
                    style={{ borderBottom: '1px solid #E5E7EB' }}
                  >
                    <span className="text-[12px]" style={{ color: '#4B5563' }}>{tx.days[day].slice(0, 3)}</span>
                    <span className="text-[12px] font-semibold" style={{ color: '#111111' }}>{daySlots.length} {tx.slots}</span>
                  </div>
                )
              })}
              {slots.length === 0 && (
                <p className="text-[12px] italic" style={{ color: '#9CA3AF' }}>{tx.noSlotsConfigured}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk-add modal */}
      <AnimatePresence>
        {bulkOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBulkOpen(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(17,17,17,0.5)', backdropFilter: 'blur(3px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[460px] rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#fff' }}
            >
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4" style={{ color: '#C41E3A' }} />
                  <h3 className="font-bold text-[15px]" style={{ color: '#111111' }}>{tx.bulkTitle}</h3>
                </div>
                <button
                  onClick={() => setBulkOpen(false)}
                  className="transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <p className="text-[12px] leading-relaxed" style={{ color: '#6B7280' }}>{tx.bulkSub}</p>

                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                  {([
                    ['weekdays', tx.bulkPresetWeekdays] as const,
                    ['weekends', tx.bulkPresetWeekends] as const,
                    ['all', tx.bulkPresetAll] as const,
                  ]).map(([kind, label]) => (
                    <button
                      key={kind}
                      onClick={() => applyBulkPreset(kind)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                      style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#C41E3A'; e.currentTarget.style.color = '#C41E3A' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Day checkboxes */}
                <div className="grid grid-cols-7 gap-1.5">
                  {tx.days.map((d, i) => {
                    const active = bulkDays.has(i)
                    return (
                      <button
                        key={i}
                        onClick={() => toggleBulkDay(i)}
                        className="flex flex-col items-center justify-center h-14 rounded-lg text-[10px] font-bold transition-all"
                        style={{
                          background: active ? '#C41E3A' : '#F9F9F9',
                          color: active ? '#fff' : '#374151',
                          border: `1px solid ${active ? '#C41E3A' : '#E5E7EB'}`,
                        }}
                      >
                        <span className="text-[11px]">{d.slice(0, 3)}</span>
                        {active && <CheckCircle2 className="h-3 w-3 mt-0.5" />}
                      </button>
                    )
                  })}
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9CA3AF' }}>
                      {tx.startTime}
                    </label>
                    <select
                      value={bulkStart}
                      onChange={e => { setBulkStart(e.target.value); setBulkError('') }}
                      style={selectStyle}
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9CA3AF' }}>
                      {tx.endTime}
                    </label>
                    <select
                      value={bulkEnd}
                      onChange={e => { setBulkEnd(e.target.value); setBulkError('') }}
                      style={selectStyle}
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {bulkError && (
                  <div className="rounded p-3 text-[12px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
                    {bulkError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setBulkOpen(false)}
                  className="flex-1 py-3 rounded font-medium text-[13px] transition-all"
                  style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#F9F9F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F9F9F9')}
                >
                  {tx.bulkCancel}
                </button>
                <button
                  onClick={handleBulkApply}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded font-bold text-[13px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#9E1830')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tx.bulkApply(bulkDays.size)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

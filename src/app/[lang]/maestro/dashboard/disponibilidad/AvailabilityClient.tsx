'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { saveAvailabilitySlots } from '@/app/actions/booking'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Modal from '@/components/dashboard/Modal'

interface Slot {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
}

// Local-only stable key so removals / bulk inserts don't reuse array indices
// (which would desync framer-motion + uncontrolled <select> state across rows).
interface SlotRow extends Slot {
  _key: string
}

let _seq = 0
function makeKey() {
  _seq += 1
  return `slot-${_seq}-${Math.random().toString(36).slice(2, 8)}`
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
    saved: 'Availability saved',
    error: 'An error occurred. Please try again.',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayLabel: 'Day',
    startTime: 'Start time',
    endTime: 'End time',
    remove: 'Remove',
    booked: 'Booked',
    noSlots: 'No availability set. Add your first time slot.',
    invalidSlot: 'End time must be after start time.',
    invalidPresent: 'Fix the highlighted rows before saving.',
    tipKicker: 'How it works',
    tipBody: 'Students see these slots and can book any open window. Booked slots are locked until the session is complete.',
    weeklySummary: 'Weekly summary',
    noSlotsConfigured: 'No slots configured.',
    slots: 'slots',
    mySlots: 'My time slots',
    bulkAdd: 'Bulk add',
    bulkTitle: 'Add availability for multiple days',
    bulkKicker: 'Bulk add',
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
    saved: 'Disponibilidad guardada',
    error: 'Ocurrió un error. Por favor intenta de nuevo.',
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayLabel: 'Día',
    startTime: 'Hora de inicio',
    endTime: 'Hora de fin',
    remove: 'Eliminar',
    booked: 'Reservado',
    noSlots: 'Sin disponibilidad. Agrega tu primer horario.',
    invalidSlot: 'La hora de fin debe ser después del inicio.',
    invalidPresent: 'Corrige los horarios marcados antes de guardar.',
    tipKicker: 'Cómo funciona',
    tipBody: 'Los estudiantes ven estos horarios y pueden reservar cualquier ventana disponible. Los horarios reservados se bloquean hasta completar la sesión.',
    weeklySummary: 'Resumen semanal',
    noSlotsConfigured: 'Sin horarios configurados.',
    slots: 'slots',
    mySlots: 'Mis horarios',
    bulkAdd: 'Agregar en grupo',
    bulkTitle: 'Agregar disponibilidad en varios días',
    bulkKicker: 'Agregar en grupo',
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
  border: '1px solid var(--ek-border)',
  color: 'var(--ek-text)',
  background: 'var(--ek-paper)',
  borderRadius: 'var(--ek-radius-sm)',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 500,
  outline: 'none',
  width: '100%',
}

const labelStyle = {
  fontFamily: 'var(--ek-font-mono)',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  marginBottom: 4,
  display: 'block',
  color: 'var(--ek-text-muted)',
}

export default function AvailabilityClient({ lang, existingSlots }: Props) {
  const tx = t[lang]
  const [isPending, startTransition] = useTransition()
  const [slots, setSlots] = useState<SlotRow[]>(() =>
    existingSlots.map((s) => ({ ...s, _key: makeKey() })),
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkDays, setBulkDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [bulkStart, setBulkStart] = useState('09:00')
  const [bulkEnd, setBulkEnd] = useState('17:00')
  const [bulkError, setBulkError] = useState('')

  const hasInvalid = slots.some((s) => s.end_time <= s.start_time)

  function addSlot() {
    setSlots((prev) => [...prev, { _key: makeKey(), day_of_week: 1, start_time: '09:00', end_time: '10:00' }])
    setSaveStatus('idle')
  }

  function toggleBulkDay(d: number) {
    setBulkDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
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
    if (bulkDays.size === 0) {
      setBulkError(tx.bulkPickDaysError)
      return
    }
    if (bulkEnd <= bulkStart) {
      setBulkError(tx.bulkTimeError)
      return
    }
    const newSlots: SlotRow[] = Array.from(bulkDays)
      .sort((a, b) => a - b)
      .map((d) => ({ _key: makeKey(), day_of_week: d, start_time: bulkStart, end_time: bulkEnd }))
    setSlots((prev) => [...prev, ...newSlots])
    setSaveStatus('idle')
    setBulkOpen(false)
    setBulkError('')
  }

  function removeSlot(key: string) {
    setSlots((prev) => prev.filter((s) => s._key !== key))
    setSaveStatus('idle')
  }

  function updateSlot(key: string, field: keyof Slot, value: string | number) {
    setSlots((prev) => prev.map((s) => (s._key === key ? { ...s, [field]: value } : s)))
    setSaveStatus('idle')
  }

  function handleSave() {
    setSaveStatus('idle')
    if (hasInvalid) {
      setSaveStatus('error')
      return
    }
    const toSave = slots.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    }))

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
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="px-8 py-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Slots editor */}
          <div
            className="lg:col-span-2 overflow-hidden"
            style={{
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 'var(--ek-radius-lg)',
            }}
          >
            <div className="px-5 pt-5 pb-4">
              <SectionHeader
                title={tx.mySlots}
                right={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setBulkError('')
                        setBulkOpen(true)
                      }}
                      className="ek-quickrow px-3 py-1.5 font-semibold text-[12px]"
                      style={{
                        border: '1px solid var(--ek-border)',
                        color: 'var(--ek-text)',
                        background: 'var(--ek-paper)',
                        borderRadius: 'var(--ek-radius-xs)',
                      }}
                    >
                      {tx.bulkAdd}
                    </button>
                    <button
                      onClick={addSlot}
                      className="ek-quickrow px-3 py-1.5 font-semibold text-[12px]"
                      style={{
                        border: '1px solid var(--ek-border)',
                        color: 'var(--ek-text)',
                        background: 'var(--ek-paper)',
                        borderRadius: 'var(--ek-radius-xs)',
                      }}
                    >
                      + {tx.addSlot}
                    </button>
                  </div>
                }
              />
            </div>

            <AnimatePresence mode="popLayout">
              {slots.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-5 py-14 text-center"
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--ek-font-serif)',
                      fontStyle: 'italic',
                      fontSize: 20,
                      color: 'var(--ek-text-soft)',
                    }}
                  >
                    {tx.noSlots}
                  </p>
                </motion.div>
              ) : (
                <div>
                  {slots.map((slot) => {
                    const invalid = slot.end_time <= slot.start_time
                    return (
                      <motion.div
                        key={slot._key}
                        layout
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 py-4"
                        style={{
                          borderTop: '1px solid var(--ek-border-soft)',
                          background: invalid ? 'var(--ek-red-tint)' : 'transparent',
                        }}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          {/* Day */}
                          <div className="flex-1 min-w-0">
                            <label style={labelStyle}>{tx.dayLabel}</label>
                            <select
                              className="ek-input"
                              value={slot.day_of_week}
                              onChange={(e) => updateSlot(slot._key, 'day_of_week', parseInt(e.target.value))}
                              style={selectStyle}
                            >
                              {tx.days.map((day, i) => (
                                <option key={i} value={i}>
                                  {day}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Start time */}
                          <div className="w-28 flex-shrink-0">
                            <label style={labelStyle}>{tx.startTime}</label>
                            <select
                              className="ek-input"
                              value={slot.start_time}
                              onChange={(e) => updateSlot(slot._key, 'start_time', e.target.value)}
                              style={selectStyle}
                            >
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* End time */}
                          <div className="w-28 flex-shrink-0">
                            <label style={labelStyle}>{tx.endTime}</label>
                            <select
                              className="ek-input"
                              value={slot.end_time}
                              onChange={(e) => updateSlot(slot._key, 'end_time', e.target.value)}
                              style={{
                                ...selectStyle,
                                borderColor: invalid ? 'var(--ek-red)' : 'var(--ek-border)',
                              }}
                            >
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Action */}
                          <div className="flex-shrink-0 mt-4 sm:mt-4">
                            <button
                              onClick={() => removeSlot(slot._key)}
                              aria-label={tx.remove}
                              className="ek-link-danger px-3 py-2 font-semibold text-[12px]"
                              style={{
                                color: 'var(--ek-text-muted)',
                                background: 'transparent',
                                border: 0,
                                cursor: 'pointer',
                              }}
                            >
                              {tx.remove}
                            </button>
                          </div>
                        </div>

                        {invalid && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--ek-red)',
                            }}
                          >
                            {tx.invalidSlot}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </AnimatePresence>

            {/* Save bar */}
            <div
              className="px-5 py-4 flex items-center gap-4"
              style={{ borderTop: '1px solid var(--ek-border)' }}
            >
              <button
                onClick={handleSave}
                disabled={isPending}
                className="ek-red-btn flex items-center gap-2 px-5 py-2.5 font-semibold text-[13px] disabled:opacity-60"
                style={{
                  background: 'var(--ek-red)',
                  color: '#fff',
                  border: 0,
                  borderRadius: 'var(--ek-radius-xs)',
                  cursor: isPending ? 'default' : 'pointer',
                }}
              >
                {isPending ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {tx.saving}
                  </>
                ) : (
                  tx.save
                )}
              </button>

              <AnimatePresence>
                {saveStatus === 'saved' && (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <StatusBadge variant="confirmed">{tx.saved}</StatusBadge>
                  </motion.div>
                )}
                {saveStatus === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--ek-red)' }}
                  >
                    {hasInvalid ? tx.invalidPresent : tx.error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Info sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* How it works */}
            <div
              className="p-5"
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-lg)',
              }}
            >
              <div
                className="ek-microlabel"
                style={{
                  color: 'var(--ek-red)',
                  paddingBottom: 10,
                  marginBottom: 12,
                  borderBottom: '1px solid var(--ek-border)',
                }}
              >
                {tx.tipKicker}
              </div>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: 'var(--ek-text-soft)', margin: 0 }}
              >
                {tx.tipBody}
              </p>
            </div>

            {/* Weekly summary */}
            <div
              className="p-5"
              style={{
                background: 'var(--ek-card)',
                border: '1px solid var(--ek-border)',
                borderRadius: 'var(--ek-radius-lg)',
              }}
            >
              <div
                className="ek-microlabel"
                style={{
                  color: 'var(--ek-red)',
                  paddingBottom: 10,
                  marginBottom: 6,
                  borderBottom: '1px solid var(--ek-border)',
                }}
              >
                {tx.weeklySummary}
              </div>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const daySlots = slots.filter((s) => s.day_of_week === day)
                if (daySlots.length === 0) return null
                return (
                  <div
                    key={day}
                    className="flex items-baseline justify-between py-2.5"
                    style={{ borderBottom: '1px solid var(--ek-border-soft)' }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--ek-font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--ek-text-muted)',
                      }}
                    >
                      {tx.days[day].slice(0, 3)}
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'var(--ek-text)',
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {daySlots.length}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--ek-text-muted)',
                          marginLeft: 5,
                        }}
                      >
                        {tx.slots}
                      </span>
                    </span>
                  </div>
                )
              })}
              {slots.length === 0 && (
                <p
                  className="text-[12px]"
                  style={{
                    fontFamily: 'var(--ek-font-serif)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'var(--ek-text-muted)',
                    margin: '6px 0 0',
                  }}
                >
                  {tx.noSlotsConfigured}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk-add modal */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kicker={tx.bulkKicker}
        title={tx.bulkTitle}
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => setBulkOpen(false)}
              className="ek-outline-btn flex-1 py-3 font-medium text-[13px]"
              style={{
                border: '1px solid var(--ek-border)',
                color: 'var(--ek-text-soft)',
                background: 'var(--ek-paper)',
                borderRadius: 'var(--ek-radius-xs)',
                cursor: 'pointer',
              }}
            >
              {tx.bulkCancel}
            </button>
            <button
              onClick={handleBulkApply}
              className="ek-red-btn flex-1 flex items-center justify-center gap-2 py-3 font-bold text-[13px]"
              style={{
                background: 'var(--ek-red)',
                color: '#fff',
                border: 0,
                borderRadius: 'var(--ek-radius-xs)',
                cursor: 'pointer',
              }}
            >
              {tx.bulkApply(bulkDays.size)}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ek-text-muted)', margin: 0 }}>
            {tx.bulkSub}
          </p>

          {/* Presets — segmented text toggles */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['weekdays', tx.bulkPresetWeekdays] as const,
                ['weekends', tx.bulkPresetWeekends] as const,
                ['all', tx.bulkPresetAll] as const,
              ]
            ).map(([kind, label]) => (
              <button
                key={kind}
                onClick={() => applyBulkPreset(kind)}
                className="ek-chip-toggle px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  background: 'var(--ek-paper)',
                  color: 'var(--ek-text-soft)',
                  border: '1px solid var(--ek-border)',
                  borderRadius: 'var(--ek-radius-xs)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Day toggles */}
          <div className="grid grid-cols-7 gap-1.5">
            {tx.days.map((d, i) => {
              const active = bulkDays.has(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleBulkDay(i)}
                  className="ek-chip-toggle flex items-center justify-center h-12 text-[11px] font-bold"
                  style={{
                    background: active ? 'var(--ek-red)' : 'var(--ek-paper)',
                    color: active ? '#fff' : 'var(--ek-text-soft)',
                    border: `1px solid ${active ? 'var(--ek-red)' : 'var(--ek-border)'}`,
                    borderRadius: 'var(--ek-radius-xs)',
                    cursor: 'pointer',
                  }}
                >
                  {d.slice(0, 3)}
                </button>
              )
            })}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{tx.startTime}</label>
              <select
                className="ek-input"
                value={bulkStart}
                onChange={(e) => {
                  setBulkStart(e.target.value)
                  setBulkError('')
                }}
                style={selectStyle}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{tx.endTime}</label>
              <select
                className="ek-input"
                value={bulkEnd}
                onChange={(e) => {
                  setBulkEnd(e.target.value)
                  setBulkError('')
                }}
                style={selectStyle}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {bulkError && (
            <div
              className="p-3 text-[12px]"
              style={{
                background: 'var(--ek-red-tint)',
                border: '1px solid var(--ek-red-tint-3)',
                borderRadius: 'var(--ek-radius-xs)',
                color: 'var(--ek-red)',
              }}
            >
              {bulkError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

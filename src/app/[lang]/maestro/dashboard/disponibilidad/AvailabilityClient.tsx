'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, Clock, Save, CheckCircle2, AlertCircle } from 'lucide-react'
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

  function addSlot() {
    setSlots(prev => [...prev, { day_of_week: 1, start_time: '09:00', end_time: '10:00' }])
    setSaveStatus('idle')
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
    </div>
  )
}

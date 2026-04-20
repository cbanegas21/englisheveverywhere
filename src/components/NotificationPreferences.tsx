'use client'

import { useState } from 'react'
import { Bell, Mail, Smartphone, MessageSquare, CheckCircle2 } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import type { NotificationPreferences as Prefs } from '@/app/actions/profile'

// TODO (Phase 4): backend wiring for reminders.
//   1) persist via `updateStudentProfile({ notificationPreferences })` (done in panel variant)
//   2) add a cron job that queries bookings in the next 25h / 2h and sends
//      via Resend (email) + Twilio (SMS/WhatsApp).
//   Until (2) is shipped, the `card` variant keeps the "Próximamente" badge so
//   students don't expect messages yet.

interface Props {
  lang: Locale
  // Visual mode: the small card used inside Placement, or the full panel used in Settings.
  variant?: 'card' | 'panel'
  initialValues?: Prefs
  // Called after the user changes values. In panel mode the component also
  // shows a save button that calls this directly. In card mode this is
  // called on every toggle (stub-friendly — parent can ignore).
  onSave?: (next: Prefs) => Promise<{ success: boolean; error?: string } | void>
  // Controls whether the "Coming soon" chip is shown. Defaults to true for card, false for panel.
  showComingSoon?: boolean
}

const T = {
  en: {
    title: 'Reminders',
    subCard: "We'll nudge you before the call.",
    subPanel: "Choose how and when we remind you before each class.",
    comingSoon: 'Coming soon',
    channelsLabel: 'Channels',
    timingLabel: 'When',
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    before24h: '24 hours before',
    before1h: '1 hour before',
    save: 'Save preferences',
    saving: '…',
    saved: 'Saved',
    saveError: 'Could not save. Try again.',
  },
  es: {
    title: 'Recordatorios',
    subCard: 'Te avisamos antes de la llamada.',
    subPanel: 'Elige cómo y cuándo te recordamos antes de cada clase.',
    comingSoon: 'Próximamente',
    channelsLabel: 'Canales',
    timingLabel: 'Cuándo',
    email: 'Correo',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    before24h: '24 horas antes',
    before1h: '1 hora antes',
    save: 'Guardar preferencias',
    saving: '…',
    saved: 'Guardado',
    saveError: 'No se pudo guardar. Inténtalo de nuevo.',
  },
}

const DEFAULT_PREFS: Required<Prefs> = {
  email: true,
  sms: false,
  whatsapp: false,
  before24h: true,
  before1h: true,
}

export default function NotificationPreferences({
  lang,
  variant = 'card',
  initialValues,
  onSave,
  showComingSoon,
}: Props) {
  const tx = T[lang]
  const [prefs, setPrefs] = useState<Required<Prefs>>({ ...DEFAULT_PREFS, ...(initialValues || {}) })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isPanel = variant === 'panel'
  const showBadge = showComingSoon ?? !isPanel

  function toggle<K extends keyof Required<Prefs>>(key: K) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaved(false)
    setError('')
    if (!isPanel && onSave) {
      void onSave(next)
    }
  }

  async function handleSave() {
    if (!onSave) return
    setSaving(true)
    setError('')
    try {
      const res = await onSave(prefs)
      if (res && !res.success) {
        setError(res.error || tx.saveError)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError(tx.saveError)
    } finally {
      setSaving(false)
    }
  }

  const channelDefs: Array<{ key: keyof Required<Prefs>; label: string; Icon: typeof Mail }> = [
    { key: 'email',    label: tx.email,    Icon: Mail },
    { key: 'sms',      label: tx.sms,      Icon: Smartphone },
    { key: 'whatsapp', label: tx.whatsapp, Icon: MessageSquare },
  ]

  const timingDefs: Array<{ key: keyof Required<Prefs>; label: string }> = [
    { key: 'before24h', label: tx.before24h },
    { key: 'before1h',  label: tx.before1h },
  ]

  // ── Card variant (compact, used in PlacementScheduledScreen) ────
  if (!isPanel) {
    return (
      <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(196,30,58,0.08)' }}>
              <Bell className="h-5 w-5" style={{ color: '#C41E3A' }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.title}</h3>
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.subCard}</p>
            </div>
          </div>
          {showBadge && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#B45309', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              {tx.comingSoon}
            </span>
          )}
        </div>

        <div className="space-y-1.5 mb-3">
          {channelDefs.map(({ key, label, Icon }) => {
            const active = prefs[key]
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all"
                style={{
                  background: active ? 'rgba(196,30,58,0.04)' : '#fff',
                  border: `1px solid ${active ? 'rgba(196,30,58,0.25)' : '#E5E7EB'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" style={{ color: active ? '#C41E3A' : '#9CA3AF' }} />
                  <span className="text-[12px] font-semibold" style={{ color: active ? '#C41E3A' : '#6B7280' }}>{label}</span>
                </div>
                <span
                  className="h-4 w-7 rounded-full flex items-center transition-all"
                  style={{ background: active ? '#C41E3A' : '#E5E7EB', padding: '2px' }}
                >
                  <span
                    className="h-3 w-3 rounded-full bg-white transition-transform"
                    style={{ transform: active ? 'translateX(12px)' : 'translateX(0)' }}
                  />
                </span>
              </button>
            )
          })}
        </div>

        <div className="space-y-1.5">
          {timingDefs.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer" style={{ background: '#FAFAFA' }}>
              <span className="text-[12px]" style={{ color: '#4B5563' }}>{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => toggle(key)}
                className="h-4 w-4 rounded"
                style={{ accentColor: '#C41E3A' }}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  // ── Panel variant (full-width, used in Settings) ─────────────────
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      <div className="px-6 py-5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(196,30,58,0.08)' }}>
            <Bell className="h-5 w-5" style={{ color: '#C41E3A' }} />
          </div>
          <div>
            <h3 className="text-[16px] font-black" style={{ color: '#111111' }}>{tx.title}</h3>
            <p className="text-[12px] mt-0.5" style={{ color: '#6B7280' }}>{tx.subPanel}</p>
          </div>
        </div>
        {showBadge && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#B45309', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            {tx.comingSoon}
          </span>
        )}
      </div>

      <div className="px-6 py-5 grid gap-6 md:grid-cols-2">
        <section>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
            {tx.channelsLabel}
          </p>
          <div className="space-y-2">
            {channelDefs.map(({ key, label, Icon }) => {
              const active = prefs[key]
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: active ? 'rgba(196,30,58,0.04)' : '#fff',
                    border: `1px solid ${active ? 'rgba(196,30,58,0.25)' : '#E5E7EB'}`,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" style={{ color: active ? '#C41E3A' : '#9CA3AF' }} />
                    <span className="text-[13px] font-semibold" style={{ color: active ? '#C41E3A' : '#111111' }}>{label}</span>
                  </div>
                  <span
                    className="h-5 w-9 rounded-full flex items-center transition-all"
                    style={{ background: active ? '#C41E3A' : '#E5E7EB', padding: '2px' }}
                  >
                    <span
                      className="h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: active ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>
            {tx.timingLabel}
          </p>
          <div className="space-y-2">
            {timingDefs.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all"
                style={{
                  background: prefs[key] ? 'rgba(196,30,58,0.04)' : '#fff',
                  border: `1px solid ${prefs[key] ? 'rgba(196,30,58,0.25)' : '#E5E7EB'}`,
                }}
              >
                <span className="text-[13px] font-semibold" style={{ color: prefs[key] ? '#C41E3A' : '#111111' }}>{label}</span>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => toggle(key)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: '#C41E3A' }}
                />
              </label>
            ))}
          </div>
        </section>
      </div>

      {onSave && (
        <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
          {error && <span className="text-[12px]" style={{ color: '#C41E3A' }}>{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all"
            style={
              saved
                ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC', cursor: 'default' }
                : { background: '#C41E3A', color: '#fff', cursor: saving ? 'wait' : 'pointer' }
            }
            onMouseEnter={e => { if (!saved && !saving) (e.currentTarget as HTMLButtonElement).style.background = '#9E1830' }}
            onMouseLeave={e => { if (!saved && !saving) (e.currentTarget as HTMLButtonElement).style.background = '#C41E3A' }}
          >
            {saved && <CheckCircle2 className="h-4 w-4" />}
            {saved ? tx.saved : saving ? tx.saving : tx.save}
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Bell, Mail, MessageSquare, CheckCircle2 } from 'lucide-react'
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

  // Email = automated (Resend). WhatsApp = an active opt-in; reminders are sent
  // by staff by hand (admin /admin/whatsapp view) until automation lands. SMS is
  // dropped, so it's no longer offered as a channel.
  const channelDefs: Array<{ key: keyof Required<Prefs>; label: string; Icon: typeof Mail }> = [
    { key: 'email',    label: tx.email,    Icon: Mail },
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
  // Cálido Editorial: tokens only, hairline rules, mono micro-labels, a red
  // left-rule accent instead of an icon chip, and crimson/ink-only state.
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}>
      <style>{`
        /* Toggle row — hairline by default, soft crimson wash + crimson hairline when on. */
        .ek-np-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px;
          border-radius: var(--ek-radius-md);
          background: var(--ek-card);
          border: 1px solid var(--ek-border);
          cursor: pointer;
          transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .ek-np-row:hover { border-color: var(--ek-border-mid); }
        .ek-np-row[data-on="true"] {
          background: var(--ek-red-tint);
          border-color: var(--ek-red-tint-3);
        }
        .ek-np-label {
          font-family: var(--ek-font-sans);
          font-size: 13px;
          font-weight: 700;
          color: var(--ek-text);
          transition: color 0.16s ease;
        }
        .ek-np-row[data-on="true"] .ek-np-label { color: var(--ek-red); }
        /* Pill switch — ink track off, crimson track on. */
        .ek-np-switch {
          height: 20px;
          width: 36px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          padding: 2px;
          background: var(--ek-border-mid);
          transition: background 0.16s ease;
        }
        .ek-np-row[data-on="true"] .ek-np-switch { background: var(--ek-red); }
        .ek-np-knob {
          height: 16px;
          width: 16px;
          border-radius: 999px;
          background: var(--ek-card);
          transition: transform 0.16s ease;
        }
        .ek-np-row[data-on="true"] .ek-np-knob { transform: translateX(16px); }
      `}</style>

      {/* Header — red hairline left-rule + mono kicker, no icon chip / glyph tile. */}
      <div className="px-6 py-5 flex items-stretch gap-4" style={{ borderBottom: '1px solid var(--ek-border)' }}>
        <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', borderRadius: 2, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{tx.title}</div>
          <h3 className="text-[16px] font-black mt-1" style={{ color: 'var(--ek-text)' }}>{tx.title}</h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ek-text-soft)' }}>{tx.subPanel}</p>
        </div>
        {showBadge && (
          <span
            className="ek-microlabel self-start flex-shrink-0 px-2 py-1"
            style={{
              fontSize: '9px',
              letterSpacing: '0.12em',
              color: 'var(--ek-red)',
              background: 'var(--ek-red-tint)',
              border: '1px solid var(--ek-red-tint-3)',
              borderRadius: 'var(--ek-radius-sm)',
            }}
          >
            {tx.comingSoon}
          </span>
        )}
      </div>

      <div className="px-6 py-5 grid gap-6 md:grid-cols-2">
        <section>
          <p className="ek-microlabel mb-3">{tx.channelsLabel}</p>
          <div className="space-y-2">
            {channelDefs.map(({ key, label }) => {
              const active = prefs[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  data-on={active}
                  className="ek-np-row"
                  role="switch"
                  aria-checked={active}
                >
                  <span className="ek-np-label">{label}</span>
                  <span className="ek-np-switch">
                    <span className="ek-np-knob" />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <p className="ek-microlabel mb-3">{tx.timingLabel}</p>
          <div className="space-y-2">
            {timingDefs.map(({ key, label }) => {
              const active = prefs[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  data-on={active}
                  className="ek-np-row"
                  role="switch"
                  aria-checked={active}
                >
                  <span className="ek-np-label">{label}</span>
                  <span className="ek-np-switch">
                    <span className="ek-np-knob" />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {onSave && (
        <div
          className="px-6 py-4 flex items-center justify-end gap-3"
          style={{ background: 'var(--ek-paper-warm)', borderTop: '1px solid var(--ek-border)' }}
        >
          {error && <span className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            data-saving={saving}
            data-saved={saved}
            className="ek-red-btn flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold"
            style={
              saved
                ? {
                    background: 'var(--ek-success-bg)',
                    color: 'var(--ek-success-text)',
                    border: '1px solid var(--ek-success-border)',
                    borderRadius: 'var(--ek-radius-md)',
                    cursor: 'default',
                  }
                : {
                    background: 'var(--ek-red)',
                    color: '#fff',
                    border: '1px solid var(--ek-red)',
                    borderRadius: 'var(--ek-radius-md)',
                    cursor: saving ? 'wait' : 'pointer',
                  }
            }
          >
            {saved && <CheckCircle2 className="h-4 w-4" />}
            {saved ? tx.saved : saving ? tx.saving : tx.save}
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail,
  CheckCircle2,
  Phone,
  ArrowRight,
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import {
  updateStudentProfile,
  requestEmailChange,
  deleteMyAccount,
  type NotificationPreferences as Prefs,
} from '@/app/actions/profile'
import TimezoneSelect from '@/components/TimezoneSelect'
import NotificationPreferences from '@/components/NotificationPreferences'
import { planName } from '@/lib/pricing'

export interface PurchaseRow {
  id: string
  planKey: string
  amountUsd: number
  classesAdded: number
  createdAt: string
}
import { DashTopBar } from '@/components/ui/DashTopBar'
import Modal from '@/components/dashboard/Modal'

// TODO (Phase 4): wire avatar upload to Supabase Storage `avatars/{user.id}`
// bucket (create bucket + policies if missing).

type TabKey = 'profile' | 'account' | 'notifications' | 'billing'

const t = {
  en: {
    title: 'Settings',
    subtitle: 'Manage your account, preferences, and notifications.',
    tabProfile: 'Profile',
    tabAccount: 'Account',
    tabNotifications: 'Notifications',
    tabBilling: 'Billing',
    tabDanger: 'Danger Zone',
    tabDescProfile: 'Personal details',
    tabDescAccount: 'Security, language & timezone',
    tabDescNotifications: 'Reminders & channels',
    tabDescBilling: 'Plan & payment',
    tabDescDanger: 'Delete your account',

    // Profile
    profileHeader: 'Profile',
    profileSub: 'This is how other people see you on the platform.',
    avatar: 'Profile picture',
    avatarHint: 'PNG, JPG or GIF — max 2MB.',
    avatarUpload: 'Upload image',
    avatarRemove: 'Remove',
    avatarSoon: 'Coming soon',
    fullName: 'Full name',
    fullNamePh: 'Enter your full name',
    phone: 'Phone number',
    phonePh: '+504 9999 9999',
    phoneHint: 'Used for class reminders only.',
    email: 'Email address',
    emailHint: 'We\'ll send a confirmation link to the new address before the change takes effect.',
    emailChange: 'Change email',
    emailSaving: 'Sending…',
    emailPendingTitle: 'Confirmation sent',
    emailSame: 'That\'s already your current email.',
    emailInvalid: 'Enter a valid email.',
    saveProfile: 'Save profile',

    // Account
    accountHeader: 'Account',
    accountSub: 'Security, language and timezone.',
    password: 'Password',
    passwordHint: 'Change your password by email link.',
    changePassword: 'Change password',
    language: 'Preferred language',
    languageHint: 'The language the platform uses for emails and notifications.',
    langEs: 'Español',
    langEn: 'English',
    timezone: 'Timezone',
    timezoneHint: 'Your class times are shown in this zone.',
    saveAccount: 'Save account',

    // Billing
    billingHeader: 'Billing',
    billingSub: 'Manage your plan, invoices and top-ups.',
    goToPlan: 'Go to My Plan',
    billingNote: 'All billing actions live on your plan page.',
    billingHistory: 'Purchase history',
    billingEmpty: 'No purchases yet. Your receipts will appear here after you buy a class pack.',
    colDate: 'Date',
    colPlan: 'Plan',
    colAmount: 'Amount',
    colClasses: 'Classes',
    viewReceipt: 'Receipt',

    // Danger
    dangerHeader: 'Danger Zone',
    dangerSub: 'These actions are permanent. Proceed with care.',
    dangerKicker: 'Irreversible',
    deleteTitle: 'Delete account',
    deleteDesc: 'Delete your profile, bookings and history. This cannot be undone.',
    deleteBtn: 'Delete my account',
    deleteModalTitle: 'Delete account?',
    deleteModalKicker: 'Danger Zone',
    deleteModalBody: 'Type DELETE to confirm. We will cancel any upcoming classes, refund unused credits and anonymize your profile. This cannot be undone.',
    deleteTypePh: 'DELETE',
    deleteCancel: 'Cancel',
    deleteConfirm: 'Yes, delete everything',
    deleteWorking: 'Deleting…',
    deleteFailed: 'Could not delete your account. Please try again.',

    // Common
    saved: 'Saved',
    saving: '…',
    saveError: 'Could not save. Try again.',
  },
  es: {
    title: 'Configuración',
    subtitle: 'Administra tu cuenta, preferencias y notificaciones.',
    tabProfile: 'Perfil',
    tabAccount: 'Cuenta',
    tabNotifications: 'Notificaciones',
    tabBilling: 'Facturación',
    tabDanger: 'Zona de peligro',
    tabDescProfile: 'Datos personales',
    tabDescAccount: 'Seguridad, idioma y zona horaria',
    tabDescNotifications: 'Recordatorios y canales',
    tabDescBilling: 'Plan y pagos',
    tabDescDanger: 'Eliminar tu cuenta',

    profileHeader: 'Perfil',
    profileSub: 'Así te ven los demás en la plataforma.',
    avatar: 'Foto de perfil',
    avatarHint: 'PNG, JPG o GIF — máximo 2MB.',
    avatarUpload: 'Subir imagen',
    avatarRemove: 'Quitar',
    avatarSoon: 'Próximamente',
    fullName: 'Nombre completo',
    fullNamePh: 'Ingresa tu nombre completo',
    phone: 'Número de teléfono',
    phonePh: '+504 9999 9999',
    phoneHint: 'Se usa solo para recordatorios de clase.',
    email: 'Correo electrónico',
    emailHint: 'Te enviaremos un enlace de confirmación al nuevo correo antes de aplicar el cambio.',
    emailChange: 'Cambiar correo',
    emailSaving: 'Enviando…',
    emailPendingTitle: 'Confirmación enviada',
    emailSame: 'Ese ya es tu correo actual.',
    emailInvalid: 'Ingresa un correo válido.',
    saveProfile: 'Guardar perfil',

    accountHeader: 'Cuenta',
    accountSub: 'Seguridad, idioma y zona horaria.',
    password: 'Contraseña',
    passwordHint: 'Cambia tu contraseña por correo.',
    changePassword: 'Cambiar contraseña',
    language: 'Idioma preferido',
    languageHint: 'Idioma que usamos en correos y notificaciones.',
    langEs: 'Español',
    langEn: 'English',
    timezone: 'Zona horaria',
    timezoneHint: 'Tus clases se muestran en esta zona.',
    saveAccount: 'Guardar cuenta',

    billingHeader: 'Facturación',
    billingSub: 'Administra tu plan, facturas y recargas.',
    goToPlan: 'Ir a Mi Plan',
    billingNote: 'Todas las acciones de facturación están en tu plan.',
    billingHistory: 'Historial de compras',
    billingEmpty: 'Aún no tienes compras. Tus recibos aparecerán aquí después de comprar un paquete de clases.',
    colDate: 'Fecha',
    colPlan: 'Plan',
    colAmount: 'Monto',
    colClasses: 'Clases',
    viewReceipt: 'Recibo',

    dangerHeader: 'Zona de peligro',
    dangerSub: 'Estas acciones son permanentes. Procede con cuidado.',
    dangerKicker: 'Irreversible',
    deleteTitle: 'Eliminar cuenta',
    deleteDesc: 'Elimina tu perfil, reservas e historial. No se puede deshacer.',
    deleteBtn: 'Eliminar mi cuenta',
    deleteModalTitle: '¿Eliminar cuenta?',
    deleteModalKicker: 'Zona de peligro',
    deleteModalBody: 'Escribe BORRAR para confirmar. Cancelaremos tus próximas clases, reembolsaremos tus créditos sin usar y anonimizaremos tu perfil. No se puede deshacer.',
    deleteTypePh: 'BORRAR',
    deleteCancel: 'Cancelar',
    deleteConfirm: 'Sí, eliminar todo',
    deleteWorking: 'Eliminando…',
    deleteFailed: 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.',

    saved: 'Guardado',
    saving: '…',
    saveError: 'No se pudo guardar. Inténtalo de nuevo.',
  },
}

interface Props {
  lang: Locale
  fullName: string
  timezone: string
  email: string
  phone: string
  avatarUrl: string
  preferredLanguage: 'es' | 'en'
  preferredCurrency: string
  notificationPreferences: Prefs
  purchases: PurchaseRow[]
}

export default function ConfigStudentClient({
  lang,
  fullName,
  timezone,
  email,
  phone,
  avatarUrl,
  preferredLanguage,
  notificationPreferences,
  purchases,
}: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('profile')

  const deleteTypeKeyword = lang === 'es' ? 'BORRAR' : 'DELETE'

  const tabs: Array<{ key: TabKey; label: string; desc: string }> = [
    { key: 'profile',       label: tx.tabProfile,       desc: tx.tabDescProfile },
    { key: 'account',       label: tx.tabAccount,       desc: tx.tabDescAccount },
    { key: 'notifications', label: tx.tabNotifications, desc: tx.tabDescNotifications },
    { key: 'billing',       label: tx.tabBilling,       desc: tx.tabDescBilling },
  ]

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)' }}>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <style>{`
        /* Mobile horizontal tab pills (squared, no dots) */
        .lk-cfg-tab {
          font-family: var(--ek-font-mono);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          flex-shrink: 0;
          padding: 8px 14px;
          border-radius: var(--ek-radius-sm);
          border: 1px solid var(--ek-border);
          background: var(--ek-card);
          color: var(--ek-text-muted);
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
          white-space: nowrap;
        }
        .lk-cfg-tab:hover { color: var(--ek-text); border-color: var(--ek-border-mid); }
        .lk-cfg-tab[data-active="true"] {
          background: var(--ek-ink);
          color: #fff;
          border-color: var(--ek-ink);
        }

        /* Desktop vertical nav rows — quiet left-rule accent, no icon chips */
        .lk-cfg-nav-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
          padding: 14px 16px 14px 13px;
          border-left: 3px solid transparent;
          border-top: 1px solid var(--ek-border-soft);
          background: transparent;
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .lk-cfg-nav-item:first-child { border-top: none; }
        .lk-cfg-nav-item:hover { background: var(--ek-red-tint); }
        .lk-cfg-nav-item[data-active="true"] {
          background: var(--ek-paper-warm);
          border-left-color: var(--ek-red);
        }

        /* Quiet text buttons (password / billing CTAs, danger trigger) */
        .lk-cfg-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--ek-font-sans);
          font-size: 13px;
          font-weight: 700;
          padding: 9px 16px;
          border-radius: var(--ek-radius-md);
          background: transparent;
          color: var(--ek-red);
          border: 1px solid var(--ek-red-tint-3);
          transition: background 0.18s ease, border-color 0.18s ease;
          flex-shrink: 0;
        }
        .lk-cfg-btn-ghost:hover { background: var(--ek-red-tint); border-color: var(--ek-red); }

        .lk-cfg-btn-red {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--ek-font-sans);
          font-size: 13px;
          font-weight: 700;
          padding: 10px 20px;
          border-radius: var(--ek-radius-md);
          background: var(--ek-red);
          color: #fff;
          border: 1px solid var(--ek-red);
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .lk-cfg-btn-red:hover { background: var(--ek-red-hover); border-color: var(--ek-red-hover); }

        /* Primary save button + saved state */
        .lk-cfg-save {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--ek-font-sans);
          font-size: 13px;
          font-weight: 700;
          padding: 10px 20px;
          border-radius: var(--ek-radius-md);
          background: var(--ek-red);
          color: #fff;
          border: 1px solid var(--ek-red);
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .lk-cfg-save:not([disabled]):hover { background: var(--ek-red-hover); border-color: var(--ek-red-hover); }
        .lk-cfg-save[data-saving="true"] { cursor: wait; }
        .lk-cfg-save[data-saved="true"] {
          background: var(--ek-success-bg);
          color: var(--ek-success-text);
          border-color: var(--ek-success-border);
          cursor: default;
        }

        /* Segmented language toggle */
        .lk-cfg-seg {
          font-family: var(--ek-font-sans);
          font-size: 13px;
          font-weight: 700;
          padding: 10px 16px;
          border-radius: var(--ek-radius-md);
          border: 1px solid var(--ek-border);
          background: var(--ek-card);
          color: var(--ek-text-muted);
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .lk-cfg-seg:hover { color: var(--ek-text); border-color: var(--ek-border-mid); }
        .lk-cfg-seg[data-active="true"] {
          background: var(--ek-red-tint);
          color: var(--ek-red);
          border-color: var(--ek-red-tint-3);
        }

        /* Inline email submit button */
        .lk-cfg-email-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--ek-font-sans);
          font-size: 13px;
          font-weight: 700;
          padding: 0 18px;
          border-radius: var(--ek-radius-md);
          border: 1px solid var(--ek-red);
          background: var(--ek-red);
          color: #fff;
          flex-shrink: 0;
          transition: background 0.18s ease;
        }
        .lk-cfg-email-btn:not([disabled]):hover { background: var(--ek-red-hover); }
        .lk-cfg-email-btn[disabled] {
          background: var(--ek-paper-warm);
          color: var(--ek-text-faint);
          border-color: var(--ek-border);
          cursor: not-allowed;
        }

        /* Form inputs — crimson focus ring via :focus, no inline handlers */
        .lk-cfg-input {
          width: 100%;
          font-family: var(--ek-font-sans);
          font-size: 13px;
          color: var(--ek-text);
          background: var(--ek-card);
          border: 1px solid var(--ek-border);
          border-radius: var(--ek-radius-md);
          outline: none;
          transition: border-color 0.18s ease;
        }
        .lk-cfg-input::placeholder { color: var(--ek-text-faint); }
        .lk-cfg-input:focus { border-color: var(--ek-red); }
      `}</style>

      <div className="px-6 md:px-10 py-6 max-w-[1280px] mx-auto">

        {/* Mobile tabs (horizontal scroll) — squared mono pills, no dots/icons */}
        <nav
          className="md:hidden flex gap-1.5 mb-5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              data-active={tab === key}
              className="lk-cfg-tab"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Desktop left nav */}
          <aside className="hidden md:block">
            <nav
              className="rounded-2xl overflow-hidden sticky top-4"
              style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              {tabs.map(({ key, label, desc }) => {
                const active = tab === key
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    data-active={active}
                    className="lk-cfg-nav-item"
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-bold"
                        style={{ color: active ? 'var(--ek-red)' : 'var(--ek-text)' }}
                      >
                        {label}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>{desc}</div>
                    </div>
                    {active && <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--ek-red)' }} />}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <section className="min-w-0">
            {tab === 'profile' && (
              <div className="space-y-6">
                <ProfilePanel
                  lang={lang}
                  tx={tx}
                  initialFullName={fullName}
                  initialPhone={phone}
                  initialAvatarUrl={avatarUrl}
                  email={email}
                />
                {/* ST-05: danger zone de-emphasized — small subsection at the
                    bottom of Profile instead of a top-level primary tab. */}
                <DangerPanel lang={lang} tx={tx} keyword={deleteTypeKeyword} />
              </div>
            )}
            {tab === 'account' && (
              <AccountPanel
                lang={lang}
                tx={tx}
                initialTimezone={timezone}
                initialLanguage={preferredLanguage}
                onLanguageChange={(next) => {
                  try {
                    document.cookie = `ee-locale=${next}; path=/; max-age=31536000; SameSite=Lax`
                    localStorage.setItem('ee-locale', next)
                  } catch { /* ignore */ }
                  // Swap the lang segment in the URL.
                  const path = window.location.pathname
                  const swapped = path.replace(/^\/(es|en)(\/|$)/, `/${next}$2`)
                  router.push(swapped)
                }}
              />
            )}
            {tab === 'notifications' && (
              <NotificationPreferences
                lang={lang}
                variant="panel"
                initialValues={notificationPreferences}
                onSave={async (next) => {
                  return await updateStudentProfile({ notificationPreferences: next })
                }}
              />
            )}
            {tab === 'billing' && <BillingPanel lang={lang} tx={tx} purchases={purchases} />}
          </section>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Profile panel
// ═══════════════════════════════════════════════════════════════════

function ProfilePanel({
  lang,
  tx,
  initialFullName,
  initialPhone,
  initialAvatarUrl,
  email,
}: {
  lang: Locale
  tx: typeof t['en']
  initialFullName: string
  initialPhone: string
  initialAvatarUrl: string
  email: string
}) {
  const [name, setName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [avatarUrl] = useState(initialAvatarUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [newEmail, setNewEmail] = useState(email)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const trimmedNew = newEmail.trim().toLowerCase()
  const emailDirty = trimmedNew.length > 0 && trimmedNew !== email.toLowerCase()

  async function handleEmailChange() {
    setEmailErr('')
    setEmailMsg('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedNew)) {
      setEmailErr(tx.emailInvalid)
      return
    }
    if (trimmedNew === email.toLowerCase()) {
      setEmailErr(tx.emailSame)
      return
    }
    setEmailSaving(true)
    try {
      const res = await requestEmailChange(trimmedNew, lang)
      if (res.success) {
        setEmailMsg(res.message || tx.emailPendingTitle)
      } else {
        setEmailErr(res.error || tx.saveError)
      }
    } catch {
      setEmailErr(tx.saveError)
    } finally {
      setEmailSaving(false)
    }
  }

  const initials = (name || email || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await updateStudentProfile({ fullName: name, phone: phone || null })
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        setError(res.error || tx.saveError)
      }
    } catch {
      setError(tx.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}>
      <PanelHeader kicker={tx.tabProfile} title={tx.profileHeader} subtitle={tx.profileSub} />

      <div className="px-6 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-start gap-5">
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center text-[24px] font-black flex-shrink-0 overflow-hidden"
            style={{ background: 'var(--ek-ink)', color: '#fff', fontFamily: 'var(--ek-font-sans)' }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Label>{tx.avatar}</Label>
            <p className="text-[12px] mb-3" style={{ color: 'var(--ek-text-muted)' }}>{tx.avatarHint}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                // TODO (Phase 4): upload to Supabase Storage, persist URL.
                onChange={() => { /* placeholder */ }}
              />
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold cursor-not-allowed"
                style={{ background: 'var(--ek-paper-warm)', color: 'var(--ek-text-faint)', border: '1px solid var(--ek-border)' }}
                title={tx.avatarSoon}
              >
                {tx.avatarUpload}
              </button>
              <span
                className="ek-microlabel"
                style={{ color: 'var(--ek-text-muted)' }}
              >
                {tx.avatarSoon}
              </span>
            </div>
          </div>
        </div>

        <Divider />

        {/* Full name */}
        <Field label={tx.fullName}>
          <Input
            value={name}
            onChange={(v) => setName(v)}
            placeholder={tx.fullNamePh}
          />
        </Field>

        {/* Email (editable — triggers Supabase confirmation flow) */}
        <Field label={tx.email} hint={tx.emailHint}>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <Input
                value={newEmail}
                onChange={(v) => { setNewEmail(v); setEmailErr(''); setEmailMsg('') }}
                placeholder={email}
                type="email"
                Icon={Mail}
              />
            </div>
            <button
              onClick={handleEmailChange}
              disabled={!emailDirty || emailSaving}
              className="lk-cfg-email-btn"
            >
              {emailSaving ? tx.emailSaving : tx.emailChange}
            </button>
          </div>
          {emailErr && (
            <p className="text-[12px] mt-2" style={{ color: 'var(--ek-red)' }}>{emailErr}</p>
          )}
          {emailMsg && (
            <div
              className="mt-2 px-3 py-2 rounded-md text-[12px] flex items-start gap-2"
              style={{ background: 'var(--ek-success-bg)', color: 'var(--ek-success-text)', border: '1px solid var(--ek-success-border)' }}
            >
              <CheckCircle2 className="h-4 w-4 mt-[1px] flex-shrink-0" />
              <span>{emailMsg}</span>
            </div>
          )}
        </Field>

        {/* Phone */}
        <Field label={tx.phone} hint={tx.phoneHint}>
          <Input
            value={phone}
            onChange={(v) => setPhone(v)}
            placeholder={tx.phonePh}
            type="tel"
            Icon={Phone}
          />
        </Field>
      </div>

      <PanelFooter
        error={error}
        saving={saving}
        saved={saved}
        onSave={handleSave}
        label={tx.saveProfile}
        savedLabel={tx.saved}
        savingLabel={tx.saving}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Account panel
// ═══════════════════════════════════════════════════════════════════

function AccountPanel({
  lang,
  tx,
  initialTimezone,
  initialLanguage,
  onLanguageChange,
}: {
  lang: Locale
  tx: typeof t['en']
  initialTimezone: string
  initialLanguage: 'es' | 'en'
  onLanguageChange: (next: 'es' | 'en') => void
}) {
  const [timezone, setTimezone] = useState(initialTimezone)
  const [language, setLanguage] = useState<'es' | 'en'>(initialLanguage)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await updateStudentProfile({ timezone, preferredLanguage: language })
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        if (language !== lang) onLanguageChange(language)
      } else {
        setError(res.error || tx.saveError)
      }
    } catch {
      setError(tx.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}>
      <PanelHeader kicker={tx.tabAccount} title={tx.accountHeader} subtitle={tx.accountSub} />

      <div className="px-6 py-6 space-y-6">
        {/* Password — thin red hairline left-rule instead of an icon chip */}
        <div className="flex items-stretch gap-4">
          <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', borderRadius: 2, flexShrink: 0 }} />
          <div className="flex-1 min-w-0 py-0.5">
            <div className="text-[14px] font-bold" style={{ color: 'var(--ek-text)' }}>{tx.password}</div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>{tx.passwordHint}</p>
          </div>
          <Link
            href={`/${lang}/login/reset`}
            className="lk-cfg-btn-ghost self-center"
          >
            {tx.changePassword}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Divider />

        {/* Language — segmented toggle, no per-option globe chips */}
        <Field label={tx.language} hint={tx.languageHint}>
          <div className="grid grid-cols-2 gap-2">
            {(['es', 'en'] as const).map((l) => {
              const active = language === l
              return (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  data-active={active}
                  className="lk-cfg-seg"
                >
                  {l === 'es' ? tx.langEs : tx.langEn}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Timezone */}
        <Field label={tx.timezone} hint={tx.timezoneHint}>
          <TimezoneSelect value={timezone} onChange={setTimezone} lang={lang} />
        </Field>
      </div>

      <PanelFooter
        error={error}
        saving={saving}
        saved={saved}
        onSave={handleSave}
        label={tx.saveAccount}
        savedLabel={tx.saved}
        savingLabel={tx.saving}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Billing panel (links to /plan)
// ═══════════════════════════════════════════════════════════════════

function BillingPanel({ lang, tx, purchases }: { lang: Locale; tx: typeof t['en']; purchases: PurchaseRow[] }) {
  const loc = lang === 'es' ? 'es-HN' : 'en-US'
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Tegucigalpa' })

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}>
      <PanelHeader kicker={tx.tabBilling} title={tx.billingHeader} subtitle={tx.billingSub} />

      <div className="px-6 py-6">
        <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--ek-font-mono)', letterSpacing: '0.1em', color: 'var(--ek-text-muted)' }}>
          {tx.billingHistory}
        </p>

        {purchases.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>{tx.billingEmpty}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[tx.colDate, tx.colPlan, tx.colAmount, tx.colClasses, ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: i === 2 || i === 3 ? 'right' : 'left',
                        padding: '0 0 10px',
                        fontFamily: 'var(--ek-font-mono)',
                        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: 'var(--ek-text-muted)',
                        borderBottom: '1px solid var(--ek-border)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--ek-border-soft)' }}>
                    <td style={{ padding: '12px 0', fontSize: 13, color: 'var(--ek-text)' }}>{fmtDate(p.createdAt)}</td>
                    <td style={{ padding: '12px 8px 12px 0', fontSize: 13, fontWeight: 600, color: 'var(--ek-text)' }}>{planName(p.planKey, lang)}</td>
                    <td style={{ padding: '12px 0', fontSize: 13, textAlign: 'right', color: 'var(--ek-text)', fontFamily: 'var(--ek-font-mono)' }}>{fmtUsd(p.amountUsd)}</td>
                    <td style={{ padding: '12px 0', fontSize: 13, textAlign: 'right', color: 'var(--ek-text-soft)' }}>{p.classesAdded}</td>
                    <td style={{ padding: '12px 0 12px 16px', textAlign: 'right' }}>
                      <Link
                        href={`/${lang}/dashboard/recibo/${p.id}`}
                        style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ek-red)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        {tx.viewReceipt} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <Link href={`/${lang}/dashboard/plan`} className="lk-cfg-btn-red">
            {tx.goToPlan}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Danger panel
// ═══════════════════════════════════════════════════════════════════

function DangerPanel({ lang, tx, keyword }: { lang: Locale; tx: typeof t['en']; keyword: string }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [working, setWorking] = useState(false)
  const [err, setErr] = useState('')
  const confirmed = typed.trim() === keyword

  async function handleDelete() {
    if (!confirmed || working) return
    setWorking(true)
    setErr('')
    try {
      const res = await deleteMyAccount(lang)
      if (res.success) {
        // Hard-nav to landing so the now-logged-out state fully resets.
        window.location.href = `/${lang}`
      } else {
        setErr(res.error || tx.deleteFailed)
        setWorking(false)
      }
    } catch {
      setErr(tx.deleteFailed)
      setWorking(false)
    }
  }

  return (
    <>
      {/* ST-05: minimized danger zone — a quiet hairline-ruled subsection that
          sits low under Profile. No filled block, no big header; just a mono
          micro-label + a single inline delete row. The full typed-confirmation
          flow lives in the Modal below, unchanged. */}
      <div className="px-1">
        <div className="ek-microlabel mb-2" style={{ color: 'var(--ek-text-muted)' }}>{tx.dangerKicker}</div>
        <div
          className="flex items-center justify-between gap-4 py-3"
          style={{ borderTop: '1px solid var(--ek-border)' }}
        >
          <div className="min-w-0">
            <div className="text-[13px] font-bold" style={{ color: 'var(--ek-text-soft)' }}>{tx.deleteTitle}</div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ek-text-muted)' }}>{tx.deleteDesc}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="ek-link-danger text-[12px] font-bold flex-shrink-0"
            style={{ color: 'var(--ek-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {tx.deleteBtn}
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { if (!working) { setOpen(false); setTyped(''); setErr('') } }}
        kicker={tx.deleteModalKicker}
        title={tx.deleteModalTitle}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { if (!working) { setOpen(false); setTyped(''); setErr('') } }}
              disabled={working}
              className="px-4 py-2 rounded-md text-[12px] font-bold transition-all"
              style={{
                background: 'transparent',
                color: 'var(--ek-text-soft)',
                border: '1px solid var(--ek-border)',
                cursor: working ? 'not-allowed' : 'pointer',
              }}
            >
              {tx.deleteCancel}
            </button>
            <button
              disabled={!confirmed || working}
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-bold transition-all"
              style={{
                background: confirmed && !working ? 'var(--ek-red)' : 'var(--ek-paper-warm)',
                color: confirmed && !working ? '#fff' : 'var(--ek-text-faint)',
                border: `1px solid ${confirmed && !working ? 'var(--ek-red)' : 'var(--ek-border)'}`,
                cursor: confirmed && !working ? 'pointer' : 'not-allowed',
              }}
            >
              {working ? tx.deleteWorking : tx.deleteConfirm}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px]" style={{ color: 'var(--ek-text-soft)' }}>{tx.deleteModalBody}</p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={keyword}
            disabled={working}
            className="lk-cfg-input px-3 py-2.5 text-[13px] font-bold"
            style={{ letterSpacing: '0.1em' }}
          />
          {err && (
            <p className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{err}</p>
          )}
        </div>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════════════

function PanelHeader({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return (
    <div className="px-6 py-5 flex items-stretch gap-4" style={{ borderBottom: '1px solid var(--ek-border)' }}>
      <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--ek-red)', borderRadius: 2, flexShrink: 0 }} />
      <div>
        <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{kicker}</div>
        <h2 className="text-[16px] font-black mt-1" style={{ color: 'var(--ek-text)' }}>{title}</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--ek-text-soft)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function PanelFooter({
  error,
  saving,
  saved,
  onSave,
  label,
  savedLabel,
  savingLabel,
}: {
  error: string
  saving: boolean
  saved: boolean
  onSave: () => void
  label: string
  savedLabel: string
  savingLabel: string
}) {
  return (
    <div
      className="px-6 py-4 flex items-center justify-end gap-3"
      style={{ background: 'var(--ek-paper-warm)', borderTop: '1px solid var(--ek-border)' }}
    >
      {error && <span className="text-[12px]" style={{ color: 'var(--ek-red)' }}>{error}</span>}
      <button
        onClick={onSave}
        disabled={saving || saved}
        data-saving={saving}
        data-saved={saved}
        className="lk-cfg-save"
      >
        {saved && <CheckCircle2 className="h-4 w-4" />}
        {saved ? savedLabel : saving ? savingLabel : label}
      </button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] mt-1.5" style={{ color: 'var(--ek-text-muted)' }}>{hint}</p>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="ek-microlabel block mb-2"
    >
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  Icon,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  Icon?: typeof Mail
}) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && (
        <Icon
          className="h-4 w-4"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ek-text-muted)' }}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="lk-cfg-input"
        style={{ padding: Icon ? '10px 12px 10px 36px' : '10px 12px' }}
      />
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--ek-border)' }} />
}

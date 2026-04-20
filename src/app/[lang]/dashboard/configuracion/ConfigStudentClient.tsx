'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User,
  Mail,
  Lock,
  Bell,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Phone,
  Upload,
  Trash2,
  ArrowRight,
  ChevronRight,
  X,
} from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { updateStudentProfile, type NotificationPreferences as Prefs } from '@/app/actions/profile'
import TimezoneSelect from '@/components/TimezoneSelect'
import NotificationPreferences from '@/components/NotificationPreferences'

// TODO (Phase 4): wire "Delete account" to a real server action + auth flow
// (requires cascading RLS-safe delete or a Supabase admin function).
// TODO (Phase 4): wire avatar upload to Supabase Storage `avatars/{user.id}`
// bucket (create bucket + policies if missing).

type TabKey = 'profile' | 'account' | 'notifications' | 'billing' | 'danger'

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
    emailHint: 'Email cannot be changed.',
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

    // Danger
    dangerHeader: 'Danger Zone',
    dangerSub: 'These actions are permanent. Proceed with care.',
    deleteTitle: 'Delete account',
    deleteDesc: 'Delete your profile, bookings and history. This cannot be undone.',
    deleteBtn: 'Delete my account',
    deleteModalTitle: 'Delete account?',
    deleteModalBody: 'Type DELETE to confirm. Your data will be permanently removed.',
    deleteTypePh: 'DELETE',
    deleteCancel: 'Cancel',
    deleteConfirm: 'Yes, delete everything',
    deleteNotWired: 'This action is not yet available. Please contact support.',

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
    emailHint: 'El correo no se puede cambiar.',
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

    dangerHeader: 'Zona de peligro',
    dangerSub: 'Estas acciones son permanentes. Procede con cuidado.',
    deleteTitle: 'Eliminar cuenta',
    deleteDesc: 'Elimina tu perfil, reservas e historial. No se puede deshacer.',
    deleteBtn: 'Eliminar mi cuenta',
    deleteModalTitle: '¿Eliminar cuenta?',
    deleteModalBody: 'Escribe BORRAR para confirmar. Tus datos se eliminarán para siempre.',
    deleteTypePh: 'BORRAR',
    deleteCancel: 'Cancelar',
    deleteConfirm: 'Sí, eliminar todo',
    deleteNotWired: 'Esta acción aún no está disponible. Contacta a soporte.',

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
}: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('profile')

  const deleteTypeKeyword = lang === 'es' ? 'BORRAR' : 'DELETE'

  const tabs: Array<{ key: TabKey; label: string; desc: string; Icon: typeof User }> = [
    { key: 'profile',       label: tx.tabProfile,       desc: tx.tabDescProfile,       Icon: User },
    { key: 'account',       label: tx.tabAccount,       desc: tx.tabDescAccount,       Icon: Lock },
    { key: 'notifications', label: tx.tabNotifications, desc: tx.tabDescNotifications, Icon: Bell },
    { key: 'billing',       label: tx.tabBilling,       desc: tx.tabDescBilling,       Icon: CreditCard },
    { key: 'danger',        label: tx.tabDanger,        desc: tx.tabDescDanger,        Icon: AlertTriangle },
  ]

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>
      <div className="px-6 md:px-10 py-8 max-w-[1440px] mx-auto">
        <header className="mb-6">
          <h1 className="text-[28px] md:text-[32px] font-black tracking-tight" style={{ color: '#111111' }}>
            {tx.title}
          </h1>
          <p className="text-[14px] mt-1" style={{ color: '#6B7280' }}>{tx.subtitle}</p>
        </header>

        {/* Mobile tabs (horizontal scroll) */}
        <nav
          className="md:hidden flex gap-1 mb-5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {tabs.map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold flex-shrink-0 transition-all"
                style={{
                  background: active ? '#C41E3A' : '#fff',
                  color: active ? '#fff' : '#6B7280',
                  border: `1px solid ${active ? '#C41E3A' : '#E5E7EB'}`,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Desktop left nav */}
          <aside className="hidden md:block">
            <nav className="rounded-2xl overflow-hidden sticky top-4" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
              {tabs.map(({ key, label, desc, Icon }, idx) => {
                const active = tab === key
                const isDanger = key === 'danger'
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all"
                    style={{
                      background: active ? (isDanger ? 'rgba(196,30,58,0.04)' : '#F9F9F9') : '#fff',
                      borderTop: idx === 0 ? 'none' : '1px solid #F3F4F6',
                      borderLeft: active ? `3px solid ${isDanger ? '#C41E3A' : '#C41E3A'}` : '3px solid transparent',
                      paddingLeft: active ? '13px' : '16px',
                    }}
                  >
                    <Icon
                      className="h-4 w-4 mt-0.5 flex-shrink-0"
                      style={{ color: active ? '#C41E3A' : isDanger ? '#DC2626' : '#9CA3AF' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-bold"
                        style={{ color: active ? '#C41E3A' : isDanger ? '#111111' : '#111111' }}
                      >
                        {label}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{desc}</div>
                    </div>
                    {active && <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: '#C41E3A' }} />}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <section className="min-w-0">
            {tab === 'profile' && (
              <ProfilePanel
                tx={tx}
                initialFullName={fullName}
                initialPhone={phone}
                initialAvatarUrl={avatarUrl}
                email={email}
              />
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
                showComingSoon
                onSave={async (next) => {
                  return await updateStudentProfile({ notificationPreferences: next })
                }}
              />
            )}
            {tab === 'billing' && <BillingPanel lang={lang} tx={tx} />}
            {tab === 'danger' && <DangerPanel tx={tx} keyword={deleteTypeKeyword} />}
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
  tx,
  initialFullName,
  initialPhone,
  initialAvatarUrl,
  email,
}: {
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
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      <PanelHeader title={tx.profileHeader} subtitle={tx.profileSub} Icon={User} />

      <div className="px-6 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-start gap-5">
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center text-[24px] font-black flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #C41E3A 0%, #9E1830 100%)', color: '#fff' }}
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
            <p className="text-[12px] mb-3" style={{ color: '#9CA3AF' }}>{tx.avatarHint}</p>
            <div className="flex items-center gap-2 flex-wrap">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-not-allowed"
                style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB' }}
                title={tx.avatarSoon}
              >
                <Upload className="h-3.5 w-3.5" />
                {tx.avatarUpload}
              </button>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#B45309', border: '1px solid rgba(245,158,11,0.3)' }}
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

        {/* Email (read-only) */}
        <Field label={tx.email} hint={tx.emailHint}>
          <InputLocked value={email} Icon={Mail} />
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
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      <PanelHeader title={tx.accountHeader} subtitle={tx.accountSub} Icon={Lock} />

      <div className="px-6 py-6 space-y-6">
        {/* Password */}
        <div className="flex items-start gap-4">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(196,30,58,0.08)' }}
          >
            <Lock className="h-5 w-5" style={{ color: '#C41E3A' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.password}</div>
            <p className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.passwordHint}</p>
          </div>
          <Link
            href={`/${lang}/login/reset`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all flex-shrink-0"
            style={{ background: '#fff', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.25)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(196,30,58,0.04)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#fff' }}
          >
            {tx.changePassword}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Divider />

        {/* Language */}
        <Field label={tx.language} hint={tx.languageHint}>
          <div className="grid grid-cols-2 gap-2">
            {(['es', 'en'] as const).map((l) => {
              const active = language === l
              return (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={{
                    background: active ? 'rgba(196,30,58,0.04)' : '#fff',
                    color: active ? '#C41E3A' : '#6B7280',
                    border: `1px solid ${active ? 'rgba(196,30,58,0.25)' : '#E5E7EB'}`,
                  }}
                >
                  <Globe className="h-4 w-4" />
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

function BillingPanel({ lang, tx }: { lang: Locale; tx: typeof t['en'] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      <PanelHeader title={tx.billingHeader} subtitle={tx.billingSub} Icon={CreditCard} />

      <div className="px-6 py-8 flex flex-col items-start gap-4">
        <p className="text-[13px]" style={{ color: '#6B7280' }}>{tx.billingNote}</p>
        <Link
          href={`/${lang}/dashboard/plan`}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all"
          style={{ background: '#C41E3A', color: '#fff' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#9E1830' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A' }}
        >
          {tx.goToPlan}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Danger panel
// ═══════════════════════════════════════════════════════════════════

function DangerPanel({ tx, keyword }: { tx: typeof t['en']; keyword: string }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const confirmed = typed.trim() === keyword

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid rgba(220,38,38,0.3)' }}
      >
        <div
          className="px-6 py-5 flex items-start justify-between gap-3"
          style={{ borderBottom: '1px solid #FEE2E2', background: 'rgba(220,38,38,0.03)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(220,38,38,0.1)' }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h3 className="text-[16px] font-black" style={{ color: '#DC2626' }}>{tx.dangerHeader}</h3>
              <p className="text-[12px] mt-0.5" style={{ color: '#991B1B' }}>{tx.dangerSub}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.deleteTitle}</div>
            <p className="text-[12px] mt-0.5" style={{ color: '#6B7280' }}>{tx.deleteDesc}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all flex-shrink-0"
            style={{ background: '#fff', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.04)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {tx.deleteBtn}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(17,17,17,0.55)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 flex items-start justify-between gap-3"
              style={{ borderBottom: '1px solid #F3F4F6', background: 'rgba(220,38,38,0.03)' }}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5" style={{ color: '#DC2626' }} />
                <h3 className="text-[15px] font-black" style={{ color: '#DC2626' }}>{tx.deleteModalTitle}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" style={{ color: '#9CA3AF' }} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              <p className="text-[13px]" style={{ color: '#4B5563' }}>{tx.deleteModalBody}</p>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={keyword}
                className="w-full px-3 py-2.5 text-[13px] font-bold rounded-lg outline-none"
                style={{
                  background: '#fff',
                  color: '#111111',
                  border: '1px solid #E5E7EB',
                  letterSpacing: '0.1em',
                }}
                onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#DC2626' }}
                onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#E5E7EB' }}
              />
              <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{tx.deleteNotWired}</p>
            </div>

            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-bold transition-all"
                style={{ background: '#fff', color: '#6B7280', border: '1px solid #E5E7EB' }}
              >
                {tx.deleteCancel}
              </button>
              <button
                disabled={!confirmed}
                onClick={() => {
                  // TODO (Phase 4): call deleteAccount() server action.
                  setOpen(false)
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all"
                style={{
                  background: confirmed ? '#DC2626' : '#F3F4F6',
                  color: confirmed ? '#fff' : '#9CA3AF',
                  cursor: confirmed ? 'pointer' : 'not-allowed',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {tx.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════════════

function PanelHeader({ title, subtitle, Icon }: { title: string; subtitle: string; Icon: typeof User }) {
  return (
    <div className="px-6 py-5 flex items-start gap-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(196,30,58,0.08)' }}
      >
        <Icon className="h-5 w-5" style={{ color: '#C41E3A' }} />
      </div>
      <div>
        <h2 className="text-[16px] font-black" style={{ color: '#111111' }}>{title}</h2>
        <p className="text-[12px] mt-0.5" style={{ color: '#6B7280' }}>{subtitle}</p>
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
      style={{ background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}
    >
      {error && <span className="text-[12px]" style={{ color: '#C41E3A' }}>{error}</span>}
      <button
        onClick={onSave}
        disabled={saving || saved}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all"
        style={
          saved
            ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC', cursor: 'default' }
            : { background: '#C41E3A', color: '#fff', cursor: saving ? 'wait' : 'pointer' }
        }
        onMouseEnter={(e) => { if (!saved && !saving) (e.currentTarget as HTMLButtonElement).style.background = '#9E1830' }}
        onMouseLeave={(e) => { if (!saved && !saving) (e.currentTarget as HTMLButtonElement).style.background = '#C41E3A' }}
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
      {hint && <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>{hint}</p>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[11px] font-bold uppercase tracking-widest mb-2"
      style={{ color: '#9CA3AF' }}
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
  Icon?: typeof User
}) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && (
        <Icon
          className="h-4 w-4"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-[13px] outline-none transition-all"
        style={{
          padding: Icon ? '10px 12px 10px 36px' : '10px 12px',
          borderRadius: '10px',
          border: '1px solid #E5E7EB',
          color: '#111111',
          background: '#fff',
        }}
        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#C41E3A' }}
        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = '#E5E7EB' }}
      />
    </div>
  )
}

function InputLocked({ value, Icon }: { value: string; Icon: typeof User }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon
        className="h-4 w-4"
        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}
      />
      <input
        type="text"
        value={value}
        readOnly
        className="w-full text-[13px] outline-none"
        style={{
          padding: '10px 12px 10px 36px',
          borderRadius: '10px',
          border: '1px solid #E5E7EB',
          color: '#9CA3AF',
          background: '#F9F9F9',
          cursor: 'not-allowed',
        }}
      />
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#F3F4F6' }} />
}

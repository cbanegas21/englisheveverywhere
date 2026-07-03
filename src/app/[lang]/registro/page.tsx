'use client'

import { Suspense, use, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Check, MailCheck, GraduationCap, BookOpen } from 'lucide-react'
import { signUp } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'
import { Logo } from '@/components/ui/Logo'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { Turnstile } from '@/components/Turnstile'
import { Spinner, LoadingOverlay } from '@/components/ui/Spinner'
import { PhoneInput, defaultCountries, parseCountry } from 'react-international-phone'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-international-phone/style.css'

const t = {
  en: {
    stepRole: 'Sign up as a…',
    studentRole: 'Student',
    teacherRole: 'Teacher',
    studentSub: 'I want to learn English 1-on-1 with a real teacher.',
    teacherSub: 'I want to teach English with flexible hours.',
    studentBenefits: ['Pay once per pack — no auto-renewal', 'Teacher matched to your level', 'Live 1-on-1 classes'],
    teacherBenefits: ['Set your own schedule', 'Competitive pay structure', 'Professional platform'],
    rolePrompt: 'How do you want to use the platform?',
    headline: 'Sign up as a student',
    headlineTeacher: 'Sign up as a teacher',
    alreadyAccount: 'Already have an account?',
    login: 'Log in',
    changeRole: 'Change',
    firstName: 'First name',
    firstNamePlaceholder: 'Your first name',
    lastName: 'Last name',
    lastNamePlaceholder: 'Your last name',
    email: 'Email',
    emailPlaceholder: 'Your email',
    phone: 'Phone number',
    phonePlaceholder: 'Your phone number',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    confirmPassword: 'Confirm password',
    confirmPlaceholder: 'Repeat your password',
    passwordMismatch: 'Passwords do not match.',
    phoneInvalid: 'Please enter a valid phone number.',
    submit: 'Create account',
    loading: 'Creating account…',
    terms: 'By creating an account you agree to our',
    termsLink: 'Terms of Use',
    and: 'and',
    privacy: 'Privacy Policy',
    successHeadline: 'Account created!',
    successSub: 'Check your inbox or spam folder for your confirmation link. Click it to activate your account.',
    backToLogin: 'Go to login',
    errorDefault: 'Something went wrong. Please try again.',
    captchaRequired: 'Please complete the anti-bot check below.',
  },
  es: {
    stepRole: 'Regístrate como…',
    studentRole: 'Estudiante',
    teacherRole: 'Maestro',
    studentSub: 'Quiero aprender inglés 1 a 1 con un maestro real.',
    teacherSub: 'Quiero enseñar inglés con horarios flexibles.',
    studentBenefits: ['Pago único por paquete, sin renovación', 'Maestro asignado a tu nivel', 'Clases 1 a 1 en vivo'],
    teacherBenefits: ['Define tu propio horario', 'Esquema de pago competitivo', 'Plataforma profesional'],
    rolePrompt: '¿Cómo quieres usar la plataforma?',
    headline: 'Regístrate como estudiante',
    headlineTeacher: 'Regístrate como maestro',
    alreadyAccount: '¿Ya tienes cuenta?',
    login: 'Ingresar',
    changeRole: 'Cambiar',
    firstName: 'Nombre',
    firstNamePlaceholder: 'Tu nombre',
    lastName: 'Apellido',
    lastNamePlaceholder: 'Tu apellido',
    email: 'Correo electrónico',
    emailPlaceholder: 'Tu correo',
    phone: 'Teléfono',
    phonePlaceholder: 'Tu número de teléfono',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    confirmPassword: 'Confirmar contraseña',
    confirmPlaceholder: 'Repite tu contraseña',
    passwordMismatch: 'Las contraseñas no coinciden.',
    phoneInvalid: 'Ingresa un número de teléfono válido.',
    submit: 'Crear cuenta',
    loading: 'Creando cuenta…',
    terms: 'Al crear una cuenta aceptas nuestros',
    termsLink: 'Términos de uso',
    and: 'y la',
    privacy: 'Política de privacidad',
    successHeadline: '¡Cuenta creada!',
    successSub: 'Revisa tu bandeja de entrada o carpeta de spam. Haz clic en el enlace para activar tu cuenta.',
    backToLogin: 'Ir a iniciar sesión',
    errorDefault: 'Algo salió mal. Intenta de nuevo.',
    captchaRequired: 'Completa la verificación anti-robot abajo.',
  },
}

type Role = 'student' | 'teacher'
type Step = 'role' | 'form' | 'success'
type Tx = typeof t['en']

function detectTimezone() {
  if (typeof window === 'undefined') return 'America/Bogota'
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
}

const inputBase: React.CSSProperties = {
  width: '100%', borderRadius: 9, border: '1px solid var(--ek-border)', background: '#fff',
  color: 'var(--ek-text)', padding: '12px 14px', fontSize: 14, outline: 'none',
  transition: 'border-color .15s ease, box-shadow .15s ease',
}
const onFocusRing = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'var(--ek-red)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,30,58,0.12)'
}
const onBlurRing = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'var(--ek-border)'
  e.currentTarget.style.boxShadow = 'none'
}

/* Split-screen shell: brand panel + right content column. */
function Shell({ lang, tx, children }: { lang: Locale; tx: Tx; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]" style={{ background: 'var(--ek-paper)' }}>
      <AuthBrandPanel lang={lang} />
      <div className="relative flex flex-col min-h-screen">
        <header className="flex flex-wrap items-center justify-between gap-y-1 px-4 py-4 sm:px-6">
          <Link href={`/${lang}`} aria-label="EnglishKolab">
            <Logo size={26} />
          </Link>
          <p className="text-[13px]" style={{ color: 'var(--ek-text-muted)' }}>
            {tx.alreadyAccount}{' '}
            <Link href={`/${lang}/login`} className="font-semibold underline underline-offset-2" style={{ color: 'var(--ek-text)' }}>
              {tx.login}
            </Link>
          </p>
        </header>
        <div className="flex-1 flex items-center justify-center px-6 pb-16 pt-2">{children}</div>
      </div>
    </div>
  )
}

function RegistroContent({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<Role>('student')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [clientError, setClientError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [timezone] = useState(detectTimezone)
  const captchaOn = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get('error')
  const successParam = searchParams.get('success')

  // Geo phone-prefix autodetect (Carlos 2026-07-03): adopt the visitor's dial
  // code AFTER mount — SSR renders the +504 default so hydration stays stable —
  // and never clobber a number the user already started typing.
  useEffect(() => {
    fetch('/api/geo')
      .then((r) => r.json())
      .then(({ country }: { country: string | null }) => {
        if (!country || typeof country !== 'string') return
        const iso = country.toLowerCase()
        if (iso === 'hn') return
        const match = defaultCountries.map(parseCountry).find((c) => c.iso2 === iso)
        if (!match) return
        setPhone((prev) => {
          const p = prev.trim()
          return p === '' || p === '+504' ? `+${match.dialCode}` : prev
        })
      })
      .catch(() => { /* geo is a nicety — keep the default */ })
  }, [])

  // Land on the right step after a redirect: success → confirm screen; a signup
  // error (e.g. "email already exists") → keep the user on the FORM with the
  // error visible instead of silently bouncing back to the role step.
  useEffect(() => {
    if (successParam === 'confirm') { setStep('success'); return }
    if (errorMsg) {
      const r = searchParams.get('role')
      if (r === 'student' || r === 'teacher') setRole(r)
      setStep('form')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successParam, errorMsg])

  // Send an already-authenticated visitor to their role home instead of showing
  // the signup form again (mirrors the login page's LIVE-003 guard). A logged-out
  // user gets null and sees the form normally. replace() so Back doesn't bounce
  // them here. Skip while landing on the success screen (?success=confirm).
  useEffect(() => {
    if (successParam === 'confirm') return
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active || !user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role = profile?.role
      const home =
        role === 'teacher' ? `/${lang}/maestro/dashboard`
        : role === 'admin' ? `/${lang}/admin`
        : `/${lang}/dashboard`
      if (active) router.replace(home)
    })
    return () => { active = false }
  }, [lang, router, successParam])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if ((fd.get('password') as string) !== (fd.get('confirm_password') as string)) {
      setClientError(tx.passwordMismatch)
      return
    }
    if (!phone || !isValidPhoneNumber(phone)) {
      setClientError(tx.phoneInvalid)
      return
    }
    if (captchaOn && !captchaToken) {
      setClientError(tx.captchaRequired)
      return
    }
    setClientError('')
    fd.set('phone', phone)
    fd.set('lang', lang)
    fd.set('role', role)
    fd.set('timezone', timezone)
    fd.set('captchaToken', captchaToken)
    startTransition(() => signUp(fd))
  }

  /* STEP 1 — Role selection */
  if (step === 'role') {
    const cards: { r: Role; icon: typeof GraduationCap; label: string; sub: string; benefits: string[] }[] = [
      { r: 'student', icon: GraduationCap, label: tx.studentRole, sub: tx.studentSub, benefits: tx.studentBenefits },
      { r: 'teacher', icon: BookOpen, label: tx.teacherRole, sub: tx.teacherSub, benefits: tx.teacherBenefits },
    ]
    return (
      <Shell lang={lang} tx={tx}>
        <div className="w-full max-w-[480px]" style={{ animation: 'fade-up 0.5s ease both' }}>
          <span className="ek-kicker" style={{ color: 'var(--ek-red)' }}>{tx.stepRole}</span>
          <h1
            className="mt-4 mb-8"
            style={{ fontFamily: 'var(--ek-font-sans)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3.2vw, 2rem)', letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--ek-text)' }}
          >
            {tx.rolePrompt}
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map(({ r, icon: Icon, label, sub, benefits }) => (
              <button
                key={r}
                onClick={() => { setRole(r); setStep('form') }}
                className="text-left p-5 transition-all"
                style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ek-red)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(196,30,58,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ek-border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--ek-red-tint-2)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--ek-red)' }} />
                </div>
                <div className="font-bold text-[15px] mb-1" style={{ color: 'var(--ek-text)' }}>{label}</div>
                <div className="text-[13px] mb-4 leading-snug" style={{ color: 'var(--ek-text-muted)' }}>{sub}</div>
                <ul className="space-y-1.5">
                  {benefits.map(b => (
                    <li key={b} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ek-text-soft)' }}>
                      <span className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ek-red-tint-2)' }}>
                        <Check className="w-2.5 h-2.5" style={{ color: 'var(--ek-red)' }} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  /* STEP 3 — Success */
  if (step === 'success') {
    return (
      <Shell lang={lang} tx={tx}>
        <div className="w-full max-w-[400px] text-center" style={{ animation: 'fade-up 0.5s ease both' }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 mx-auto" style={{ background: 'var(--ek-red-tint-2)' }}>
            <MailCheck className="w-7 h-7" style={{ color: 'var(--ek-red)' }} />
          </div>
          <h1 className="font-black mb-3" style={{ fontSize: '1.8rem', letterSpacing: '-0.02em', color: 'var(--ek-text)' }}>
            {tx.successHeadline}
          </h1>
          <p className="text-[15px] leading-relaxed mb-8" style={{ color: 'var(--ek-text-soft)' }}>{tx.successSub}</p>
          <Link
            href={`/${lang}/login`}
            className="inline-block font-bold text-[14px] px-8 py-3.5 rounded-lg transition-all"
            style={{ background: 'var(--ek-red)', color: '#fff' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--ek-red-hover)')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--ek-red)')}
          >
            {tx.backToLogin}
          </Link>
        </div>
      </Shell>
    )
  }

  /* STEP 2 — Form */
  return (
    <Shell lang={lang} tx={tx}>
      <div className="w-full max-w-[400px]" style={{ animation: 'fade-up 0.5s ease both' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="ek-kicker" style={{ color: 'var(--ek-red)' }}>{role === 'teacher' ? tx.teacherRole : tx.studentRole}</span>
            <h1 className="mt-3 font-black" style={{ fontSize: '1.55rem', letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--ek-text)' }}>
              {role === 'teacher' ? tx.headlineTeacher : tx.headline}
            </h1>
          </div>
          <button
            onClick={() => setStep('role')}
            className="text-[12px] rounded-md px-3 py-2 mt-1 transition-colors flex-shrink-0"
            style={{ border: '1px solid var(--ek-border)', color: 'var(--ek-text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--ek-text)'; e.currentTarget.style.borderColor = 'var(--ek-text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--ek-text-muted)'; e.currentTarget.style.borderColor = 'var(--ek-border)' }}
          >
            {tx.changeRole}
          </button>
        </div>

        {(clientError || errorMsg) && (
          <div className="mb-4 rounded-lg px-4 py-3 text-[13px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
            {clientError || errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.firstName}</label>
              <input type="text" name="first_name" required maxLength={60} placeholder={tx.firstNamePlaceholder} style={inputBase} onFocus={onFocusRing} onBlur={onBlurRing} />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.lastName}</label>
              <input type="text" name="last_name" required maxLength={60} placeholder={tx.lastNamePlaceholder} style={inputBase} onFocus={onFocusRing} onBlur={onBlurRing} />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.email}</label>
            <input type="email" name="email" required placeholder={tx.emailPlaceholder} style={inputBase} onFocus={onFocusRing} onBlur={onBlurRing} />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.phone}</label>
            <div
              style={{
                '--react-international-phone-height': '46px',
                '--react-international-phone-border-radius': '9px',
                '--react-international-phone-border-color': 'var(--ek-border)',
                '--react-international-phone-font-size': '14px',
                '--react-international-phone-background-color': '#fff',
                '--react-international-phone-text-color': 'var(--ek-text)',
              } as React.CSSProperties}
            >
              <PhoneInput
                defaultCountry="hn"
                value={phone}
                onChange={p => setPhone(p)}
                placeholder={tx.phonePlaceholder}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.password}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                minLength={8}
                placeholder={tx.passwordPlaceholder}
                style={{ ...inputBase, paddingRight: 44 }}
                onFocus={onFocusRing}
                onBlur={onBlurRing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? (lang === 'es' ? 'Ocultar contraseña' : 'Hide password') : (lang === 'es' ? 'Mostrar contraseña' : 'Show password')}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors"
                style={{ color: 'var(--ek-text-muted)', width: 40, height: 40 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ek-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ek-text-muted)')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.confirmPassword}</label>
            <input type={showPassword ? 'text' : 'password'} name="confirm_password" required minLength={8} placeholder={tx.confirmPlaceholder} style={inputBase} onFocus={onFocusRing} onBlur={onBlurRing} />
          </div>

          {captchaOn && <Turnstile onToken={setCaptchaToken} />}

          <button
            type="submit"
            disabled={isPending}
            className="w-full font-bold text-[14px] py-3.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'var(--ek-red)', color: '#fff' }}
            onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = 'var(--ek-red-hover)' }}
            onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = 'var(--ek-red)' }}
          >
            {isPending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner size={16} stroke="#fff" />
                {tx.loading}
              </span>
            ) : tx.submit}
          </button>
        </form>

        {/* Veil the gap between submit and the onboarding page painting. */}
        {isPending && <LoadingOverlay label={tx.loading} />}

        {/* Google sign-up (students only) sits directly under the primary action,
            with the legal line last so it applies to BOTH sign-up methods. */}
        {role === 'student' && <GoogleButton lang={lang} />}

        <p className="mt-5 text-[12px] leading-relaxed text-center" style={{ color: 'var(--ek-text-muted)' }}>
          {tx.terms}{' '}
          <a href={`/${lang}/terms`} className="underline" style={{ color: 'var(--ek-text-soft)' }}>{tx.termsLink}</a>{' '}
          {tx.and}{' '}
          <a href={`/${lang}/privacy`} className="underline" style={{ color: 'var(--ek-text-soft)' }}>{tx.privacy}</a>.
        </p>
      </div>
    </Shell>
  )
}

export default function RegistroPage({ params }: { params: Promise<{ lang: string }> }) {
  // Read lang synchronously so /en never flashes Spanish copy before an effect
  // resolves the params promise (AUTH-04 FOUC). Mirrors the new-password page.
  const { lang: raw } = use(params)
  const lang: Locale = raw === 'en' ? 'en' : 'es'

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--ek-paper)' }} />}>
      <RegistroContent lang={lang} />
    </Suspense>
  )
}

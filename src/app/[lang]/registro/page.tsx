'use client'

import { Suspense, useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Check, MailCheck, GraduationCap, BookOpen } from 'lucide-react'
import { signUp } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    stepRole: 'Sign up as a…',
    studentRole: 'Student',
    teacherRole: 'Teacher',
    studentSub: 'I want to learn English with bilingual Honduran teachers',
    teacherSub: 'I want to teach and earn with flexible hours',
    studentBenefits: ['No subscription required', 'Teacher matched to your level', 'Live 1-on-1 classes'],
    teacherBenefits: ['Set your own schedule', 'Competitive pay structure', 'Professional platform'],
    headline: 'Sign up as a student',
    headlineTeacher: 'Sign up as a teacher',
    alreadyAccount: 'Already have an account?',
    login: 'Log in',
    changeRole: 'Change',
    name: 'Full name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'Your email',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    remember: 'Remember me',
    submit: 'Create account',
    loading: 'Creating account…',
    terms: 'By creating an account you agree to our',
    termsLink: 'Terms of Use',
    and: 'and',
    privacy: 'Privacy Policy',
    successHeadline: 'Check your email',
    successSub: 'We sent you a confirmation link. Click it to activate your account.',
    backToLogin: 'Go to login',
    errorDefault: 'Something went wrong. Please try again.',
    or: 'or sign up with',
    continueGoogle: 'Sign up with Google',
    continueMicrosoft: 'Sign up with Microsoft',
    oauthNote: 'Google and Microsoft sign-ups are registered as students.',
  },
  es: {
    stepRole: 'Regístrate como…',
    studentRole: 'Estudiante',
    teacherRole: 'Maestro',
    studentSub: 'Quiero aprender inglés con maestros hondureños bilingües',
    teacherSub: 'Quiero enseñar inglés con horarios flexibles',
    studentBenefits: ['Sin suscripción requerida', 'Maestro asignado a tu nivel', 'Clases 1-a-1 en vivo'],
    teacherBenefits: ['Establece tu horario', 'Esquema de pago competitivo', 'Plataforma profesional'],
    headline: 'Regístrate como estudiante',
    headlineTeacher: 'Regístrate como maestro',
    alreadyAccount: '¿Ya tienes cuenta?',
    login: 'Ingresar',
    changeRole: 'Cambiar',
    name: 'Nombre completo',
    namePlaceholder: 'Tu nombre',
    email: 'Correo electrónico',
    emailPlaceholder: 'Tu correo',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    remember: 'Recuérdame',
    submit: 'Crear cuenta',
    loading: 'Creando cuenta…',
    terms: 'Al crear una cuenta aceptas nuestros',
    termsLink: 'Términos de uso',
    and: 'y la',
    privacy: 'Política de privacidad',
    successHeadline: 'Revisa tu correo',
    successSub: 'Te enviamos un enlace de confirmación. Haz clic para activar tu cuenta.',
    backToLogin: 'Ir al login',
    errorDefault: 'Algo salió mal. Intenta de nuevo.',
    or: 'o regístrate con',
    continueGoogle: 'Registrarse con Google',
    continueMicrosoft: 'Registrarse con Microsoft',
    oauthNote: 'Las cuentas de Google y Microsoft se registran como estudiantes.',
  },
}

type Role = 'student' | 'teacher'
type Step = 'role' | 'form' | 'success'

function detectTimezone() {
  if (typeof window === 'undefined') return 'America/Bogota'
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
}

/* Shared top bar */
function TopBar({ lang, tx }: { lang: Locale; tx: typeof t['en'] }) {
  return (
    <div className="px-8 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB' }}>
      <Link href={`/${lang}`} className="flex items-center gap-2">
        <div
          className="h-7 w-7 rounded flex items-center justify-center text-[10px] font-black"
          style={{ background: '#C41E3A', color: '#fff' }}
        >
          EE
        </div>
        <span className="text-[14px] font-black tracking-tight" style={{ color: '#111111' }}>
          English Everywhere
        </span>
      </Link>
      <p className="text-[13px]" style={{ color: '#9CA3AF' }}>
        {tx.alreadyAccount}{' '}
        <Link
          href={`/${lang}/login`}
          className="font-semibold underline underline-offset-2 transition-colors"
          style={{ color: '#111111' }}
        >
          {tx.login}
        </Link>
      </p>
    </div>
  )
}

function RegistroContent({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<Role>('student')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState('')
  const [timezone] = useState(detectTimezone)
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get('error')
  const successParam = searchParams.get('success')

  useEffect(() => { if (successParam === 'confirm') setStep('success') }, [successParam])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('lang', lang)
    fd.set('role', role)
    fd.set('timezone', timezone)
    startTransition(() => signUp(fd))
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    setOauthError('')
    setOauthLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/${lang}/auth/callback`,
        ...(provider === 'azure' && { scopes: 'email' }),
      },
    })
    if (error) {
      setOauthError(error.message)
      setOauthLoading(null)
    }
  }

  /* STEP 1 — Role selection */
  if (step === 'role') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F9F9F9' }}>
        <TopBar lang={lang} tx={tx} />

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-[540px]">
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{ color: '#9CA3AF' }}
            >
              {tx.stepRole}
            </p>
            <h1
              className="font-black mb-10"
              style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', color: '#111111', lineHeight: 1.1 }}
            >
              {lang === 'en' ? 'How do you want\nto use the platform?' : '¿Cómo quieres\nusar la plataforma?'}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student card */}
              <button
                onClick={() => { setRole('student'); setStep('form') }}
                className="text-left rounded-xl p-6 transition-all"
                style={{ background: '#fff', border: '2px solid #E5E7EB' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#111111')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              >
                <div
                  className="w-10 h-10 rounded flex items-center justify-center mb-4"
                  style={{ background: 'rgba(196,30,58,0.08)' }}
                >
                  <GraduationCap className="w-5 h-5" style={{ color: '#C41E3A' }} />
                </div>
                <div className="font-bold text-[15px] mb-1" style={{ color: '#111111' }}>{tx.studentRole}</div>
                <div className="text-[13px] mb-4 leading-snug" style={{ color: '#9CA3AF' }}>{tx.studentSub}</div>
                <ul className="space-y-1.5">
                  {tx.studentBenefits.map(b => (
                    <li key={b} className="flex items-center gap-2 text-[12px]" style={{ color: '#4B5563' }}>
                      <div className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(196,30,58,0.08)' }}>
                        <Check className="w-2.5 h-2.5" style={{ color: '#C41E3A' }} />
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
              </button>

              {/* Teacher card */}
              <button
                onClick={() => { setRole('teacher'); setStep('form') }}
                className="text-left rounded-xl p-6 transition-all"
                style={{ background: '#fff', border: '2px solid #E5E7EB' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              >
                <div
                  className="w-10 h-10 rounded flex items-center justify-center mb-4"
                  style={{ background: 'rgba(196,30,58,0.08)' }}
                >
                  <BookOpen className="w-5 h-5" style={{ color: '#C41E3A' }} />
                </div>
                <div className="font-bold text-[15px] mb-1" style={{ color: '#111111' }}>{tx.teacherRole}</div>
                <div className="text-[13px] mb-4 leading-snug" style={{ color: '#9CA3AF' }}>{tx.teacherSub}</div>
                <ul className="space-y-1.5">
                  {tx.teacherBenefits.map(b => (
                    <li key={b} className="flex items-center gap-2 text-[12px]" style={{ color: '#4B5563' }}>
                      <div className="h-4 w-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(196,30,58,0.08)' }}>
                        <Check className="w-2.5 h-2.5" style={{ color: '#C41E3A' }} />
                      </div>
                      {b}
                    </li>
                  ))}
                </ul>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* STEP 3 — Success */
  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#F9F9F9' }}>
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(196,30,58,0.08)' }}
        >
          <MailCheck className="w-7 h-7" style={{ color: '#C41E3A' }} />
        </div>
        <h1 className="font-black mb-3" style={{ fontSize: '1.8rem', color: '#111111' }}>
          {tx.successHeadline}
        </h1>
        <p className="text-[15px] max-w-sm leading-relaxed mb-8" style={{ color: '#4B5563' }}>
          {tx.successSub}
        </p>
        <Link
          href={`/${lang}/login`}
          className="font-bold text-[14px] px-8 py-3.5 rounded transition-all"
          style={{ background: '#C41E3A', color: '#fff' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
        >
          {tx.backToLogin}
        </Link>
      </div>
    )
  }

  /* STEP 2 — Form */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9F9F9' }}>
      <TopBar lang={lang} tx={tx} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-[420px] rounded-xl px-8 py-10"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(28,19,8,0.06)' }}
        >
          {/* Heading */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-black text-[18px]" style={{ color: '#111111' }}>
              {role === 'teacher' ? tx.headlineTeacher : tx.headline}
            </h1>
            <button
              onClick={() => setStep('role')}
              className="text-[12px] rounded px-2.5 py-1 transition-colors"
              style={{ border: '1px solid #E5E7EB', color: '#9CA3AF' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#111111'; e.currentTarget.style.borderColor = '#111111' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = '#E5E7EB' }}
            >
              {tx.changeRole}
            </button>
          </div>

          {errorMsg && (
            <div
              className="mb-4 rounded px-4 py-3 text-[13px]"
              style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}
            >
              {errorMsg || tx.errorDefault}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#111111' }}>{tx.name}</label>
              <input
                type="text"
                name="full_name"
                required
                placeholder={tx.namePlaceholder}
                className="w-full rounded px-3.5 py-3 text-[14px] transition-all outline-none"
                style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#F9F9F9' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#111111' }}>{tx.email}</label>
              <input
                type="email"
                name="email"
                required
                placeholder={tx.emailPlaceholder}
                className="w-full rounded px-3.5 py-3 text-[14px] transition-all outline-none"
                style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#F9F9F9' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#111111' }}>{tx.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={8}
                  placeholder={tx.passwordPlaceholder}
                  className="w-full rounded px-3.5 py-3 pr-10 text-[14px] transition-all outline-none"
                  style={{ border: '1px solid #E5E7EB', color: '#111111', background: '#F9F9F9' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#111111')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded" style={{ accentColor: '#C41E3A' }} />
              <span className="text-[13px]" style={{ color: '#4B5563' }}>{tx.remember}</span>
            </label>

            <button
              type="submit"
              disabled={isPending}
              className="w-full font-bold text-[14px] py-3.5 rounded transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
              onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
            >
              {isPending ? tx.loading : tx.submit}
            </button>

            <p className="text-[11px] leading-relaxed text-center" style={{ color: '#9CA3AF' }}>
              {tx.terms}{' '}
              <a href={`/${lang}/terms`} className="underline" style={{ color: '#4B5563' }}>{tx.termsLink}</a>{' '}
              {tx.and}{' '}
              <a href={`/${lang}/privacy`} className="underline" style={{ color: '#4B5563' }}>{tx.privacy}</a>.
            </p>
          </form>

          {/* TODO: Enable OAuth once Google/Microsoft providers are configured in Supabase
          {oauthError && (
            <div ...>{oauthError}</div>
          )}

          <div className="flex items-center gap-3 mt-5">
            ... divider ...
          </div>

          <div className="space-y-2.5 mt-4">
            <button onClick={() => handleOAuth('google')} ...>
              {tx.continueGoogle}
            </button>
            <button onClick={() => handleOAuth('azure')} ...>
              {tx.continueMicrosoft}
            </button>
          </div>

          <p ...>{tx.oauthNote}</p>
          */}
        </div>
      </div>
    </div>
  )
}

export default function RegistroPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState<Locale>('es')
  useEffect(() => { params.then(({ lang: l }) => setLang(l as Locale)) }, [params])

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#F9F9F9' }} />}>
      <RegistroContent lang={lang} />
    </Suspense>
  )
}

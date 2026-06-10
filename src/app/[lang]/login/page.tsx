'use client'

import { Suspense, use, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'
import { Logo } from '@/components/ui/Logo'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'

const t = {
  en: {
    kicker: 'Welcome back',
    headline: 'Log in to your account',
    email: 'Email address',
    emailPlaceholder: 'Enter your email address',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    forgot: 'Forgot password?',
    submit: 'Log in',
    loading: 'Logging in…',
    noAccount: "Don't have an account?",
    register: 'Sign up',
    errorDefault: 'Invalid email or password.',
    successReset: 'Check your inbox for a recovery email.',
    keepLogged: 'Keep me logged in',
    or: 'or continue with',
    continueGoogle: 'Continue with Google',
    continueMicrosoft: 'Continue with Microsoft',
    adminPrompt: 'Are you an admin? ',
    adminLink: 'Login here',
  },
  es: {
    kicker: 'Bienvenido de vuelta',
    headline: 'Ingresar a tu cuenta',
    email: 'Correo electrónico',
    emailPlaceholder: 'Ingresa tu correo electrónico',
    password: 'Contraseña',
    passwordPlaceholder: 'Ingresa tu contraseña',
    forgot: '¿Olvidaste tu contraseña?',
    submit: 'Ingresar',
    loading: 'Ingresando…',
    noAccount: '¿No tienes cuenta?',
    register: 'Regístrate',
    errorDefault: 'Correo o contraseña inválidos.',
    successReset: 'Revisa tu bandeja de entrada para recuperar tu contraseña.',
    keepLogged: 'Mantenerme conectado',
    or: 'o continúa con',
    continueGoogle: 'Continuar con Google',
    continueMicrosoft: 'Continuar con Microsoft',
    adminPrompt: '¿Eres administrador? ',
    adminLink: 'Accede aquí',
  },
}

type Tx = typeof t['en']
interface Props { params: Promise<{ lang: string }> }

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

function LoginForm({ lang }: { lang: Locale }) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const tx: Tx = t[lang]
  const errorMsg = searchParams.get('error')
  const successMsg = searchParams.get('success')

  // Send an already-authenticated visitor to their role home instead of showing
  // the login form again (LIVE-003). A logged-out user (incl. right after
  // signOut) gets null and sees the form normally. replace() so Back doesn't
  // bounce them here.
  useEffect(() => {
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
  }, [lang, router])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('lang', lang)
    // Carry the post-login destination (e.g. a /sala room join link, CALL-13).
    const next = searchParams.get('next')
    if (next) fd.set('next', next)
    startTransition(() => signIn(fd))
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    setOauthError('')
    setOauthLoading(provider)
    const supabase = createClient()
    const next = searchParams.get('next')
    const callback = `${window.location.origin}/${lang}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callback,
        ...(provider === 'azure' && { scopes: 'email' }),
      },
    })
    if (error) {
      setOauthError(error.message)
      setOauthLoading(null)
    }
    // On success the browser follows the OAuth redirect automatically
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]" style={{ background: 'var(--ek-paper)' }}>
      <AuthBrandPanel lang={lang} />

      <div className="relative flex flex-col min-h-screen">
        <header className="flex items-center justify-between" style={{ padding: '20px 26px' }}>
          <Link href={`/${lang}`} aria-label="EnglishKolab">
            <Logo size={26} />
          </Link>
          <p className="text-[13px]" style={{ color: 'var(--ek-text-muted)' }}>
            {tx.noAccount}{' '}
            <Link href={`/${lang}/registro`} className="font-semibold underline underline-offset-2" style={{ color: 'var(--ek-text)' }}>
              {tx.register}
            </Link>
          </p>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 pb-16 pt-2">
          <div className="w-full max-w-[400px]" style={{ animation: 'fade-up 0.5s ease both' }}>
            <div className="mb-6">
              <span className="ek-kicker" style={{ color: 'var(--ek-red)' }}>{tx.kicker}</span>
              <h1 className="mt-3 font-black" style={{ fontSize: '1.6rem', letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--ek-text)' }}>
                {tx.headline}
              </h1>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-lg px-4 py-3 text-[13px]" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}>
                {/(invalid login credentials|invalid email or password|email not confirmed)/i.test(errorMsg) ? tx.errorDefault : errorMsg}
              </div>
            )}
            {successMsg === 'reset' && (
              <div className="mb-4 rounded-lg px-4 py-3 text-[13px]" style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#16A34A' }}>
                {tx.successReset}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--ek-text)' }}>{tx.email}</label>
                <input type="email" name="email" required placeholder={tx.emailPlaceholder} style={inputBase} onFocus={onFocusRing} onBlur={onBlurRing} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>{tx.password}</label>
                  <Link
                    href={`/${lang}/login/reset`}
                    className="text-[12px] transition-colors"
                    style={{ color: 'var(--ek-text-muted)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ek-text)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ek-text-muted)')}
                  >
                    {tx.forgot}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    minLength={8}
                    placeholder={tx.passwordPlaceholder}
                    style={{ ...inputBase, paddingRight: 40 }}
                    onFocus={onFocusRing}
                    onBlur={onBlurRing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? (lang === 'es' ? 'Ocultar contraseña' : 'Hide password') : (lang === 'es' ? 'Mostrar contraseña' : 'Show password')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--ek-text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ek-text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ek-text-muted)')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full font-bold text-[14px] py-3.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'var(--ek-red)', color: '#fff' }}
                onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = 'var(--ek-red-hover)' }}
                onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = 'var(--ek-red)' }}
              >
                {isPending ? tx.loading : tx.submit}
              </button>
            </form>

            <p className="mt-6 text-center text-[13px]" style={{ color: 'var(--ek-text-muted)' }}>
              {tx.noAccount}{' '}
              <Link href={`/${lang}/registro`} className="font-semibold underline underline-offset-2" style={{ color: 'var(--ek-text)' }}>
                {tx.register}
              </Link>
            </p>

            <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--ek-text-faint)' }}>
              {tx.adminPrompt}
              <Link
                href={`/${lang}/admin`}
                className="underline underline-offset-2 transition-colors"
                style={{ color: 'var(--ek-text-muted)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ek-text-soft)')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ek-text-muted)')}
              >
                {tx.adminLink}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage({ params }: Props) {
  // Read lang synchronously so /en never flashes Spanish copy before an effect
  // resolves the params promise (AUTH-04 FOUC). Mirrors the new-password page.
  const { lang: raw } = use(params)
  const lang: Locale = raw === 'en' ? 'en' : 'es'

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--ek-paper)' }} />}>
      <LoginForm lang={lang} />
    </Suspense>
  )
}

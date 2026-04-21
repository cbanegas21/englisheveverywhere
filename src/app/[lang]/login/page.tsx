'use client'

import { Suspense, useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
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
    backToHome: '← Home',
    or: 'or continue with',
    continueGoogle: 'Continue with Google',
    continueMicrosoft: 'Continue with Microsoft',
  },
  es: {
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
    successReset: 'Revisa tu bandeja de entrada.',
    keepLogged: 'Mantenerme conectado',
    backToHome: '← Inicio',
    or: 'o continúa con',
    continueGoogle: 'Continuar con Google',
    continueMicrosoft: 'Continuar con Microsoft',
  },
}

interface Props { params: Promise<{ lang: string }> }

function LoginForm({ lang }: { lang: Locale }) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState('')
  const searchParams = useSearchParams()
  const tx = t[lang]
  const errorMsg = searchParams.get('error')
  const successMsg = searchParams.get('success')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('lang', lang)
    startTransition(() => signIn(fd))
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
    // On success the browser follows the OAuth redirect automatically
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9F9F9' }}>
      {/* Top bar */}
      <div className="px-8 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded flex items-center justify-center text-[10px] font-black"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            EK
          </div>
          <span className="text-[14px] font-black tracking-tight" style={{ color: '#111111' }}>
            EnglishKolab
          </span>
        </Link>
        <p className="text-[13px]" style={{ color: '#9CA3AF' }}>
          {tx.noAccount}{' '}
          <Link
            href={`/${lang}/registro`}
            className="font-semibold underline underline-offset-2 transition-colors"
            style={{ color: '#111111' }}
          >
            {tx.register}
          </Link>
        </p>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-[400px] rounded-xl px-8 py-10"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(28,19,8,0.06)' }}
        >
          {/* Logo */}
          <div className="mb-7">
            <h1 className="text-[18px] font-black" style={{ color: '#111111' }}>
              {tx.headline}
            </h1>
          </div>

          {/* Error / success messages */}
          {errorMsg && (
            <div
              className="mb-4 rounded px-4 py-3 text-[13px]"
              style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}
            >
              {errorMsg === 'Invalid login credentials' ? tx.errorDefault : errorMsg}
            </div>
          )}
          {successMsg === 'reset' && (
            <div
              className="mb-4 rounded px-4 py-3 text-[13px]"
              style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#16A34A' }}
            >
              {tx.successReset}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#111111' }}>
                {tx.email}
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder={tx.emailPlaceholder}
                className="w-full rounded px-3.5 py-3 text-[14px] transition-all outline-none"
                style={{
                  border: '1px solid #E5E7EB',
                  color: '#111111',
                  background: '#F9F9F9',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#111111' }}>{tx.password}</label>
                <Link
                  href={`/${lang}/login/reset`}
                  className="text-[12px] transition-colors"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#111111')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF')}
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
                  className="w-full rounded px-3.5 py-3 pr-10 text-[14px] transition-all outline-none"
                  style={{
                    border: '1px solid #E5E7EB',
                    color: '#111111',
                    background: '#F9F9F9',
                  }}
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

            {/* Keep me logged in */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                style={{ accentColor: '#C41E3A' }}
              />
              <span className="text-[13px]" style={{ color: '#4B5563' }}>{tx.keepLogged}</span>
            </label>

            {/* Submit */}
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
          </form>

          {/* TODO: Enable OAuth once Google/Microsoft providers are configured in Supabase
          {oauthError && (
            <div
              className="mt-4 rounded px-4 py-3 text-[13px]"
              style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626' }}
            >
              {oauthError}
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px" style={{ background: '#E5E7EB' }} />
            <span className="text-[12px] whitespace-nowrap" style={{ color: '#9CA3AF' }}>{tx.or}</span>
            <div className="flex-1 h-px" style={{ background: '#E5E7EB' }} />
          </div>

          <div className="space-y-2.5 mt-4">
            <button type="button" onClick={() => handleOAuth('google')} ...>
              {tx.continueGoogle}
            </button>
            <button type="button" onClick={() => handleOAuth('azure')} ...>
              {tx.continueMicrosoft}
            </button>
          </div>
          */}

          {/* Sign up link */}
          <p className="mt-6 text-center text-[13px]" style={{ color: '#9CA3AF' }}>
            {tx.noAccount}{' '}
            <Link
              href={`/${lang}/registro`}
              className="font-semibold underline underline-offset-2 transition-colors"
              style={{ color: '#111111' }}
            >
              {tx.register}
            </Link>
          </p>

          {/* Admin access — subtle, for internal use */}
          <p className="mt-4 text-center text-[11px]" style={{ color: '#D1D5DB' }}>
            {lang === 'es' ? '¿Eres administrador? ' : 'Are you an admin? '}
            <Link
              href={`/${lang}/admin`}
              className="underline underline-offset-2 transition-colors"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#4B5563')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF')}
            >
              {lang === 'es' ? 'Accede aquí' : 'Login here'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage({ params }: Props) {
  const [lang, setLang] = useState<Locale>('es')
  useEffect(() => { params.then(({ lang: l }) => setLang(l as Locale)) }, [params])

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#F9F9F9' }} />}>
      <LoginForm lang={lang} />
    </Suspense>
  )
}

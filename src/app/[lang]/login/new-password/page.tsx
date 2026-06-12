'use client'

import { Suspense, use, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    title: 'Set new password',
    label: 'New password',
    placeholder: 'At least 8 characters',
    cta: 'Update password',
    success: 'Password updated! Redirecting…',
    verifying: 'Verifying your reset link…',
    errorSession: 'Invalid or expired reset link. Please request a new one.',
    errorShort: 'Password must be at least 8 characters.',
    errorUpdate: 'We could not update your password. Please try again.',
    requestNewLink: 'Request a new link',
  },
  es: {
    title: 'Nueva contraseña',
    label: 'Nueva contraseña',
    placeholder: 'Mínimo 8 caracteres',
    cta: 'Actualizar contraseña',
    success: '¡Contraseña actualizada! Redirigiendo…',
    verifying: 'Verificando tu enlace…',
    errorSession: 'Enlace inválido o expirado. Solicita uno nuevo.',
    errorShort: 'La contraseña debe tener al menos 8 caracteres.',
    errorUpdate: 'No pudimos actualizar tu contraseña. Intenta de nuevo.',
    requestNewLink: 'Solicitar un nuevo enlace',
  },
}

function NewPasswordForm({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  // The reset code/token is single-use: exchanging it twice (e.g. a StrictMode
  // effect re-run, or a re-render before state settles) burns the second call
  // and surfaces a spurious "expired link" (PASSWORD-02). Cache the establish()
  // promise so the actual exchange runs exactly once across re-runs; each run
  // still attaches its own result handler (guarded by its `active` flag).
  const establishRef = useRef<Promise<boolean> | null>(null)

  // Establish the recovery session from whatever shape the reset link arrives in:
  //  • PKCE flow:      ?code=...                      → exchangeCodeForSession
  //  • OTP/token_hash: ?token_hash=...&type=recovery  → verifyOtp
  //  • Implicit/hash:  #access_token=...              → detectSessionInUrl (auto)
  useEffect(() => {
    let active = true

    async function establish(): Promise<boolean> {
      // Always attempt to consume the recovery token FIRST. An unrelated
      // pre-existing session must NOT mask it — short-circuiting on getSession()
      // would update the currently-logged-in account's password instead of the
      // token subject's. Only on exchange FAILURE do we fall back to an existing
      // session: that's the double-consume recovery (PASSWORD-02) — a second
      // effect run / true remount finds the code already spent but the recovery
      // session from the first exchange still present, so it's a success, not a
      // spurious "expired link".
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return true
        const { data } = await supabase.auth.getSession()
        return !!data.session
      }
      const tokenHash = searchParams.get('token_hash')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
        if (!error) return true
        const { data } = await supabase.auth.getSession()
        return !!data.session
      }
      // Hash-fragment flow: createBrowserClient auto-parses #access_token — just check.
      const { data } = await supabase.auth.getSession()
      return !!data.session
    }

    if (!establishRef.current) establishRef.current = establish()
    establishRef.current.then(ok => {
      if (!active) return
      if (ok) {
        setSessionReady(true)
        setStatus('idle')
      } else {
        setSessionReady(false)
        setStatus('error')
        setMessage(tx.errorSession)
      }
    })

    // Supabase emits PASSWORD_RECOVERY once it parses a recovery URL (hash flow).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (active && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setSessionReady(true)
        setStatus(prev => (prev === 'error' ? 'idle' : prev))
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setStatus('error')
      setMessage(tx.errorShort)
      return
    }
    setStatus('loading')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      // Never surface the raw Supabase message (untranslated + info-leaking).
      // Map to a localized generic and log the real error server-side-ish.
      console.error('[new-password] updateUser failed:', error.message)
      setStatus('error')
      setMessage(tx.errorUpdate)
    } else {
      setStatus('success')
      setMessage(tx.success)
      // Route to the role-appropriate home, not always the student dashboard
      // (PASSWORD-01). The recovery session is active here, so we can read the
      // caller's own role (RLS permits self-read of role).
      let dest = `/${lang}/dashboard`
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error: roleErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        if (roleErr || !profile?.role) {
          // Self-read of own role is permitted (migration 033), so this is
          // unexpected — keep the safe /dashboard fallback but surface the
          // anomaly so an RLS/timing misconfig is visible in monitoring.
          console.warn('[new-password] could not read role for redirect:', roleErr?.message)
        } else if (profile.role === 'teacher') dest = `/${lang}/maestro/dashboard`
        else if (profile.role === 'admin') dest = `/${lang}/admin`
      }
      setTimeout(() => router.push(dest), 1500)
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--ek-paper)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}
      >
        <h1 className="text-[22px] font-black mb-6" style={{ color: '#111111' }}>
          {tx.title}
        </h1>

        {!sessionReady && status === 'error' && (
          <div className="mb-4">
            <p className="text-[13px] text-red-600">{message}</p>
            <Link
              href={`/${lang}/login/reset`}
              className="mt-2 inline-block text-[13px] font-semibold underline underline-offset-2"
              style={{ color: 'var(--ek-red)' }}
            >
              {tx.requestNewLink}
            </Link>
          </div>
        )}

        {!sessionReady && status !== 'error' && (
          <p className="text-[13px] mb-1" style={{ color: 'var(--ek-text-muted)' }}>{tx.verifying}</p>
        )}

        {sessionReady && status !== 'success' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#111111' }}>
                {tx.label}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tx.placeholder}
                required
                minLength={8}
                className="w-full rounded-lg px-3.5 py-2.5 text-[14px] outline-none transition-all"
                style={{
                  border: '1.5px solid rgba(0,0,0,0.12)',
                  color: '#111111',
                  background: '#fff',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            {status === 'error' && sessionReady && (
              <p className="text-[12px] text-red-600">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="ee-btn-primary w-full justify-center"
            >
              {status === 'loading' ? '…' : tx.cta}
            </button>
          </form>
        )}

        {status === 'success' && (
          <p className="text-[14px] font-medium" style={{ color: '#16a34a' }}>
            {message}
          </p>
        )}
      </div>
    </main>
  )
}

export default function NewPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang: raw } = use(params)
  const lang = (raw as Locale) in t ? (raw as Locale) : 'es'
  return (
    <Suspense>
      <NewPasswordForm lang={lang} />
    </Suspense>
  )
}

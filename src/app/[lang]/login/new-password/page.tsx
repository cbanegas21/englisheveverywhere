'use client'

import { Suspense, use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    title: 'Set new password',
    label: 'New password',
    placeholder: 'At least 8 characters',
    cta: 'Update password',
    success: 'Password updated! Redirecting…',
    errorSession: 'Invalid or expired reset link. Please request a new one.',
    errorShort: 'Password must be at least 8 characters.',
  },
  es: {
    title: 'Nueva contraseña',
    label: 'Nueva contraseña',
    placeholder: 'Mínimo 8 caracteres',
    cta: 'Actualizar contraseña',
    success: '¡Contraseña actualizada! Redirigiendo…',
    errorSession: 'Enlace inválido o expirado. Solicita uno nuevo.',
    errorShort: 'La contraseña debe tener al menos 8 caracteres.',
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

  // Exchange the code from the URL for a session
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setStatus('error')
      setMessage(tx.errorSession)
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setStatus('error')
        setMessage(tx.errorSession)
      } else {
        setSessionReady(true)
      }
    })
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
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('success')
      setMessage(tx.success)
      setTimeout(() => router.push(`/${lang}/dashboard`), 1500)
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F9F9F9' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}
      >
        <h1 className="text-[22px] font-black mb-6" style={{ color: '#111111' }}>
          {tx.title}
        </h1>

        {status === 'error' && !sessionReady && (
          <p className="text-[13px] mb-4 text-red-600">{message}</p>
        )}

        {(sessionReady || status !== 'error') && status !== 'success' && (
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

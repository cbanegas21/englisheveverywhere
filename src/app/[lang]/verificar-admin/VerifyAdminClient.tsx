'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

const T = {
  es: {
    title: 'Verificación en dos pasos',
    sub: 'Ingresa el código de 6 dígitos de tu app de autenticación.',
    code: 'Código de verificación',
    submit: 'Verificar',
    verifying: 'Verificando…',
    bad: 'Código incorrecto o expirado. Intenta de nuevo.',
    noFactor: 'No se encontró un autenticador. Recarga la página.',
    signout: 'Cerrar sesión',
  },
  en: {
    title: 'Two-step verification',
    sub: 'Enter the 6-digit code from your authenticator app.',
    code: 'Verification code',
    submit: 'Verify',
    verifying: 'Verifying…',
    bad: 'Wrong or expired code. Try again.',
    noFactor: 'No authenticator found. Reload the page.',
    signout: 'Sign out',
  },
}

export default function VerifyAdminClient({ lang }: { lang: Locale }) {
  const tx = T[lang]
  const router = useRouter()
  const supabase = createClient()
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.find((f) => f.status === 'verified') || data?.totp?.[0]
      if (totp) setFactorId(totp.id)
      else setErr(tx.noFactor)
    }).catch(() => setErr(tx.noFactor))
    inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length < 6 || busy) return
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) {
      setErr(tx.bad)
      setCode('')
      setBusy(false)
      inputRef.current?.focus()
      return
    }
    // Session is now AAL2 — go back into the admin.
    router.replace(`/${lang}/admin`)
    router.refresh()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace(`/${lang}/login`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)' }}>
      <div className="w-full max-w-sm" style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 16, padding: '32px 28px' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--ek-red-tint)', color: 'var(--ek-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <ShieldCheck size={22} />
        </div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ek-text)' }}>{tx.title}</h1>
        <p style={{ margin: '8px 0 22px', fontSize: 13.5, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>{tx.sub}</p>
        <form onSubmit={submit}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text-muted)' }}>{tx.code}</label>
          <input
            ref={inputRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ width: '100%', marginTop: 6, padding: '12px 14px', fontSize: 22, letterSpacing: '0.35em', textAlign: 'center', borderRadius: 10, border: '1px solid var(--ek-border)', background: 'var(--ek-paper)', color: 'var(--ek-text)', fontFamily: 'var(--ek-font-mono)' }}
            placeholder="000000"
          />
          {err && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#DC2626' }}>{err}</p>}
          <button
            type="submit"
            disabled={busy || code.length < 6}
            style={{ width: '100%', marginTop: 18, padding: '12px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', background: 'var(--ek-red)', color: '#fff', cursor: busy || code.length < 6 ? 'not-allowed' : 'pointer', opacity: busy || code.length < 6 ? 0.6 : 1 }}
          >
            {busy ? tx.verifying : tx.submit}
          </button>
        </form>
        <button onClick={signOut} style={{ width: '100%', marginTop: 12, padding: '8px', fontSize: 12.5, fontWeight: 500, background: 'transparent', border: 'none', color: 'var(--ek-text-muted)', cursor: 'pointer' }}>
          {tx.signout}
        </button>
      </div>
    </div>
  )
}

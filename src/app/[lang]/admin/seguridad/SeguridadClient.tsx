'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

const T = {
  es: {
    title: 'Seguridad de la cuenta',
    sub: 'Verificación en dos pasos (2FA) para el panel de administración.',
    active: '2FA activado',
    activeNote: 'Tu cuenta de administrador está protegida con un código de un solo uso. Te pediremos el código al iniciar sesión.',
    disable: 'Desactivar 2FA',
    disabling: 'Desactivando…',
    inactive: '2FA no está activado',
    inactiveNote: 'Recomendado: protege el panel con tu app de autenticación (Google Authenticator, Authy, 1Password). Si tu contraseña se filtra, el 2FA evita el acceso.',
    enable: 'Activar 2FA',
    starting: 'Generando…',
    step1: '1. Escanea este código QR con tu app de autenticación',
    orManual: 'O ingresa esta clave manualmente:',
    step2: '2. Ingresa el código de 6 dígitos que muestra la app',
    verify: 'Verificar y activar',
    verifying: 'Verificando…',
    bad: 'Código incorrecto. Intenta con el código actual de tu app.',
    enrollErr: 'No se pudo iniciar. Recarga e intenta de nuevo.',
    done: '¡2FA activado correctamente!',
    cancel: 'Cancelar',
  },
  en: {
    title: 'Account security',
    sub: 'Two-factor authentication (2FA) for the admin panel.',
    active: '2FA is on',
    activeNote: 'Your admin account is protected with a one-time code. We\'ll ask for it when you sign in.',
    disable: 'Turn off 2FA',
    disabling: 'Turning off…',
    inactive: '2FA is off',
    inactiveNote: 'Recommended: protect the panel with your authenticator app (Google Authenticator, Authy, 1Password). If your password leaks, 2FA still blocks access.',
    enable: 'Turn on 2FA',
    starting: 'Generating…',
    step1: '1. Scan this QR code with your authenticator app',
    orManual: 'Or enter this key manually:',
    step2: '2. Enter the 6-digit code the app shows',
    verify: 'Verify & turn on',
    verifying: 'Verifying…',
    bad: 'Wrong code. Try the current code from your app.',
    enrollErr: 'Couldn\'t start. Reload and try again.',
    done: '2FA turned on successfully!',
    cancel: 'Cancel',
  },
}

type Enroll = { factorId: string; qr: string; secret: string }

export default function SeguridadClient({ lang }: { lang: Locale }) {
  const tx = T[lang]
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [hasFactor, setHasFactor] = useState(false)
  const [enroll, setEnroll] = useState<Enroll | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setHasFactor(!!data?.totp?.some((f) => f.status === 'verified'))
    setLoading(false)
  }, [supabase])

  useEffect(() => { refresh() }, [refresh])

  async function startEnroll() {
    setErr(''); setBusy(true)
    // Clear any half-finished (unverified) factor so re-enrolling is clean.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.totp || []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `admin-${Date.now()}` })
    setBusy(false)
    if (error || !data) { setErr(tx.enrollErr); return }
    setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enroll || code.length < 6 || busy) return
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.factorId, code })
    setBusy(false)
    if (error) { setErr(tx.bad); setCode(''); return }
    setEnroll(null); setCode('')
    await refresh()
    router.refresh()
  }

  async function disable() {
    if (busy) return
    setBusy(true)
    const { data } = await supabase.auth.mfa.listFactors()
    for (const f of data?.totp || []) await supabase.auth.mfa.unenroll({ factorId: f.id })
    setBusy(false)
    await refresh()
    router.refresh()
  }

  const card: React.CSSProperties = { background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 14, padding: 24, maxWidth: 460 }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ek-text-muted)' }}><Loader2 className="animate-spin" size={16} /></div>

  return (
    <div style={{ fontFamily: 'var(--ek-font-sans)' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--ek-text)' }}>{tx.title}</h1>
      <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--ek-text-muted)' }}>{tx.sub}</p>

      {hasFactor ? (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ek-success, #16a34a)' }}>
            <ShieldCheck size={20} /><strong style={{ fontSize: 15 }}>{tx.active}</strong>
          </div>
          <p style={{ margin: '12px 0 18px', fontSize: 13, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>{tx.activeNote}</p>
          <button onClick={disable} disabled={busy} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: '1px solid var(--ek-border)', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}>
            {busy ? tx.disabling : tx.disable}
          </button>
        </div>
      ) : enroll ? (
        <div style={card}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--ek-text)' }}>{tx.step1}</p>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: '#fff', borderRadius: 10, width: 200, height: 200, margin: '0 auto' }}>
            {enroll.qr.startsWith('data:') ? <img src={enroll.qr} alt="QR" width={176} height={176} /> : <div style={{ width: 176, height: 176 }} dangerouslySetInnerHTML={{ __html: enroll.qr }} />}
          </div>
          <p style={{ margin: '14px 0 4px', fontSize: 12, color: 'var(--ek-text-muted)' }}>{tx.orManual}</p>
          <code style={{ display: 'block', padding: '8px 10px', background: 'var(--ek-paper)', borderRadius: 8, fontSize: 12.5, wordBreak: 'break-all', fontFamily: 'var(--ek-font-mono)', color: 'var(--ek-text)' }}>{enroll.secret}</code>
          <form onSubmit={confirmEnroll}>
            <p style={{ margin: '18px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--ek-text)' }}>{tx.step2}</p>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
              style={{ width: '100%', padding: '11px 14px', fontSize: 20, letterSpacing: '0.3em', textAlign: 'center', borderRadius: 10, border: '1px solid var(--ek-border)', background: 'var(--ek-paper)', color: 'var(--ek-text)', fontFamily: 'var(--ek-font-mono)' }} />
            {err && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#DC2626' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" disabled={busy || code.length < 6} style={{ flex: 1, padding: '11px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', background: 'var(--ek-red)', color: '#fff', cursor: 'pointer', opacity: busy || code.length < 6 ? 0.6 : 1 }}>{busy ? tx.verifying : tx.verify}</button>
              <button type="button" onClick={() => { setEnroll(null); setCode(''); setErr('') }} style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1px solid var(--ek-border)', background: 'transparent', color: 'var(--ek-text-muted)', cursor: 'pointer' }}>{tx.cancel}</button>
            </div>
          </form>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ek-text-muted)' }}>
            <ShieldAlert size={20} /><strong style={{ fontSize: 15, color: 'var(--ek-text)' }}>{tx.inactive}</strong>
          </div>
          <p style={{ margin: '12px 0 18px', fontSize: 13, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>{tx.inactiveNote}</p>
          {err && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#DC2626' }}>{err}</p>}
          <button onClick={startEnroll} disabled={busy} style={{ padding: '11px 18px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', background: 'var(--ek-red)', color: '#fff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? tx.starting : tx.enable}
          </button>
        </div>
      )}
    </div>
  )
}

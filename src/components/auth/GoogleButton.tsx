'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notifyGoogleSignup } from '@/app/actions/auth'
import { safeNextPath, pathAllowedForRole } from '@/lib/safeNext'
import type { Locale } from '@/lib/i18n/translations'

// "Continue with Google" via Google Identity Services (GIS) + Supabase
// signInWithIdToken. Unlike the old signInWithOAuth redirect flow, the login is
// NOT bounced through <ref>.supabase.co — Google's screen shows englishkolab.com.
// This file ONLY affects Google sign-in; email/password login is untouched.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
      }
    }
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GIS_SRC = 'https://accounts.google.com/gsi/client'

const t = {
  es: { or: 'o', err: 'No se pudo continuar con Google. Intenta de nuevo.', loading: 'Conectando…', deleted: 'Esta cuenta ya no está disponible.', blocked: 'No se pudo cargar Google. Usa tu correo para continuar.' },
  en: { or: 'or', err: "Couldn't continue with Google. Please try again.", loading: 'Connecting…', deleted: 'This account is no longer available.', blocked: "Couldn't load Google. Use your email to continue." },
}

export function GoogleButton({ lang, next }: { lang: Locale; next?: string | null }) {
  const tx = t[lang]
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null) // full-width measuring container
  const btnRef = useRef<HTMLDivElement>(null)  // GIS renders the iframe button here
  const rawNonce = useRef<string>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID || !btnRef.current) return
    let cancelled = false
    let poll: ReturnType<typeof setInterval> | undefined
    let ro: ResizeObserver | undefined
    let raf = 0

    // Render the GIS button at the CURRENT container width so it lines up with the
    // full-width email/password form on every viewport (the old fixed 336px was
    // narrower than the form on desktop and overflowed the column on mobile). GIS
    // only accepts a pixel width (200–400), so we measure + clamp and re-render on
    // resize. renderButton appends, so clear the host first.
    function renderBtn() {
      if (!window.google?.accounts?.id || !btnRef.current || !wrapRef.current) return
      const w = Math.min(400, Math.max(240, Math.floor(wrapRef.current.clientWidth)))
      btnRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(btnRef.current, {
        type: 'standard', theme: 'outline', size: 'large',
        text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', width: w,
      })
    }

    async function handleCredential(resp: { credential?: string }) {
      if (!resp.credential) return
      setError('')
      setLoading(true)
      const supabase = createClient()
      const { error: signErr } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: resp.credential,
        nonce: rawNonce.current,
      })
      if (signErr) {
        console.error('[google] signInWithIdToken failed:', signErr.message)
        setError(tx.err)
        setLoading(false)
        return
      }
      // Role-based landing, resolved client-side (RLS lets a user read own profile).
      const { data: { user } } = await supabase.auth.getUser()
      let role: string | undefined
      let dest = `/${lang}/dashboard`
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role, deleted_at').eq('id', user.id).maybeSingle()
        // A soft-deleted account must never re-enter via Google (the password path
        // already blocks this in signIn). signInWithIdToken matches the surviving
        // Google identity onto the scrubbed row, so gate it here. P2-1.
        if (profile?.deleted_at) {
          await supabase.auth.signOut()
          setError(tx.deleted)
          setLoading(false)
          return
        }
        role = profile?.role
        dest = role === 'teacher' ? `/${lang}/maestro/dashboard` : role === 'admin' ? `/${lang}/admin` : `/${lang}/dashboard`
        // First-time Google students get the welcome email (the old flow did this
        // in /auth/callback, which signInWithIdToken bypasses). Fire-and-forget.
        notifyGoogleSignup(lang).catch(() => {})
      }
      // Honor `next` only via the SAME canonical guard the password login uses
      // (safeNextPath rejects //, backslash, and non-locale paths → no open
      // redirect; pathAllowedForRole keeps it inside the user's own area).
      const safe = safeNextPath(next)
      router.replace(safe && pathAllowedForRole(safe, role) ? safe : dest)
      router.refresh()
    }

    async function init() {
      if (cancelled || !window.google?.accounts?.id || !btnRef.current) return
      // Nonce: GIS gets the SHA-256 hash, Supabase gets the raw value (replay guard).
      const raw = crypto.randomUUID()
      rawNonce.current = raw
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
      const hashedNonce = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        nonce: hashedNonce,
        ux_mode: 'popup',
        auto_select: false,
      })
      renderBtn()
      // Keep the button width matched to the form as the column resizes
      // (orientation change, responsive breakpoints). rAF-debounced.
      if (wrapRef.current && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderBtn) })
        ro.observe(wrapRef.current)
      }
    }

    if (window.google?.accounts?.id) { init() }
    else {
      if (!document.querySelector(`script[src="${GIS_SRC}"]`)) {
        const s = document.createElement('script'); s.src = GIS_SRC; s.async = true; s.defer = true; document.head.appendChild(s)
      }
      // P3: stop polling after ~8s if the GIS script is blocked (extension / network)
      // and surface a hint to use the email login above, instead of an invisible
      // never-resolving wait.
      let tries = 0
      poll = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(poll); init() }
        else if (++tries > 53) { clearInterval(poll); if (!cancelled) setBlocked(true) }
      }, 150)
    }
    return () => { cancelled = true; if (poll) clearInterval(poll); if (ro) ro.disconnect(); cancelAnimationFrame(raf) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!CLIENT_ID) return null

  return (
    <div>
      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1" style={{ background: 'var(--ek-border)' }} />
        <span className="text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.or}</span>
        <div className="h-px flex-1" style={{ background: 'var(--ek-border)' }} />
      </div>
      <div ref={wrapRef} className="w-full flex justify-center" style={{ minHeight: 44 }}>
        <div ref={btnRef} aria-label="Google" />
      </div>
      {loading && <p className="mt-2 text-center text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.loading}</p>}
      {error && <p className="mt-2 text-center text-[12px]" style={{ color: '#DC2626' }}>{error}</p>}
      {blocked && <p className="mt-2 text-center text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.blocked}</p>}
    </div>
  )
}

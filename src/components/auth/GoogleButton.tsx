'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  es: { or: 'o', cont: 'Continuar con Google', loading: 'Conectando…', err: 'No se pudo continuar con Google. Intenta de nuevo.' },
  en: { or: 'or', cont: 'Continue with Google', loading: 'Connecting…', err: "Couldn't continue with Google. Please try again." },
}

// Official Google "G" mark.
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.59-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  )
}

/**
 * "Continue with Google" — the only social provider we offer (Google is what
 * nearly everyone uses; Microsoft/etc. were intentionally dropped). On login it
 * works for any existing account (role read from `profiles` in the callback); on
 * signup the DB trigger provisions a *student*, so registro only shows this on the
 * student form. Requires Google to be enabled in Supabase Auth → Providers.
 */
export function GoogleButton({ lang, next }: { lang: Locale; next?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tx = t[lang]

  async function continueWithGoogle() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const callback = `${window.location.origin}/${lang}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback },
    })
    if (error) {
      setError(tx.err)
      setLoading(false)
    }
    // On success the browser follows the redirect to Google automatically.
  }

  return (
    <div>
      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1" style={{ background: 'var(--ek-border)' }} />
        <span className="text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>{tx.or}</span>
        <div className="h-px flex-1" style={{ background: 'var(--ek-border)' }} />
      </div>
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-lg py-3.5 text-[14px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ border: '1px solid var(--ek-border)', background: '#fff', color: 'var(--ek-text)' }}
        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--ek-paper)' }}
        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#fff' }}
      >
        <GoogleG />
        {loading ? tx.loading : tx.cont}
      </button>
      {error && <p className="mt-2 text-center text-[12px]" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}

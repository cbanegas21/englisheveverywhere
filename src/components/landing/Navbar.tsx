'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'
import CurrencySelect from '@/components/CurrencySelect'
import { Logo } from '@/components/ui/Logo'

const t = {
  en: {
    how: 'How it works',
    teachers: 'Teachers',
    pricing: 'Pricing',
    faq: 'Questions',
    login: 'Log in',
    cta: 'Get started',
    dashboard: 'Go to Dashboard',
  },
  es: {
    how: 'Cómo funciona',
    teachers: 'Maestros',
    pricing: 'Precios',
    faq: 'Preguntas',
    login: 'Iniciar sesión',
    cta: 'Empezar',
    dashboard: 'Ir al Dashboard',
  },
}

export default function Navbar({ lang, isLoggedIn = false }: { lang: Locale; isLoggedIn?: boolean }) {
  const tx = t[lang]
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [mounted, setMounted] = useState(false)
  const other = lang === 'en' ? 'es' : 'en'
  const { currency, changeCurrency } = useCurrency()
  const pathname = usePathname()
  const router = useRouter()
  const otherLocalePath = pathname.replace(`/${lang}`, `/${other}`)

  useEffect(() => {
    const saved = sessionStorage.getItem('ee-scroll')
    if (saved) {
      sessionStorage.removeItem('ee-scroll')
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)))
    }
  }, [pathname])

  // Lock body scroll while the mobile menu overlay is open so the page
  // underneath doesn't move (LK2-10). Restore on close/unmount.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Portal target (document.body) is only available after mount — guards SSR.
  useEffect(() => setMounted(true), [])

  function handleLocaleSwitch() {
    if (switching) return
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ee-scroll', String(window.scrollY))
      localStorage.setItem('ee-locale', other)
      document.cookie = `ee-locale=${other}; path=/; max-age=31536000; SameSite=Lax`
    }
    setSwitching(true)
    setTimeout(() => {
      router.push(otherLocalePath, { scroll: false })
    }, 130)
  }

  const dim = 'var(--ek-text-soft)'

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(251,248,243,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--ek-border)',
      }}
    >
      <div className="lk-shell h-16 flex items-center justify-between">
        <Logo href={`/${lang}`} size={32} />

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {[
            // Absolute (/${lang}#...) so they also work from subpages like
            // /contact, /privacy, /terms — not just the home page. Audit EK-036.
            { label: tx.how, href: `/${lang}#how-it-works` },
            { label: tx.teachers, href: `/${lang}#teachers` },
            { label: tx.pricing, href: `/${lang}#pricing` },
            { label: tx.faq, href: `/${lang}#faq` },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                color: dim,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                fontFamily: 'var(--ek-font-sans)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ek-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = dim)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="hidden lg:flex items-center gap-3">
          <CurrencySelect
            value={currency}
            onChange={changeCurrency}
            lang={lang}
            variant="light"
            compact
          />

          {/* ES/EN toggle */}
          <button
            onClick={handleLocaleSwitch}
            aria-label={`Switch to ${other.toUpperCase()}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 999,
              border: '1px solid var(--ek-border-mid)',
              overflow: 'hidden',
              opacity: switching ? 0 : 1,
              transition: 'opacity 130ms ease',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {(['es', 'en'] as const).map((l) => (
              <span
                key={l}
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: lang === l ? 'var(--ek-ink)' : 'transparent',
                  color: lang === l ? '#fff' : 'var(--ek-text-muted)',
                  fontFamily: 'var(--ek-font-mono)',
                }}
              >
                {l}
              </span>
            ))}
          </button>

          {!isLoggedIn && (
            <Link
              href={`/${lang}/login`}
              style={{
                color: dim,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                padding: '6px 4px',
                fontFamily: 'var(--ek-font-sans)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ek-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = dim)}
            >
              {tx.login}
            </Link>
          )}

          <Link
            href={isLoggedIn ? `/${lang}/dashboard` : `/${lang}/registro`}
            className="ek-btn ek-btn-primary"
            style={{ padding: '10px 18px', fontSize: 13 }}
          >
            {isLoggedIn ? tx.dashboard : tx.cta}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2"
          style={{ color: 'var(--ek-text)', background: 'transparent', border: 0 }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu — fixed overlay portaled to <body> so it escapes the
          header's backdrop-filter containing block and covers the whole
          viewport (not just the header). Does not reflow the page (LK2-10). */}
      {open && mounted &&
        createPortal(
          <>
            {/* Scrim — starts below the 64px header so the X stays clickable */}
            <div
              className="lg:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
              style={{
                position: 'fixed',
                top: 64,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 60,
              }}
            />
          {/* Sheet */}
          <div
            className="lg:hidden px-6 py-5 flex flex-col gap-1"
            style={{
              position: 'fixed',
              top: 64,
              left: 0,
              right: 0,
              maxHeight: 'calc(100dvh - 64px)',
              overflowY: 'auto',
              zIndex: 70,
              background: 'var(--ek-paper-warm)',
              borderTop: '1px solid var(--ek-border)',
            }}
          >
          <div
            className="flex items-center justify-between pb-3 mb-1"
            style={{ borderBottom: '1px solid var(--ek-border)' }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontFamily: 'var(--ek-font-mono)',
              }}
            >
              {lang === 'es' ? 'Idioma' : 'Language'}
            </span>
            <button
              onClick={() => {
                setOpen(false)
                handleLocaleSwitch()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 999,
                border: '1px solid var(--ek-border-mid)',
                overflow: 'hidden',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {(['es', 'en'] as const).map((l) => (
                <span
                  key={l}
                  style={{
                    display: 'inline-block',
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: lang === l ? 'var(--ek-ink)' : 'transparent',
                    color: lang === l ? '#fff' : 'var(--ek-text-muted)',
                    fontFamily: 'var(--ek-font-mono)',
                  }}
                >
                  {l}
                </span>
              ))}
            </button>
          </div>

          <div
            className="flex items-center justify-between pb-3 mb-1"
            style={{ borderBottom: '1px solid var(--ek-border)' }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ek-text-muted)',
                fontFamily: 'var(--ek-font-mono)',
              }}
            >
              {lang === 'es' ? 'Moneda' : 'Currency'}
            </span>
            <CurrencySelect
              value={currency}
              onChange={changeCurrency}
              lang={lang}
              variant="light"
              compact
            />
          </div>

          {[
            { label: tx.how, href: `/${lang}#how-it-works` },
            { label: tx.teachers, href: `/${lang}#teachers` },
            { label: tx.pricing, href: `/${lang}#pricing` },
            { label: tx.faq, href: `/${lang}#faq` },
            ...(!isLoggedIn ? [{ label: tx.login, href: `/${lang}/login` }] : []),
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--ek-text-soft)',
                borderBottom: '1px solid var(--ek-border)',
                textDecoration: 'none',
                fontFamily: 'var(--ek-font-sans)',
              }}
            >
              {item.label}
            </Link>
          ))}

          <Link
            href={isLoggedIn ? `/${lang}/dashboard` : `/${lang}/registro`}
            onClick={() => setOpen(false)}
            className="ek-btn ek-btn-primary mt-4 justify-center"
          >
            {isLoggedIn ? tx.dashboard : tx.cta}
          </Link>
          </div>
          </>,
          document.body,
        )}
    </header>
  )
}

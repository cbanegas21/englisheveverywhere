'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency } from '@/lib/useCurrency'
import CurrencySelect from '@/components/CurrencySelect'

const t = {
  en: {
    how: 'How it works',
    teachers: 'Teachers',
    pricing: 'Pricing',
    login: 'Log in',
    cta: 'Get started',
    dashboard: 'Go to Dashboard',
  },
  es: {
    how: 'Cómo funciona',
    teachers: 'Maestros',
    pricing: 'Precios',
    login: 'Ingresar',
    cta: 'Comenzar',
    dashboard: 'Ir al Dashboard',
  },
}

export default function Navbar({ lang, isLoggedIn = false }: { lang: Locale; isLoggedIn?: boolean }) {
  const tx = t[lang]
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
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

  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{ background: 'rgba(17,17,17,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href={`/${lang}`} className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="h-8 w-8 rounded flex items-center justify-center text-[11px] font-black"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            EE
          </div>
          <span className="text-[15px] font-black tracking-tight hidden sm:block" style={{ color: '#F9F9F9' }}>
            English Everywhere
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: tx.how, href: '#how-it-works' },
            { label: tx.teachers, href: '#teachers' },
            { label: tx.pricing, href: '#pricing' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-4 py-2 text-[14px] font-medium rounded transition-colors"
              style={{ color: 'rgba(249,249,249,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F9F9F9')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(249,249,249,0.6)')}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-2">

          {/* Currency select */}
          <CurrencySelect
            value={currency}
            onChange={changeCurrency}
            lang={lang}
            variant="dark"
            compact
          />

          {/* Lang toggle switch */}
          <button
            onClick={handleLocaleSwitch}
            aria-label={`Switch to ${other.toUpperCase()}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              opacity: switching ? 0 : 1,
              transition: 'opacity 130ms ease',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {(['es', 'en'] as const).map(l => (
              <span
                key={l}
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: lang === l ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: lang === l ? '#F9F9F9' : 'rgba(249,249,249,0.35)',
                  borderRight: l === 'es' ? '1px solid rgba(255,255,255,0.12)' : 'none',
                  transition: 'background 130ms, color 130ms',
                }}
              >
                {l}
              </span>
            ))}
          </button>

          {!isLoggedIn && (
            <Link
              href={`/${lang}/login`}
              className="px-4 py-2 text-[14px] font-medium rounded transition-colors"
              style={{ color: 'rgba(249,249,249,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F9F9F9')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(249,249,249,0.6)')}
            >
              {tx.login}
            </Link>
          )}

          <Link
            href={isLoggedIn ? `/${lang}/dashboard` : `/${lang}/registro`}
            className="ee-btn-primary text-[13px] !py-2 !px-5"
          >
            {isLoggedIn ? tx.dashboard : tx.cta}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded"
          style={{ color: '#F9F9F9' }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-t px-6 py-5 flex flex-col gap-1"
          style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {/* Lang toggle — mobile */}
          <div className="flex items-center justify-between pb-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(249,249,249,0.4)' }}>
              {lang === 'es' ? 'Idioma' : 'Language'}
            </span>
            <button
              onClick={() => { setOpen(false); handleLocaleSwitch() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                overflow: 'hidden',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {(['es', 'en'] as const).map(l => (
                <span
                  key={l}
                  style={{
                    display: 'inline-block',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: lang === l ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: lang === l ? '#F9F9F9' : 'rgba(249,249,249,0.35)',
                    borderRight: l === 'es' ? '1px solid rgba(255,255,255,0.15)' : 'none',
                  }}
                >
                  {l}
                </span>
              ))}
            </button>
          </div>

          {/* Currency — mobile */}
          <div className="flex items-center justify-between pb-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(249,249,249,0.4)' }}>
              {lang === 'es' ? 'Moneda' : 'Currency'}
            </span>
            <CurrencySelect
              value={currency}
              onChange={changeCurrency}
              lang={lang}
              variant="dark"
              compact
            />
          </div>

          {[
            { label: tx.how, href: '#how-it-works' },
            { label: tx.teachers, href: '#teachers' },
            { label: tx.pricing, href: '#pricing' },
            ...(!isLoggedIn ? [{ label: tx.login, href: `/${lang}/login` }] : []),
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] font-medium border-b"
              style={{ color: 'rgba(249,249,249,0.7)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={isLoggedIn ? `/${lang}/dashboard` : `/${lang}/registro`}
            onClick={() => setOpen(false)}
            className="ee-btn-primary mt-4 justify-center"
          >
            {isLoggedIn ? tx.dashboard : tx.cta}
          </Link>
        </div>
      )}
    </header>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { useCurrency, CURRENCIES, CURRENCY_INFO } from '@/lib/useCurrency'

const t = {
  en: {
    how: 'How it works',
    teachers: 'Teachers',
    pricing: 'Pricing',
    login: 'Log in',
    cta: 'Get started',
    updatingRates: 'Updating rates...',
  },
  es: {
    how: 'Cómo funciona',
    teachers: 'Maestros',
    pricing: 'Precios',
    login: 'Ingresar',
    cta: 'Comenzar',
    updatingRates: 'Actualizando tasas...',
  },
}

export default function Navbar({ lang }: { lang: Locale }) {
  const tx = t[lang]
  const [open, setOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const other = lang === 'en' ? 'es' : 'en'
  const { currency, changeCurrency, loading } = useCurrency()

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

          {/* Currency toggle */}
          <div className="relative">
            <button
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(249,249,249,0.7)',
                background: 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
              onMouseLeave={e => !currencyOpen && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            >
              <span>{CURRENCY_INFO[currency].flag}</span>
              <span>{currency}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {currencyOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded overflow-hidden z-50 min-w-[120px]"
                style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
              >
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { changeCurrency(c); setCurrencyOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors text-left"
                    style={{
                      color: c === currency ? '#C41E3A' : 'rgba(249,249,249,0.7)',
                      background: c === currency ? 'rgba(196,30,58,0.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (c !== currency) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { if (c !== currency) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span>{CURRENCY_INFO[c].flag}</span>
                    <span>{c}</span>
                  </button>
                ))}
                {loading && (
                  <div className="px-3 py-1.5 text-[10px]" style={{ color: 'rgba(249,249,249,0.3)' }}>
                    {tx.updatingRates}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lang toggle */}
          <Link
            href={`/${other}`}
            className="px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded transition-colors"
            style={{ color: 'rgba(249,249,249,0.4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F9F9F9')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(249,249,249,0.4)')}
          >
            {other}
          </Link>

          <Link
            href={`/${lang}/login`}
            className="px-4 py-2 text-[14px] font-medium rounded transition-colors"
            style={{ color: 'rgba(249,249,249,0.6)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F9F9F9')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(249,249,249,0.6)')}
          >
            {tx.login}
          </Link>

          <Link href={`/${lang}/registro`} className="ee-btn-primary text-[13px] !py-2 !px-5">
            {tx.cta}
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
          {/* Currency — mobile */}
          <div className="flex gap-2 flex-wrap pb-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {CURRENCIES.map(c => (
              <button
                key={c}
                onClick={() => changeCurrency(c)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all"
                style={{
                  background: c === currency ? 'rgba(196,30,58,0.15)' : 'rgba(255,255,255,0.05)',
                  color: c === currency ? '#C41E3A' : 'rgba(249,249,249,0.5)',
                  border: `1px solid ${c === currency ? 'rgba(196,30,58,0.3)' : 'transparent'}`,
                }}
              >
                {CURRENCY_INFO[c].flag} {c}
              </button>
            ))}
          </div>

          {[
            { label: tx.how, href: '#how-it-works' },
            { label: tx.teachers, href: '#teachers' },
            { label: tx.pricing, href: '#pricing' },
            { label: tx.login, href: `/${lang}/login` },
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
            href={`/${lang}/registro`}
            onClick={() => setOpen(false)}
            className="ee-btn-primary mt-4 justify-center"
          >
            {tx.cta}
          </Link>
        </div>
      )}
    </header>
  )
}

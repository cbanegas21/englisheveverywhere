'use client'

import Link from 'next/link'
import { Mail } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    tagline: 'Live English classes with near-native Honduran teachers. No subscriptions. Real progress.',
    cols: [
      {
        title: 'Platform',
        links: [
          { label: 'How it works', href: '#how-it-works' },
          { label: 'Our teachers', href: '#teachers' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Log in', href: '/en/login' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About us', href: '/en/about' },
          { label: 'For teachers', href: '/en/teachers' },
          { label: 'Privacy policy', href: '/en/privacy' },
          { label: 'Terms of use', href: '/en/terms' },
        ],
      },
    ],
    copyright: '© 2025 EnglishKolab',
    legal: 'Operated by Remote ACKtive LLC · Wyoming, USA',
  },
  es: {
    tagline: 'Clases de inglés en vivo con maestros hondureños near-native. Sin suscripciones. Progreso real.',
    cols: [
      {
        title: 'Plataforma',
        links: [
          { label: 'Cómo funciona', href: '#how-it-works' },
          { label: 'Maestros', href: '#teachers' },
          { label: 'Precios', href: '#pricing' },
          { label: 'Ingresar', href: '/es/login' },
        ],
      },
      {
        title: 'Empresa',
        links: [
          { label: 'Nosotros', href: '/es/about' },
          { label: 'Para maestros', href: '/es/teachers' },
          { label: 'Privacidad', href: '/es/privacy' },
          { label: 'Términos', href: '/es/terms' },
        ],
      },
    ],
    copyright: '© 2025 EnglishKolab',
    legal: 'Operado por Remote ACKtive LLC · Wyoming, USA',
  },
}

export default function Footer({ lang }: { lang: Locale }) {
  const tx = t[lang]

  return (
    <footer style={{ background: '#111111' }}>
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="md:col-span-2">
            <Link href={`/${lang}`} className="flex items-center gap-2.5 mb-4">
              <div
                className="h-8 w-8 rounded flex items-center justify-center text-[11px] font-black"
                style={{ background: '#C41E3A', color: '#fff' }}
              >
                EK
              </div>
              <span className="text-[15px] font-black tracking-tight" style={{ color: '#F9F9F9' }}>
                EnglishKolab
              </span>
            </Link>
            <p className="text-[13px] leading-relaxed max-w-xs mb-6" style={{ color: 'rgba(249,249,249,0.35)' }}>
              {tx.tagline}
            </p>
            <a
              href="mailto:hola@englishkolab.com"
              className="h-9 w-9 rounded flex items-center justify-center transition-colors"
              style={{ background: 'rgba(249,249,249,0.06)', color: 'rgba(249,249,249,0.35)', display: 'inline-flex' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#F9F9F9')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,249,249,0.35)')}
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>

          {/* Link columns */}
          {tx.cols.map((col) => (
            <div key={col.title}>
              <p
                className="text-[11px] font-bold uppercase tracking-widest mb-5"
                style={{ color: 'rgba(249,249,249,0.25)' }}
              >
                {col.title}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] transition-colors"
                      style={{ color: 'rgba(249,249,249,0.4)' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#F9F9F9')}
                      onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,249,249,0.4)')}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6"
          style={{ borderTop: '1px solid rgba(249,249,249,0.06)' }}
        >
          <p className="text-[12px]" style={{ color: 'rgba(249,249,249,0.2)' }}>{tx.copyright}</p>
          <p className="text-[11px]" style={{ color: 'rgba(249,249,249,0.12)' }}>{tx.legal}</p>
        </div>
      </div>
    </footer>
  )
}

'use client'

import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { Logo } from '@/components/ui/Logo'

const t = {
  en: {
    tagline: 'Learn English. Anytime. Anywhere. At your pace.',
    cols: [
      {
        title: 'Product',
        links: [
          { label: 'How it works', href: '#how-it-works' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Teachers', href: '#teachers' },
          { label: 'Questions', href: '#faq' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'Privacy', href: '/en/privacy' },
          { label: 'Terms', href: '/en/terms' },
          { label: 'Contact', href: 'mailto:hola@englishkolab.com' },
        ],
      },
      {
        title: 'Language',
        links: [
          { label: 'English', href: '/en' },
          { label: 'Español', href: '/es' },
        ],
      },
    ],
    bottomLeft: '© 2026 Remote ACKtive LLC · Wyoming, USA',
    bottomRight: 'Secure payments via Stripe · USD',
  },
  es: {
    tagline: 'Aprende inglés. Cuando quieras. Donde quieras. A tu ritmo.',
    cols: [
      {
        title: 'Producto',
        links: [
          { label: 'Cómo funciona', href: '#how-it-works' },
          { label: 'Precios', href: '#pricing' },
          { label: 'Maestros', href: '#teachers' },
          { label: 'Preguntas', href: '#faq' },
        ],
      },
      {
        title: 'Empresa',
        links: [
          { label: 'Privacidad', href: '/es/privacy' },
          { label: 'Términos', href: '/es/terms' },
          { label: 'Contacto', href: 'mailto:hola@englishkolab.com' },
        ],
      },
      {
        title: 'Idioma',
        links: [
          { label: 'Español', href: '/es' },
          { label: 'English', href: '/en' },
        ],
      },
    ],
    bottomLeft: '© 2026 Remote ACKtive LLC · Wyoming, USA',
    bottomRight: 'Pagos seguros vía Stripe · USD',
  },
}

export default function Footer({ lang }: { lang: Locale }) {
  const tx = t[lang]
  return (
    <footer
      style={{
        background: '#0A0A0A',
        color: '#888',
        padding: '48px clamp(24px, 6vw, 80px)',
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
            gap: 48,
          }}
        >
          <div>
            <Logo onDark href={`/${lang}`} size={32} />
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: 280,
                color: '#888',
              }}
            >
              {tx.tagline}
            </p>
          </div>

          {tx.cols.map((col) => (
            <div key={col.title}>
              <div
                style={{
                  fontFamily: 'var(--ek-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#666',
                }}
              >
                {col.title}
              </div>
              <ul
                style={{
                  margin: '16px 0 0',
                  padding: 0,
                  listStyle: 'none',
                  fontSize: 14,
                  display: 'grid',
                  gap: 10,
                }}
              >
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      style={{ color: '#aaa', textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          style={{
            borderTop: '1px solid #1F1F1F',
            marginTop: 48,
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#666',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>{tx.bottomLeft}</div>
          <div>{tx.bottomRight}</div>
        </div>
      </div>
    </footer>
  )
}

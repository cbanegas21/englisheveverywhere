'use client'

import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { Logo } from '@/components/ui/Logo'

const SUPPORT_EMAIL = 'hola@englishkolab.com'

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
          { label: 'Contact', href: '/en/contact' },
        ],
      },
    ],
    supportLabel: 'Talk to a human',
    manifesto: 'Real teachers, real conversations — no bots, no scripts.',
    langLabel: 'Language',
    langEs: 'Español',
    langEn: 'English',
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
          { label: 'Contacto', href: '/es/contact' },
        ],
      },
    ],
    supportLabel: 'Habla con una persona',
    manifesto: 'Profesores de verdad, conversaciones de verdad — sin bots, sin guiones.',
    langLabel: 'Idioma',
    langEs: 'Español',
    langEn: 'English',
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
        paddingBlock: 48,
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <div className="lk-shell">
        <div
          className="grid grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]"
          style={{
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
                      className="lk-footer-link"
                      style={{ color: '#aaa', textDecoration: 'none' }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Editorial support quadrant — replaces the duplicate language
              column. A real mailto + a one-line brand manifesto carry the
              weight; the locale switch moves to the bottom bar below. */}
          <div className="lk-footer-support">
            <div
              style={{
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#666',
              }}
            >
              {tx.supportLabel}
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="lk-footer-link"
              style={{
                display: 'inline-block',
                marginTop: 14,
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(20px, 2.4vw, 26px)',
                lineHeight: 1.1,
                color: '#e8e2d6',
                textDecoration: 'none',
              }}
            >
              {SUPPORT_EMAIL}
            </a>
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: 260,
                color: '#777',
              }}
            >
              {tx.manifesto}
            </p>
          </div>
        </div>
        <div
          style={{
            borderTop: '1px solid #1F1F1F',
            marginTop: 48,
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: '#666',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>{tx.bottomLeft}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Locale switch lives here now — no longer a dead quadrant. */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
              aria-label={tx.langLabel}
            >
              <Link
                href="/es"
                className="lk-footer-link"
                aria-current={lang === 'es' ? 'true' : undefined}
                style={{
                  color: lang === 'es' ? 'var(--ek-on-dark)' : '#777',
                  textDecoration: 'none',
                }}
              >
                {tx.langEs}
              </Link>
              <span aria-hidden style={{ color: '#3a3a3a' }}>/</span>
              <Link
                href="/en"
                className="lk-footer-link"
                aria-current={lang === 'en' ? 'true' : undefined}
                style={{
                  color: lang === 'en' ? 'var(--ek-on-dark)' : '#777',
                  textDecoration: 'none',
                }}
              >
                {tx.langEn}
              </Link>
            </div>
            <span aria-hidden style={{ color: '#2a2a2a' }}>·</span>
            <div>{tx.bottomRight}</div>
          </div>
        </div>
      </div>
      <style>{`
        .lk-footer-link {
          transition: color 0.18s ease;
        }
        .lk-footer-link:hover,
        .lk-footer-link:focus-visible {
          color: var(--ek-on-dark);
        }
        /* Support quadrant spans both columns on the 2-col (mobile/tablet)
           grid so its serif email line never gets crushed. */
        @media (max-width: 1023px) {
          .lk-footer-support { grid-column: 1 / -1; }
        }
      `}</style>
    </footer>
  )
}

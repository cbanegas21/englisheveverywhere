'use client'

import type { Locale } from '@/lib/i18n/translations'

const countries = [
  { flag: '🇲🇽', name: 'México' },
  { flag: '🇭🇳', name: 'Honduras' },
  { flag: '🇬🇹', name: 'Guatemala' },
  { flag: '🇸🇻', name: 'El Salvador' },
  { flag: '🇨🇷', name: 'Costa Rica' },
  { flag: '🇨🇴', name: 'Colombia' },
  { flag: '🇦🇷', name: 'Argentina' },
  { flag: '🇨🇱', name: 'Chile' },
  { flag: '🇧🇷', name: 'Brasil' },
  { flag: '🇵🇪', name: 'Perú' },
  { flag: '🇪🇨', name: 'Ecuador' },
  { flag: '🇵🇦', name: 'Panamá' },
]

// Triplicate for seamless loop
const items = [...countries, ...countries, ...countries]

export default function TrustStrip({ lang }: { lang: Locale }) {
  const label = lang === 'es' ? 'Estudiantes de todo el continente' : 'Students from across Latin America'

  return (
    <div style={{ background: '#F9F9F9', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
      {/* Label row */}
      <div className="text-center pt-5 pb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: '#9CA3AF' }}
        >
          {label}
        </span>
      </div>

      {/* Marquee strip */}
      <div
        className="overflow-hidden pb-5"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}
      >
        <div
          className="flex items-stretch"
          style={{
            animation: 'ee-marquee 36s linear infinite',
            width: 'max-content',
            willChange: 'transform',
          }}
        >
          {items.map((c, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center flex-shrink-0 mx-3"
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: '#fff',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                minWidth: '72px',
              }}
            >
              <span style={{ fontSize: '28px', lineHeight: 1, display: 'block' }}>{c.flag}</span>
              <span
                className="text-[10px] font-semibold whitespace-nowrap mt-1.5"
                style={{ color: '#374151' }}
              >
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ee-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  )
}

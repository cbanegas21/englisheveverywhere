'use client'

import type { Locale } from '@/lib/i18n/translations'

const countries = [
  { flag: '🇭🇳', name: 'Honduras' },
  { flag: '🇲🇽', name: 'México' },
  { flag: '🇨🇴', name: 'Colombia' },
  { flag: '🇦🇷', name: 'Argentina' },
  { flag: '🇵🇪', name: 'Perú' },
  { flag: '🇨🇱', name: 'Chile' },
  { flag: '🇻🇪', name: 'Venezuela' },
  { flag: '🇪🇨', name: 'Ecuador' },
  { flag: '🇬🇹', name: 'Guatemala' },
  { flag: '🇧🇴', name: 'Bolivia' },
  { flag: '🇩🇴', name: 'Rep. Dominicana' },
  { flag: '🇸🇻', name: 'El Salvador' },
  { flag: '🇳🇮', name: 'Nicaragua' },
  { flag: '🇨🇷', name: 'Costa Rica' },
  { flag: '🇵🇦', name: 'Panamá' },
  { flag: '🇺🇾', name: 'Uruguay' },
  { flag: '🇵🇾', name: 'Paraguay' },
  { flag: '🇧🇷', name: 'Brasil' },
]

// Duplicate for seamless loop
const items = [...countries, ...countries]

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
      <div className="overflow-hidden pb-5" style={{ maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}>
        <div
          className="flex items-center"
          style={{
            animation: 'ee-marquee 42s linear infinite',
            width: 'max-content',
            willChange: 'transform',
          }}
        >
          {items.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 mx-4 flex-shrink-0"
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                background: '#fff',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{c.flag}</span>
              <span
                className="text-[12px] font-semibold whitespace-nowrap"
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
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

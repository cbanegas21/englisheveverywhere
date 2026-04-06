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
]

const items = [...countries, ...countries]

export default function TrustStrip({ lang }: { lang: Locale }) {
  return (
    <div
      className="py-4 overflow-hidden"
      style={{ background: '#F9F9F9', borderBottom: '1px solid #E5E7EB' }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{ animation: 'trust-marquee 36s linear infinite', width: 'max-content' }}
      >
        {items.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 text-[13px] font-semibold px-6 flex-shrink-0"
            style={{ color: '#4B5563' }}
          >
            <span className="text-xl">{c.flag}</span>
            {c.name}
            <span className="w-1 h-1 rounded-full ml-4" style={{ background: '#C41E3A' }} />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes trust-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

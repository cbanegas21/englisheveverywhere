import { ImageResponse } from 'next/og'

// Branded social-share card (WhatsApp / Facebook / iMessage / X link previews).
export const alt = 'EnglishKolab — Aprende inglés a tu ritmo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '90px 96px',
          background: '#F4EFE6',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="104" height="104" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="18" fill="#111111" />
            <path d="M 22 28 L 60 28 L 65 36 L 22 36 Z" fill="#ffffff" />
            <path d="M 22 46 L 52 46 L 56 54 L 22 54 Z" fill="#ffffff" />
            <path d="M 22 64 L 60 64 L 65 72 L 22 72 Z" fill="#ffffff" />
            <path d="M 62 22 L 70 22 L 84 50 L 70 78 L 62 78 L 76 50 Z" fill="#C41E3A" />
          </svg>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#111111',
            marginTop: 44,
          }}
        >
          <span>English</span>
          <span style={{ color: '#C41E3A' }}>Kolab</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 38,
            lineHeight: 1.3,
            color: '#5C5648',
            marginTop: 24,
            maxWidth: 940,
          }}
        >
          Aprende inglés en vivo, 1 a 1, con maestros certificados. Tú eliges la hora — y las clases nunca expiran.
        </div>
      </div>
    ),
    { ...size },
  )
}

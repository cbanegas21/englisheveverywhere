import { ImageResponse } from 'next/og'

// iOS "Add to Home Screen" icon — the EnglishKolab mark as a 180x180 PNG.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <svg width="180" height="180" viewBox="0 0 100 100">
          <rect width="100" height="100" rx="18" fill="#111111" />
          <path d="M 22 28 L 60 28 L 65 36 L 22 36 Z" fill="#ffffff" />
          <path d="M 22 46 L 52 46 L 56 54 L 22 54 Z" fill="#ffffff" />
          <path d="M 22 64 L 60 64 L 65 72 L 22 72 Z" fill="#ffffff" />
          <path d="M 62 22 L 70 22 L 84 50 L 70 78 L 62 78 L 76 50 Z" fill="#C41E3A" />
        </svg>
      </div>
    ),
    { ...size },
  )
}

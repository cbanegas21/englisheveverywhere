// Brand-aligned tokens for the video room surface.
// The rest of the app uses crimson on white/gray. Inside the call we invert
// to dark (video needs dark backgrounds for contrast) but keep crimson as
// the sole accent — no teal/gold, no gradients.

export const VIDEO_THEME = {
  // Dark stage — neutral near-black, not the old #0A1628 navy.
  stage: '#0B0D10',
  stageOverlay: 'rgba(11,13,16,0.97)',

  // Brand
  brand: '#C41E3A',
  brandHover: '#9E1830',
  brandTint10: 'rgba(196,30,58,0.10)',
  brandTint20: 'rgba(196,30,58,0.20)',
  brandTint30: 'rgba(196,30,58,0.30)',

  // Neutrals on dark
  surface: 'rgba(255,255,255,0.06)',
  surfaceHover: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.08)',
  textMuted: 'rgba(255,255,255,0.55)',
  textSubtle: 'rgba(255,255,255,0.35)',

  // Avatar fallback (neutral — brand crimson is reserved for CTAs).
  avatarBg: '#1F2937',
  avatarText: '#FFFFFF',
} as const

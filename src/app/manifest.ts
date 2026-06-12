import type { MetadataRoute } from 'next'

// PWA manifest — "Add to Home Screen" on mobile shows the EnglishKolab name + mark
// instead of a generic page title.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EnglishKolab',
    short_name: 'EnglishKolab',
    description: 'Aprende inglés en vivo, 1 a 1, con maestros certificados. A tu ritmo.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4EFE6',
    theme_color: '#F4EFE6',
    lang: 'es',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  }
}

import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import 'flag-icons/css/flag-icons.min.css'

const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-geist',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const SITE_URL = 'https://englishkolab.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'EnglishKolab — Aprende inglés. Cuando quieras. Donde quieras. A tu ritmo.',
    template: '%s · EnglishKolab',
  },
  description:
    'Aprende inglés en vivo y 1 a 1 con maestros certificados. Cuando quieras. Donde quieras. A tu ritmo.',
  keywords: 'clases de inglés, inglés online, aprender inglés, EnglishKolab, Latinoamérica',
  applicationName: 'EnglishKolab',
  alternates: { canonical: '/' },
  // og:image, the favicon and the apple-touch icon are auto-wired by Next from
  // app/opengraph-image.tsx, app/icon.svg and app/apple-icon.tsx.
  openGraph: {
    type: 'website',
    siteName: 'EnglishKolab',
    url: SITE_URL,
    title: 'EnglishKolab — Aprende inglés a tu ritmo',
    description: 'Clases de inglés en vivo, 1 a 1, con maestros certificados. Tú eliges la hora — y las clases nunca expiran.',
    locale: 'es_HN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EnglishKolab — Aprende inglés a tu ritmo',
    description: 'Clases de inglés en vivo, 1 a 1, con maestros certificados. Tú eliges la hora.',
  },
}

export const viewport: Viewport = {
  // Mobile browser chrome matches the cream page background.
  themeColor: '#F4EFE6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        {/* Point Excalidraw (the /sala whiteboard) at our self-hosted assets BEFORE
            any app JS runs — it resolves its font URLs at chunk-eval and otherwise
            appends the esm.sh CDN (blocked by our 'self'-only CSP). beforeInteractive
            injects this into <head>, ahead of every chunk. */}
        <Script id="excalidraw-asset-path" strategy="beforeInteractive">
          {`window.EXCALIDRAW_ASSET_PATH='/excalidraw/'`}
        </Script>
        {children}
      </body>
    </html>
  )
}

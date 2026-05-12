import type { Metadata } from 'next'
import { Geist, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'

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

export const metadata: Metadata = {
  title: 'EnglishKolab — Aprende inglés. Cuando quieras. Donde quieras. A tu ritmo.',
  description:
    'Aprende inglés con maestros latinoamericanos near-native, en vivo y 1 a 1. Cuando quieras. Donde quieras. A tu ritmo.',
  keywords: 'clases de inglés, inglés online, aprender inglés, EnglishKolab, Latinoamérica',
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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}

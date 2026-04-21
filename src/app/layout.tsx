import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EnglishKolab — Learn English. Anytime. Anywhere. At your pace.',
  description:
    'Aprende inglés con maestros hondureños near-native, en vivo y a tu ritmo. Cuando quieras. Donde quieras.',
  keywords: 'clases de inglés, inglés online, aprender inglés, EnglishKolab, Latinoamérica',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}

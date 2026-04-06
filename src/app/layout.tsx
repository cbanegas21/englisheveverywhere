import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EnglishEverywhere — Clases de inglés 1 a 1',
  description:
    'Plataforma de clases de inglés personalizadas para Latinoamérica. Aprende a tu ritmo con maestros certificados.',
  keywords: 'clases de inglés, inglés online, aprender inglés, Latinoamérica',
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

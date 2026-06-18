import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { locales, type Locale } from '@/lib/i18n/translations'
import HtmlLangSync from './HtmlLangSync'

type Props = {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params
  return {
    title:
      lang === 'es'
        ? 'EnglishKolab — Aprende inglés. Cuando quieras. Donde quieras. A tu ritmo.'
        : 'EnglishKolab — Learn English. Anytime. Anywhere. At your pace.',
  }
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params
  // Dotted bot paths (e.g. /wp-login.php, /.env) bypass the locale proxy (its
  // matcher skips paths containing a ".") and hit /[lang] directly with an
  // invalid lang. Without this guard the landing components do T[lang] →
  // undefined → "Cannot read properties of undefined (reading 'how'/'eyebrow')"
  // (a real 500 surfaced in Sentry). 404 any non-locale segment instead.
  if (!locales.includes(lang as Locale)) notFound()
  return (
    <div lang={lang as Locale}>
      <HtmlLangSync lang={lang as Locale} />
      {children}
    </div>
  )
}

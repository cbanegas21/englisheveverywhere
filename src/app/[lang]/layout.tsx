import type { Metadata } from 'next'
import { locales, type Locale } from '@/lib/i18n/translations'

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
  return <div lang={lang as Locale}>{children}</div>
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BibliotecaClient from './BibliotecaClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function BibliotecaPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // Library is COMING SOON — the catalog is not loaded or exposed yet. The plan
  // is in-platform interactive books (not downloads); see actions/library.ts
  // (LIBRARY_ENABLED) which also hard-gates signed-URL minting.
  return <BibliotecaClient lang={lang as Locale} books={[]} comingSoon />
}

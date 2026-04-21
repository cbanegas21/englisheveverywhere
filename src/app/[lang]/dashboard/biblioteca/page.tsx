import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BibliotecaClient from './BibliotecaClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function BibliotecaPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: books } = await admin
    .from('library_books')
    .select('id, title, description, level, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return <BibliotecaClient lang={lang as Locale} books={books || []} />
}

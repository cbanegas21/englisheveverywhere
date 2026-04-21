import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminLibraryClient from './AdminLibraryClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

export default async function AdminBibliotecaPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/${lang}/dashboard`)

  const admin = createAdminClient()
  const { data: books } = await admin
    .from('library_books')
    .select('id, title, description, level, is_active, created_at, storage_path')
    .order('created_at', { ascending: false })

  return <AdminLibraryClient lang={lang as Locale} books={books || []} />
}

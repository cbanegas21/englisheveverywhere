import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

// Guards every route under /[lang]/maestro/dashboard.
// Requires the teacher to be logged in AND is_active = true.
// Inactive teachers are redirected to /maestro/pending.
export default async function MaestroDashboardLayout({ children, params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // The "Teachers can view own record" RLS policy (migration 002) is required
  // for this query to work when is_active = false.
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!teacher) redirect(`/${lang}/onboarding`)
  if (!teacher.is_active) redirect(`/${lang}/maestro/pending`)

  return <>{children}</>
}

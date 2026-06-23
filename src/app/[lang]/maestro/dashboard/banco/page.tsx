import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BancoClient from './BancoClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

// Teacher question bank (The Lab STEP 2). The maestro/dashboard layout already
// guards role + is_active; here we resolve the teacher id and read the teacher's
// OWN questions via the service-role client (RLS is SELECT-only; reads go through
// admin after the guard, mirroring tareas/page.tsx).
export default async function BancoPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: teacher } = await admin
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const { data: questions } = await admin
    .from('lab_question_bank')
    .select('id, type, prompt, payload, general_feedback, tags, archived_at, created_at')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })

  const rows = (questions || []).map((q) => ({
    id: q.id as string,
    type: q.type as string,
    prompt: q.prompt as string,
    payload: q.payload as unknown,
    generalFeedback: (q.general_feedback as string | null) ?? '',
    tags: Array.isArray(q.tags) ? (q.tags as string[]) : [],
    archived: !!q.archived_at,
  }))

  return <BancoClient lang={lang as Locale} questions={rows} />
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QuizzesClient from './QuizzesClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

// Teacher quiz builder (The Lab STEP 3, Slice A). Reads the teacher's own quizzes
// + their non-archived bank questions to compose from. Service-role reads after
// the maestro layout's role+is_active guard; all writes go through gated actions.
export default async function QuizzesPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const [{ data: quizzes }, { data: questions }, { data: bookingRows }] = await Promise.all([
    admin
      .from('lab_quizzes')
      .select('id, title, intro, question_ids, settings, status, created_at')
      .eq('teacher_id', teacher.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false }),
    admin
      .from('lab_question_bank')
      .select('id, type, prompt')
      .eq('teacher_id', teacher.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('bookings')
      .select('student_id, student:students(profile:profiles(full_name))')
      .eq('teacher_id', teacher.id)
      .neq('status', 'cancelled'),
  ])

  const quizRows = (quizzes || []).map((q) => ({
    id: q.id as string,
    title: q.title as string,
    intro: (q.intro as string) || '',
    questionIds: Array.isArray(q.question_ids) ? (q.question_ids as string[]) : [],
    settings: q.settings as unknown,
    status: q.status as string,
  }))
  const bank = (questions || []).map((q) => ({ id: q.id as string, type: q.type as string, prompt: q.prompt as string }))

  // Distinct students this teacher actually teaches (the assign-to dropdown).
  // Embeds come back as nested arrays/objects from PostgREST — normalize both.
  const seen = new Set<string>()
  const students: { id: string; name: string }[] = []
  for (const b of bookingRows || []) {
    const sid = (b as { student_id?: string }).student_id
    if (!sid || seen.has(sid)) continue
    seen.add(sid)
    const st = (b as { student?: unknown }).student
    const stRec = Array.isArray(st) ? st[0] : st
    const prof = (stRec as { profile?: unknown } | null)?.profile
    const profRec = Array.isArray(prof) ? prof[0] : prof
    const name = (profRec as { full_name?: string | null } | null)?.full_name || (lang === 'es' ? 'Estudiante' : 'Student')
    students.push({ id: sid, name })
  }

  return <QuizzesClient lang={lang as Locale} quizzes={quizRows} bank={bank} students={students} />
}

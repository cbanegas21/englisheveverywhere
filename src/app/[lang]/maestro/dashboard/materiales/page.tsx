import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MaterialesClient from './MaterialesClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props { params: Promise<{ lang: string }> }

// The Lab STEP 5 (§8.4) — teacher private folder + share-with-student. Files live
// in the private 'lab-files' bucket (migration 054); downloads go through an
// entitlement-gated signed URL (getLabFileSignedUrl). Service-role reads after
// the maestro layout's role + is_active guard.
export default async function MaterialesPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const admin = createAdminClient()
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', user.id).maybeSingle()
  if (!teacher) redirect(`/${lang}/maestro/dashboard`)

  const [{ data: fileRows }, { data: bookingRows }] = await Promise.all([
    admin
      .from('lab_teacher_files')
      .select('id, file_name, description, mime_type, size_bytes, created_at')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false }),
    admin
      .from('bookings')
      .select('student_id, student:students(profile:profiles(full_name))')
      .eq('teacher_id', teacher.id)
      .neq('status', 'cancelled'),
  ])

  const fileIds = ((fileRows as { id: string }[]) || []).map((f) => f.id)
  let shares: { file_id: string; student_id: string; name: string }[] = []
  if (fileIds.length) {
    const { data: shareData } = await admin
      .from('lab_file_shares')
      .select('file_id, student_id, student:students(profile:profiles(full_name))')
      .in('file_id', fileIds)
    shares = ((shareData as unknown[]) || []).map((row) => {
      const r = row as Record<string, unknown>
      const st = Array.isArray(r.student) ? r.student[0] : r.student
      const prof = (st as { profile?: unknown } | null)?.profile
      const profRec = Array.isArray(prof) ? prof[0] : prof
      const name = (profRec as { full_name?: string | null } | null)?.full_name || (lang === 'es' ? 'Estudiante' : 'Student')
      return { file_id: r.file_id as string, student_id: r.student_id as string, name }
    })
  }

  const files = ((fileRows as unknown[]) || []).map((row) => {
    const f = row as Record<string, unknown>
    return {
      id: f.id as string,
      fileName: f.file_name as string,
      description: (f.description as string) || '',
      mimeType: (f.mime_type as string) || '',
      sizeBytes: Number(f.size_bytes ?? 0),
      sharedWith: shares.filter((s) => s.file_id === f.id).map((s) => ({ studentId: s.student_id, name: s.name })),
    }
  })

  // Distinct booked students for the share dropdown (mirrors the quizzes page).
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

  return <MaterialesClient lang={lang as Locale} files={files} students={students} />
}

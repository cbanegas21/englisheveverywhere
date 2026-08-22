import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve student display names/avatars for a teacher-facing page.
 *
 * WHY THIS EXISTS: a teacher embedding `students(profile:profiles(...))` on the
 * RLS session client silently gets `null` — `profiles` carries only "Users can
 * view own profile", "Students can read teacher profiles" and "Users can update
 * own profile"; there is NO teacher -> student-profile SELECT policy. The embed
 * resolves to null with a 200 and no error, and every call site swallows it with
 * `|| 'Estudiante'` / `|| '—'`, so the page renders a plausible-looking placeholder
 * instead of the student's name. Deep-audit I18N-6 fixed agenda + estudiantes this
 * way; the teacher HOME and GANANCIAS pages were missed and kept showing
 * "Estudiante" / "—" in production.
 *
 * SAFETY: this bypasses RLS, so callers MUST have already scoped their query by
 * `teacher_id` (i.e. ownership is proven) and pass only student ids drawn from
 * that teacher's own rows. It widens nothing — it only re-reads names the teacher
 * is already entitled to see.
 *
 * Centralised deliberately: the same fix has now been applied piecemeal twice.
 * New teacher pages should call this rather than re-deriving it.
 */
export type StudentName = { full_name: string | null; avatar_url: string | null }

const EMPTY: StudentName = { full_name: null, avatar_url: null }

export async function resolveStudentNames(studentIds: (string | null | undefined)[]): Promise<Map<string, StudentName>> {
  const ids = Array.from(new Set(studentIds.filter((x): x is string => !!x)))
  const out = new Map<string, StudentName>()
  if (!ids.length) return out

  const { data } = await createAdminClient()
    .from('students')
    .select('id, profile:profiles(full_name, avatar_url)')
    .in('id', ids)

  for (const s of data ?? []) {
    // The embed types as an array even though it is a to-one relation.
    const raw = (s as unknown as { profile?: unknown }).profile
    const prof = (Array.isArray(raw) ? raw[0] : raw) as StudentName | null
    out.set(s.id as string, { full_name: prof?.full_name ?? null, avatar_url: prof?.avatar_url ?? null })
  }
  return out
}

/**
 * Re-shape a row that carries `student_id` into the `{ student: { profile } }`
 * shape the teacher clients already render, now with the real name attached.
 */
export function attachStudentName<T extends { student_id?: string | null }>(
  row: T,
  names: Map<string, StudentName>,
): T & { student: { profile: StudentName } } {
  return { ...row, student: { profile: names.get(row.student_id ?? '') ?? EMPTY } }
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AvailabilityClient from './AvailabilityClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function AvailabilityPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!teacher) redirect(`/${lang}/onboarding`)

  // Read the teacher's OWN slots with the service-role client, scoped by the
  // teacher.id we just resolved from auth.uid() above — ownership is already
  // proven, so this widens nothing.
  //
  // Why not the session client: migration 062 dropped "Teachers manage own
  // availability", which was a FOR ALL policy — so it removed the teacher's
  // SELECT along with the write surface it was targeting. availability_slots now
  // has RLS on with ZERO policies (deny-all), and this read silently returned []
  // with a 200 and no error. That is dangerous rather than merely broken: the
  // editor rendered EMPTY, and saveAvailabilitySlots does an atomic replace-all,
  // so the next save would wipe every real slot the teacher had. Deny-all is the
  // right resting state for this table — every other reader (3 admin sites) already
  // uses the service-role client — so fix the reader, not the policy.
  // Same pattern as the student-name resolve in agenda/estudiantes (deep-audit I18N-6).
  const { data: slots } = await createAdminClient()
    .from('availability_slots')
    .select('id, day_of_week, start_time, end_time')
    .eq('teacher_id', teacher.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <AvailabilityClient
      lang={lang as Locale}
      existingSlots={(slots as any) || []}
    />
  )
}

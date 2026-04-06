import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProgresoClient from './ProgresoClient'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

export default async function ProgresoPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: student } = await supabase
    .from('students')
    .select('id, level, classes_remaining')
    .eq('profile_id', user.id)
    .single()

  const studentId = student?.id || ''

  const { count: completedCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'completed')

  return (
    <ProgresoClient
      lang={lang as Locale}
      level={student?.level || null}
      classesRemaining={student?.classes_remaining || 0}
      completedCount={completedCount || 0}
    />
  )
}

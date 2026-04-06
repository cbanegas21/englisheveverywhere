import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const { searchParams, origin } = new URL(request.url)
  const { lang } = await params

  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // Read role from profiles table — authoritative for both email/password
      // and OAuth users (trigger sets default 'student' for OAuth signups)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      const role = profile?.role || user?.user_metadata?.role || 'student'

      if (role === 'teacher') {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id, is_active')
          .eq('profile_id', user!.id)
          .maybeSingle()

        if (teacher) {
          if (!teacher.is_active) {
            return NextResponse.redirect(`${origin}/${lang}/maestro/pending`)
          }
          return NextResponse.redirect(`${origin}/${lang}/maestro/dashboard`)
        }
      } else {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', user!.id)
          .maybeSingle()
        if (student) return NextResponse.redirect(`${origin}/${lang}/dashboard`)
      }

      return NextResponse.redirect(`${origin}/${lang}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}/${lang}/login?error=auth_callback_failed`)
}

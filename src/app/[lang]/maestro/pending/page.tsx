import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

const t = {
  en: {
    headline: 'Your application is under review',
    sub: 'Our team is reviewing your teacher profile. You\'ll receive an email at the address you signed up with once your account is activated.',
    timeline: 'Typical review time: 24–48 hours',
    whatNext: 'What happens next?',
    steps: [
      'Our team reviews your bio, specializations, and rate',
      'You receive an activation email',
      'You gain full access to your teacher dashboard',
    ],
    questions: 'Questions?',
    contact: 'Contact us at',
    logout: 'Sign out',
    alreadyActive: 'Already activated? Click here to access your dashboard.',
    dashboard: 'Go to dashboard',
  },
  es: {
    headline: 'Tu solicitud está siendo revisada',
    sub: 'Nuestro equipo está revisando tu perfil de maestro. Recibirás un correo en la dirección con la que te registraste cuando tu cuenta esté activada.',
    timeline: 'Tiempo de revisión típico: 24–48 horas',
    whatNext: '¿Qué sigue?',
    steps: [
      'Nuestro equipo revisa tu bio, especializaciones y tarifa',
      'Recibes un correo de activación',
      'Obtienes acceso completo a tu dashboard de maestro',
    ],
    questions: '¿Preguntas?',
    contact: 'Escríbenos a',
    logout: 'Cerrar sesión',
    alreadyActive: '¿Ya activaste tu cuenta? Haz clic aquí para ir a tu dashboard.',
    dashboard: 'Ir al dashboard',
  },
}

export default async function MaestroPendingPage({ params }: Props) {
  const { lang } = await params
  const tx = t[lang as Locale]
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // If teacher got activated since last visit, send them to dashboard
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (teacher?.is_active) {
    redirect(`/${lang}/maestro/dashboard`)
  }

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher'

  async function handleSignOut() {
    'use server'
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const supabaseServer = await createServerClient()
    await supabaseServer.auth.signOut()
    redirect(`/${lang}/login`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9F9F9' }}>
      {/* Top bar */}
      <div
        className="px-8 py-4 flex items-center justify-between"
        style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded flex items-center justify-center text-[10px] font-black"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            EE
          </div>
          <span className="text-[14px] font-black tracking-tight" style={{ color: '#111111' }}>
            English Everywhere
          </span>
        </div>
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-[12px] transition-colors"
            style={{ color: '#9CA3AF' }}
          >
            {tx.logout}
          </button>
        </form>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[480px]">

          {/* Status badge */}
          <div className="flex justify-center mb-8">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold"
              style={{ background: '#FEF9EE', color: '#C41E3A', border: '1px solid rgba(196,30,58,0.2)' }}
            >
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ background: '#C41E3A' }}
              />
              {lang === 'es' ? 'En revisión' : 'Under review'}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-black text-center mb-3"
            style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', color: '#111111', lineHeight: 1.2 }}
          >
            {tx.headline}
          </h1>
          <p className="text-[14px] text-center leading-relaxed mb-2" style={{ color: '#4B5563' }}>
            {tx.sub}
          </p>
          <p className="text-[12px] text-center mb-10" style={{ color: '#9CA3AF' }}>
            {tx.timeline}
          </p>

          {/* What happens next */}
          <div
            className="rounded-xl p-6 mb-5"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <h2 className="text-[14px] font-bold mb-4" style={{ color: '#111111' }}>
              {tx.whatNext}
            </h2>
            <ol className="space-y-3">
              {tx.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[11px] font-bold"
                    style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed pt-0.5" style={{ color: '#4B5563' }}>
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* Hello, name */}
          <p className="text-center text-[13px] mb-4" style={{ color: '#9CA3AF' }}>
            {lang === 'es' ? `Cuenta registrada como: ` : `Account registered as: `}
            <span className="font-semibold" style={{ color: '#4B5563' }}>{name}</span>
          </p>

          {/* Contact */}
          <p className="text-center text-[13px] mb-6" style={{ color: '#9CA3AF' }}>
            {tx.questions}{' '}
            {tx.contact}{' '}
            <a
              href="mailto:hola@englisheverywhere.com"
              className="font-semibold underline underline-offset-2"
              style={{ color: '#111111' }}
            >
              hola@englisheverywhere.com
            </a>
          </p>

          {/* Refresh link — server checks is_active on each load */}
          <div className="text-center">
            <Link
              href={`/${lang}/maestro/pending`}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors"
              style={{ color: '#9CA3AF' }}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M13.65 2.35A8 8 0 1 0 15 8h-1.5a6.5 6.5 0 1 1-1.12-3.65l-2.13 2.13H14V2l-2.35 2.35z"/>
              </svg>
              {lang === 'es' ? 'Actualizar estado' : 'Refresh status'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

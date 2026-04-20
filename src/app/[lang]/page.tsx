import type { Locale } from '@/lib/i18n/translations'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import Teachers from '@/components/landing/Teachers'
import Pricing from '@/components/landing/Pricing'
import Testimonials from '@/components/landing/Testimonials'
import FAQ from '@/components/landing/FAQ'
import FinalCTA from '@/components/landing/FinalCTA'
import Footer from '@/components/landing/Footer'

type Props = { params: Promise<{ lang: string }> }

export default async function LandingPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()
  let isLoggedIn = false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    isLoggedIn = !!user
  } catch {
    // Stale/invalid refresh token — render as logged-out
  }

  return (
    <main className="overflow-x-hidden">
      <Navbar lang={lang as Locale} isLoggedIn={isLoggedIn} />
      <Hero lang={lang as Locale} isLoggedIn={isLoggedIn} />
      <HowItWorks lang={lang as Locale} />
      <Teachers lang={lang as Locale} />
      <Pricing lang={lang as Locale} />
      <Testimonials lang={lang as Locale} />
      <FAQ lang={lang as Locale} />
      <FinalCTA lang={lang as Locale} />
      <Footer lang={lang as Locale} />
    </main>
  )
}

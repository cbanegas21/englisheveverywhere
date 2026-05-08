import type { Locale } from '@/lib/i18n/translations'
import { cookies } from 'next/headers'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import TrustStrip from '@/components/landing/TrustStrip'
import HowItWorks from '@/components/landing/HowItWorks'
import Teachers from '@/components/landing/Teachers'
import Pricing from '@/components/landing/Pricing'
import FAQ from '@/components/landing/FAQ'
import FinalCTA from '@/components/landing/FinalCTA'
import Footer from '@/components/landing/Footer'

type Props = { params: Promise<{ lang: string }> }

export default async function LandingPage({ params }: Props) {
  const { lang } = await params
  // Cookie-only login check on the landing page. supabase.auth.getUser()
  // makes a network round-trip to the Supabase auth server on every
  // request — unacceptable latency for a public marketing page that
  // doesn't actually need a verified user, just a CTA toggle. The
  // ee-role cookie is set on signIn and cleared on signOut; worst
  // case (stale cookie post-expiry) is the user clicks "Dashboard"
  // and gets redirected to /login, which is fine.
  const cookieStore = await cookies()
  const isLoggedIn = !!cookieStore.get('ee-role')?.value

  return (
    <main className="overflow-x-hidden">
      <Navbar lang={lang as Locale} isLoggedIn={isLoggedIn} />
      <Hero lang={lang as Locale} isLoggedIn={isLoggedIn} />
      <TrustStrip lang={lang as Locale} />
      <HowItWorks lang={lang as Locale} />
      <Teachers lang={lang as Locale} />
      <Pricing lang={lang as Locale} />
      <FAQ lang={lang as Locale} />
      <FinalCTA lang={lang as Locale} />
      <Footer lang={lang as Locale} />
    </main>
  )
}

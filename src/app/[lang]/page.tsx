import { locales, type Locale } from '@/lib/i18n/translations'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import MorningBanner from '@/components/landing/MorningBanner'
import TrustStrip from '@/components/landing/TrustStrip'
import HowItWorks from '@/components/landing/HowItWorks'
import Teachers from '@/components/landing/Teachers'
import NotebookBanner from '@/components/landing/NotebookBanner'
import WorkshopSection from '@/components/landing/WorkshopSection'
import HorasGrid from '@/components/landing/HorasGrid'
import Pricing from '@/components/landing/Pricing'
import FAQ from '@/components/landing/FAQ'
import FinalCTA from '@/components/landing/FinalCTA'
import Footer from '@/components/landing/Footer'
import { publicPlans, minPerClassUsd } from '@/lib/pricing'

type Props = { params: Promise<{ lang: string }> }

export default async function LandingPage({ params }: Props) {
  const { lang } = await params
  // The [lang]/layout.tsx notFound() guard is NOT enough here: Next renders
  // page and layout in parallel, so a dotted-path fallthrough from the proxy
  // (/apple-touch-icon.png, /wp-login.php, …) still executes this page with an
  // invalid lang and crashes the landing sections (Sentry ENGLISHKOLAB-3/4/G).
  if (!locales.includes(lang as Locale)) notFound()
  // Cookie-only login check on the landing page. supabase.auth.getUser()
  // makes a network round-trip to the Supabase auth server on every
  // request — unacceptable latency for a public marketing page that
  // doesn't actually need a verified user, just a CTA toggle. The
  // ee-role cookie is set on signIn and cleared on signOut; worst
  // case (stale cookie post-expiry) is the user clicks "Dashboard"
  // and gets redirected to /login, which is fine.
  const cookieStore = await cookies()
  // Read the role server-side (the ee-role cookie is httpOnly — unreadable from
  // the client) so role-aware CTAs work without a dead document.cookie read.
  const role = cookieStore.get('ee-role')?.value ?? null
  const isLoggedIn = !!role
  // First-name hint for the "Conectado como {name}" nav affordance (cookie-only, no getUser).
  const userName = cookieStore.get('ee-name')?.value ?? null

  // overflow-x: clip (not hidden) contains horizontal overflow WITHOUT creating
  // a scroll container — so the sticky Navbar keeps working (LK-01).
  return (
    <main style={{ background: 'var(--ek-paper-warm)', overflowX: 'clip' }}>
      <Navbar lang={lang as Locale} isLoggedIn={isLoggedIn} userName={userName} />
      <Hero lang={lang as Locale} isLoggedIn={isLoggedIn} />
      <MorningBanner lang={lang as Locale} />
      <TrustStrip lang={lang as Locale} />
      <HowItWorks lang={lang as Locale} />
      <Teachers lang={lang as Locale} />
      <NotebookBanner lang={lang as Locale} />
      <WorkshopSection lang={lang as Locale} />
      <HorasGrid lang={lang as Locale} />
      <Pricing lang={lang as Locale} plans={publicPlans()} minPerClass={minPerClassUsd()} />
      <FAQ lang={lang as Locale} />
      <FinalCTA lang={lang as Locale} isLoggedIn={isLoggedIn} role={role} />
      <Footer lang={lang as Locale} />
    </main>
  )
}

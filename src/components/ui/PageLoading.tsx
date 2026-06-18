import { Spinner } from '@/components/ui/Spinner'

// Generic branded route-loading screen for Next.js `loading.tsx` boundaries.
// It renders inside the app shell's content <main>, so the sidebar/topbar stay
// put while the page's server data loads — every in-app navigation shows this
// instead of a frozen-looking blank, even when the DB is slow. A faux topbar +
// skeleton cards keep the layout from jumping; the brand spinner reads as
// "loading". Pages with a bespoke skeleton (e.g. progreso) keep their own.
export default function PageLoading() {
  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>
      {/* Topbar placeholder — mirrors DashTopBar so the header doesn't jump in. */}
      <div
        className="px-6 lg:px-8 py-6 animate-pulse"
        style={{ background: 'var(--ek-card)', borderBottom: '1px solid var(--ek-border)' }}
      >
        <div className="h-6 w-40 rounded" style={{ background: 'var(--ek-border)' }} />
        <div className="h-3.5 w-56 rounded mt-2.5" style={{ background: 'var(--ek-border-soft, var(--ek-border))' }} />
      </div>

      {/* Content placeholder with the brand spinner centered over it. */}
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-5" aria-hidden="true">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl" style={{ height: 96, background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }} />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl" style={{ height: 130, background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-start justify-center pt-24" role="status" aria-label="Loading">
          <Spinner size={30} stroke="var(--ek-red)" />
        </div>
      </div>
    </div>
  )
}

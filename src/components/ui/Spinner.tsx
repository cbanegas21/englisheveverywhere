// Shared loading primitives. The app talks to a DB with real latency, so any
// async action (sign-in, booking, checkout, save) must show that it's WORKING —
// otherwise a slow response reads as "broken". Two pieces:
//   <Spinner/>        — inline animated ring; drop inside a button or next to text.
//   <LoadingOverlay/> — a fixed full-screen veil for slow TRANSITIONS (sign-in +
//                       the page load that follows), so the user never stares at a
//                       frozen-looking screen wondering if it failed.

export function Spinner({
  size = 18,
  stroke = 'currentColor',
  className = '',
}: {
  size?: number
  stroke?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke={stroke} strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3"
      style={{ background: 'rgba(244, 239, 230, 0.82)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
    >
      <Spinner size={36} stroke="var(--ek-red)" />
      {label && (
        <p className="text-[13px] font-medium" style={{ color: 'var(--ek-text)' }}>
          {label}
        </p>
      )}
    </div>
  )
}

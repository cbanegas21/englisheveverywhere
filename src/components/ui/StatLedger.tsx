import Link from 'next/link'
import type { ReactNode } from 'react'

export type StatLedgerItem = {
  kicker: string
  value: ReactNode
  sub?: string
  /** When set, the whole stat becomes a doorway to that route. */
  href?: string
  /** Render the value in the red accent (use for the key/actionable stat). */
  accent?: boolean
}

// Styles ship WITH the component (not globals.css) so the ledger always renders
// styled wherever it's used — no dependency on global CSS load order.
const STYLES = `
.lk-statledger {
  display: grid;
  grid-template-columns: repeat(var(--lk-cols, 4), minmax(0, 1fr));
  border-top: 1px solid var(--ek-ink);
  border-bottom: 1px solid var(--ek-border);
}
.lk-statledger .lk-stat {
  padding: 18px 22px 20px;
  text-decoration: none;
  color: inherit;
  border-left: 1px solid var(--ek-border);
}
.lk-statledger .lk-stat:first-child { border-left: none; }
.lk-statledger a.lk-stat { transition: background 0.18s ease; }
.lk-statledger a.lk-stat:hover { background: var(--ek-red-tint); }
.lk-statledger .lk-stat-kicker {
  font-family: var(--ek-font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ek-text-muted);
}
.lk-statledger .lk-stat-value {
  font-size: clamp(30px, 4.2vw, 50px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--ek-text);
  margin-top: 14px;
  font-feature-settings: 'tnum' 1;
}
.lk-statledger .lk-stat-sub { font-size: 12px; color: var(--ek-text-muted); margin-top: 10px; }
@media (max-width: 720px) {
  .lk-statledger { grid-template-columns: 1fr 1fr; }
  .lk-statledger .lk-stat:nth-child(odd) { border-left: none; }
  .lk-statledger .lk-stat:nth-child(n+3) { border-top: 1px solid var(--ek-border); }
}
`

/**
 * Editorial stat ledger — box-less stats divided by hairline rules, big numbers,
 * mono kickers. Replaces the generic "AI card grid" across the dashboard. Set the
 * column count via --lk-cols.
 */
export function StatLedger({ items }: { items: StatLedgerItem[] }) {
  return (
    <div className="lk-statledger" style={{ ['--lk-cols' as string]: items.length }}>
      {items.map((it, i) => {
        const inner = (
          <>
            <div className="lk-stat-kicker">{it.kicker}</div>
            <div className="lk-stat-value" style={it.accent ? { color: 'var(--ek-red)' } : undefined}>
              {it.value}
            </div>
            {it.sub && <div className="lk-stat-sub">{it.sub}</div>}
          </>
        )
        return it.href ? (
          <Link key={i} href={it.href} className="lk-stat">
            {inner}
          </Link>
        ) : (
          <div key={i} className="lk-stat">
            {inner}
          </div>
        )
      })}
      <style>{STYLES}</style>
    </div>
  )
}

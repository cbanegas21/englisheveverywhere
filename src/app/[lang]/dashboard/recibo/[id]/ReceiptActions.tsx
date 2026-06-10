'use client'

import Link from 'next/link'

interface Props {
  backHref: string
  printLabel: string
  backLabel: string
}

// Print / back controls — hidden from the printout via the .no-print rule in the
// receipt page's print stylesheet. window.print() lets the browser print or
// "Save as PDF", so a real receipt is downloadable with no PDF dependency.
export default function ReceiptActions({ backHref, printLabel, backLabel }: Props) {
  return (
    <div className="no-print" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
      <button
        onClick={() => window.print()}
        style={{
          padding: '10px 20px', borderRadius: 'var(--ek-radius-sm)',
          background: 'var(--ek-red)', color: '#fff', border: '1px solid var(--ek-red)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {printLabel}
      </button>
      <Link
        href={backHref}
        style={{
          padding: '10px 20px', borderRadius: 'var(--ek-radius-sm)',
          background: 'var(--ek-card)', color: 'var(--ek-text-soft)',
          border: '1px solid var(--ek-border)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}
      >
        {backLabel}
      </Link>
    </div>
  )
}

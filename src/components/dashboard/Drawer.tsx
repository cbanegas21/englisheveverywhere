'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Shared editorial slide-over drawer for the dashboard.
 *
 * Portaled to <body> for the same reason as Modal: the per-page framer-motion
 * wrappers apply a `transform`, which becomes the containing block for any
 * `position: fixed` descendant and drifts hand-rolled panels. Rendering at the
 * body root escapes every transform/overflow trap. Locks body scroll, closes on
 * Esc / scrim click. Right-edge panel — use for long content (student profiles,
 * grade forms) where a centered Modal would feel cramped.
 */
export default function Drawer({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  width = 460,
  labelledBy = 'ek-drawer-title',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  kicker?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  labelledBy?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="ek-drawer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? labelledBy : undefined}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(17,17,17,0.55)',
          }}
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring' as const, stiffness: 320, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: width,
              height: '100dvh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--ek-card)',
              borderLeft: '1px solid var(--ek-border)',
              boxShadow: '-40px 0 80px -32px rgba(0,0,0,0.4)',
              fontFamily: 'var(--ek-font-sans)',
              color: 'var(--ek-text)',
            }}
          >
            {(kicker || title) && (
              <div
                style={{
                  padding: '22px 26px 18px',
                  borderBottom: '1px solid var(--ek-border)',
                  flexShrink: 0,
                }}
              >
                {kicker && (
                  <div className="ek-microlabel" style={{ color: 'var(--ek-red)', marginBottom: 8 }}>
                    {kicker}
                  </div>
                )}
                {title && (
                  <h2
                    id={labelledBy}
                    style={{
                      margin: 0,
                      fontWeight: 800,
                      fontSize: 22,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.15,
                      color: 'var(--ek-text)',
                    }}
                  >
                    {title}
                  </h2>
                )}
              </div>
            )}
            <div style={{ padding: '20px 26px', overflowY: 'auto', flex: 1 }}>{children}</div>
            {footer && (
              <div
                style={{ padding: '16px 26px', borderTop: '1px solid var(--ek-border)', flexShrink: 0 }}
              >
                {footer}
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

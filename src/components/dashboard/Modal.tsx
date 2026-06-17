'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { lockBodyScroll } from '@/lib/scrollLock'
import { pushOverlay, popOverlay, isTopOverlay } from './overlayStack'

/**
 * One shared, centered, editorial modal for the whole dashboard.
 *
 * Portaled to <body> on purpose: the per-page framer-motion wrappers apply a
 * `transform`, which makes them the containing block for any `position: fixed`
 * descendant — that's why the old hand-rolled popups drifted to the bottom-right.
 * Rendering at the body root escapes every transform/overflow trap, so the
 * overlay is always viewport-centered. Locks body scroll + closes on Esc / scrim.
 */
export default function Modal({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  maxWidth = 460,
  labelledBy = 'ek-modal-title',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  kicker?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number
  labelledBy?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const id = pushOverlay()
    const unlock = lockBodyScroll()
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most overlay reacts, so Esc dismisses one dialog at a time.
      if (e.key === 'Escape' && isTopOverlay(id)) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      popOverlay(id)
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="ek-modal-overlay"
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
            // Above Drawer (zIndex 100) so a Modal opened over a Drawer (e.g. the
            // AD-03 conflict dialog over the booking detail) sits reliably on top.
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(17,17,17,0.55)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth,
              maxHeight: 'calc(100dvh - 40px)',
              overflowY: 'auto',
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 'var(--ek-radius-lg)',
              boxShadow: '0 40px 80px -32px rgba(0,0,0,0.4)',
              fontFamily: 'var(--ek-font-sans)',
              color: 'var(--ek-text)',
            }}
          >
            {(kicker || title) && (
              <div style={{ padding: '24px 26px 0' }}>
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
            <div style={{ padding: kicker || title ? '16px 26px 24px' : '26px' }}>{children}</div>
            {footer && (
              <div style={{ padding: '16px 26px', borderTop: '1px solid var(--ek-border)' }}>{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

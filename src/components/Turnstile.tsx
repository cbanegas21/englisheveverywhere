'use client'

import { useEffect, useRef } from 'react'

// Cloudflare Turnstile (CAPTCHA) widget. Loads the CF script once and renders
// explicitly so it works inside a React form. Reports the verification token via
// onToken (and clears it on expiry/error so a stale token can't be submitted).
// No-ops if NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (keeps local/dev working).
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey || !ref.current) return
    let widgetId: string | undefined
    let rendered = false

    const render = () => {
      if (rendered || !ref.current || !window.turnstile) return
      rendered = true
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => cb.current(token),
        'expired-callback': () => cb.current(''),
        'error-callback': () => cb.current(''),
        'timeout-callback': () => cb.current(''),
      })
    }

    let poll: ReturnType<typeof setInterval> | undefined
    if (window.turnstile) {
      render()
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = render
      document.head.appendChild(s)
    } else {
      poll = setInterval(() => { if (window.turnstile) { clearInterval(poll); render() } }, 150)
    }

    return () => {
      if (poll) clearInterval(poll)
      try { if (widgetId && window.turnstile) window.turnstile.remove(widgetId) } catch { /* noop */ }
    }
  }, [])

  // Reserve height so the form doesn't jump when the widget mounts.
  return <div ref={ref} style={{ minHeight: 65 }} />
}

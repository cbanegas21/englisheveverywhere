import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Resend (Svix) webhook (P2-9). On a hard bounce or spam complaint we flag the
// recipient's profile.email_suppressed so the recurring senders stop emailing a
// dead/complaining address (sender-reputation protection on the new domain).
// Fails closed if RESEND_WEBHOOK_SECRET is unset. Svix signs
// `${id}.${timestamp}.${body}` with the base64 secret (after the whsec_ prefix).
function verifySvix(secret: string, req: NextRequest, body: string): boolean {
  const id = req.headers.get('svix-id')
  const ts = req.headers.get('svix-timestamp')
  const sigHeader = req.headers.get('svix-signature')
  if (!id || !ts || !sigHeader) return false
  let key: Buffer
  try { key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64') } catch { return false }
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  const expBuf = Buffer.from(expected)
  // The header is a space-delimited list of "v1,<base64sig>" — accept if any matches.
  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1]
    if (!sig) return false
    const sBuf = Buffer.from(sig)
    return sBuf.length === expBuf.length && crypto.timingSafeEqual(sBuf, expBuf)
  })
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret || secret.endsWith('_placeholder')) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  const body = await req.text()
  if (!verifySvix(secret, req, body)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }
  let event: { type?: string; data?: { to?: string | string[] } }
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    const to = event.data?.to
    const addrs = (Array.isArray(to) ? to : to ? [to] : []).filter(Boolean)
    if (addrs.length) {
      const admin = createAdminClient()
      for (const addr of addrs) {
        await admin.from('profiles').update({ email_suppressed: true }).eq('email', addr)
      }
      Sentry.captureMessage(`Resend ${event.type} → suppressed ${addrs.join(', ')}`, 'warning')
    }
  }
  return NextResponse.json({ received: true })
}

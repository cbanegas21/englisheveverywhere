/**
 * Shared helpers for the EXHAUSTIVE LIVE QA SWEEP. Proven in exhaustive-auth.spec.ts.
 * Every per-surface spec imports from here — ONE consistent toolkit, never reinvented
 * (inconsistent ad-hoc helpers are exactly what produced the locale/selector artifacts
 * in the legacy suite). Do not add `networkidle` waits or `describe.serial` here.
 */
import { type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, v] = m
      if (process.env[k]) continue
      process.env[k] = v.replace(/^['"]|['"]$/g, '')
    }
  } catch { /* optional */ }
}
loadEnvLocal()

export function makeAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// auth_attempts.id is bigint — clear with gte('id', 0). Resets the rate-limit window.
export async function clearRateLimit() {
  const db = makeAdmin(); if (!db) return
  await db.from('auth_attempts').delete().gte('id', 0)
}

// 'networkidle' NEVER settles on a live app (analytics/keep-alive). Use DOM-ready
// plus a short fixed window for any server-action redirect chain to resolve.
export async function settle(p: Page, ms = 2000) {
  await p.waitForLoadState('domcontentloaded').catch(() => {})
  await p.waitForTimeout(ms)
}

export const hasAuthCookie = (cookies: { name: string }[]) =>
  cookies.some(c => /^sb-.*-auth-token/.test(c.name))

// react-international-phone reformats per keystroke — focus then type slowly.
export async function typePhone(page: Page, national: string) {
  const input = page.locator('.react-international-phone-input')
  await input.click()
  await input.pressSequentially(national, { delay: 80 })
}

// Saved authenticated sessions produced by scripts/qa-save-states.mjs. Load via
//   test.use({ storageState: STATE.student })
// so surface specs DON'T log in per-test (no rate-limit contention at scale).
export const STATE = {
  student: '.auth/student.json',
  teacher: '.auth/teacher.json',
  admin: '.auth/admin.json',
} as const

// Credentials come from env only — never hardcode live passwords in the repo.
// Specs that need a session skip themselves when these are unset (see test.skip guards).
export const ACCOUNT = {
  student: { email: process.env.E2E_STUDENT_EMAIL || 'student@englishkolab.com', password: process.env.E2E_STUDENT_PASSWORD || '' },
  teacher: { email: process.env.E2E_TEACHER_EMAIL || 'teacher@englishkolab.com', password: process.env.E2E_TEACHER_PASSWORD || '' },
  admin:   { email: process.env.E2E_ADMIN_EMAIL   || 'admin@englishkolab.com',   password: process.env.E2E_ADMIN_PASSWORD   || '' },
} as const

// Real UI login (when a spec must drive the login itself rather than reuse a session).
export async function loginUI(page: Page, email: string, password: string, opts: { next?: string } = {}) {
  const url = opts.next ? `/es/login?next=${encodeURIComponent(opts.next)}` : '/es/login'
  await page.goto(url)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: /ingresar|log in/i }).click()
}

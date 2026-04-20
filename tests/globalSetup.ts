/**
 * Playwright global setup. Runs once before the suite.
 *
 * IMPORTANT: by default this is a NO-OP. It only writes to the backing
 * Supabase project (resetting the student password, creating the admin
 * test user) when E2E_PROVISION=1 is set in the shell. This keeps CI
 * runs against production safe — the mutating steps require an explicit
 * opt-in from the developer running the local suite.
 *
 * When enabled:
 *   1. Resets the static student account password to the documented value
 *      so dashboards.spec.ts + auth.spec.ts can log in.
 *   2. Ensures a dedicated E2E admin user exists with a known password and
 *      writes its creds to the env so admin.spec.ts picks them up.
 */

import { ACCOUNTS } from './fixtures/accounts'
import { ensureStudentPassword, ensureAdminUser } from './fixtures/manageUsers'

export default async function globalSetup() {
  if (process.env.E2E_PROVISION !== '1') {
    console.error('[globalSetup] skipped — set E2E_PROVISION=1 to sync the student + admin test accounts via service role')
    return
  }

  const okStudent = await ensureStudentPassword(ACCOUNTS.student.email, ACCOUNTS.student.password)
  if (okStudent) {
    console.error(`[globalSetup] student ${ACCOUNTS.student.email} password synchronized`)
  } else {
    console.error(`[globalSetup] could not sync student password (missing service role key or user)`)
  }

  const adminCreds = await ensureAdminUser()
  if (adminCreds) {
    process.env.E2E_ADMIN_EMAIL = adminCreds.email
    process.env.E2E_ADMIN_PASSWORD = adminCreds.password
    console.error(`[globalSetup] admin user ready: ${adminCreds.email}`)
  } else {
    console.error(`[globalSetup] could not provision admin user`)
  }
}

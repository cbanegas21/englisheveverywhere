/**
 * Playwright global setup. Runs once before the suite.
 *
 *   1. Resets the static student account password to the documented value
 *      so dashboards.spec.ts + auth.spec.ts can log in.
 *   2. Ensures a dedicated E2E admin user exists with a known password and
 *      writes its creds to the env so admin.spec.ts picks them up.
 */

import { ACCOUNTS } from './fixtures/accounts'
import { ensureStudentPassword, ensureAdminUser } from './fixtures/manageUsers'

export default async function globalSetup() {
  const okStudent = await ensureStudentPassword(ACCOUNTS.student.email, ACCOUNTS.student.password)
  if (okStudent) {
    console.error(`[globalSetup] student ${ACCOUNTS.student.email} password synchronized`)
  } else {
    console.warn(`[globalSetup] could not sync student password (missing service role key or user)`)
  }

  const adminCreds = await ensureAdminUser()
  if (adminCreds) {
    process.env.E2E_ADMIN_EMAIL = adminCreds.email
    process.env.E2E_ADMIN_PASSWORD = adminCreds.password
    console.error(`[globalSetup] admin user ready: ${adminCreds.email}`)
  } else {
    console.warn(`[globalSetup] could not provision admin user`)
  }
}

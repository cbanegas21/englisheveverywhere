/**
 * Test account credentials. Defaults match the known test accounts
 * (see CLAUDE.md). Override per-environment by setting:
 *   E2E_STUDENT_EMAIL, E2E_STUDENT_PASSWORD
 *   E2E_TEACHER_EMAIL, E2E_TEACHER_PASSWORD
 *
 * Tests that depend on login will be skipped when credentials are the
 * default placeholders AND the placeholder login fails — so CI can
 * short-circuit gracefully rather than flooding with auth failures.
 */
export const ACCOUNTS = {
  student: {
    email: process.env.E2E_STUDENT_EMAIL || 'testing@remoteacktive.com',
    password: process.env.E2E_STUDENT_PASSWORD || 'Test1234!',
  },
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL || 'c.banegaspaz2020@gmail.com',
    password: process.env.E2E_TEACHER_PASSWORD || 'Test1234!',
  },
} as const

export const ROUTES = {
  es: {
    login: '/es/login',
    registro: '/es/registro',
    studentDashboard: '/es/dashboard',
    teacherDashboard: '/es/maestro/dashboard',
    adminDashboard: '/es/admin',
  },
  en: {
    login: '/en/login',
    registro: '/en/registro',
    studentDashboard: '/en/dashboard',
    teacherDashboard: '/en/maestro/dashboard',
    adminDashboard: '/en/admin',
  },
} as const

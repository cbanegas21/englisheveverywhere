// TEMPORARY server-side Sentry probe — confirms that UNHANDLED backend errors
// (a server route/action that throws unexpectedly) actually reach Sentry via the
// instrumentation.ts `onRequestError` hook. Secret-gated so the public can't
// trigger it / spam the project. DELETE this file once verified.
export const dynamic = 'force-dynamic'

const PROBE_KEY = 'ek-sentry-probe-9f3a2c'

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('key') !== PROBE_KEY) {
    return new Response('Not found', { status: 404 })
  }
  // Throw an UNHANDLED error — this is what gets auto-captured server-side.
  throw new Error('SENTRY-SERVER-TEST — backend reporting probe')
}

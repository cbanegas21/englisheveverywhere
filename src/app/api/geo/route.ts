import { NextResponse, type NextRequest } from 'next/server'

// Client-readable geo hint (registro phone-prefix autodetect). Vercel populates
// x-vercel-ip-country at the edge; locally it's absent → null and callers keep
// their defaults. No PII beyond the country code; safe to expose.
export function GET(req: NextRequest) {
  const country = req.headers.get('x-vercel-ip-country') || null
  return NextResponse.json(
    { country },
    // Country rarely changes per visitor session — let the browser cache it.
    { headers: { 'Cache-Control': 'private, max-age=3600' } },
  )
}

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ---------------------------------------------------------------------------
// Content-Security-Policy (§7.4 follow-up). Origins enumerated from the actual
// client code — every browser-reachable external host:
//   • Supabase REST/auth/storage (https) + realtime (wss) — public project URL.
//   • LiveKit signaling — regional *.livekit.cloud over wss/https.
//   • FX rates — open.er-api.com (client fetch in lib/fx.ts).
// Deliberately NOT listed (verified server-side or top-level redirects, so they
// never load on our origin): Stripe (checkout is a full window.location redirect,
// no Stripe.js embedded), Google OAuth (Supabase signInWithOAuth top-level
// redirect, no GIS script/iframe), Resend / Anthropic / Deepgram (all server
// actions). Fonts are self-hosted by next/font/google. Sentry error monitoring
// is ENABLED (NEXT_PUBLIC_SENTRY_DSN set 2026-06-15) → its ingest host is in
// connect-src below so the browser SDK + Session Replay can report.
//
// 'unsafe-inline' (script + style) is required: Next App Router emits inline
// bootstrap/hydration scripts with no nonce pipeline here, and the app uses
// pervasive inline style={{}} attributes + framer-motion. 'wasm-unsafe-eval'
// lets LiveKit compile its audio-processing WASM without allowing full eval.
// The real defense-in-depth comes from the locked-down connect-src/object-src/
// base-uri/form-action/frame-ancestors — nonce-based strict-dynamic is a future
// hardening step. Verified with scripts/qa-csp.mjs: zero violations across
// anon/student surfaces AND a live /sala LiveKit room (video connected) — now
// ENFORCING (was Report-Only for the verification pass).
const SUPABASE_ORIGIN = "https://kasuwdltupqpfxvjrmrp.supabase.co";
const SUPABASE_WSS = "wss://kasuwdltupqpfxvjrmrp.supabase.co";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://cdnjs.cloudflare.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WSS} https://*.livekit.cloud wss://*.livekit.cloud https://open.er-api.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://challenges.cloudflare.com`,
  `media-src 'self' blob: mediastream: ${SUPABASE_ORIGIN}`,
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Move the Next.js dev-tools indicator off the admin sidebar's bottom-left
  // "Sign out" button (its default position). Dev-only — absent in production.
  devIndicators: { position: "bottom-right" },

  // Don't advertise the framework (drops the `X-Powered-By: Next.js` header) —
  // pentest LOW: removes a free fingerprinting hint for attackers.
  poweredByHeader: false,

  // Baseline security headers (§7.4). Only HSTS was present; add clickjacking +
  // MIME-sniff + referrer-leak + feature-policy hardening on every route. NOTE:
  // Permissions-Policy MUST keep camera/microphone = (self) or the /sala LiveKit
  // classroom loses getUserMedia. CSP (see `CSP` above) is enforced; it was
  // verified Report-Only first (scripts/qa-csp.mjs, zero violations incl. /sala).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

// Sentry uploads sourcemaps when SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT
// are set (configured 2026-06-15: org english-kolab / project englishkolab, org
// auth token in Vercel) — so production stack traces de-minify to real file:line.
// Without them the wrapper is a no-op pass-through (safe for local/preview).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Strip tunnel by default — only enable if you need to bypass ad blockers.
  // tunnelRoute: "/monitoring",
  sourcemaps: { disable: false },
});

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Move the Next.js dev-tools indicator off the admin sidebar's bottom-left
  // "Sign out" button (its default position). Dev-only — absent in production.
  devIndicators: { position: "bottom-right" },

  // Baseline security headers (§7.4). Only HSTS was present; add clickjacking +
  // MIME-sniff + referrer-leak + feature-policy hardening on every route. NOTE:
  // Permissions-Policy MUST keep camera/microphone = (self) or the /sala LiveKit
  // classroom loses getUserMedia. A full Content-Security-Policy is deliberately
  // NOT set here — it needs per-source tuning for LiveKit/Stripe/Resend/Sentry and
  // careful testing to avoid breaking the app (tracked as a follow-up).
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
        ],
      },
    ];
  },
};

// Sentry only uploads sourcemaps when SENTRY_AUTH_TOKEN + SENTRY_ORG +
// SENTRY_PROJECT are set. Without them the wrapper is a no-op pass-through,
// so this is safe to ship before the user has a Sentry account.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Strip tunnel by default — only enable if you need to bypass ad blockers.
  // tunnelRoute: "/monitoring",
  sourcemaps: { disable: false },
});

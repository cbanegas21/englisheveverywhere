import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
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

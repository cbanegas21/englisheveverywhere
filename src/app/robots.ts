import type { MetadataRoute } from 'next'

// Let search engines index the public marketing pages; keep the authenticated
// app areas (and the API) out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api',
        '/es/dashboard', '/en/dashboard',
        '/es/maestro', '/en/maestro',
        '/es/admin', '/en/admin',
        '/es/sala', '/en/sala',
        '/es/onboarding', '/en/onboarding',
      ],
    },
    sitemap: 'https://englishkolab.com/sitemap.xml',
  }
}

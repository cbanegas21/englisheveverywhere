import type { MetadataRoute } from 'next'

// Public, indexable pages only (both locales). Authenticated app routes are
// excluded (and disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://englishkolab.com'
  const paths = ['', '/descubre', '/contact', '/privacy', '/terms', '/login', '/registro']
  const langs = ['es', 'en']
  const out: MetadataRoute.Sitemap = []
  for (const lang of langs) {
    for (const p of paths) {
      out.push({
        url: `${base}/${lang}${p}`,
        changeFrequency: p === '' ? 'weekly' : 'monthly',
        priority: p === '' ? 1 : 0.6,
      })
    }
  }
  return out
}

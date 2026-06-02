'use client'

import { useEffect } from 'react'
import type { Locale } from '@/lib/i18n/translations'

/**
 * Syncs the document <html lang> to the active locale on the client (EK-025).
 *
 * The root layout owns <html> and is static (lang defaults to "es"); reading
 * headers() there to vary it per route would force the whole app into dynamic
 * rendering and kill static generation on the marketing pages — a worse SEO
 * outcome than the bug. The [lang] <div lang> already gives assistive tech the
 * correct language for page content (nested lang overrides per the HTML spec);
 * this additionally corrects the document-level lang for JS-rendering crawlers,
 * with zero rendering-strategy cost.
 */
export default function HtmlLangSync({ lang }: { lang: Locale }) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}

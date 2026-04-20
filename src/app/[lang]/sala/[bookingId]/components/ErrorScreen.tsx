import { AlertCircle } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import { VIDEO_THEME } from '../theme'

interface Props {
  lang: Locale
  errorMsg: string | null
  onRetry: () => void
}

export function ErrorScreen({ lang, errorMsg, onRetry }: Props) {
  const tx = videoStrings(lang)
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: VIDEO_THEME.stage }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
        style={{ background: VIDEO_THEME.brandTint20 }}
      >
        <AlertCircle className="h-8 w-8" style={{ color: VIDEO_THEME.brand }} />
      </div>
      <p className="text-white font-bold mb-2">{tx.errorTitle}</p>
      <p className="text-xs mb-6 text-center max-w-xs px-4" style={{ color: VIDEO_THEME.textSubtle }}>
        {errorMsg}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
        style={{ background: VIDEO_THEME.brand }}
        onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
        onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
      >
        {tx.retry}
      </button>
    </div>
  )
}

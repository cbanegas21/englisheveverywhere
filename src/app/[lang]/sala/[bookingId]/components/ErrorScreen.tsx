import type { Locale } from '@/lib/i18n/translations'
import { videoStrings } from '../i18n'
import type { RoomErrorCode } from '../i18n'
import { VIDEO_THEME } from '../theme'
import { EKMark } from '@/components/ui/EKMark'

interface Props {
  lang: Locale
  errorCode: RoomErrorCode | null
  onRetry: () => void
}

export function ErrorScreen({ lang, errorCode, onRetry }: Props) {
  const tx = videoStrings(lang)
  // Map the stable code to localized prose; fall back to a generic localized
  // message for any unknown/connection-layer error (never raw English).
  const errorMsg = errorCode
    ? tx.errorMessages[errorCode] ?? tx.errorMessages.errorFallback
    : tx.errorMessages.errorFallback
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: VIDEO_THEME.stage }}
    >
      <div className="mb-6">
        <EKMark size={40} bg="#F4EFE6" arrowColor={VIDEO_THEME.brand} />
      </div>
      <h2
        className="mb-2 text-white"
        style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 26 }}
      >
        {tx.errorTitle}
      </h2>
      <p className="mb-7 max-w-xs text-center text-xs" style={{ color: VIDEO_THEME.textSubtle }}>
        {errorMsg}
      </p>
      <button
        onClick={onRetry}
        className="rounded-full px-7 py-2.5 text-white transition-colors"
        style={{ background: VIDEO_THEME.brand, fontWeight: 600, fontSize: 14 }}
        onMouseEnter={e => { e.currentTarget.style.background = VIDEO_THEME.brandHover }}
        onMouseLeave={e => { e.currentTarget.style.background = VIDEO_THEME.brand }}
      >
        {tx.retry}
      </button>
    </div>
  )
}

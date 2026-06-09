// Shared branded HTML wrapper for transactional emails (EnglishKolab look:
// cream backdrop, white card, crimson accent + CTA). Reuse for welcome, booking,
// and any future Resend email so they all read like one product.

// Escape user-supplied values before interpolating them into email HTML.
// full_name / email / feedback etc. are attacker-controllable and otherwise
// render as raw markup — including CROSS-PARTY (e.g. one user's name shown in
// the other party's inbox). Always wrap such values: `${escapeHtml(name)}`.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Canonical sender + app URL for all transactional email. Centralized so a
// missing/misconfigured env var can never ship localhost links, and the sender
// always shows a display name ("EnglishKolab"), not a bare mailbox.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://englishkolab.com'
// Always present a display name. EMAIL_FROM is often set to a BARE address
// (e.g. noreply@englishkolab.com) — wrap it so the sender shows "EnglishKolab".
const _rawFrom = process.env.EMAIL_FROM || 'noreply@englishkolab.com'
export const EMAIL_FROM = _rawFrom.includes('<') ? _rawFrom : `EnglishKolab <${_rawFrom}>`

export function brandedEmail(opts: {
  heading: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  footnote?: string
}): string {
  const { heading, bodyHtml, ctaLabel, ctaUrl, footnote } = opts
  const cta =
    ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;background:#C41E3A;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;margin:4px 0 0;">${ctaLabel}</a>`
      : ''
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F4EFE6;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #EAE4D6;border-radius:16px;padding:32px 28px;color:#111111;">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin-bottom:24px;">English<span style="color:#C41E3A;">Kolab</span></div>
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;margin:0 0 14px;">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#5C5648;margin:0 0 20px;">${bodyHtml}</div>
    ${cta}
    ${footnote ? `<p style="font-size:13px;line-height:1.6;color:#8C8578;margin:20px 0 0;">${footnote}</p>` : ''}
    <hr style="border:none;border-top:1px solid #EAE4D6;margin:26px 0 16px;" />
    <p style="font-size:12px;color:#C4BCAA;margin:0;">EnglishKolab — Aprende inglés. A tu ritmo.</p>
  </div>
</div>`
}

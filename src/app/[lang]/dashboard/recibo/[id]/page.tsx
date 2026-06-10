import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/translations'
import { planName } from '@/lib/pricing'
import ReceiptActions from './ReceiptActions'

interface Props { params: Promise<{ lang: string; id: string }> }

const STR = {
  en: {
    receipt: 'Receipt', receiptNo: 'Receipt no.', date: 'Date', billedTo: 'Billed to',
    description: 'Description', amount: 'Amount', total: 'Total', classes: 'classes',
    classPack: 'class pack', paidVia: 'Paid via Stripe · USD',
    thanks: 'Thank you for learning with EnglishKolab.',
    backToBilling: 'Back to billing', print: 'Print / Save as PDF',
  },
  es: {
    receipt: 'Recibo', receiptNo: 'Recibo n.º', date: 'Fecha', billedTo: 'Facturado a',
    description: 'Descripción', amount: 'Monto', total: 'Total', classes: 'clases',
    classPack: 'paquete de clases', paidVia: 'Pagado con Stripe · USD',
    thanks: 'Gracias por aprender con EnglishKolab.',
    backToBilling: 'Volver a facturación', print: 'Imprimir / Guardar PDF',
  },
}

export default async function ReceiptPage({ params }: Props) {
  const { lang, id } = await params
  const locale = (lang === 'en' ? 'en' : 'es') as Locale
  const t = STR[locale]

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) redirect(`/${lang}/login`)

  // RLS ("Students read own purchases", migration 035) scopes this to the
  // caller's own rows — a foreign or unknown id returns null → 404.
  const { data: purchase } = await supabase
    .from('student_purchases')
    .select('id, plan_key, amount_usd, classes_added, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!purchase) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const loc = locale === 'es' ? 'es-HN' : 'en-US'
  const amount = Number(purchase.amount_usd) || 0
  const fmtUsd = new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  const dateStr = new Date(purchase.created_at as string).toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Tegucigalpa' })
  const receiptNo = (purchase.id as string).slice(0, 8).toUpperCase()
  const plan = planName(purchase.plan_key as string, locale)
  const buyerName = (profile?.full_name as string) || user.email || ''

  const label = { fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700 as const, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--ek-text-muted)' }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px 64px' }}>
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          #ek-receipt, #ek-receipt * { visibility: visible; }
          #ek-receipt { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 560 }}>
        <div
          id="ek-receipt"
          style={{
            background: '#fff',
            border: '1px solid var(--ek-border)',
            borderRadius: 'var(--ek-radius-md)',
            padding: '36px 40px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
          }}
        >
          {/* Brand + receipt label */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 22, borderBottom: '1px solid var(--ek-border)' }}>
            <div>
              <div style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ek-text)' }}>EnglishKolab</div>
              <div style={{ fontSize: 11, color: 'var(--ek-text-muted)', marginTop: 3 }}>Remote ACKtive LLC · Wyoming, USA</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--ek-text)' }}>{t.receipt}</div>
              <div style={{ ...label, marginTop: 4 }}>{t.receiptNo} {receiptNo}</div>
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', padding: '22px 0', borderBottom: '1px solid var(--ek-border)' }}>
            <div>
              <div style={label}>{t.date}</div>
              <div style={{ fontSize: 14, color: 'var(--ek-text)', marginTop: 4 }}>{dateStr}</div>
            </div>
            <div>
              <div style={label}>{t.billedTo}</div>
              <div style={{ fontSize: 14, color: 'var(--ek-text)', marginTop: 4 }}>{buyerName}</div>
            </div>
          </div>

          {/* Line item */}
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0 0' }}>
            <thead>
              <tr>
                <th style={{ ...label, textAlign: 'left', padding: '14px 0 10px', borderBottom: '1px solid var(--ek-border)' }}>{t.description}</th>
                <th style={{ ...label, textAlign: 'right', padding: '14px 0 10px', borderBottom: '1px solid var(--ek-border)' }}>{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '14px 0', fontSize: 14, color: 'var(--ek-text)' }}>
                  {plan} — {purchase.classes_added} {t.classes} ({t.classPack})
                </td>
                <td style={{ padding: '14px 0', fontSize: 14, textAlign: 'right', fontFamily: 'var(--ek-font-mono)', color: 'var(--ek-text)' }}>{fmtUsd}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: '14px 0 0', fontSize: 14, fontWeight: 800, color: 'var(--ek-text)', borderTop: '1px solid var(--ek-border)' }}>{t.total}</td>
                <td style={{ padding: '14px 0 0', fontSize: 16, fontWeight: 800, textAlign: 'right', fontFamily: 'var(--ek-font-mono)', color: 'var(--ek-text)', borderTop: '1px solid var(--ek-border)' }}>{fmtUsd}</td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--ek-border)', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--ek-text-soft)' }}>{t.thanks}</span>
            <span style={{ ...label }}>{t.paidVia}</span>
          </div>
        </div>

        <ReceiptActions
          backHref={`/${lang}/dashboard/configuracion`}
          printLabel={t.print}
          backLabel={t.backToBilling}
        />
      </div>
    </div>
  )
}

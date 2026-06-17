'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/i18n/translations'
import { runWeeklyPayoutSweep, markTeacherPayoutPaid, cancelTeacherPayout } from '../actions'

interface Ready { teacherId: string; name: string | null; veemEmail: string | null; availableUsd: number }
interface Payout {
  id: string
  teacherName: string | null
  veemEmail: string | null
  amountUsd: number
  status: string
  createdAt: string
  paidAt: string | null
  note: string | null
}

interface Props { lang: Locale; ready: Ready[]; payouts: Payout[] }

const STR = {
  en: {
    kicker: '↳ Admin · Finance',
    title: 'Payouts',
    sub: 'Run the weekly sweep, then pay each teacher in Veem and mark it paid.',
    readyTitle: 'Ready to pay out',
    readyEmpty: 'Nothing ready to sweep right now.',
    runSweep: 'Run weekly sweep',
    sweeping: 'Sweeping…',
    teachersReady: (n: number, usd: string) => `${n} ${n === 1 ? 'teacher' : 'teachers'} · ${usd} ready`,
    pendingTitle: 'Pending payouts',
    pendingHint: 'Send each amount to the teacher’s Veem, then mark it paid.',
    pendingEmpty: 'No pending payouts.',
    historyTitle: 'History',
    historyEmpty: 'No payouts yet.',
    thTeacher: 'Teacher', thVeem: 'Veem email', thAmount: 'Amount', thWhen: 'Created', thPaid: 'Paid', thStatus: 'Status', thActions: '',
    markPaid: 'Mark paid', confirm: 'Confirm', cancel: 'Cancel', cancelPayout: 'Cancel', confirmCancel: 'Cancel payout?', keep: 'Keep',
    sweptToast: (n: number, usd: string) => `${n} payout${n === 1 ? '' : 's'} created (${usd}).`,
    sweepErr: (n: number) => `${n} payout${n === 1 ? '' : 's'} failed — review and retry.`,
    nothingToast: 'Nothing to sweep — no available balances.',
    paidToast: 'Marked as paid.',
    cancelledToast: 'Payout cancelled.',
    error: 'Something went wrong.',
    statusPending: 'Pending', statusPaid: 'Paid', statusCancelled: 'Cancelled',
  },
  es: {
    kicker: '↳ Admin · Finanzas',
    title: 'Pagos',
    sub: 'Ejecuta el barrido semanal, luego paga a cada maestro en Veem y márcalo como pagado.',
    readyTitle: 'Listo para pagar',
    readyEmpty: 'Nada listo para barrer por ahora.',
    runSweep: 'Ejecutar barrido semanal',
    sweeping: 'Barriendo…',
    teachersReady: (n: number, usd: string) => `${n} ${n === 1 ? 'maestro' : 'maestros'} · ${usd} listos`,
    pendingTitle: 'Pagos pendientes',
    pendingHint: 'Envía cada monto al Veem del maestro y luego márcalo como pagado.',
    pendingEmpty: 'No hay pagos pendientes.',
    historyTitle: 'Historial',
    historyEmpty: 'Aún no hay pagos.',
    thTeacher: 'Maestro', thVeem: 'Correo Veem', thAmount: 'Monto', thWhen: 'Creado', thPaid: 'Pagado', thStatus: 'Estado', thActions: '',
    markPaid: 'Marcar pagado', confirm: 'Confirmar', cancel: 'Cancelar', cancelPayout: 'Cancelar', confirmCancel: '¿Cancelar pago?', keep: 'Mantener',
    sweptToast: (n: number, usd: string) => `${n} pago${n === 1 ? '' : 's'} creado${n === 1 ? '' : 's'} (${usd}).`,
    sweepErr: (n: number) => `${n} pago${n === 1 ? '' : 's'} fallaron — revisa y reintenta.`,
    nothingToast: 'Nada que barrer — sin saldos disponibles.',
    paidToast: 'Marcado como pagado.',
    cancelledToast: 'Pago cancelado.',
    error: 'Algo salió mal.',
    statusPending: 'Pendiente', statusPaid: 'Pagado', statusCancelled: 'Cancelado',
  },
}

export default function PayoutsClient({ lang, ready, payouts }: Props) {
  const tx = STR[lang === 'es' ? 'es' : 'en']
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const DLOC = lang === 'es' ? 'es-HN' : 'en-US'
  // Pin BOTH min+max fraction digits so the admin queue/preview/history shows the
  // same cents as the teacher dashboard ($5.50, not $5.5) — they must reconcile.
  const usd = (n: number) => new Intl.NumberFormat(DLOC, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(DLOC, { timeZone: 'America/Tegucigalpa', month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const pending = payouts.filter(p => p.status === 'pending')
  const history = payouts.filter(p => p.status !== 'pending')
  const readyTotal = ready.reduce((s, r) => s + r.availableUsd, 0)

  function runSweep() {
    startTransition(async () => {
      try {
        const res = await runWeeklyPayoutSweep()
        if (res.errors && res.errors.length > 0) flash(tx.sweepErr(res.errors.length))
        else flash(res.created > 0 ? tx.sweptToast(res.created, usd(res.totalUsd)) : tx.nothingToast)
        router.refresh()
      } catch { flash(tx.error) }
    })
  }
  function markPaid(id: string) {
    startTransition(async () => {
      try {
        const res = await markTeacherPayoutPaid(id)
        if (res && !res.ok) { flash(res.error || tx.error); return }
        setConfirmId(null); flash(tx.paidToast); router.refresh()
      } catch { flash(tx.error) }
    })
  }
  function cancel(id: string) {
    startTransition(async () => {
      try {
        const res = await cancelTeacherPayout(id)
        if (res && !res.ok) { flash(res.error || tx.error); return }
        setConfirmCancelId(null); flash(tx.cancelledToast); router.refresh()
      } catch { flash(tx.error) }
    })
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', borderBottom: '1px solid var(--ek-border)' }
  const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: 'var(--ek-text)', borderBottom: '1px solid var(--ek-border-soft)' }
  const card: React.CSSProperties = { background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)', overflow: 'hidden' }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: 'var(--ek-ink)', color: '#fff', padding: '12px 18px', borderRadius: 'var(--ek-radius-md)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--ek-font-sans)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)' }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ek-text-muted)', marginBottom: 6 }}>{tx.kicker}</div>
        <h1 style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ek-text)', margin: 0, lineHeight: 1.1 }}>{tx.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: '6px 0 0' }}>{tx.sub}</p>
      </div>

      {/* Ready to pay out + run sweep */}
      <section style={{ ...card, marginBottom: 24, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{tx.readyTitle}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)', marginTop: 5 }}>
              {ready.length === 0 ? tx.readyEmpty : tx.teachersReady(ready.length, usd(readyTotal))}
            </div>
          </div>
          <button onClick={runSweep} disabled={isPending || ready.length === 0} className="ek-btn ek-btn-primary ek-btn-square" style={{ padding: '11px 20px', fontSize: 13, opacity: (isPending || ready.length === 0) ? 0.55 : 1 }}>
            {isPending ? tx.sweeping : tx.runSweep}
          </button>
        </div>
        {ready.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ready.map(r => (
              <div key={r.teacherId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--ek-border-soft)' }}>
                <span style={{ fontWeight: 600, color: 'var(--ek-text)' }}>{r.name || '—'}</span>
                <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 12, color: 'var(--ek-text-muted)', flex: 1, textAlign: 'left', marginLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.veemEmail}</span>
                <span style={{ fontWeight: 700, color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}>{usd(r.availableUsd)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending payouts */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ek-text)', margin: '0 0 4px' }}>{tx.pendingTitle}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ek-text-muted)', margin: '0 0 12px' }}>{tx.pendingHint}</p>
        {/* Desktop / tablet: horizontally-scrollable table */}
        <div className="hidden sm:block" style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr>{[tx.thTeacher, tx.thVeem, tx.thAmount, tx.thWhen, tx.thActions].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}>{tx.pendingEmpty}</td></tr>
                ) : pending.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{p.teacherName || '—'}</td>
                    <td style={{ ...td, fontFamily: 'var(--ek-font-mono)', fontSize: 12, color: 'var(--ek-text-soft)' }}>{p.veemEmail || '—'}</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}>{usd(p.amountUsd)}</td>
                    <td style={{ ...td, color: 'var(--ek-text-soft)' }}>{fmtDate(p.createdAt)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {confirmId === p.id ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => markPaid(p.id)} disabled={isPending} className="ek-btn ek-btn-primary ek-btn-square" style={{ padding: '10px 14px', minHeight: 40, fontSize: 12 }}>{tx.confirm}</button>
                          <button onClick={() => setConfirmId(null)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '10px 14px', minHeight: 40, fontSize: 12 }}>{tx.cancel}</button>
                        </span>
                      ) : confirmCancelId === p.id ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginRight: 2 }}>{tx.confirmCancel}</span>
                          <button onClick={() => cancel(p.id)} disabled={isPending} className="ek-btn ek-btn-square" style={{ padding: '10px 14px', minHeight: 40, fontSize: 12, background: 'var(--ek-red)', color: '#fff' }}>{tx.cancelPayout}</button>
                          <button onClick={() => setConfirmCancelId(null)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '10px 14px', minHeight: 40, fontSize: 12 }}>{tx.keep}</button>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => { setConfirmCancelId(null); setConfirmId(p.id) }} className="ek-btn ek-btn-primary ek-btn-square" style={{ padding: '10px 14px', minHeight: 40, fontSize: 12 }}>{tx.markPaid}</button>
                          <button onClick={() => { setConfirmId(null); setConfirmCancelId(p.id) }} className="ek-btn ek-btn-ghost ek-btn-square" style={{ padding: '10px 14px', minHeight: 40, fontSize: 12, color: 'var(--ek-text-muted)' }}>{tx.cancelPayout}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phone: stacked cards so the primary Mark-paid action is never hidden off-screen */}
        <div className="sm:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.length === 0 ? (
            <div style={{ ...card, padding: '24px 18px', textAlign: 'center', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 13 }}>{tx.pendingEmpty}</div>
          ) : pending.map(p => (
            <div key={p.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>{p.teacherName || '—'}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-red)', fontFeatureSettings: '"tnum"' }}>{usd(p.amountUsd)}</span>
              </div>
              <div style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 12, color: 'var(--ek-text-soft)', marginTop: 4, overflowWrap: 'anywhere' }}>{p.veemEmail || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 2 }}>{fmtDate(p.createdAt)}</div>
              {confirmCancelId === p.id && (
                <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 12 }}>{tx.confirmCancel}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {confirmId === p.id ? (
                  <>
                    <button onClick={() => markPaid(p.id)} disabled={isPending} className="ek-btn ek-btn-primary ek-btn-square" style={{ flex: 1, padding: '12px 14px', minHeight: 44, fontSize: 13, justifyContent: 'center' }}>{tx.confirm}</button>
                    <button onClick={() => setConfirmId(null)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, padding: '12px 14px', minHeight: 44, fontSize: 13, justifyContent: 'center' }}>{tx.cancel}</button>
                  </>
                ) : confirmCancelId === p.id ? (
                  <>
                    <button onClick={() => cancel(p.id)} disabled={isPending} className="ek-btn ek-btn-square" style={{ flex: 1, padding: '12px 14px', minHeight: 44, fontSize: 13, justifyContent: 'center', background: 'var(--ek-red)', color: '#fff' }}>{tx.cancelPayout}</button>
                    <button onClick={() => setConfirmCancelId(null)} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, padding: '12px 14px', minHeight: 44, fontSize: 13, justifyContent: 'center' }}>{tx.keep}</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setConfirmCancelId(null); setConfirmId(p.id) }} className="ek-btn ek-btn-primary ek-btn-square" style={{ flex: 1, padding: '12px 14px', minHeight: 44, fontSize: 13, justifyContent: 'center' }}>{tx.markPaid}</button>
                    <button onClick={() => { setConfirmId(null); setConfirmCancelId(p.id) }} className="ek-btn ek-btn-ghost ek-btn-square" style={{ flex: 1, padding: '12px 14px', minHeight: 44, fontSize: 13, justifyContent: 'center', color: 'var(--ek-text-muted)' }}>{tx.cancelPayout}</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ek-text)', margin: '0 0 12px' }}>{tx.historyTitle}</h2>
        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
              <thead><tr>{[tx.thTeacher, tx.thAmount, tx.thStatus, tx.thPaid].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}>{tx.historyEmpty}</td></tr>
                ) : history.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{p.teacherName || '—'}</td>
                    <td style={{ ...td, fontWeight: 700, fontFeatureSettings: '"tnum"' }}>{usd(p.amountUsd)}</td>
                    <td style={{ ...td, fontFamily: 'var(--ek-font-mono)', fontSize: 12, color: p.status === 'paid' ? 'var(--ek-text)' : 'var(--ek-text-muted)' }}>{p.status === 'paid' ? tx.statusPaid : tx.statusCancelled}</td>
                    <td style={{ ...td, color: 'var(--ek-text-soft)' }}>{fmtDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { updateTeacherProfile } from '@/app/actions/profile'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { Spinner } from '@/components/ui/Spinner'

const t = {
  en: {
    title: 'Settings',
    subtitle: 'Manage your teacher profile.',
    sectionProfile: 'Profile',
    sectionAccount: 'Account',
    fullName: 'Full name',
    bio: 'Bio',
    specializations: 'Specializations',
    specializationsHint: 'Comma-separated (e.g. Business English, IELTS, Pronunciation)',
    specializationsPlaceholder: 'Business English, IELTS, Pronunciation',
    email: 'Email address',
    emailReadOnly: 'Email cannot be changed.',
    changePassword: 'Change password',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Changes saved',
    namePlaceholder: 'Your full name',
    bioPlaceholder: 'Tell students about yourself, your teaching style, and experience...',
  },
  es: {
    title: 'Configuración',
    subtitle: 'Administra tu perfil de maestro.',
    sectionProfile: 'Perfil',
    sectionAccount: 'Cuenta',
    fullName: 'Nombre completo',
    bio: 'Biografía',
    specializations: 'Especializaciones',
    specializationsHint: 'Separadas por comas (ej. Business English, IELTS, Pronunciación)',
    specializationsPlaceholder: 'Business English, IELTS, Pronunciación',
    email: 'Correo electrónico',
    emailReadOnly: 'El correo no se puede cambiar.',
    changePassword: 'Cambiar contraseña',
    save: 'Guardar cambios',
    saving: 'Guardando…',
    saved: 'Cambios guardados',
    namePlaceholder: 'Tu nombre completo',
    bioPlaceholder: 'Cuéntales a los estudiantes sobre ti, tu estilo de enseñanza y experiencia...',
  },
}

interface Props {
  lang: Locale
  fullName: string
  bio: string
  specializations: string
  email: string
}

export default function ConfigTeacherClient({ lang, fullName, bio, specializations, email }: Props) {
  const tx = t[lang]
  const [name, setName] = useState(fullName)
  const [bioVal, setBioVal] = useState(bio)
  const [specsVal, setSpecsVal] = useState(specializations)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const result = await updateTeacherProfile({ fullName: name, bio: bioVal, specializations: specsVal })
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setSaveError(result.error || 'Error al guardar')
      }
    } catch {
      setSaveError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--ek-radius-xs)',
    fontSize: '13px',
    color: 'var(--ek-text)',
    background: 'var(--ek-card)',
  } as React.CSSProperties

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
  } as React.CSSProperties

  const hintStyle = {
    fontSize: '11px',
    marginTop: '6px',
    color: 'var(--ek-text-muted)',
  } as React.CSSProperties

  return (
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>

      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div className="px-8 py-6 max-w-xl mx-auto">

        {/* Profile section — editorial: kicker + hairline rule, no boxed card */}
        <section>
          <div
            className="ek-microlabel"
            style={{ color: 'var(--ek-red)', paddingBottom: 12, borderBottom: '1px solid var(--ek-border)' }}
          >
            {tx.sectionProfile}
          </div>

          <div className="space-y-4" style={{ paddingTop: 18 }}>
            {/* Full name */}
            <div>
              <label className="ek-microlabel" style={labelStyle}>{tx.fullName}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tx.namePlaceholder}
                className="ek-input"
                style={inputStyle}
              />
            </div>

            {/* Bio */}
            <div>
              <label className="ek-microlabel" style={labelStyle}>{tx.bio}</label>
              <textarea
                value={bioVal}
                onChange={e => setBioVal(e.target.value)}
                placeholder={tx.bioPlaceholder}
                rows={4}
                className="ek-input"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              />
            </div>

            {/* Specializations */}
            <div>
              <label className="ek-microlabel" style={labelStyle}>{tx.specializations}</label>
              <input
                type="text"
                value={specsVal}
                onChange={e => setSpecsVal(e.target.value)}
                placeholder={tx.specializationsPlaceholder}
                className="ek-input"
                style={inputStyle}
              />
              <p style={hintStyle}>{tx.specializationsHint}</p>
            </div>
          </div>
        </section>

        {/* Account section */}
        <section style={{ marginTop: 36 }}>
          <div
            className="ek-microlabel"
            style={{ color: 'var(--ek-red)', paddingBottom: 12, borderBottom: '1px solid var(--ek-border)' }}
          >
            {tx.sectionAccount}
          </div>

          <div className="space-y-4" style={{ paddingTop: 18 }}>
            {/* Email read-only */}
            <div>
              <label className="ek-microlabel" style={labelStyle}>{tx.email}</label>
              <input
                type="email"
                value={email}
                readOnly
                className="ek-input"
                style={{ ...inputStyle, background: 'var(--ek-paper)', color: 'var(--ek-text-muted)', cursor: 'not-allowed' }}
              />
              <p style={hintStyle}>{tx.emailReadOnly}</p>
            </div>

            {/* Change password */}
            <div>
              <Link
                href={`/${lang}/login/reset`}
                className="ek-link-danger text-[13px] font-semibold"
                style={{ color: 'var(--ek-text-soft)', textDecoration: 'none' }}
              >
                {tx.changePassword}
              </Link>
            </div>
          </div>
        </section>

        {/* Save error */}
        {saveError && (
          <p className="text-[12px] text-right" style={{ color: 'var(--ek-red)', marginTop: 20 }}>{saveError}</p>
        )}

        {/* Save button */}
        <div className="flex justify-end" style={{ marginTop: 28 }}>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={saved ? 'px-6 py-2.5 text-[13px] font-semibold' : 'ek-red-btn px-6 py-2.5 text-[13px] font-semibold'}
            style={
              saved
                ? {
                    background: 'var(--ek-red-tint)',
                    color: 'var(--ek-red)',
                    borderRadius: 'var(--ek-radius-xs)',
                    cursor: 'default',
                  }
                : {
                    background: 'var(--ek-red)',
                    color: '#fff',
                    borderRadius: 'var(--ek-radius-xs)',
                    cursor: saving ? 'wait' : 'pointer',
                  }
            }
          >
            {saved ? (
              tx.saved
            ) : saving ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner size={14} stroke="#fff" />
                {tx.saving}
              </span>
            ) : (
              tx.save
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

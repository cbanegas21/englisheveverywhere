'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Mail, Lock, FileText, Tag, CheckCircle2 } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { updateTeacherProfile } from '@/app/actions/profile'

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
    email: 'Email address',
    emailReadOnly: 'Email cannot be changed.',
    changePassword: 'Change password',
    save: 'Save changes',
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
    email: 'Correo electrónico',
    emailReadOnly: 'El correo no se puede cambiar.',
    changePassword: 'Cambiar contraseña',
    save: 'Guardar cambios',
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
    borderRadius: '4px',
    border: '1px solid #E5E7EB',
    fontSize: '13px',
    color: '#111111',
    background: '#fff',
    outline: 'none',
  } as React.CSSProperties

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#9CA3AF',
    marginBottom: '6px',
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-xl mx-auto space-y-5">

        {/* Profile section */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="px-5 py-3" style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                {tx.sectionProfile}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Full name */}
            <div>
              <label style={labelStyle}>{tx.fullName}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tx.namePlaceholder}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* Bio */}
            <div>
              <label style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  {tx.bio}
                </span>
              </label>
              <textarea
                value={bioVal}
                onChange={e => setBioVal(e.target.value)}
                placeholder={tx.bioPlaceholder}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* Specializations */}
            <div>
              <label style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  {tx.specializations}
                </span>
              </label>
              <input
                type="text"
                value={specsVal}
                onChange={e => setSpecsVal(e.target.value)}
                placeholder="Business English, IELTS, Pronunciation"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
              <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>{tx.specializationsHint}</p>
            </div>
          </div>
        </div>

        {/* Account section */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="px-5 py-3" style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                {tx.sectionAccount}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Email read-only */}
            <div>
              <label style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  {tx.email}
                </span>
              </label>
              <input
                type="email"
                value={email}
                readOnly
                style={{ ...inputStyle, background: '#F9F9F9', color: '#9CA3AF', cursor: 'not-allowed' }}
              />
              <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>{tx.emailReadOnly}</p>
            </div>

            {/* Change password */}
            <div>
              <Link
                href={`/${lang}/login/reset`}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors"
                style={{ color: '#C41E3A' }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9E1830')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#C41E3A')}
              >
                <Lock className="h-3.5 w-3.5" />
                {tx.changePassword}
              </Link>
            </div>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <p className="text-[12px] text-right" style={{ color: '#C41E3A' }}>{saveError}</p>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 px-6 py-2.5 rounded text-[13px] font-semibold transition-all"
            style={
              saved
                ? { background: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC', cursor: 'default' }
                : { background: '#C41E3A', color: '#fff', cursor: saving ? 'wait' : 'pointer' }
            }
            onMouseEnter={e => {
              if (!saved && !saving) (e.currentTarget as HTMLButtonElement).style.background = '#9E1830'
            }}
            onMouseLeave={e => {
              if (!saved && !saving) (e.currentTarget as HTMLButtonElement).style.background = '#C41E3A'
            }}
          >
            {saved && <CheckCircle2 className="h-4 w-4" />}
            {saved ? tx.saved : saving ? '...' : tx.save}
          </button>
        </div>
      </div>
    </div>
  )
}

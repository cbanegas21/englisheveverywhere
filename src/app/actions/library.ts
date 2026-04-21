'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'books'
const SIGNED_URL_TTL_SECONDS = 900 // 15 min

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Admin only' as const }
  return { admin: createAdminClient(), userId: user.id }
}

async function requireAuthed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { admin: createAdminClient(), userId: user.id }
}

export async function uploadBook(formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { admin } = ctx

  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim() || ''
  const description = (formData.get('description') as string | null)?.trim() || ''
  const level = (formData.get('level') as string | null) || null

  if (!file || file.size === 0) return { error: 'File is required' }
  if (!title) return { error: 'Title is required' }
  if (file.type !== 'application/pdf') return { error: 'Only PDF files are supported' }
  if (file.size > 40 * 1024 * 1024) return { error: 'File exceeds 40 MB limit' }

  const safeSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const storagePath = `${Date.now()}-${safeSlug}.pdf`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (uploadErr) return { error: uploadErr.message }

  const { error: insertErr } = await admin.from('library_books').insert({
    title,
    description,
    level: level && level !== '' ? level : null,
    storage_path: storagePath,
    is_active: true,
  })
  if (insertErr) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return { error: insertErr.message }
  }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function setBookActive(bookId: string, active: boolean) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { admin } = ctx

  const { error } = await admin
    .from('library_books')
    .update({ is_active: active })
    .eq('id', bookId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

export async function deleteBook(bookId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { admin } = ctx

  const { data: book } = await admin
    .from('library_books')
    .select('storage_path')
    .eq('id', bookId)
    .single()
  if (!book) return { error: 'Book not found' }

  await admin.storage.from(BUCKET).remove([book.storage_path])

  const { error } = await admin.from('library_books').delete().eq('id', bookId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Any authenticated user can request a signed URL for an active book.
// Returned URL is valid for 15 min and scoped to the underlying object.
export async function getBookSignedUrl(bookId: string) {
  const ctx = await requireAuthed()
  if ('error' in ctx) return { error: ctx.error }
  const { admin } = ctx

  const { data: book } = await admin
    .from('library_books')
    .select('storage_path, is_active')
    .eq('id', bookId)
    .single()
  if (!book || !book.is_active) return { error: 'Book not available' }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(book.storage_path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) return { error: error?.message || 'Could not generate URL' }

  return { success: true as const, url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }
}

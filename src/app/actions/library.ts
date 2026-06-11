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
  // Server-side length caps (LIB-06) — the client textareas are advisory only.
  if (title.length > 120) return { error: 'Title is too long (max 120 characters)' }
  if (description.length > 1000) return { error: 'Description is too long (max 1000 characters)' }
  if (file.type !== 'application/pdf') return { error: 'Only PDF files are supported' }
  if (file.size > 40 * 1024 * 1024) return { error: 'File exceeds 40 MB limit' }

  const safeSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const storagePath = `${Date.now()}-${safeSlug}.pdf`

  const buffer = Buffer.from(await file.arrayBuffer())
  // Magic-byte check (LIB-03) — don't trust the client-supplied file.type alone.
  // Conforming readers scan ~the first 1KB for the "%PDF-" signature (a leading
  // BOM/whitespace is tolerated), so match that rather than requiring offset 0.
  if (buffer.subarray(0, 1024).indexOf(Buffer.from('%PDF-')) === -1) {
    return { error: 'File does not look like a valid PDF' }
  }
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

  const { data, error } = await admin
    .from('library_books')
    .update({ is_active: active })
    .eq('id', bookId)
    .select('id')
  if (error) return { error: error.message }
  // Zero rows changed = no such book (LIB-04) — don't report success on a no-op.
  if (!data || data.length === 0) return { error: 'Book not found' }

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

  // Delete the catalog row FIRST (LIB-01). If we removed the storage object first
  // and the row delete then failed, the catalog would point at a missing file and
  // every reader would 404. A failed object delete here only orphans a file.
  const { error } = await admin.from('library_books').delete().eq('id', bookId)
  if (error) return { error: error.message }

  const { error: rmErr } = await admin.storage.from(BUCKET).remove([book.storage_path])
  if (rmErr) console.error('deleteBook: failed to remove storage object', book.storage_path, rmErr.message)

  revalidatePath('/', 'layout')
  return { success: true as const }
}

// Library is COMING SOON — the plan is in-platform INTERACTIVE books (not file
// downloads), so books must not be openable/downloadable yet. Hard-gate here
// (defense-in-depth) so a signed URL can't be minted even by a direct call.
// Flip LIBRARY_ENABLED to true when the real feature ships.
const LIBRARY_ENABLED: boolean = false

// Any authenticated user can request a signed URL for an active book.
// Returned URL is valid for 15 min and scoped to the underlying object.
export async function getBookSignedUrl(bookId: string) {
  if (!LIBRARY_ENABLED) return { error: 'The library is coming soon.' }
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

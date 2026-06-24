// Shared file-upload constants + validation for The Lab file features (the
// teacher folder in lab.ts and assignment attachments in assignments.ts). One
// source of truth so the security-sensitive content-type allowlist + magic-byte
// check can't drift between the two callers. Server-only by usage (imported only
// from 'use server' action files).

export const LAB_FILES_BUCKET = 'lab-files'
export const FILE_URL_TTL = 900 // 15 min signed URL
export const MAX_FILE_BYTES = 25 * 1024 * 1024

// Allowlisted content types for shareable teacher/student resources.
export const ALLOWED_FILE_TYPES = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/plain',
])

// Defense-in-depth (the LIB-03 lesson): file.type is client-controlled, so verify
// the bytes match the claimed type for the formats with a reliable signature.
// Office docs are zip containers (PK\x03\x04). Types without a single reliable
// magic number (audio/video/plain text) are allowed through — none of them render
// as executable HTML when served inline from the private bucket.
export function magicMatches(buf: Buffer, type: string): boolean {
  const at = (sig: number[], offset = 0) => sig.every((b, i) => buf[offset + i] === b)
  switch (type) {
    case 'application/pdf':
      return buf.subarray(0, 1024).indexOf(Buffer.from('%PDF-')) !== -1
    case 'image/png':
      return at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/jpeg':
      return at([0xff, 0xd8, 0xff])
    case 'image/gif':
      return at([0x47, 0x49, 0x46, 0x38]) // 'GIF8'
    case 'image/webp':
      return at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8) // 'RIFF'…'WEBP'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return at([0x50, 0x4b, 0x03, 0x04]) // zip header
    default:
      return true
  }
}

// Returns an error code (caller localizes) or null if the file is acceptable.
export function checkUpload(file: unknown): 'fileRequired' | 'fileTooLarge' | 'fileType' | null {
  if (!(file instanceof File) || file.size === 0) return 'fileRequired'
  if (file.size > MAX_FILE_BYTES) return 'fileTooLarge'
  const ct = file.type || 'application/octet-stream'
  if (!ALLOWED_FILE_TYPES.has(ct)) return 'fileType'
  return null
}

export function safeSlug(name: string): string {
  return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'archivo'
}
export function safeExt(fileName: string): string {
  return (fileName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

/** Delete the temp AD-03 screenshot bookings. Run: node --env-file=.env.local scripts/qa-unseed-calendar.mjs */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ids = JSON.parse(readFileSync(join(tmpdir(), 'ad03-shots', 'seeded-ids.json'), 'utf8'))
const { error } = await sb.from('bookings').delete().in('id', ids)
if (error) { console.error('delete failed:', error.message); process.exit(1) }
console.log(`deleted ${ids.length} temp bookings:`, ids.join(', '))
// Safety net: nuke anything still tagged as a temp AD-03 row.
const { data: leftover } = await sb.from('bookings').select('id').like('meeting_notes', '[AD-03 temp]%')
if (leftover && leftover.length) {
  await sb.from('bookings').delete().like('meeting_notes', '[AD-03 temp]%')
  console.log(`also removed ${leftover.length} leftover [AD-03 temp] rows`)
}
const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true })
console.log('bookings remaining in DB:', count)

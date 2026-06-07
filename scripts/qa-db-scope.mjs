// Read-only: count every table + list profiles + sample transactional rows,
// so we can scope a safe "fresh start" cleanup. Touches nothing.
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const tables = ['profiles','students','teachers','bookings','sessions','assignments','assignment_submissions','payments','subscriptions','reschedule_requests','availability_slots','library_books','plans','processed_stripe_events','auth_attempts']
console.log('=== ROW COUNTS ===')
for (const t of tables) {
  const { count, error } = await sb.from(t).select('id', { count: 'exact', head: true })
  console.log(`${t}: ${error ? 'ERR ' + error.message : count}`)
}

console.log('\n=== PROFILES (all) ===')
const { data: profs } = await sb.from('profiles').select('email, full_name, role, created_at').order('created_at', { ascending: true })
for (const p of (profs || [])) console.log(`${p.role}\t${p.full_name}\t<${p.email}>\t${p.created_at?.slice(0,10)}`)

console.log('\n=== PAYMENTS sample ===')
const { data: pays } = await sb.from('payments').select('*').limit(5)
console.log(JSON.stringify(pays))

console.log('\n=== SUBSCRIPTIONS sample ===')
const { data: subs } = await sb.from('subscriptions').select('*').limit(5)
console.log(JSON.stringify(subs))

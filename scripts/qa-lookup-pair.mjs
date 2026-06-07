// Look up the student + teacher for a test booking. Read-only.
// node --env-file=.env.local scripts/qa-lookup-pair.mjs
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: stuProf } = await sb.from('profiles').select('id, email, full_name, role, timezone').eq('email', 'carlos_paz2020@outlook.com').single()
console.log('STUDENT profile:', JSON.stringify(stuProf))
if (stuProf) {
  const { data: stu } = await sb.from('students').select('id, classes_remaining').eq('profile_id', stuProf.id).single()
  console.log('STUDENT students.id:', JSON.stringify(stu))
}

console.log('--- teacher search "lecparos" / "lesly" ---')
const { data: tmatch } = await sb.from('profiles').select('id, email, full_name, role, timezone')
  .or('email.ilike.%lecpar%,full_name.ilike.%lecpar%,email.ilike.%lesly%,full_name.ilike.%lesly%')
console.log('matches:', JSON.stringify(tmatch))

console.log('--- all teachers ---')
const { data: teachers } = await sb.from('teachers').select('id, profile_id, is_active')
for (const t of (teachers || [])) {
  const { data: p } = await sb.from('profiles').select('email, full_name').eq('id', t.profile_id).single()
  console.log(`teacher.id=${t.id} active=${t.is_active} :: ${p?.full_name} <${p?.email}>`)
}

console.log('--- now ---')
console.log('UTC now:', new Date().toISOString())

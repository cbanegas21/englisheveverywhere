// Screen-share-WITH-AUDIO suite (feat/screen-share-audio) — runs against a LOCAL
// dev server (http://localhost:3000) because the new control lives on this branch,
// not on PROD yet. Drives two REAL LiveKit participants (real creds in .env.local)
// and exercises the new ShareScreenMenu + the share/stop refactor end to end:
//   - Share button opens the menu; audio toggle defaults ON
//   - "Start sharing" publishes a screen-share VIDEO track the peer renders
//   - the "Audio" badge appears when a ScreenShareAudio track is live (best-effort:
//     the fake-media harness may not synthesize display audio — that case is the
//     manual leg, a real Windows-Chrome PowerPoint share)
//   - "Stop sharing" tears the share down on both sides
// No End-Class step → no payment/session rows; only a throwaway booking, cleaned up.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const BASE=process.env.QA_BASE||'http://localhost:3000'
const SUPA=process.env.NEXT_PUBLIC_SUPABASE_URL,TOK=process.env.SUPABASE_ACCESS_TOKEN
const REF=(SUPA||'').match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
async function sql(q){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${TOK}`,'Content-Type':'application/json'},body:JSON.stringify({query:q})});if(!r.ok){console.log('SQLERR',await r.text());return null}return r.json()}
const TEACHER={tid:'b4c78cf4-5b23-412a-bd2b-997b136d8fa2',email:'teacher@englishkolab.com',pass:'Teacher2026!'}
const STUDENT={sid:'148fc1e7-40c7-476b-9ba1-64ca8cfce23e',email:'student@englishkolab.com',pass:'Student2026!'}
const iso=mins=>new Date(Date.now()+mins*60000).toISOString()
// getDisplayMedia needs the fake UI to auto-accept AND a fake desktop source picked
// for us; --auto-select-desktop-capture-source="Entire screen" maps to a system-audio
// eligible surface so {audio:true} can attach a fake audio track where supported.
const b=await chromium.launch({args:[
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--auto-select-desktop-capture-source=Entire screen',
  '--autoplay-policy=no-user-gesture-required',
]})
async function joinRoom(email,pass,id){
  const ctx=await b.newContext({viewport:{width:1280,height:900},permissions:['microphone','camera']})
  const p=await ctx.newPage()
  await p.goto(`${BASE}/es/login`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(700)
  await p.fill('input[name="email"]',email);await p.fill('input[name="password"]',pass)
  await p.getByRole('button',{name:/^(ingresar|iniciar sesión)$/i}).click();await p.waitForTimeout(3500)
  await p.goto(`${BASE}/es/sala/${id}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(6000)
  return {ctx,p}
}
const R=[];const ok=(n,c,d='')=>{R.push([c,n,d]);console.log(`${c?'✅':'❌'} ${n}${d?'  — '+d:''}`)}
const info=(n,d='')=>{console.log(`ℹ️  ${n}${d?'  — '+d:''}`)}
// Poll a page's body for a regex (present=true) or its absence (present=false),
// up to ms. Robust against cold-dev JIT compile / LiveKit subscribe latency.
async function waitBody(p,re,{present=true,ms=25000,step=1000}={}){
  const end=Date.now()+ms
  while(Date.now()<end){const b=(await p.locator('body').textContent())||'';if(re.test(b)===present)return true;await p.waitForTimeout(step)}
  return false
}
let id,T,S
try{
  id=(await sql(`insert into bookings (student_id, teacher_id, scheduled_at, type, status, duration_minutes) values ('${STUDENT.sid}','${TEACHER.tid}','${iso(-2)}','class','confirmed',60) returning id`))?.[0]?.id
  if(!id)throw new Error('booking insert failed (check SUPABASE_ACCESS_TOKEN)')
  S=await joinRoom(STUDENT.email,STUDENT.pass,id)
  T=await joinRoom(TEACHER.email,TEACHER.pass,id)

  // Sanity: both in the room. Poll until the teacher actually sees the student
  // (peer subscription can lag on a cold dev server).
  {const peer=await waitBody(T.p,/Esperando al otro participante/i,{present:false,ms:30000})
   const tb=(await T.p.locator('body').textContent())||''
   ok('S0 both participants connected', /Terminar Clase/i.test(tb) && peer, peer?'peer present':'teacher still waiting after 30s')}

  // S1 Share button opens the menu (the new ShareScreenMenu)
  {await T.p.getByRole('button',{name:'Compartir pantalla'}).first().click();await T.p.waitForTimeout(900)
   const tb=(await T.p.locator('body').textContent())||''
   ok('S1 Share button opens the share menu', /Compartir tu pantalla/i.test(tb) && /Comenzar a compartir/i.test(tb))}

  // S2 audio toggle defaults ON
  {const sw=T.p.getByRole('switch').first()
   const checked=await sw.getAttribute('aria-checked').catch(()=>null)
   ok('S2 "Share audio" toggle defaults ON', checked==='true', `aria-checked=${checked}`)}

  // S3 Start sharing -> peer sees the screen share (the refactored start path)
  {await T.p.getByRole('button',{name:/Comenzar a compartir/i}).click();await T.p.waitForTimeout(3000)
   const teacherSharing=await waitBody(T.p,/Estás compartiendo tu pantalla/i,{ms:12000})
   const studentSees=await waitBody(S.p,/está compartiendo la pantalla/i,{ms:15000})
   ok('S3a teacher enters presenter view', teacherSharing, teacherSharing?'sharing':'NOT sharing — getDisplayMedia may have failed in this headless env')
   ok('S3b student receives the screen share', studentSees, studentSees?'received':'NOT received')}

  // S4 post-share audio-detection — the 1200ms check must produce the RIGHT signal
  // for whatever the harness gave us: if a ScreenShareAudio track landed -> the
  // "Audio" badge; if not (the usual headless case) -> the "no sound shared"
  // advisory toast. Either proves the detection path; both being absent is a bug.
  {await T.p.waitForTimeout(1800)
   const tb=(await T.p.locator('body').textContent())||''
   const sb=(await S.p.locator('body').textContent())||''
   const badge=tb.includes('Audio')||sb.includes('Audio') // capital-A pill (advisory copy is lowercase)
   const advisory=/no se compartió sonido/i.test(tb)
   ok('S4 audio-detection signals correctly (badge OR no-sound advisory)', badge||advisory, badge?'Audio badge — track is live end-to-end':(advisory?'advisory fired — no-audio detection works (real audio = manual Windows-Chrome leg)':'NEITHER — detection failed'))
   if(badge) info('S4+ fake harness DID provide display audio — full audio path proven end-to-end')}

  // S5 Stop sharing tears it down on both sides
  {await T.p.getByRole('button',{name:'Dejar de compartir'}).first().click()
   const cleared=await waitBody(S.p,/está compartiendo la pantalla/i,{present:false,ms:10000})
   ok('S5 stop sharing removes the share for the peer', cleared, cleared?'cleared':'still showing')}

  // S6 re-open menu, turn audio OFF, start, confirm no audio badge (toggle wiring)
  {await T.p.getByRole('button',{name:'Compartir pantalla'}).first().click();await T.p.waitForTimeout(800)
   await T.p.getByRole('switch').first().click();await T.p.waitForTimeout(300) // audio -> OFF
   const checked=await T.p.getByRole('switch').first().getAttribute('aria-checked').catch(()=>null)
   ok('S6a audio toggle flips to OFF', checked==='false', `aria-checked=${checked}`)
   await T.p.getByRole('button',{name:/Comenzar a compartir/i}).click();await T.p.waitForTimeout(3000)
   const studentSees=await waitBody(S.p,/está compartiendo la pantalla/i,{ms:15000})
   const sb=(await S.p.locator('body').textContent())||''
   ok('S6b audio-off share still shares video to peer', studentSees)
   ok('S6c audio-off share shows NO audio badge', !/\bAudio\b/.test(sb), /\bAudio\b/.test(sb)?'badge present (unexpected)':'no badge (correct)')
   await T.p.getByRole('button',{name:'Dejar de compartir'}).first().click().catch(()=>{})}

  const pass=R.filter(r=>r[0]).length,fail=R.filter(r=>!r[0]).length
  console.log(`\n========== SCREEN-SHARE-AUDIO SUITE: ${pass} PASS / ${fail} FAIL ==========`)
  if(fail) for(const r of R.filter(x=>!x[0])) console.log('  FAIL:',r[1],r[2])
}catch(e){console.log('SUITE ERR',e.message,e.stack)}
finally{
  if(T)await T.ctx.close();if(S)await S.ctx.close()
  if(id){await sql(`delete from payments where booking_id='${id}'`);await sql(`delete from sessions where booking_id='${id}'`);await sql(`delete from bookings where id='${id}'`)}
  await sql(`delete from auth_attempts where action='login' and attempted_at>now()-interval '40 min' and (email in ('teacher@englishkolab.com','student@englishkolab.com') or email is null)`)
  await b.close()
  console.log('=== cleanup done ===')
}

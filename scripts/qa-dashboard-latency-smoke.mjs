// Smoke test for the dashboard latency refactor (cached getUser/profile +
// Promise.all). The risk in this change is auth/guard regressions, so this drives
// the REAL login + the layout role-guards against a local dev server and asserts
// every guard still behaves. Run after `pnpm dev`. Targets localhost:3000.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const BASE=process.env.QA_BASE||'http://localhost:3000'
const TEACHER={email:'teacher@englishkolab.com',pass:'Teacher2026!'}
const STUDENT={email:'student@englishkolab.com',pass:'Student2026!'}
const b=await chromium.launch()
const R=[];const ok=(n,c,d='')=>{R.push([c,n,d]);console.log(`${c?'✅':'❌'} ${n}${d?'  — '+d:''}`)}
async function login(email,pass){
  const ctx=await b.newContext();const p=await ctx.newPage()
  await p.goto(`${BASE}/es/login`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(800)
  await p.fill('input[name="email"]',email);await p.fill('input[name="password"]',pass)
  await p.getByRole('button',{name:/^(ingresar|iniciar sesión)$/i}).click();await p.waitForTimeout(3500)
  return {ctx,p}
}
async function go(p,path){await p.goto(`${BASE}${path}`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);return new URL(p.url()).pathname}
const hasError=async p=>/Application error|Internal Server Error|something went wrong|Server Components render/i.test((await p.locator('body').textContent())||'')
let S,T,A
try{
  // ── Student ──────────────────────────────────────────────────────────────
  S=await login(STUDENT.email,STUDENT.pass)
  {const path=await go(S.p,'/es/dashboard')
   ok('STUDENT /dashboard authenticated (not bounced to /login)', !/\/login/.test(path), `landed ${path}`)
   ok('STUDENT /dashboard renders without error overlay', !(await hasError(S.p)))}
  {const path=await go(S.p,'/es/maestro/dashboard')
   ok('STUDENT blocked from /maestro/dashboard (role guard via cached profile)', !/\/maestro\/dashboard$/.test(path), `landed ${path}`)}

  // ── Teacher ──────────────────────────────────────────────────────────────
  T=await login(TEACHER.email,TEACHER.pass)
  {const path=await go(T.p,'/es/maestro/dashboard')
   ok('TEACHER /maestro/dashboard authenticated (not bounced to /login)', !/\/login/.test(path), `landed ${path}`)
   ok('TEACHER /maestro/dashboard renders without error overlay', !(await hasError(T.p)))}
  {const path=await go(T.p,'/es/dashboard')
   ok('TEACHER redirected away from student /dashboard (role guard)', !/\/dashboard$/.test(path)||/\/maestro/.test(path), `landed ${path}`)}

  // ── Anonymous ────────────────────────────────────────────────────────────
  A=await b.newContext().then(c=>c.newPage())
  {const path=await go(A,'/es/dashboard')
   ok('ANON /dashboard bounced to /login (auth guard)', /\/login/.test(path), `landed ${path}`)}

  const pass=R.filter(r=>r[0]).length,fail=R.filter(r=>!r[0]).length
  console.log(`\n========== DASHBOARD LATENCY SMOKE: ${pass} PASS / ${fail} FAIL ==========`)
  if(fail) for(const r of R.filter(x=>!x[0])) console.log('  FAIL:',r[1],r[2])
}catch(e){console.log('SMOKE ERR',e.message,e.stack)}
finally{ if(S)await S.ctx.close(); if(T)await T.ctx.close(); await b.close() }

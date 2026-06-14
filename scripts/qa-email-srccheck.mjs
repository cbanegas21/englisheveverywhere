// One-off: verify the email-bearing source files are clean UTF-8 (no BOM
// surprises, no baked-in U+FFFD replacement char, no invalid byte sequences).
// The old password-reset emails sent a U+FFFD for ñ — this proves the CURRENT
// source doesn't carry that corruption forward.
import fs from 'node:fs'

const files = [
  'src/lib/email.ts', 'src/lib/welcomeEmail.ts', 'src/lib/reminders.ts', 'src/lib/ics.ts',
  'src/app/actions/booking.ts', 'src/app/actions/placement.ts', 'src/app/actions/onboarding.ts',
  'src/app/actions/auth.ts', 'src/app/actions/profile.ts', 'src/app/[lang]/admin/actions.ts',
]
const FFFD = '�'
for (const f of files) {
  const buf = fs.readFileSync(f)
  const bom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF ? 'UTF8-BOM'
    : buf[0] === 0xFF && buf[1] === 0xFE ? 'UTF16LE'
    : buf[0] === 0xFE && buf[1] === 0xFF ? 'UTF16BE' : 'no-bom'
  const txt = buf.toString('utf8')
  const fffd = (txt.split(FFFD).length - 1)
  // control chars excluding tab(9)/LF(10)/CR(13)
  let ctrl = 0
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i)
    if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) ctrl++
  }
  const valid = bom !== 'no-bom' || Buffer.compare(Buffer.from(txt, 'utf8'), buf) === 0
  console.log(`${f.padEnd(40)} ${bom.padEnd(9)} fffd=${fffd} ctrlChars=${ctrl} validUTF8=${valid}`)
  if (fffd) {
    const idx = txt.indexOf(FFFD)
    console.log('    FIRST FFFD context:', JSON.stringify(txt.slice(idx - 30, idx + 10)))
  }
}

// Dump codepoints for the password-reset subject (the historically-broken one).
const adm = fs.readFileSync('src/app/[lang]/admin/actions.ts', 'utf8')
const m = adm.match(/Restablece tu contrase[\s\S]{1,4}a [\s\S] EnglishKolab/)
console.log('\nadmin reset ES subject:', m ? JSON.stringify(m[0]) : 'NOT FOUND')
if (m) console.log('  codepoints:', [...m[0]].map((c) => c.codePointAt(0).toString(16)).join(' '))

// The Lab — quiz sanitization + server-side auto-grading.
//
// PURE module. Imported ONLY by the server quiz-player page and the 'use server'
// submitQuizAttempt action — NEVER by a client component. Answer keys must never
// enter the client bundle (the gated-pricing `priceUsd` leak lesson) and a client
// tally must never be trusted (the no-show self-grade lesson), so the only place
// that sees a key is the server: this file strips keys for rendering and grades
// from the source of truth, in one spot so the two can't drift.

export const LAB_QUESTION_TYPES = [
  'mcq_single',
  'mcq_multi',
  'true_false',
  'short_answer',
  'matching',
  'essay',
] as const
export type LabQuestionType = (typeof LAB_QUESTION_TYPES)[number]

// A raw row out of lab_question_bank (payload is free-form jsonb validated at
// write time by lab.ts `validateQuestion`; still coerced defensively here).
export interface BankQuestionRow {
  id: string
  type: string
  prompt: string
  payload: unknown
  general_feedback?: string | null
}

// ── untrusted coercers (mirror lab.ts) ───────────────────────────────────
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const s = (v: unknown): string => (typeof v === 'string' ? v : '')

function isType(t: string): t is LabQuestionType {
  return (LAB_QUESTION_TYPES as readonly string[]).includes(t)
}

// ── sanitized shape sent to the client ────────────────────────────────────
// Flat (not a discriminated union) so the client can switch on `.type` without
// TS narrowing pain. Key fields (correct / answer / accepted / pairs) appear
// ONLY when `reveal` is true.
export interface SanitizedOption {
  idx: number // ORIGINAL bank position — the value the student submits + the grader
  text: string // indexes against the unsanitized bank, so display order can be
  correct?: boolean // shuffled (shuffleAnswers) without ever touching gradeQuestion
  feedback?: string
}
export interface SanitizedQuestion {
  id: string
  type: LabQuestionType
  prompt: string
  guidance?: string // essay — student-facing, always included
  options?: SanitizedOption[] // mcq_single / mcq_multi
  lefts?: string[] // matching — prompts
  rights?: string[] // matching — answer pool (page shuffles for play)
  pairs?: { left: string; right: string }[] // matching key — reveal only
  answer?: boolean // true_false key — reveal only
  feedback?: string // true_false / general — reveal only
  accepted?: string[] // short_answer key — reveal only
}

// Strip answer keys for the player. `reveal=false` (always, pre-submit) removes
// every key field; `reveal=true` (post-submit review, ONLY when the quiz's
// reviewAfter setting allows) keeps keys so the student can learn from them.
export function sanitizeQuestion(q: BankQuestionRow, reveal: boolean): SanitizedQuestion | null {
  if (!isType(q.type)) return null
  const p = rec(q.payload)
  const base = { id: q.id, prompt: s(q.prompt) }

  if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
    const options: SanitizedOption[] = arr(p.options).map((o, i) => {
      const r = rec(o)
      const opt: SanitizedOption = { idx: i, text: s(r.text) }
      if (reveal) {
        opt.correct = r.correct === true
        if (s(r.feedback)) opt.feedback = s(r.feedback)
      }
      return opt
    })
    return { ...base, type: q.type, options }
  }

  if (q.type === 'true_false') {
    const out: SanitizedQuestion = { ...base, type: 'true_false' }
    if (reveal) {
      out.answer = p.answer === true
      if (s(p.feedback)) out.feedback = s(p.feedback)
    }
    return out
  }

  if (q.type === 'short_answer') {
    const out: SanitizedQuestion = { ...base, type: 'short_answer' }
    if (reveal) {
      out.accepted = arr(p.accepted)
        .map((a) => s(rec(a).text).trim())
        .filter((t) => t.length > 0)
      if (s(p.feedback)) out.feedback = s(p.feedback)
    }
    return out
  }

  if (q.type === 'matching') {
    const pairs = arr(p.pairs)
      .map((x) => ({ left: s(rec(x).left), right: s(rec(x).right) }))
      .filter((x) => x.left.length > 0 && x.right.length > 0)
    // rights is the answer POOL, not the key — grading is by right-side TEXT
    // (gradeQuestion), so order is irrelevant to correctness. We sort it here so
    // rights[i] is NEVER aligned to lefts[i]: that alignment IS the key, and the
    // frozen snapshot reuses this output without the play page's extra shuffle
    // (GRADE-01 — the gated-pricing "data-in-bundle" lesson). The play page may
    // still shuffle on top for presentation.
    const out: SanitizedQuestion = {
      ...base,
      type: 'matching',
      lefts: pairs.map((x) => x.left),
      rights: pairs.map((x) => x.right).sort((a, b) => a.localeCompare(b)),
    }
    if (reveal) out.pairs = pairs
    return out
  }

  // essay — manual grade; guidance is a student-facing note, always shown.
  return { ...base, type: 'essay', guidance: s(p.guidance) }
}

// ── grading ───────────────────────────────────────────────────────────────
export type Outcome = 'correct' | 'incorrect' | 'pending'

// Grade ONE question against an UNTRUSTED answer using the UNSANITIZED payload.
// Objective types resolve correct/incorrect; short_answer with no accepted match
// and essay go to 'pending' (awaiting teacher) — never auto-failed (the gentle /
// anti-IA rule: a wrong-looking short answer might be a synonym the teacher
// accepts, so we never stamp it wrong automatically).
export function gradeQuestion(q: BankQuestionRow, answer: unknown): Outcome {
  if (!isType(q.type)) return 'pending'
  const p = rec(q.payload)

  if (q.type === 'mcq_single') {
    const options = arr(p.options)
    const idx = typeof answer === 'number' && Number.isInteger(answer) ? answer : -1
    return rec(options[idx]).correct === true ? 'correct' : 'incorrect'
  }

  if (q.type === 'mcq_multi') {
    const options = arr(p.options)
    const correct = new Set(
      options.map((o, i) => (rec(o).correct === true ? i : -1)).filter((i) => i >= 0),
    )
    const chosen = new Set(
      arr(answer)
        .map((x) => (typeof x === 'number' && Number.isInteger(x) ? x : -1))
        .filter((i) => i >= 0 && i < options.length),
    )
    if (correct.size === 0) return 'incorrect'
    if (chosen.size !== correct.size) return 'incorrect'
    for (const i of chosen) if (!correct.has(i)) return 'incorrect'
    return 'correct'
  }

  if (q.type === 'true_false') {
    return typeof answer === 'boolean' && answer === (p.answer === true) ? 'correct' : 'incorrect'
  }

  if (q.type === 'short_answer') {
    const given = (typeof answer === 'string' ? answer : '').trim()
    if (!given) return 'pending'
    const accepted = arr(p.accepted)
      .map((a) => {
        const r = rec(a)
        return { text: s(r.text).trim(), cs: r.caseSensitive === true }
      })
      .filter((a) => a.text.length > 0)
    const hit = accepted.some((a) =>
      a.cs ? a.text === given : a.text.toLowerCase() === given.toLowerCase(),
    )
    return hit ? 'correct' : 'pending' // never auto-fail
  }

  if (q.type === 'matching') {
    const pairs = arr(p.pairs)
      .map((x) => ({ left: s(rec(x).left).trim(), right: s(rec(x).right).trim() }))
      .filter((x) => x.left.length > 0 && x.right.length > 0)
    if (pairs.length === 0) return 'pending'
    const given = arr(answer).map((x) => (typeof x === 'string' ? x.trim() : ''))
    // All-or-nothing: every left must map to its correct right.
    for (let i = 0; i < pairs.length; i++) {
      if (given[i] !== pairs[i].right) return 'incorrect'
    }
    return 'correct'
  }

  return 'pending' // essay
}

export interface GradedAttempt {
  autoScore: number // questions answered correctly
  maxScore: number // questions that were auto-decided (excludes pending)
  pendingCount: number // essays + short-answers awaiting the teacher
  outcomes: Record<string, Outcome>
}

// Score = "autoScore de maxScore aciertos". Pending questions (essay / unmatched
// short-answer) are excluded from the denominator and surfaced separately so the
// student never sees a wrong mark for something a human still has to read.
export function gradeAttempt(
  questions: BankQuestionRow[],
  answers: Record<string, unknown>,
): GradedAttempt {
  let autoScore = 0
  let maxScore = 0
  let pendingCount = 0
  const outcomes: Record<string, Outcome> = {}
  for (const q of questions) {
    const o = gradeQuestion(q, answers[q.id])
    outcomes[q.id] = o
    if (o === 'pending') pendingCount++
    else {
      maxScore++
      if (o === 'correct') autoScore++
    }
  }
  return { autoScore, maxScore, pendingCount, outcomes }
}

// ── multi-attempt aggregation ───────────────────────────────────────────────
// "retake always allowed" (gentle/anti-IA constraint): a student may attempt up
// to the quiz's attempts_allowed. The teacher's grading_method picks which score
// is the OFFICIAL one. Score is always "x de y aciertos", never a grade.
export const LAB_GRADING_METHODS = ['greatest', 'average', 'first', 'last'] as const
export type GradingMethod = (typeof LAB_GRADING_METHODS)[number]
export function isGradingMethod(v: unknown): v is GradingMethod {
  return typeof v === 'string' && (LAB_GRADING_METHODS as readonly string[]).includes(v)
}

export interface AttemptScore {
  autoScore: number
  maxScore: number
}

const attemptRatio = (a: AttemptScore) => (a.maxScore > 0 ? a.autoScore / a.maxScore : 0)

// `attempts` MUST be ordered oldest→newest (by attempt_number) for first/last.
// Ratio-based so a differing denominator (a blank short-answer left pending in
// one attempt) can't skew the average. maxScore for the headline is the largest
// seen, so "x de y" reads sensibly.
export function aggregateAttempts(attempts: AttemptScore[], method: GradingMethod): AttemptScore {
  if (attempts.length === 0) return { autoScore: 0, maxScore: 0 }
  if (attempts.length === 1) return { autoScore: attempts[0].autoScore, maxScore: attempts[0].maxScore }
  if (method === 'first') return { autoScore: attempts[0].autoScore, maxScore: attempts[0].maxScore }
  if (method === 'last') {
    const a = attempts[attempts.length - 1]
    return { autoScore: a.autoScore, maxScore: a.maxScore }
  }
  if (method === 'greatest') {
    const best = attempts.reduce((b, a) => (attemptRatio(a) > attemptRatio(b) ? a : b), attempts[0])
    return { autoScore: best.autoScore, maxScore: best.maxScore }
  }
  // average — exclude all-pending attempts (maxScore===0): they auto-graded nothing,
  // so counting them as 0% would understate the score (MA-01).
  const scored = attempts.filter((a) => a.maxScore > 0)
  if (scored.length === 0) return { autoScore: 0, maxScore: 0 }
  const maxScore = Math.max(...scored.map((a) => a.maxScore))
  const avgRatio = scored.reduce((sum, a) => sum + attemptRatio(a), 0) / scored.length
  return { autoScore: Math.round(avgRatio * maxScore), maxScore }
}

// Index of the attempt whose answers should be shown in review — the one the
// aggregate actually scored (MA-02), so the per-question detail matches the
// headline. 'average' has no single attempt, so show the latest as representative.
export function scoringAttemptIndex(attempts: AttemptScore[], method: GradingMethod): number {
  if (attempts.length === 0) return -1
  if (method === 'first') return 0
  if (method === 'last' || method === 'average') return attempts.length - 1
  // greatest
  let best = 0
  for (let i = 1; i < attempts.length; i++) if (attemptRatio(attempts[i]) > attemptRatio(attempts[best])) best = i
  return best
}

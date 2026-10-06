import { QUESTIONS, VOLETS, type DiagnosticQuestion } from './diagnosticData'

export const GRID_VERSION = 'v5.1'

export type DiagnosticFormat = 'Complet' | 'Express ★'

export interface ScoreAnswer {
  score: number
  comment: string
  set?: boolean
}

export type AnswerMap = Record<string, ScoreAnswer>

export interface ScopeStat {
  total: number
  noted: number
  zeros: number
  sum: number
  avg: number
  index: number
  missingComments: number
}

export interface VoletStat {
  id: number
  title: string
  internal: ScopeStat
  external: ScopeStat
  combined: ScopeStat
  conclusive: boolean
}

export interface RankedQuestion {
  q: DiagnosticQuestion
  score: number
  value: number
}

export interface DiagnosticStats {
  scope: DiagnosticQuestion[]
  byVolet: VoletStat[]
  combined: ScopeStat
  touched: number
  missingComments: string[]
  ready: boolean
  forces: RankedQuestion[]
  weaknesses: RankedQuestion[]
  priorities: RankedQuestion[]
  opportunities: RankedQuestion[]
  threats: RankedQuestion[]
}

export interface ConsentRecord {
  acceptedAt: string
  version: string
  by: string
}

export function questionsForFormat(format: DiagnosticFormat): DiagnosticQuestion[] {
  return format === 'Express ★' ? QUESTIONS.filter((q) => q.starred) : QUESTIONS
}

export function isTouched(answer: ScoreAnswer | undefined): boolean {
  if (!answer) return false
  if (typeof answer.set === 'boolean') return answer.set
  return (answer.score || 0) > 0
}

export function isNoted(answer: ScoreAnswer | undefined): boolean {
  return (answer?.score || 0) > 0
}

export function needsComment(answer: ScoreAnswer | undefined): boolean {
  return isNoted(answer) && !(answer?.comment || '').trim()
}

function buildStat(questions: DiagnosticQuestion[], answers: AnswerMap): ScopeStat {
  const scores = questions.map((q) => answers[q.id]?.score || 0)
  const notedScores = scores.filter((score) => score > 0)
  const sum = notedScores.reduce((a, b) => a + b, 0)
  return {
    total: questions.length,
    noted: notedScores.length,
    zeros: scores.filter((score) => score === 0).length,
    sum,
    avg: notedScores.length ? sum / notedScores.length : 0,
    index: notedScores.length ? (sum / (5 * notedScores.length)) * 100 : 0,
    missingComments: questions.filter((q) => needsComment(answers[q.id])).length,
  }
}

function rank(questions: DiagnosticQuestion[], answers: AnswerMap, kind: 'priority' | 'gap'): RankedQuestion[] {
  return questions.map((q) => {
    const score = answers[q.id]?.score || 0
    const factor = kind === 'priority' ? q.weight || 0 : q.enjeu || 0
    return { q, score, value: (5 - score) * factor }
  })
}

export function buildStats(format: DiagnosticFormat, answers: AnswerMap): DiagnosticStats {
  const scope = questionsForFormat(format)

  const byVolet: VoletStat[] = VOLETS.map((volet) => {
    const scoped = scope.filter((q) => Number(q.id[0]) === volet.id)
    const internal = scoped.filter((q) => q.internal)
    const external = scoped.filter((q) => !q.internal)
    const internalStat = buildStat(internal, answers)
    const externalStat = buildStat(external, answers)
    return {
      id: volet.id,
      title: volet.title,
      internal: internalStat,
      external: externalStat,
      combined: buildStat(scoped, answers),
      conclusive: internalStat.zeros <= 2,
    }
  })

  const conclusiveVolets = new Set(byVolet.filter((v) => v.conclusive).map((v) => v.id))
  const inConclusiveVolet = (q: DiagnosticQuestion) => conclusiveVolets.has(Number(q.id[0]))

  const internalRanked = rank(scope.filter((q) => q.internal && inConclusiveVolet(q)), answers, 'priority').filter(
    (item) => isNoted(answers[item.q.id]),
  )
  const externalRanked = rank(scope.filter((q) => !q.internal && inConclusiveVolet(q)), answers, 'gap').filter(
    (item) => isNoted(answers[item.q.id]),
  )

  const heaviestFirst = (a: RankedQuestion, b: RankedQuestion) =>
    b.score - a.score || (b.q.weight || 0) - (a.q.weight || 0)

  const missingComments = scope.filter((q) => needsComment(answers[q.id])).map((q) => q.id)
  const touched = scope.filter((q) => isTouched(answers[q.id])).length
  const combined = buildStat(scope, answers)

  return {
    scope,
    byVolet,
    combined,
    touched,
    missingComments,
    ready: scope.length > 0 && touched === scope.length && missingComments.length === 0,
    forces: internalRanked.filter((item) => item.score >= 4).sort(heaviestFirst).slice(0, 3),
    weaknesses: internalRanked
      .filter((item) => item.score <= 2)
      .sort((a, b) => a.score - b.score || (b.q.weight || 0) - (a.q.weight || 0))
      .slice(0, 3),
    priorities: [...internalRanked].sort((a, b) => b.value - a.value).slice(0, 3),
    opportunities: externalRanked
      .filter((item) => item.q.type === 'Opportunité' && item.score <= 3)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3),
    threats: externalRanked
      .filter((item) => item.q.type === 'Menace' && item.score <= 3)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3),
  }
}

export function buildConsent(by: string, at: string = new Date().toISOString()): ConsentRecord | null {
  const identity = by.trim()
  if (!identity) return null
  return { acceptedAt: at, version: GRID_VERSION, by: identity }
}

export function formatConsent(consent: ConsentRecord): string {
  const at = consent.acceptedAt ? new Date(consent.acceptedAt) : null
  const stamp = at && !Number.isNaN(at.getTime()) ? at.toLocaleString('fr-FR') : consent.acceptedAt
  return `Cadre accepté le ${stamp} · texte v${consent.version} · par ${consent.by}`
}

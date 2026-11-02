import { PACKS, type SectorKey } from '@/features/health360/packs'

export interface DiagnosticDraft {
  started: boolean
  answered: number
  total: number
  completed: number
  answers: Record<string, { score: number; comment: string; completed?: boolean }>
}

/** Brouillon local du questionnaire (Diagnostic360), partagé entre l'envoi et l'accueil. */
export function readDiagnosticDraft(sector: SectorKey): DiagnosticDraft {
  const pack = PACKS[sector]
  const questions = pack.questions
  const empty: DiagnosticDraft = { started: false, answered: 0, total: questions.length, completed: 0, answers: {} }
  try {
    const raw = window.localStorage.getItem('allneeds.diagnostic360.v51.' + sector)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as {
      meta?: { started?: boolean }
      answers?: Record<string, { score: number; comment: string; completed?: boolean }>
    }
    const answers = parsed.answers ?? {}
    const answered = questions.filter((question) => (answers[question.id]?.score ?? 0) > 0).length
    const completed = questions.filter((question) => answers[question.id]?.completed === true).length
    return { started: Boolean(parsed.meta?.started), answered, total: questions.length, completed, answers }
  } catch {
    return empty
  }
}

/** Liste des questions du questionnaire dont une note a été renseignée (> 0). */
export function answeredDraftQuestions(
  sector: SectorKey,
  answers: Record<string, { score: number; comment: string; completed?: boolean }>,
) {
  const pack = PACKS[sector]
  return pack.questions
    .filter((question) => (answers[question.id]?.score ?? 0) > 0)
    .map((question) => ({
      question,
      score: answers[question.id]?.score ?? 0,
      comment: answers[question.id]?.comment ?? '',
      situation: question.levels[Math.min(4, Math.max(0, (answers[question.id]?.score ?? 1) - 1))] ?? '',
    }))
}
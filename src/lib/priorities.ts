import { PACKS, type SectorKey, type SectorPack } from '@/features/health360/packs'
import { computeDiagnostic, type AnswersMap, type DiagnosticSummary } from './diagnostic360'

export type PriorityLevel = 'Élevée' | 'Importante' | 'À traiter'

export interface PriorityItem {
  rank: number
  questionId: string
  title: string
  question: string
  situation: string
  comment: string
  score: number
  weight: number
  scorePriority: number
  level: PriorityLevel
  voletId: number
  voletTitle: string
  why: string
  consequence: string
  recommendation: string
}

/** Conséquences opérationnelles par volet — formulées pour un dirigeant, pas de jargon. */
export const VOLET_CONSEQUENCE: Record<number, string> = {
  1: 'Sans suivi commun, une demande entrante peut rester sans réponse et un prospect disparaître entre le premier contact et la décision.',
  2: 'Sans visibilité mesurée, l’acquisition dépend du bouche-à-oreille : les demandes arrivent au hasard et les dépenses ne sont jamais comparées à leur résultat.',
  3: 'Sans rôles, outils et planning clairement définis, les tâches repassent par le dirigeant et l’équipe attend, double ou refait.',
  4: 'Sans relevé des charges poste par poste, les renouvellements et hausses de tarif passent sans être comparés, contestés ni décidés.',
}

/** Recommandations par volet — une action concrète, pas une promesse. */
export const VOLET_RECOMMANDATION: Record<number, string> = {
  1: 'Structurer un parcours commercial : origine des demandes, responsable identifié, relances datées, point hebdomadaire sur les chiffres.',
  2: 'Installer un canal de demande régulier : fiche et site à jour, avis suivis, budget par canal et résultat mesuré chaque mois.',
  3: 'Écrire les rôles et le rythme : fiche de poste, outil de travail unique, point d’équipe régulier, procédure pour les gestes répétés.',
  4: 'Mettre en place un relevé des charges et un point trimestriel : comparer, contester, renégocier avant chaque échéance.',
}

function levelOf(scorePriority: number): PriorityLevel {
  if (scorePriority >= 9) return 'Élevée'
  if (scorePriority >= 6) return 'Importante'
  return 'À traiter'
}

export function buildPriorities(pack: SectorPack, answers: AnswersMap, limit = 5): PriorityItem[] {
  const summary = computeDiagnostic(answers, 'Express', pack)
  return summary.priorities.slice(0, limit).map((entry, index) => {
    const volet = pack.volets.find((item) => item.id === Number(entry.q.id[0]))
    const score = entry.s
    const weight = entry.q.weight ?? 1
    return {
      rank: index + 1,
      questionId: entry.q.id,
      title: entry.q.title,
      question: entry.q.question,
      situation: entry.q.levels[score - 1] ?? '',
      comment: answers[entry.q.id]?.comment ?? '',
      score,
      weight,
      scorePriority: entry.priority,
      level: levelOf(entry.priority),
      voletId: volet?.id ?? Number(entry.q.id[0]),
      voletTitle: volet?.title ?? '',
      why: volet?.subtitle ?? '',
      consequence: VOLET_CONSEQUENCE[volet?.id ?? 0] ?? '',
      recommendation: VOLET_RECOMMANDATION[volet?.id ?? 0] ?? '',
    }
  })
}

export interface DiagnosticView {
  pack: SectorPack
  summary: DiagnosticSummary
  priorities: PriorityItem[]
  globalIndex: number
  answered: number
  total: number
}

export function buildDiagnosticView(sector: SectorKey, answers: AnswersMap): DiagnosticView {
  const pack = PACKS[sector] ?? PACKS.sante
  const summary = computeDiagnostic(answers, 'Express', pack)
  const noted = summary.byVolet.reduce((total, volet) => total + volet.internal.coverage + volet.external.coverage, 0)
  const pool = summary.byVolet.reduce((total, volet) => total + volet.internal.pool + volet.external.pool, 0)
  const sum = summary.byVolet.reduce(
    (total, volet) => total + volet.internal.total + volet.external.total,
    0,
  )
  return {
    pack,
    summary,
    priorities: buildPriorities(pack, answers),
    globalIndex: pool > 0 && noted > 0 ? Math.round((sum / (5 * pool)) * 100) : 0,
    answered: summary.answered,
    total: summary.totalQuestions,
  }
}

export function detectedVolets(priorities: PriorityItem[]): number[] {
  return [...new Set(priorities.map((item) => item.voletId))].sort()
}

/** Brouillon local du questionnaire (Diagnostic360) — utilisé tant que le serveur n'a rien. */
export function readLocalAnswers(sector: SectorKey): AnswersMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem('allneeds.diagnostic360.v51.' + sector)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { answers?: AnswersMap }
    return parsed.answers ?? {}
  } catch {
    return {}
  }
}

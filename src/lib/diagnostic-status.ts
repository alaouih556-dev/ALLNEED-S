export interface DiagnosticStatusInfo {
  orgId: string | null
  completed: boolean
  status: string | null
  diagnosticId: string | null
  createdAt: string | null
  restoredAt: string | null
  publishedAt?: string | null
  restitutionPublished?: boolean
  hasRestitution: boolean
  submittedAt?: string | null
  isSubmitted?: boolean
}

export const DIAGNOSTIC_STATUS_LABELS: Record<string, string> = {
  soumis: 'Diagnostic transmis',
  analyse: "En cours d'analyse",
  en_analyse: "En cours d'analyse",
  pret_a_valider: "En cours d'analyse",
  restitue: 'Restitution disponible',
}

/** Libellés côté équipe ALLNEEDS (concierge / admin) — vue interne. */
export const DIAGNOSTIC_STAFF_STATUS_LABELS: Record<string, string> = {
  soumis: 'À analyser',
  analyse: 'En analyse',
  en_analyse: 'En analyse',
  pret_a_valider: 'Prêt à valider',
  restitue: 'Restitué / publié',
}

export function diagnosticStatusLabel(status?: string | null) {
  return status ? DIAGNOSTIC_STATUS_LABELS[status] || status : 'Terminé'
}

export function diagnosticStaffStatusLabel(status?: string | null) {
  return status ? DIAGNOSTIC_STAFF_STATUS_LABELS[status] || status : '—'
}

/**
 * Détermine si le diagnostic a été soumis/envoyé au concierge.
 * Basé sur le statut backend : 'soumis', 'analyse', 'en_analyse', 'pret_a_valider', 'restitue'.
 */
export function isDiagnosticSubmitted(
  record: { status?: string | null; submittedAt?: string | null } | null | undefined,
): boolean {
  if (!record) return false
  if (record.submittedAt) return true
  return ['soumis', 'analyse', 'en_analyse', 'pret_a_valider', 'restitue'].includes(record.status || '')
}

/**
 * Détermine si le diagnostic est terminé à partir du vrai diagnostic de
 * l'organisation (statuts API soumis / analyse / restitue), jamais un flag demo.
 */
export function hasCompletedDiagnostic(
  record: { status?: string | null; completed?: boolean; createdAt?: string | null } | null | undefined,
  submittedAt?: string | null,
): boolean {
  if (submittedAt) return true
  if (!record) return false
  if (record.completed === true) return true
  return ['soumis', 'analyse', 'en_analyse', 'pret_a_valider', 'restitue'].includes(record.status || '')
}

/**
 * Le client voit la restitution uniquement si elle est VALIDÉE ET PUBLIÉE.
 * Jamais sur la présence d'une synthèse, de réponses, ou sur le statut `soumis`.
 */
export function canClientViewRestitution(diagnostic: {
  status?: string | null
  restitutionVisible?: boolean
  publishedAt?: string | null
} | null | undefined): boolean {
  if (!diagnostic) return false
  if (diagnostic.status !== 'restitue') return false
  if (diagnostic.restitutionVisible === false) return false
  return Boolean(diagnostic.publishedAt)
}
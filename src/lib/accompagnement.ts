import type { Tone } from '@/components/ui'

/* ------------------------------------------------------------------ */
/* Phase 5 — Offres d'accompagnement & missions                        */
/* Contrat partagé avec le backend (source de vérité).                 */
/* ------------------------------------------------------------------ */

export const OFFER_CODES = ['BASIQUE', 'PRO', 'PERFORMANCE'] as const
export type OfferCode = (typeof OFFER_CODES)[number]

export const OFFER_PRICES: Record<OfferCode, number> = {
  BASIQUE: 3445,
  PRO: 6445,
  PERFORMANCE: 10945,
}

/** STARTER (héritage) est l'alias de BASIQUE : jamais affiché tel quel. */
export function normalizeOfferCode(value?: string | null): OfferCode | null {
  const code = String(value || '').trim().toUpperCase()
  if (code === 'STARTER') return 'BASIQUE'
  return (OFFER_CODES as readonly string[]).includes(code) ? (code as OfferCode) : null
}

export function formatOfferPrice(price: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(price)} MAD`
}

export interface CatalogMission {
  key: string
  title: string
  description: string
  contentStatus: string
}

export interface OfferCatalogItem {
  code: OfferCode
  name: string
  price: number
  summary: string
  missions: CatalogMission[]
  contentStatus: string
}

export type OfferStatus = 'draft' | 'en_attente_validation' | 'actif' | 'refuse' | 'suspendu' | 'expire' | 'disponible' | 'selectionnee' | 'acceptee' | 'annulee' | 'refusee'

export interface OfferRecord {
  id: string
  orgId: string
  organizationId?: string
  diagnosticId: string | null
  offerCode: OfferCode
  offerName: string
  price: number
  status: OfferStatus
  acceptedAt: string | null
  acceptedBy?: string | null
  acceptedByName?: string | null
  acceptedByConciergeId?: string | null
  createdAt: string
  updatedAt: string
  orgName?: string
}

export interface OffersPayload {
  locked: boolean
  reason?: string
  offers: OfferCatalogItem[]
  current: OfferRecord | null
  pending?: OfferRecord | OfferRecord[] | null
  history?: OfferRecord[]
  recommendedOfferCode: OfferCode | null
  recommendedOfferSource: 'explicit' | 'heuristique_a_valider' | null
  diagnosticId: string | null
}

export const MISSION_STATUSES = ['a_faire', 'en_cours', 'a_valider_client', 'validee_client', 'terminee'] as const
export type MissionStatus = (typeof MISSION_STATUSES)[number]

export const MISSION_STATUS_META: Record<MissionStatus, { label: string; tone: Tone }> = {
  a_faire: { label: 'À faire', tone: 'neutral' },
  en_cours: { label: 'En cours', tone: 'brand' },
  a_valider_client: { label: 'À valider par le client', tone: 'warning' },
  validee_client: { label: 'Validée par le client', tone: 'success' },
  terminee: { label: 'Terminée', tone: 'success' },
}

export const MISSION_PRIORITY_LABELS: Record<string, string> = {
  faible: 'Faible',
  normale: 'Normale',
  haute: 'Haute',
}

export type MissionAxisKey = 'commercial' | 'marketing' | 'rh' | 'juridique' | 'financement'

export type MissionAction = Omit<Mission, 'axisKey' | 'actions'> & { axisKey?: MissionAxisKey }

export interface Mission {
  id: string
  orgId: string
  offerRecordId: string | null
  offerCode: OfferCode
  axisKey: MissionAxisKey
  title: string
  description: string
  contentStatus?: string
  status: MissionStatus
  priority: 'faible' | 'normale' | 'haute'
  dueDate: string | null
  assignedConciergeId: string | null
  instructions: string
  instructionsResponse?: string | null
  deliverables: string[]
  documents: string[]
  clientFeedback: string | null
  order?: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  actions?: MissionAction[]
  orgName?: string
}

export class ApiError extends Error {
  code?: string
  status?: number
  constructor(message: string, code?: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
  } catch {
    throw new ApiError('Le service ALLNEEDS est indisponible. Réessayez dans un instant.')
  }
  const body = (await response.json().catch(() => ({}))) as T & { error?: string; code?: string }
  if (!response.ok) throw new ApiError(body?.error || `Erreur serveur (${response.status})`, body?.code, response.status)
  return body as T
}

export function fetchOffers(): Promise<OffersPayload> {
  return apiRequest<OffersPayload>('/api/offers')
}

export function acceptOffer(offerCode: OfferCode): Promise<{ offer: OfferRecord; missions?: Mission[] }> {
  return apiRequest('/api/offers/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offerCode }) })
}

export function fetchClientMissions(): Promise<{ offer: OfferRecord; missions: Mission[] }> {
  return apiRequest('/api/missions')
}

export function fetchMission(id: string): Promise<Mission> {
  return apiRequest(`/api/missions/${encodeURIComponent(id)}`)
}

export type MissionPatch = Partial<Omit<Mission, 'status' | 'clientFeedback'>> & {
  status?: MissionStatus
  clientDecision?: 'validate' | 'request_correction'
  clientFeedback?: string | null
}

export function patchMission(id: string, patch: MissionPatch): Promise<Mission> {
  if (patch.clientDecision) {
    return apiRequest(`/api/missions/${encodeURIComponent(id)}/validation`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: patch.clientDecision === 'request_correction' ? 'correction' : 'validate', feedback: patch.clientFeedback }),
    })
  }
  return apiRequest(`/api/missions/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
}

export function fetchConciergeMissions(): Promise<Mission[]> {
  return apiRequest<Mission[]>('/api/account-manager/missions')
}

export function fetchAdminMissions(): Promise<Mission[]> {
  return apiRequest<Mission[]>('/api/admin/missions')
}

export function fetchAdminOffers(): Promise<{ offers: OfferRecord[]; catalog: OfferCatalogItem[] }> {
  return apiRequest('/api/admin/offers')
}

export function patchAdminOffer(id: string, patch: { status: OfferStatus }): Promise<OfferRecord> {
  return apiRequest(`/api/admin/offers/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
}

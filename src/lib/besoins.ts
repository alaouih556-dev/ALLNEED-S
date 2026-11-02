import type { Tone } from '@/components/ui'
import { apiRequest } from '@/lib/accompagnement'

/* ------------------------------------------------------------------ */
/* Phase 6 — Abonnements Besoins & propositions                        */
/* Contrat partagé avec le backend (source de vérité).                 */
/* Mapping historique : CONNECT -> ESSENTIEL, PLUS -> AVANCÉ,          */
/* PRIORITE -> PREMIUM (jamais affichés tels quels au client).         */
/* ------------------------------------------------------------------ */

export const NEEDS_PLAN_CODES = ['ESSENTIEL', 'AVANCE', 'PREMIUM'] as const
export type NeedsPlanCode = (typeof NEEDS_PLAN_CODES)[number]

export const NEEDS_PLAN_NAMES: Record<NeedsPlanCode, string> = {
  ESSENTIEL: 'ESSENTIEL',
  AVANCE: 'AVANCÉ',
  PREMIUM: 'PREMIUM',
}

export const NEEDS_PLAN_PRICES: Record<NeedsPlanCode, number> = {
  ESSENTIEL: 149,
  AVANCE: 349,
  PREMIUM: 549,
}

export const NEEDS_PLAN_LIMITS: Record<NeedsPlanCode, { monthlyLimit: number; proposalsLimit: number; targetDelayHours: number; recommendedProposal: boolean; negotiatedProposal: boolean }> = {
  ESSENTIEL: { monthlyLimit: 2, proposalsLimit: 2, targetDelayHours: 72, recommendedProposal: false, negotiatedProposal: false },
  AVANCE: { monthlyLimit: 5, proposalsLimit: 3, targetDelayHours: 48, recommendedProposal: true, negotiatedProposal: false },
  PREMIUM: { monthlyLimit: 10, proposalsLimit: 3, targetDelayHours: 36, recommendedProposal: true, negotiatedProposal: true },
}

/** Normalise un code de plan (anciens noms inclus). Accents tolérés. */
export function normalizeNeedsPlanCode(value?: string | null): NeedsPlanCode | null {
  const raw = String(value || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (raw === 'CONNECT') return 'ESSENTIEL'
  if (raw === 'PLUS') return 'AVANCE'
  if (raw === 'PRIORITE') return 'PREMIUM'
  return (NEEDS_PLAN_CODES as readonly string[]).includes(raw) ? (raw as NeedsPlanCode) : null
}

export function formatNeedsPrice(price: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(price)} MAD`
}

export interface NeedsCatalogItem {
  code: NeedsPlanCode
  name: string
  price: number
  currency: string
  period: string
  monthlyLimit: number
  proposalsLimit: number
  targetDelayHours: number
  recommendedProposal: boolean
  negotiatedProposal: boolean
  contentStatus: string
}

export type NeedsSubscriptionStatus = 'pending' | 'en_attente_validation' | 'active' | 'suspended' | 'cancelled' | 'expired' | 'refused' | 'refusee'

export interface NeedsSubscriptionSummary {
  id: string
  orgId: string
  planCode: NeedsPlanCode
  planName: string
  price: number
  status: NeedsSubscriptionStatus
  monthlyLimit: number
  proposalsLimit: number
  targetDelayHours: number
  recommendedProposal: boolean
  negotiatedProposal: boolean
  usedThisMonth: number
  remaining: number
  periodStart: string
  periodEnd: string
  startDate: string
  endDate: string | null
  active: boolean
  acceptedAt?: string | null
  acceptedByName?: string | null
  createdAt: string
  updatedAt: string
  orgName?: string
}

export interface NeedsPrerequisite {
  ok: boolean
  code?: string
  error?: string
}

export interface NeedsSubscriptionPayload {
  catalog: NeedsCatalogItem[]
  current: NeedsSubscriptionSummary | null
  pending?: NeedsSubscriptionSummary | null
  history: NeedsSubscriptionSummary[]
  prerequisites: NeedsPrerequisite
}

export const NEEDS_SUBSCRIPTION_STATUS_META: Record<NeedsSubscriptionStatus, { label: string; tone: Tone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  en_attente_validation: { label: 'En attente de validation', tone: 'warning' },
  active: { label: 'Actif', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  cancelled: { label: 'Résilié', tone: 'neutral' },
  expired: { label: 'Expiré', tone: 'neutral' },
  refused: { label: 'Refusé', tone: 'neutral' },
  refusee: { label: 'Refusé', tone: 'neutral' },
}

export const PROPOSAL_STATUSES = ['brouillon', 'proposee', 'en_etude', 'envoyee', 'acceptee', 'refusee'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; tone: Tone }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  proposee: { label: 'Proposée', tone: 'brand' },
  en_etude: { label: 'En étude', tone: 'info' },
  envoyee: { label: 'Envoyée au client', tone: 'warning' },
  acceptee: { label: 'Acceptée', tone: 'success' },
  refusee: { label: 'Refusée', tone: 'neutral' },
}

export interface NeedProposal {
  id: string
  kind: 'proposition'
  needId: string
  orgId: string
  providerName: string
  title: string
  description: string
  deliveryDelay?: string | null
  amount: number | null
  recommended: boolean
  negotiated: boolean
  status: ProposalStatus
  createdBy?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
  sentAt?: string | null
  sentBy?: string | null
}

export function fetchNeedsSubscription(): Promise<NeedsSubscriptionPayload> {
  return apiRequest<NeedsSubscriptionPayload>('/api/needs/subscription')
}

export function activateNeedsSubscription(planCode: NeedsPlanCode): Promise<{ subscription: NeedsSubscriptionSummary }> {
  return apiRequest('/api/needs/subscription/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planCode }) })
}

export function changeNeedsSubscription(planCode: NeedsPlanCode): Promise<{ subscription: NeedsSubscriptionSummary }> {
  return apiRequest('/api/needs/subscription/change', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planCode }) })
}

export function cancelNeedsSubscription(): Promise<{ subscription: NeedsSubscriptionSummary }> {
  return apiRequest('/api/needs/subscription/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
}

export function fetchNeedProposals(needId: string): Promise<{ needId: string; proposals: NeedProposal[] }> {
  return apiRequest(`/api/needs/${encodeURIComponent(needId)}/proposals`)
}

export function createNeedProposal(needId: string, input: { providerName: string; title: string; description: string; deliveryDelay?: string | null; amount: number | null; recommended?: boolean; negotiated?: boolean }): Promise<NeedProposal> {
  return apiRequest(`/api/needs/${encodeURIComponent(needId)}/proposals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
}

export function patchProposal(id: string, patch: Partial<Pick<NeedProposal, 'title' | 'description' | 'deliveryDelay' | 'providerName' | 'amount' | 'status' | 'recommended' | 'negotiated'>>): Promise<NeedProposal> {
  return apiRequest(`/api/proposals/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
}

export function transmitProposal(id: string): Promise<NeedProposal> {
  return apiRequest(`/api/proposals/${encodeURIComponent(id)}/transmit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
}

export function decideProposal(id: string, decision: 'accept' | 'refuse'): Promise<NeedProposal> {
  return apiRequest(`/api/proposals/${encodeURIComponent(id)}/decision`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) })
}

export function fetchAdminNeedsSubscriptions(): Promise<{ subscriptions: NeedsSubscriptionSummary[]; catalog: NeedsCatalogItem[] }> {
  return apiRequest('/api/admin/needs/subscriptions')
}

export function patchAdminNeedsSubscription(id: string, patch: { status?: NeedsSubscriptionStatus; planCode?: NeedsPlanCode }): Promise<NeedsSubscriptionSummary> {
  return apiRequest(`/api/admin/needs/subscriptions/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
}

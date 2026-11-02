import { apiRequest } from '@/lib/accompagnement'

export const SAAS_MONTHLY_PRICE = 445

export type SaasSubscriptionStatus = 'en_attente_validation' | 'pending' | 'active' | 'refused' | 'refusee' | 'cancelled' | string

export interface SaasSubscriptionRecord {
  id?: string
  status?: SaasSubscriptionStatus
  planName?: string
  price?: number
  requestedAt?: string
  createdAt?: string
  activatedAt?: string | null
  reason?: string | null
}

export interface SaasSubscriptionPayload extends SaasSubscriptionRecord {
  subscription?: SaasSubscriptionRecord | null
  current?: SaasSubscriptionRecord | null
  pending?: SaasSubscriptionRecord | null
  history?: SaasSubscriptionRecord[]
  active?: boolean
  enabled?: boolean
  url?: string | null
}

export function requestSaasSubscription(): Promise<SaasSubscriptionPayload | { subscription: SaasSubscriptionRecord }> {
  return apiRequest('/api/saas/subscription/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
}

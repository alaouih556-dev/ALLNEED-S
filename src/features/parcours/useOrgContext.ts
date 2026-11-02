import { useMemo } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useDemo } from '@/store/store'
import { toSector } from '@/lib/parcours'
import { clientModules, orgSaas, orgSaasActive, type AccessModule, type SaasAccess } from '@/lib/access'
import type { Sector } from '@/types'

export interface OrgContext {
  orgId: string
  orgName: string
  email: string
  sector: Sector | null
  sectorResolved: boolean
  moduleKeys: Record<AccessModule, boolean>
  saas: SaasAccess
  saasAccess: boolean
}

/**
 * Contexte d'entreprise réellement connectée : le secteur vient du compte,
 * jamais d'une sélection implicite, pour éviter tout mélange de secteurs.
 */
export function useOrgContext(): OrgContext {
  const auth = useAuth()
  const { state, orgId: fallbackOrgId } = useDemo()

  return useMemo(() => {
    const org = auth.user?.organization ?? null
    const orgId = org?.id || fallbackOrgId || ''
    const sector =
      toSector(org?.sector) ??
      toSector(state.registrationProfile?.sector) ??
      toSector(state.orgs.find((item) => item.id === orgId)?.sector) ??
      null

    return {
      orgId,
      orgName: org?.name ?? state.orgs.find((item) => item.id === orgId)?.name ?? '',
      email: auth.user?.email ?? '',
      sector,
      sectorResolved: sector !== null,
      moduleKeys: clientModules(org),
      saas: orgSaas(org),
      saasAccess: orgSaasActive(org),
    }
  }, [auth.user, fallbackOrgId, state.registrationProfile, state.orgs])
}

import { useCallback, useEffect, useState } from 'react'
import type { Sector } from '@/types'

export type ParcoursStepId =
  | 'diagnostic'
  | 'preparation'
  | 'rendezvous'
  | 'restitution'
  | 'offre'
  | 'activation'

export interface ParcoursStep {
  id: ParcoursStepId
  label: string
  hint: string
}

export const PARCOURS_STEPS: ParcoursStep[] = [
  { id: 'diagnostic', label: 'Diagnostic', hint: 'Comprendre la situation' },
  { id: 'preparation', label: 'Préparation', hint: 'Documents et demande concierge' },
  { id: 'rendezvous', label: 'Rendez-vous', hint: 'Échange avec votre concierge' },
  { id: 'restitution', label: 'Restitution', hint: 'Vos priorités validées' },
  { id: 'offre', label: 'Offre', hint: 'Niveau d’accompagnement' },
  { id: 'activation', label: 'Activation', hint: 'Modules débloqués' },
]

export interface ParcoursState {
  sector: Sector | null
  diagnosticId: string | null
  submittedAt: string | null
  conciergeRequestedAt: string | null
  rendezVousAt: string | null
  restoredAt: string | null
  offerChosenAt: string | null
  offerCode: string | null
  documentsChecked: string[]
}

export const EMPTY_PARCOURS: ParcoursState = {
  sector: null,
  diagnosticId: null,
  submittedAt: null,
  conciergeRequestedAt: null,
  rendezVousAt: null,
  restoredAt: null,
  offerChosenAt: null,
  offerCode: null,
  documentsChecked: [],
}

const EVENT = 'allneeds:parcours-changed'
const PREFIX = 'allneeds.parcours.v1.'

function storageKey(orgId: string) {
  return PREFIX + (orgId || 'anon')
}

export function readParcours(orgId: string): ParcoursState {
  if (typeof window === 'undefined') return EMPTY_PARCOURS
  try {
    const raw = window.localStorage.getItem(storageKey(orgId))
    if (!raw) return EMPTY_PARCOURS
    const parsed = JSON.parse(raw) as Partial<ParcoursState>
    return { ...EMPTY_PARCOURS, ...parsed, documentsChecked: Array.isArray(parsed.documentsChecked) ? parsed.documentsChecked : [] }
  } catch {
    return EMPTY_PARCOURS
  }
}

export function writeParcours(orgId: string, patch: Partial<ParcoursState>): ParcoursState {
  const next = { ...readParcours(orgId), ...patch }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(orgId), JSON.stringify(next))
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { orgId } }))
    } catch {
      /* stockage indisponible : on garde l'état en mémoire */
    }
  }
  return next
}

export function useParcours(orgId: string) {
  const [value, setValue] = useState<ParcoursState>(() => readParcours(orgId))

  useEffect(() => {
    setValue(readParcours(orgId))
    const sync = (event: Event) => {
      const detail = (event as CustomEvent).detail as { orgId?: string } | undefined
      if (!detail || !orgId || detail.orgId === orgId) setValue(readParcours(orgId))
    }
    window.addEventListener(EVENT, sync as EventListener)
    window.addEventListener('storage', sync as EventListener)
    return () => {
      window.removeEventListener(EVENT, sync as EventListener)
      window.removeEventListener('storage', sync as EventListener)
    }
  }, [orgId])

  const patch = useCallback(
    (next: Partial<ParcoursState>) => {
      setValue(writeParcours(orgId, next))
    },
    [orgId],
  )

  return { parcours: value, patch }
}

const SECTOR_VALUES: Sector[] = ['enseignement', 'sante', 'tourisme']

export function toSector(value: unknown): Sector | null {
  return SECTOR_VALUES.includes(value as Sector) ? (value as Sector) : null
}

export interface ParcoursSnapshot {
  sector: Sector | null
  submittedAt: string | null
  conciergeRequestedAt: string | null
  rendezVousAt: string | null
  restoredAt: string | null
  offerChosenAt: string | null
  subscriptionActive: boolean
}

export function parcoursStepCount(snapshot: ParcoursSnapshot): number {
  let done = 0
  if (snapshot.submittedAt) done += 1
  if (snapshot.conciergeRequestedAt) done += 1
  if (snapshot.rendezVousAt) done += 1
  if (snapshot.restoredAt) done += 1
  if (snapshot.offerChosenAt) done += 1
  if (snapshot.offerChosenAt && snapshot.subscriptionActive) done += 1
  return done
}

export function parcoursCurrentStep(snapshot: ParcoursSnapshot): number {
  return Math.min(parcoursStepCount(snapshot), PARCOURS_STEPS.length - 1)
}

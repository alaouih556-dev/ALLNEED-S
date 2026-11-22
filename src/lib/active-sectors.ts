import type { Sector } from '@/types'
import { DIAGNOSTIC_SECTORS, getSector } from '@/lib/sectors'

/** Secteurs disposant d'un questionnaire et de plans (espaces privés). La liste complète est dans `lib/sectors.ts`. */
export const ACTIVE_SECTORS: Sector[] = DIAGNOSTIC_SECTORS

export const DEFAULT_SECTOR: Sector = 'sante'

export function isSectorActive(sector?: string | null): boolean {
  return Boolean(getSector(sector))
}

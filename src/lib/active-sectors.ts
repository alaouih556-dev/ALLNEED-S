import type { Sector } from '@/types'

/**
 * Secteurs actuellement proposés par ALLNEEDS.
 *
 * Les autres secteurs (Enseignement, Tourisme) restent dans le code mais sont
 * masqués partout dans l’interface. Pour les réactiver, définir par exemple :
 *   VITE_ACTIVE_SECTORS=sante,enseignement,tourisme
 * dans .env puis redémarrer le serveur de développement.
 */
const ALL: Sector[] = ['enseignement', 'sante', 'tourisme']

function parse(value: string | undefined): Sector[] {
  const wanted = (value ?? 'sante').split(',').map((s) => s.trim().toLowerCase())
  const list = ALL.filter((s) => wanted.includes(s))
  return list.length ? list : ['sante']
}

export const ACTIVE_SECTORS: Sector[] = parse(import.meta.env.VITE_ACTIVE_SECTORS as string | undefined)

/** Secteur par défaut (premier secteur actif). */
export const DEFAULT_SECTOR: Sector = ACTIVE_SECTORS.includes('sante') ? 'sante' : ACTIVE_SECTORS[0]

/** Un seul secteur actif : on masque les sélecteurs de secteur. */
export const SINGLE_SECTOR = ACTIVE_SECTORS.length === 1

export function isSectorActive(sector?: string | null): boolean {
  return !!sector && (ACTIVE_SECTORS as string[]).includes(sector)
}

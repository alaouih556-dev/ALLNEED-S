import { useEffect, useState } from 'react'
import { getSector, type SectorSlug } from '@/lib/sectors'

const KEY = 'allneeds-public-sector'
const EVENT = 'allneeds:sector-changed'

export function readSelectedSector(): SectorSlug | null {
  if (typeof window === 'undefined') return null
  try {
    return getSector(window.localStorage.getItem(KEY))?.slug ?? null
  } catch {
    return null
  }
}

export function selectSector(sector: SectorSlug) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, sector)
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: sector }))
}

export function clearSelectedSector() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }))
}

export function useSelectedSector() {
  const [sector, setSector] = useState<SectorSlug | null>(() => readSelectedSector())

  useEffect(() => {
    const sync = () => setSector(readSelectedSector())
    window.addEventListener('storage', sync)
    window.addEventListener(EVENT, sync as EventListener)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(EVENT, sync as EventListener)
    }
  }, [])

  return sector
}

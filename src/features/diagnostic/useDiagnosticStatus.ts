import { useCallback, useEffect, useState } from 'react'
import { readParcours } from '@/lib/parcours'
import { hasCompletedDiagnostic, type DiagnosticStatusInfo } from '@/lib/diagnostic-status'

const EMPTY: DiagnosticStatusInfo = {
  orgId: null,
  completed: false,
  status: null,
  diagnosticId: null,
  createdAt: null,
  restoredAt: null,
  hasRestitution: false,
}

const cache = new Map<string, { info: DiagnosticStatusInfo; at: number }>()

/**
 * Statut du diagnostic de l'organisation connectée, lu côté serveur
 * (`/api/me/diagnostic-status`) avec cache mémoire et resynchronisation
 * quand le parcours local est mis à jour (submit diagnostic).
 */
export function useDiagnosticStatus(orgId: string) {
  const [info, setInfo] = useState<DiagnosticStatusInfo | null>(() => (orgId && cache.has(orgId) ? cache.get(orgId)!.info : null))
  const [loading, setLoading] = useState<boolean>(() => !(orgId && cache.has(orgId)))
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/me/diagnostic-status', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Erreur serveur (${response.status})`)
      }
      const data = (await response.json()) as DiagnosticStatusInfo
      cache.set(orgId, { info: data, at: Date.now() })
      setInfo(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de vérifier votre diagnostic.')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (!orgId) {
      setInfo(null)
      setLoading(false)
      return
    }
    if (cache.has(orgId)) {
      setInfo(cache.get(orgId)!.info)
      setLoading(false)
    } else {
      void refresh()
    }
    const handler = () => void refresh()
    window.addEventListener('allneeds:parcours-changed', handler)
    return () => window.removeEventListener('allneeds:parcours-changed', handler)
  }, [orgId, refresh])

  const submittedAt = orgId ? readParcours(orgId).submittedAt : null
  const completed = hasCompletedDiagnostic(info ?? EMPTY, submittedAt)

  return { info: info ?? EMPTY, completed, loading, error, refresh }
}
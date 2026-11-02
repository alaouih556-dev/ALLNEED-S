import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/lib/accompagnement'
import type { Need, NeedStatus } from '@/types'

type NewNeed = Pick<Need, 'orgId' | 'title' | 'category' | 'categoryLabel' | 'description' | 'location' | 'budgetMax' | 'urgency' | 'deadline'> & { volume?: string | null }

async function toApiError(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string }
  return new ApiError(body.error || `Erreur serveur (${response.status})`, body.code, response.status)
}

export function useOperationalNeeds(fallbackNeeds: Need[] = []) {
  const { status } = useAuth()
  const live = status === 'authenticated'
  const [records, setRecords] = useState<Need[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!live) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/needs', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw await toApiError(response)
      setRecords(await response.json() as Need[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les besoins.')
    } finally { setLoading(false) }
  }, [live])

  useEffect(() => { void refresh() }, [refresh])

  const create = useCallback(async (input: NewNeed) => {
    const response = await fetch('/api/needs', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw await toApiError(response)
    const record = await response.json() as Need
    setRecords((current) => [record, ...current])
    setError('')
    return record
  }, [])

  const setStatus = useCallback(async (id: string, next: NeedStatus, label?: string) => {
    const response = await fetch(`/api/needs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next, label }),
    })
    if (!response.ok) throw await toApiError(response)
    const record = await response.json() as Need
    setRecords((current) => current.map((item) => item.id === id ? record : item))
    setError('')
  }, [])

  return { needs: live ? records : fallbackNeeds, live, loading: live && loading, error, refresh, create, setStatus }
}

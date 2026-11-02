import { useCallback, useEffect, useState } from 'react'
import { apiRequest, ApiError } from '@/lib/accompagnement'

export interface ApiResource<T> {
  data: T | null
  loading: boolean
  error: string
  code: string | null
  refresh: () => Promise<void>
  setData: (value: T | null) => void
}

/** Lecture d'une ressource API protégée, avec code d'erreur backend (ex. OFFER_REQUIRED). */
export function useApiResource<T>(path: string | null): ApiResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState('')
  const [code, setCode] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!path) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setCode(null)
    try {
      setData(await apiRequest<T>(path))
    } catch (cause) {
      const failure = cause as ApiError
      setError(failure.message || 'Une erreur est survenue.')
      setCode(failure.code ?? null)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, loading, error, code, refresh, setData }
}

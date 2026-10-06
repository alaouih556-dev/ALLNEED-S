/**
 * Client HTTP vers l'API ALLNEEDS (server/).
 *
 * Règle : aucune décision d'identité ou de permission n'est prise localement.
 * Le cookie de session est HttpOnly, il n'est jamais lisible ni modifiable par
 * le JavaScript du navigateur.
 */

const RAW_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? ''
export const API_BASE = RAW_BASE.replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: string[]

  constructor(status: number, code: string, message: string, details?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

const NETWORK_MESSAGE =
  "Service d'authentification injoignable. Démarrez l'API locale (npm run server) ou vérifiez la variable VITE_API_BASE."

type Options = Omit<RequestInit, 'body'> & { json?: unknown; timeoutMs?: number }

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { json, timeoutMs = 15000, ...init } = options
  const headers = new Headers(init.headers)
  if (json !== undefined) headers.set('content-type', 'application/json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      body: json === undefined ? init.body : JSON.stringify(json),
      credentials: 'include',
      signal: init.signal ?? controller.signal,
    })
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_MESSAGE)
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ApiError(response.status, 'invalid_response', 'Réponse illisible du serveur')
    }
  }

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string; details?: string[] } } | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'http_error',
      body?.error?.message ?? `Erreur serveur (${response.status})`,
      body?.error?.details,
    )
  }

  return payload as T
}

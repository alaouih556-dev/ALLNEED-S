import type { ClientRole, Role } from './permissions'

/**
 * Cache local du profil serveur.
 *
 * Cette valeur n'est JAMAIS la source de vérité : elle ne sert qu'à afficher
 * l'identité entre deux allers-retours. `verifySession()` revalide systématiquement
 * auprès de `GET /api/auth/me` et remplace le cache par la réponse du serveur.
 * Le cookie de session lui-même est HttpOnly et illisible par ce module.
 *
 * Ce module reste volontairement sans import de valeur : il est chargé tel quel
 * par `scripts/test-permissions.mjs`.
 */

export interface Session {
  role: Role
  userId: string
  orgId: string
  email: string
  createdAt: string
  clientRole?: ClientRole | null
  name?: string
}

export const SESSION_KEY = 'allneeds.session.v1'

const NETWORK_MESSAGE =
  "Service d'authentification injoignable. Démarrez l'API locale (npm run server) ou vérifiez VITE_API_BASE."

class SessionError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'SessionError'
    this.status = status
  }
}

export function isSessionError(error: unknown): error is SessionError {
  return error instanceof SessionError
}

const API_BASE = ((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '')

interface ServerUser {
  id: string
  email: string
  name?: string
  role: string
  clientRole?: string | null
  orgId?: string | null
  assignedOrgIds?: string[]
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function readSession(): Session | null {
  const target = storage()
  if (!target) return null
  try {
    const raw = target.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed || typeof parsed.role !== 'string') return null
    if (typeof parsed.userId !== 'string' || !parsed.userId) return null
    if (typeof parsed.orgId !== 'string') return null
    return {
      role: parsed.role as Role,
      userId: parsed.userId,
      orgId: parsed.orgId,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      clientRole: (parsed.clientRole ?? null) as ClientRole | null,
      name: typeof parsed.name === 'string' ? parsed.name : '',
    }
  } catch {
    return null
  }
}

export function writeSession(session: Session): Session {
  const target = storage()
  if (target) target.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession(): void {
  const target = storage()
  if (target) target.removeItem(SESSION_KEY)
}

export function sessionFromServerUser(user: ServerUser): Session {
  return {
    role: user.role as Role,
    userId: user.id,
    orgId: user.orgId ?? '',
    email: user.email ?? '',
    createdAt: new Date().toISOString(),
    clientRole: (user.clientRole ?? null) as ClientRole | null,
    name: user.name ?? '',
  }
}

async function call<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.method === 'POST' ? { 'content-type': 'application/json' } : undefined)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      credentials: 'include',
    })
  } catch {
    throw new SessionError(0, NETWORK_MESSAGE)
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new SessionError(response.status, 'Réponse illisible du serveur')
    }
  }
  if (!response.ok) {
    const body = payload as { error?: { message?: string } } | null
    throw new SessionError(response.status, body?.error?.message ?? `Erreur serveur (${response.status})`)
  }
  return payload as T
}

/** Connexion réelle : identifiants vérifiés et session délivrée par le serveur. */
export async function login(email: string, password: string): Promise<Session> {
  const data = await call<{ user: ServerUser }>('/api/auth/login', { method: 'POST', json: { email, password } })
  return writeSession(sessionFromServerUser(data.user))
}

/** Déconnexion : révocation côté serveur, puis effacement du cache local. */
export async function logout(): Promise<void> {
  try {
    await call('/api/auth/logout', { method: 'POST' })
  } catch {
    /* même si le serveur est injoignable, aucun profil local ne doit subsister */
  }
  clearSession()
}

/**
 * Revalidation système auprès du serveur.
 *
 * - navigateur : `GET /api/auth/me` ; 401 → cache effacé et null renvoyé ;
 *   erreur réseau → exception (l'écran d'erreur l'explique) ;
 * - rendu serveur (SSR) : aucun appel réseau, le cache local est lu tel quel.
 */
export async function verifySession(): Promise<Session | null> {
  if (typeof window === 'undefined') return readSession()
  try {
    const data = await call<{ user: ServerUser }>('/api/auth/me')
    return writeSession(sessionFromServerUser(data.user))
  } catch (error) {
    if (isSessionError(error) && error.status === 401) {
      clearSession()
      return null
    }
    throw error
  }
}

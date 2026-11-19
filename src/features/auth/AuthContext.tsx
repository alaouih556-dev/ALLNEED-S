import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'concierge' | 'dirigeant' | 'manager' | 'collaborateur' | 'sales' | string
  orgIds: string[]
  name: string
  phone?: string
  firstName?: string
  lastName?: string
  city?: string
  jobTitle?: string
  active?: boolean
  permissions?: string[]
  sectors?: Array<'sante' | 'enseignement' | 'tourisme'>
  organization?: { id:string; name:string; slug:string; sector?:string; city?:string; kind?:string; size?:string; contactName?:string; contactRole?:string; contactEmail?:string; contactPhone?:string; active:boolean; modules:Record<string,boolean>; saas?: { subscriptionActive?:boolean; enabled?:boolean; startDate?:string|null; endDate?:string|null; plan?:string|null } | null } | null
}

type AuthState = {
  status: 'loading' | 'anonymous' | 'authenticated'
  user: AuthUser | null
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Espace de travail ouvert par défaut pour un rôle (null si aucun espace n’existe). */
export function workspacePathForRole(role?: string | null): '/admin' | '/concierge' | '/expert' | '/app' | '/sales-presentation' | '/crm' | null {
  if (role === 'admin') return '/admin'
  if (role === 'agent') return '/crm'
  if (role === 'sales') return '/sales-presentation'
  if (role === 'concierge') return '/concierge'
  if (role === 'prestataire') return '/expert'
  if (role && ['dirigeant', 'manager', 'collaborateur'].includes(role)) return '/app'
  return null
}

/** Permission accordée par un administrateur à un concierge pour ouvrir la présentation commerciale. */
export const SALES_PERMISSION = 'sales_presentation'

/**
 * Accès à la présentation commerciale : administrateurs, comptes `sales`,
 * et concierges ayant reçu la permission. Le serveur applique la même règle.
 */
export function canAccessSalesPresentation(user?: Pick<AuthUser, 'role' | 'permissions' | 'active'> | null) {
  if (!user || user.active === false) return false
  if (user.role === 'admin' || user.role === 'sales') return true
  return user.role === 'concierge' && (user.permissions ?? []).includes(SALES_PERMISSION)
}

async function readError(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  return body.error || 'La connexion a échoué. Réessayez.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('Session absente')
      setUser(await response.json() as AuthUser)
      setStatus('authenticated')
    } catch {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    let response: Response
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
    } catch {
      throw new Error('Le service de connexion est indisponible. Démarrez le serveur ALLNEEDS puis réessayez.')
    }
    if (!response.ok) throw new Error(await readError(response))
    const result = await response.json() as { user: AuthUser }
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(() => ({ status, user, login, logout, refresh }), [status, user, login, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}

import { dispatchDemo } from '@/store/store'
import type { Session } from './session'

/**
 * Aligne l'identité du store local (jeu de démonstration) sur la session serveur
 * vérifiée. Sans cela, un compte dont l'entreprise n'est pas provisionnée
 * afficherait par défaut les données d'une autre société.
 */
export function syncIdentity(session: Session | null | undefined): void {
  if (!session) return
  dispatchDemo({
    type: 'IDENTITY_SYNC',
    userId: session.userId,
    role: session.role,
    orgId: session.orgId,
    clientRole: session.clientRole ?? null,
    name: session.name ?? '',
    email: session.email,
  })
}

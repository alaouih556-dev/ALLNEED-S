import { positionOf } from './organization.mjs'

const CLIENT_ROLES = new Set(['dirigeant', 'manager', 'collaborateur'])
const COMMERCIAL_FIELD_ROLES = new Set(['agent', 'crm'])

/** Droits Studio IA et sites web, à partir des rôles et affectations existants. */
export function createProjectAccess({ db, accessFailure }) {
  const isAdmin = (user) => user?.role === 'admin'
  const isClient = (user) => CLIENT_ROLES.has(user?.role)
  /** Il n'existe pas de rôle dédié : les développeurs sont les membres de l'équipe Dev — AI — Automation. */
  const isDeveloper = (user) => user?.role === 'staff' && user.active !== false && positionOf(user)?.teamId === 'dev-ai'
  const managesAllClients = (user) => {
    const position = positionOf(user)
    if (!position || position.departmentId !== 'commercial' || isAdmin(user)) return false
    return position.level === 'department_manager' || (position.level === 'team_manager' && position.teamId === 'account-manager')
  }
  const isCommercial = (user) => user?.role === 'concierge' || COMMERCIAL_FIELD_ROLES.has(user?.role) || managesAllClients(user)

  /** Entreprises dont ce compte peut gérer les projets. */
  function managedOrgIds(user) {
    if (isAdmin(user) || managesAllClients(user)) return db.orgs.filter((org) => org.active !== false).map((org) => org.id)
    if (isClient(user)) return accessFailure(user) ? [] : (user.orgIds || []).slice(0, 1)
    if (user?.role === 'concierge') return (user.orgIds || []).filter((id) => db.orgs.some((org) => org.id === id && org.active !== false))
    return []
  }
  const canManageOrg = (user, orgId) => Boolean(orgId) && managedOrgIds(user).includes(orgId)
  const canUseStudio = (user) => isAdmin(user) || isCommercial(user) || (isClient(user) && !accessFailure(user))
  const canRequestWebsite = (user) => managedOrgIds(user).length > 0

  const toolsFor = (user) => ({
    studio: canUseStudio(user),
    websites: canRequestWebsite(user),
    developer: isDeveloper(user),
    websiteAdmin: isAdmin(user),
  })

  return { isAdmin, isClient, isDeveloper, isCommercial, managedOrgIds, canManageOrg, canUseStudio, canRequestWebsite, toolsFor }
}

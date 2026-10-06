/**
 * Matrice de permissions — ALLNEEDS
 *
 * Source de vérité côté serveur. Chaque route doit appeler `can()` (ou l'un des
 * helpers `canRead*` / `canWrite*`) AVANT toute lecture ou écriture, en plus du
 * contrôle de périmètre `canAccessOrg`.
 *
 * Un actor est soit une chaîne (rôle), soit un utilisateur
 * `{ role, clientRole?, assignedOrgIds?, orgId? }`.
 *
 * Les sous-rôles client (dirigeant / manager / collaborateur) sont portés par
 * `clientRole` et non par le rôle : ils partagent le même périmètre d'entreprise
 * mais n'ont pas les mêmes droits.
 */

export const CLIENT_ROLES = ['dirigeant', 'manager', 'collaborateur']

export const CLIENT_ROLE_PERMISSIONS = {
  // Décideur : voit et engage l'entreprise (diagnostic, priorités, missions,
  // équipe, préférences). Ne peut pas se donner un rôle global ALLNEEDS.
  dirigeant: [
    'org:read:own',
    'org:update:own',
    'member:invite:own',
    'member:revoke:own',
    'diagnostic:read:own',
    'diagnostic:write:own',
    'mission:read:own',
    'mission:write:own',
    'decision:write',
    'consent:validate',
  ],
  // Responsable : uniquement ce qui lui est confié. Pas de score ni de
  // synthèse de direction par défaut.
  manager: ['org:read:own', 'mission:read:own', 'mission:write:own', 'activity:write'],
  // Collaborateur : exécution seule, sans score, sans commentaire confidentiel,
  // sans offre commerciale, sans autre équipe ni synthèse de direction.
  collaborateur: ['org:read:own', 'mission:read:assigned', 'mission:write:assigned'],
}

export const ROLE_PERMISSIONS = {
  admin: [
    'org:read:all',
    'org:update',
    'member:invite',
    'member:revoke',
    'user:manage',
    'concierge:manage',
    'portfolio:assign',
    'diagnostic:read:all',
    'diagnostic:write:all',
    'crm:read',
    'crm:write',
    'audit:read',
  ],
  concierge: [
    'org:read:assigned',
    'org:update:assigned',
    'diagnostic:read:assigned',
    'diagnostic:write:assigned',
    'mission:read:assigned',
    'mission:write:assigned',
    'crm:read',
    'followup:write',
    'appointment:write',
    'message:write',
    'audit:read:assigned',
  ],
  // Périmètre CRM : prospects, contacts, pipeline, diagnostic Express de
  // qualification. Aucun accès opérationnel ni confidentiel d'une entreprise.
  commercial: ['crm:read', 'crm:write', 'lead:write', 'diagnostic:express:run'],
  // Expert / partenaire : strictement limité aux missions attribuées.
  expert: ['org:read:assigned', 'mission:read:assigned', 'mission:write:assigned', 'deliverable:write'],
}

const ROLES = Object.keys(ROLE_PERMISSIONS)

export function actorRole(actor) {
  if (typeof actor === 'string') return actor
  return actor && typeof actor.role === 'string' ? actor.role : null
}

export function permissionsOf(actor) {
  const role = actorRole(actor)
  if (role === 'client') {
    const sub = actor && typeof actor === 'object' && CLIENT_ROLES.includes(actor.clientRole)
      ? actor.clientRole
      : 'dirigeant'
    return CLIENT_ROLE_PERMISSIONS[sub]
  }
  if (!role || !ROLE_PERMISSIONS[role]) return []
  return ROLE_PERMISSIONS[role]
}

export function can(actor, permission) {
  return permissionsOf(actor).includes(permission)
}

export function canAny(actor, permissions) {
  return permissions.some((permission) => can(actor, permission))
}

export function isValidRole(role) {
  return typeof role === 'string' && (ROLES.includes(role) || role === 'client')
}

export function canReadOrg(actor) {
  return canAny(actor, ['org:read:all', 'org:read:assigned', 'org:read:own'])
}

export function canReadDiagnostic(actor) {
  return canAny(actor, ['diagnostic:read:all', 'diagnostic:read:assigned', 'diagnostic:read:own'])
}

export function canWriteDiagnostic(actor) {
  return canAny(actor, ['diagnostic:write:all', 'diagnostic:write:assigned', 'diagnostic:write:own'])
}

export function auditScope(actor) {
  if (can(actor, 'audit:read')) return 'all'
  if (can(actor, 'audit:read:assigned')) return 'assigned'
  return null
}

export function accessibleOrgIds(actor, state) {
  if (!actor) return []
  const role = actorRole(actor)
  if (role === 'admin') return state.orgs.map((org) => org.id)
  if (role === 'client') return actor.orgId ? [actor.orgId] : []
  if (role === 'concierge' || role === 'expert') {
    return Array.isArray(actor.assignedOrgIds) ? [...new Set(actor.assignedOrgIds)] : []
  }
  return []
}

export function canAccessOrg(actor, orgId, state) {
  if (!orgId) return false
  return accessibleOrgIds(actor, state).includes(orgId)
}

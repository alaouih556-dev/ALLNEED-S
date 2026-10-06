/**
 * Habilitations côté interface.
 *
 * Cette matrice sert uniquement à afficher ou masquer des commandes. Elle est
 * alignée sur `server/policy.mjs`, mais elle n'est PAS une sécurité : toutes les
 * lectures et écritures sont contrôlées à nouveau par l'API.
 */

export type Role = 'client' | 'admin' | 'concierge' | 'expert' | 'commercial'
export type ClientRole = 'dirigeant' | 'manager' | 'collaborateur'

export type Permission =
  | 'org:read:own'
  | 'org:read:assigned'
  | 'org:read:all'
  | 'org:update'
  | 'org:update:own'
  | 'org:update:assigned'
  | 'member:invite'
  | 'member:invite:own'
  | 'member:revoke'
  | 'member:revoke:own'
  | 'user:manage'
  | 'concierge:manage'
  | 'portfolio:assign'
  | 'diagnostic:read:own'
  | 'diagnostic:read:assigned'
  | 'diagnostic:read:all'
  | 'diagnostic:write:own'
  | 'diagnostic:write:assigned'
  | 'diagnostic:write:all'
  | 'diagnostic:express:run'
  | 'mission:read:own'
  | 'mission:read:assigned'
  | 'mission:write:own'
  | 'mission:write:assigned'
  | 'crm:read'
  | 'crm:write'
  | 'lead:write'
  | 'followup:write'
  | 'appointment:write'
  | 'message:write'
  | 'activity:write'
  | 'decision:write'
  | 'consent:validate'
  | 'deliverable:write'
  | 'audit:read'
  | 'audit:read:assigned'

export const CLIENT_ROLE_PERMISSIONS: Record<ClientRole, readonly Permission[]> = {
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
  manager: ['org:read:own', 'mission:read:own', 'mission:write:own', 'activity:write'],
  collaborateur: ['org:read:own', 'mission:read:assigned', 'mission:write:assigned'],
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
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
  client: CLIENT_ROLE_PERMISSIONS.dirigeant,
  commercial: ['crm:read', 'crm:write', 'lead:write', 'diagnostic:express:run'],
  expert: ['org:read:assigned', 'mission:read:assigned', 'mission:write:assigned', 'deliverable:write'],
}

export type PermissionSubject = Role | { role: Role | null | undefined; clientRole?: ClientRole | null }

function resolve(subject: PermissionSubject): readonly Permission[] {
  if (typeof subject === 'string') {
    if (subject === 'client') return CLIENT_ROLE_PERMISSIONS.dirigeant
    return ROLE_PERMISSIONS[subject] ?? []
  }
  const role = subject?.role
  if (!role) return []
  if (role === 'client') {
    const sub = subject.clientRole && subject.clientRole in CLIENT_ROLE_PERMISSIONS ? subject.clientRole : 'dirigeant'
    return CLIENT_ROLE_PERMISSIONS[sub]
  }
  return ROLE_PERMISSIONS[role] ?? []
}

export function can(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false
  return resolve(subject).includes(permission)
}

const ROUTE_ROLES: Record<string, Role> = {
  '/admin': 'admin',
  '/concierge': 'concierge',
  '/expert': 'expert',
  '/app': 'client',
}

export function requiredRoleFor(pathname: string): Role | null {
  let required: Role | null = null
  let matched = -1
  for (const prefix of Object.keys(ROUTE_ROLES)) {
    const hit = pathname === prefix || pathname.startsWith(`${prefix}/`)
    if (hit && prefix.length > matched) {
      required = ROUTE_ROLES[prefix]
      matched = prefix.length
    }
  }
  return required
}

export function canAccessPath(role: Role | null | undefined, pathname: string): boolean {
  const required = requiredRoleFor(pathname)
  if (!required) return true
  return role === required
}

export const GUARDED_PATHS = Object.keys(ROUTE_ROLES)

import { DEPARTMENTS, LABELS, PERMISSIONS, isCrmManagerPosition, positionOf } from './organization.mjs'
import { AGENT_PERMISSIONS } from './crm.mjs'

/* ------------------------------------------------------------------ */
/* Comptes & accès : vue et gestion de tous les comptes (PDG uniquement) */
/* ------------------------------------------------------------------ */

export const ROLE_LABELS = {
  admin: 'PDG / Administrateur',
  staff: 'Équipe interne',
  concierge: 'Account Manager',
  agent: 'Agent CRM',
  crm: 'CRM + Sales Presentation',
  sales: 'Sales Presentation',
  dirigeant: 'Dirigeant (client)',
  manager: 'Manager (client)',
  collaborateur: 'Collaborateur (client)',
  prestataire: 'Prestataire',
}
const ASSIGNABLE_ROLES = ['admin', 'staff', 'concierge', 'agent', 'crm', 'sales', 'dirigeant', 'manager', 'collaborateur']
const INTERNAL_ROLES = new Set(['staff', 'concierge', 'agent', 'crm'])
const CLIENT_ROLES = new Set(['dirigeant', 'manager', 'collaborateur'])
const CRM_FIELD_ROLES = new Set(['agent', 'crm'])
const SALES_TOGGLE_ROLES = new Set(['staff', 'concierge'])
/** Équipes compatibles avec chaque rôle : le rôle détermine les outils réellement ouverts. */
const TEAMS_BY_ROLE = {
  staff: ['dev-ai', 'community', 'design', 'strategies'],
  concierge: ['account-manager'],
  agent: ['teleprospection'],
  crm: ['teleprospection'],
}
const DEFAULT_POSITION = {
  concierge: { level: 'member', departmentId: 'commercial', teamId: 'account-manager', strategyManager: false },
  agent: { level: 'member', departmentId: 'commercial', teamId: 'teleprospection', strategyManager: false },
  crm: { level: 'member', departmentId: 'commercial', teamId: 'teleprospection', strategyManager: false },
}

const httpError = (status, message) => Object.assign(new Error(message), { status })
const isActiveAdmin = (user) => user.role === 'admin' && user.active !== false

function cleanList(value, allowed, field) {
  if (value === null) return null
  if (!Array.isArray(value) || value.some((item) => !allowed.includes(item))) throw httpError(400, `${field} invalides`)
  return [...new Set(value)]
}

function cleanPosition(role, input) {
  const level = input?.level
  if (!['department_manager', 'team_manager', 'member'].includes(level)) throw httpError(400, 'niveau invalide')
  const department = DEPARTMENTS.find((item) => item.id === input.departmentId)
  if (!department) throw httpError(400, 'service requis')
  const allowedTeams = TEAMS_BY_ROLE[role]
  if (role !== 'staff' && department.id !== 'commercial') throw httpError(400, 'ce rôle appartient au Service Commerciale')
  const teamId = level === 'department_manager' ? null : input.teamId
  if (level !== 'department_manager' && (!department.teams.some((team) => team.id === teamId) || !allowedTeams.includes(teamId))) throw httpError(400, 'équipe incompatible avec ce rôle')
  const strategyManager = input.strategyManager === true
  if (strategyManager && department.id !== 'marketing') throw httpError(400, 'le responsable des stratégies appartient au Service Marketing')
  return { level, departmentId: department.id, teamId, strategyManager }
}

export function createAccounts({ db, saveDb, json, readBody, audit, organization, crm, canAccessSalesPresentation, salesPermission, ownerPermissions, moduleKeys, defaultModules }) {
  const view = (user, actor) => {
    const position = positionOf(user)
    const org = CLIENT_ROLES.has(user.role) ? db.orgs.find((item) => (user.orgIds || []).includes(item.id)) : null
    const crmManaged = isCrmManagerPosition(user)
    return {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] || user.role,
      active: user.active !== false,
      passwordConfigured: user.passwordConfigured === true,
      lastLoginAt: user.lastLoginAt || null,
      isSelf: user.id === actor.id,
      organization: org ? { id: org.id, name: org.name, modules: { ...defaultModules, ...(org.modules || {}) } } : null,
      portfolio: user.role === 'concierge' ? (user.orgIds || []).length : null,
      position: position && user.role !== 'admin' ? { ...position, levelLabel: LABELS[position.level] } : null,
      access: {
        orgPermissions: position ? organization.permissionsOf(user).filter((item) => PERMISSIONS.includes(item)) : [],
        orgCustom: Array.isArray(user.orgPermissions),
        crmPermissions: CRM_FIELD_ROLES.has(user.role) && !crmManaged ? crm.permissionsOf(user).filter((item) => AGENT_PERMISSIONS.includes(item)) : [],
        crmCustom: Array.isArray(user.crm?.permissions),
        crmFull: user.role === 'admin' || crmManaged,
        salesPresentation: canAccessSalesPresentation(user),
      },
    }
  }

  async function handle(req, res, url, user, cors) {
    if (!url.pathname.startsWith('/api/org/accounts')) return false
    if (user.role !== 'admin') { json(res, 403, { error: 'réservé au PDG' }, cors); return true }

    if (url.pathname === '/api/org/accounts' && req.method === 'GET') {
      json(res, 200, {
        accounts: db.users.map((item) => view(item, user)).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
        catalog: {
          roles: ASSIGNABLE_ROLES.map((id) => ({ id, label: ROLE_LABELS[id] })),
          structure: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, teams: d.teams.map((t) => ({ id: t.id, name: t.name })) })),
          teamsByRole: TEAMS_BY_ROLE,
          orgPermissions: PERMISSIONS,
          crmPermissions: AGENT_PERMISSIONS,
          modules: moduleKeys,
        },
        organizations: db.orgs.map((org) => ({ id: org.id, name: org.name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      }, cors)
      return true
    }

    const match = url.pathname.match(/^\/api\/org\/accounts\/([^/]+)$/)
    if (!match || req.method !== 'PATCH') { json(res, 404, { error: 'route inconnue' }, cors); return true }
    const target = db.users.find((item) => item.id === match[1])
    if (!target) throw httpError(404, 'compte introuvable')
    const body = await readBody(req)

    // Validation complète avant toute écriture : une demande refusée ne modifie rien.
    const role = body.role ?? target.role
    const roleChanged = role !== target.role
    if (roleChanged && !ASSIGNABLE_ROLES.includes(role)) throw httpError(400, 'rôle invalide')
    const active = typeof body.active === 'boolean' ? body.active : target.active !== false
    if (target.id === user.id && (roleChanged || !active)) throw httpError(400, 'vous ne pouvez pas retirer vos propres droits')
    if (isActiveAdmin(target) && (role !== 'admin' || !active) && db.users.filter(isActiveAdmin).length <= 1) throw httpError(400, 'il doit rester au moins un PDG actif')

    let organizationId = null
    if (CLIENT_ROLES.has(role)) {
      organizationId = body.organizationId ?? (CLIENT_ROLES.has(target.role) ? target.orgIds?.[0] : null)
      if (!db.orgs.some((org) => org.id === organizationId)) throw httpError(400, 'entreprise requise pour un compte client')
    }

    let position = null
    if (INTERNAL_ROLES.has(role)) {
      if (body.position) position = cleanPosition(role, body.position)
      else {
        const current = target.role === 'admin' ? null : positionOf(target)
        try { position = current ? cleanPosition(role, current) : null } catch { position = null }
        position ||= DEFAULT_POSITION[role] || null
        if (!position) throw httpError(400, 'choisissez un service et une équipe')
      }
    }

    const orgPermissions = 'orgPermissions' in body ? cleanList(body.orgPermissions, PERMISSIONS, 'permissions') : undefined
    const crmPermissions = 'crmPermissions' in body ? cleanList(body.crmPermissions, AGENT_PERMISSIONS, 'permissions CRM') : undefined
    if (orgPermissions !== undefined && !INTERNAL_ROLES.has(role)) throw httpError(400, 'permissions réservées à l’équipe interne')
    if (crmPermissions !== undefined && !CRM_FIELD_ROLES.has(role)) throw httpError(400, 'permissions CRM réservées aux comptes CRM')
    if ('salesPresentation' in body && !SALES_TOGGLE_ROLES.has(role)) throw httpError(400, 'cet accès dépend du rôle')
    let companyModules = null
    if (body.companyModules !== undefined) {
      if (!organizationId || typeof body.companyModules !== 'object' || Array.isArray(body.companyModules)) throw httpError(400, 'modules invalides')
      if (Object.entries(body.companyModules).some(([key, value]) => !moduleKeys.includes(key) || typeof value !== 'boolean')) throw httpError(400, 'modules invalides')
      companyModules = body.companyModules
    }

    if (roleChanged) {
      const sameCompany = CLIENT_ROLES.has(target.role) && CLIENT_ROLES.has(role) && target.orgIds?.[0] === organizationId
      target.role = role
      delete target.orgPermissions
      if (target.crm) delete target.crm.permissions
      if (role === 'admin') { target.orgIds = ['*']; target.permissions = ['*'] }
      else if (role === 'dirigeant') target.permissions = [...ownerPermissions]
      else if (CLIENT_ROLES.has(role)) target.permissions = sameCompany ? (target.permissions || []).filter((item) => item !== '*') : ['documents', 'messages']
      else target.permissions = []
      if (role !== 'admin' && role !== 'concierge' && !CLIENT_ROLES.has(role)) target.orgIds = []
      if (role === 'concierge' && (target.orgIds || []).includes('*')) target.orgIds = []
    }
    if (CLIENT_ROLES.has(role)) target.orgIds = [organizationId]
    if (INTERNAL_ROLES.has(role)) target.orgPosition = position
    else delete target.orgPosition
    if (CRM_FIELD_ROLES.has(role)) target.crm ||= { databaseIds: [], campaignIds: [], zoneIds: [] }
    if (orgPermissions === null) delete target.orgPermissions
    else if (orgPermissions) target.orgPermissions = orgPermissions
    if (crmPermissions === null) delete target.crm.permissions
    else if (crmPermissions) target.crm.permissions = crmPermissions
    if (typeof body.salesPresentation === 'boolean') {
      const others = (target.permissions || []).filter((item) => item !== salesPermission)
      target.permissions = body.salesPresentation ? [...others, salesPermission] : others
    }
    target.active = active
    if (target.status) target.status = active ? 'active' : 'inactive'
    if (companyModules) {
      const org = db.orgs.find((item) => item.id === organizationId)
      org.modules = { ...defaultModules, ...(org.modules || {}), ...companyModules }
    }
    saveDb(db)
    audit('account.access.updated', { by: user.id, target: target.id, role: target.role, active, fields: Object.keys(body) })
    json(res, 200, view(target, user), cors)
    return true
  }

  return { handle }
}

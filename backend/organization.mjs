import { randomBytes } from 'node:crypto'

/* ------------------------------------------------------------------ */
/* Structure de l'entreprise                                           */
/* ------------------------------------------------------------------ */

export const DEPARTMENTS = [
  {
    id: 'marketing',
    name: 'Service Marketing',
    teams: [
      { id: 'dev-ai', name: 'Dev — AI — Automation', role: 'staff' },
      { id: 'community', name: 'Community Management', role: 'staff' },
      { id: 'design', name: 'Infographic — Photography — Designer', role: 'staff' },
      { id: 'strategies', name: 'Marketing Strategies', role: 'staff' },
    ],
  },
  {
    id: 'commercial',
    name: 'Service Commerciale',
    teams: [
      { id: 'teleprospection', name: 'Teleprospection — CRM / Call Center', role: 'agent' },
      { id: 'account-manager', name: 'Account Manager', role: 'concierge' },
    ],
  },
]

const ALL_TEAMS = DEPARTMENTS.flatMap((d) => d.teams.map((t) => ({ ...t, departmentId: d.id })))
const teamById = (id) => ALL_TEAMS.find((t) => t.id === id) || null
const departmentById = (id) => DEPARTMENTS.find((d) => d.id === id) || null

export const LEVELS = ['pdg', 'department_manager', 'team_manager', 'member']
const LEVEL_RANK = { pdg: 3, department_manager: 2, team_manager: 1, member: 0 }

/** Droits configurables par niveau. `settings.manage` reste réservé au PDG. */
export const PERMISSIONS = ['department.view', 'team.view', 'members.view', 'members.manage', 'tasks.view', 'tasks.manage', 'strategies.view', 'strategies.manage', 'accounts.view', 'performance.view']
const DEFAULT_LEVEL_PERMISSIONS = {
  department_manager: ['department.view', 'team.view', 'members.view', 'members.manage', 'tasks.view', 'tasks.manage', 'strategies.view', 'accounts.view', 'performance.view'],
  team_manager: ['team.view', 'members.view', 'tasks.view', 'tasks.manage', 'strategies.view', 'accounts.view', 'performance.view'],
  member: ['team.view', 'tasks.view'],
}
const STRATEGY_MANAGER_PERMISSIONS = ['strategies.view', 'strategies.manage', 'tasks.view', 'tasks.manage', 'members.view']

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done']
const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent']
const STRATEGY_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived']
const MANAGEABLE_ROLES = new Set(['staff', 'agent', 'crm', 'concierge'])

const httpError = (status, message) => Object.assign(new Error(message), { status })
const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}-${randomBytes(10).toString('hex')}`

function text(value, max, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `${field} requis`)
    return ''
  }
  if (typeof value !== 'string') throw httpError(400, `${field} invalide`)
  const clean = value.trim()
  if (required && !clean) throw httpError(400, `${field} requis`)
  if (clean.length > max) throw httpError(400, `${field} trop long (${max} caractères maximum)`)
  return clean
}
function oneOf(value, list, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (!list.includes(value)) throw httpError(400, `${field} invalide`)
  return value
}
function dateOrNull(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))) throw httpError(400, `${field} invalide`)
  return value
}
function numberOrNull(value, field) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw httpError(400, `${field} invalide`)
  return n
}

/* ------------------------------------------------------------------ */
/* Position d'un utilisateur dans l'organisation                        */
/* ------------------------------------------------------------------ */

/** Position effective : celle enregistrée, sinon celle déduite du rôle historique. */
export function positionOf(user) {
  if (!user) return null
  if (user.role === 'admin') return { level: 'pdg', departmentId: null, teamId: null, strategyManager: true }
  const stored = user.orgPosition
  if (stored?.level && LEVELS.includes(stored.level)) {
    return { level: stored.level, departmentId: stored.departmentId || null, teamId: stored.teamId || null, strategyManager: stored.strategyManager === true }
  }
  if (user.role === 'concierge') return { level: 'member', departmentId: 'commercial', teamId: 'account-manager', strategyManager: false }
  if (user.role === 'agent' || user.role === 'crm') return { level: 'member', departmentId: 'commercial', teamId: 'teleprospection', strategyManager: false }
  return null
}

/** Accès CRM selon la hiérarchie : direction commerciale et responsable de la téléprospection administrent le CRM. */
export function isCrmManagerPosition(user) {
  const p = positionOf(user)
  if (!p || p.departmentId !== 'commercial') return false
  return p.level === 'department_manager' || (p.level === 'team_manager' && p.teamId === 'teleprospection')
}

export const LABELS = { pdg: 'PDG', department_manager: 'Responsable de service', team_manager: 'Responsable d’équipe', member: 'Membre d’équipe' }

export function createOrganization({ db, saveDb, json, readBody, audit, createInvitation, sendInvitationEmail, pushNotification }) {
  const orgSettings = () => {
    let s = db.orgSettings.find((x) => x.id === 'settings')
    // Les valeurs par défaut ne sont enregistrées qu'à la première modification.
    if (!s) s = { id: 'settings', levelPermissions: structuredClone(DEFAULT_LEVEL_PERMISSIONS) }
    for (const level of Object.keys(DEFAULT_LEVEL_PERMISSIONS)) if (!Array.isArray(s.levelPermissions?.[level])) (s.levelPermissions ||= {})[level] = [...DEFAULT_LEVEL_PERMISSIONS[level]]
    return s
  }

  function permissionsOf(user) {
    const p = positionOf(user)
    if (!p) return []
    if (p.level === 'pdg') return [...PERMISSIONS, 'org.overview', 'settings.manage']
    // Réglage individuel défini par le PDG : il remplace les droits du niveau.
    if (Array.isArray(user.orgPermissions)) return user.orgPermissions.filter((perm) => PERMISSIONS.includes(perm))
    const granted = new Set(orgSettings().levelPermissions[p.level] || [])
    if (p.strategyManager) for (const perm of STRATEGY_MANAGER_PERMISSIONS) granted.add(perm)
    return [...granted]
  }
  const can = (user, perm) => permissionsOf(user).includes(perm)
  const need = (user, perm) => { if (!can(user, perm)) throw httpError(403, 'action non autorisée') }

  const members = () => db.users.filter((u) => positionOf(u) && u.role !== 'admin')
  const seesDepartment = (p, departmentId) => p.level === 'pdg' || p.departmentId === departmentId
  const managesDepartment = (p, departmentId) => p.level === 'pdg' || (p.level === 'department_manager' && p.departmentId === departmentId)
  const seesTeam = (p, team) => managesDepartment(p, team.departmentId) || p.teamId === team.id
  const isMarketingPosition = (p) => p.level === 'pdg' || p.departmentId === 'marketing' || p.strategyManager

  function memberInScope(viewer, target) {
    const v = positionOf(viewer)
    const t = positionOf(target)
    if (!v || !t) return false
    if (v.level === 'pdg' || viewer.id === target.id) return true
    if (v.strategyManager && t.departmentId === 'marketing') return true
    if (v.level === 'department_manager') return t.departmentId === v.departmentId
    return Boolean(v.teamId) && t.teamId === v.teamId
  }

  const publicMember = (u) => {
    const p = positionOf(u)
    return { id: u.id, name: u.name || u.email, email: u.email, role: u.role, active: u.active !== false, passwordConfigured: u.passwordConfigured === true, level: p.level, levelLabel: LABELS[p.level], departmentId: p.departmentId, teamId: p.teamId, strategyManager: p.strategyManager, lastLoginAt: u.lastLoginAt || null }
  }

  /* ---------- Tâches ---------- */
  function taskVisible(user, task) {
    const p = positionOf(user)
    if (!p) return false
    if (task.assigneeId === user.id || task.createdBy === user.id) return true
    if (managesDepartment(p, task.departmentId)) return true
    if (p.strategyManager && task.departmentId === 'marketing') return true
    return p.level === 'team_manager' && Boolean(task.teamId) && p.teamId === task.teamId
  }
  function canManageTask(user, departmentId, teamId) {
    if (!can(user, 'tasks.manage')) return false
    const p = positionOf(user)
    if (managesDepartment(p, departmentId)) return true
    if (p.strategyManager && departmentId === 'marketing') return true
    return p.level === 'team_manager' && Boolean(teamId) && p.teamId === teamId
  }
  const isOverdue = (t) => Boolean(t.dueDate) && t.status !== 'done' && t.dueDate < new Date().toISOString().slice(0, 10)
  const taskStats = (tasks) => {
    const done = tasks.filter((t) => t.status === 'done').length
    return { total: tasks.length, open: tasks.length - done, done, overdue: tasks.filter(isOverdue).length, blocked: tasks.filter((t) => t.status === 'blocked').length, completion: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  }
  const taskOut = (t) => {
    const assignee = db.users.find((u) => u.id === t.assigneeId)
    const strategy = t.strategyId ? db.orgStrategies.find((s) => s.id === t.strategyId) : null
    return { ...t, assigneeName: assignee?.name || assignee?.email || null, strategyTitle: strategy?.title || null, overdue: isOverdue(t) }
  }
  function validateAssignee(assigneeId, departmentId, teamId) {
    if (!assigneeId) return null
    const target = db.users.find((u) => u.id === assigneeId && u.active !== false)
    const p = positionOf(target)
    if (!p) throw httpError(400, 'personne assignée introuvable')
    if (p.level === 'pdg') return target.id
    if (p.departmentId !== departmentId) throw httpError(400, 'la personne assignée n’appartient pas à ce service')
    if (teamId && p.teamId !== teamId && p.level !== 'department_manager') throw httpError(400, 'la personne assignée n’appartient pas à cette équipe')
    return target.id
  }

  /* ---------- Stratégies ---------- */
  const strategyVisible = (user, strategy) => {
    if (!can(user, 'strategies.view')) return db.orgTasks.some((t) => t.strategyId === strategy.id && t.assigneeId === user.id)
    return isMarketingPosition(positionOf(user)) || db.orgTasks.some((t) => t.strategyId === strategy.id && t.assigneeId === user.id)
  }
  const canManageStrategies = (user) => can(user, 'strategies.manage') && isMarketingPosition(positionOf(user))
  function cleanObjectives(list) {
    if (!Array.isArray(list)) throw httpError(400, 'objectifs invalides')
    if (list.length > 30) throw httpError(400, 'trop d’objectifs')
    return list.map((o) => ({
      id: typeof o?.id === 'string' && o.id ? o.id.slice(0, 40) : newId('obj'),
      title: text(o?.title, 200, 'objectif', { required: true }),
      metric: text(o?.metric, 80, 'indicateur'),
      target: numberOrNull(o?.target, 'cible'),
      current: numberOrNull(o?.current, 'valeur actuelle'),
      unit: text(o?.unit, 20, 'unité'),
      dueDate: dateOrNull(o?.dueDate, 'échéance'),
    }))
  }
  function strategyOut(s, user) {
    const tasks = db.orgTasks.filter((t) => t.strategyId === s.id)
    const measured = s.objectives.filter((o) => Number(o.target) > 0 && o.current !== null)
    const objectiveProgress = measured.length ? Math.round(measured.reduce((sum, o) => sum + Math.min(100, (Number(o.current) / Number(o.target)) * 100), 0) / measured.length) : null
    const owner = db.users.find((u) => u.id === s.ownerId)
    return { ...s, ownerName: owner?.name || owner?.email || null, taskStats: taskStats(tasks), objectiveProgress, canManage: canManageStrategies(user) }
  }

  /* ---------- Indicateurs ---------- */
  function commercialStats() {
    const reachedStatuses = new Set(['answered', 'callback_requested', 'interested', 'not_interested', 'appointment_booked', 'completed'])
    const calls = db.crmCalls.filter((c) => !c.deletedAt)
    const contacts = db.crmContacts.filter((c) => !c.archived)
    const calledIds = new Set(calls.map((c) => c.contactId))
    const appointments = db.crmAppointments.filter((a) => a.status !== 'cancelled')
    const appointmentIds = new Set(appointments.map((a) => a.contactId))
    const converted = [...calledIds].filter((id) => appointmentIds.has(id)).length
    return {
      contacts: contacts.length,
      calls: calls.length,
      reached: calls.filter((c) => reachedStatuses.has(c.status)).length,
      appointments: appointments.length,
      callbacks: contacts.filter((c) => c.nextCallbackAt).length,
      conversion: calledIds.size ? Math.round((converted / calledIds.size) * 100) : 0,
    }
  }
  function accountStats() {
    const clients = db.orgs.filter((o) => o.active !== false)
    const assigned = new Set(db.users.filter((u) => u.role === 'concierge' && u.active !== false).flatMap((u) => u.orgIds || []))
    return {
      clients: clients.length,
      assigned: clients.filter((o) => assigned.has(o.id)).length,
      needsOpen: db.needs.filter((n) => !['cloture', 'annule', 'valide'].includes(n.status)).length,
      missions: db.missions.filter((m) => m.status !== 'terminee').length,
      diagnostics: db.diagnostics.length,
    }
  }
  function strategyStats() {
    const list = db.orgStrategies.filter((s) => s.status !== 'archived')
    return { strategies: list.length, active: list.filter((s) => s.status === 'active').length, objectives: list.reduce((n, s) => n + s.objectives.length, 0) }
  }
  function teamSummary(team, user) {
    const tasks = db.orgTasks.filter((t) => t.teamId === team.id)
    const out = { id: team.id, name: team.name, departmentId: team.departmentId, members: members().filter((u) => positionOf(u).teamId === team.id && u.active !== false).length, tasks: taskStats(tasks) }
    if (can(user, 'performance.view')) {
      if (team.id === 'teleprospection') out.kpis = commercialStats()
      if (team.id === 'account-manager') out.kpis = accountStats()
      if (team.id === 'strategies') out.kpis = strategyStats()
    }
    return out
  }
  function departmentSummary(department, user) {
    const p = positionOf(user)
    const teams = department.teams.map((t) => ({ ...t, departmentId: department.id })).filter((t) => seesTeam(p, t) || (p.strategyManager && department.id === 'marketing'))
    const tasks = db.orgTasks.filter((t) => t.departmentId === department.id)
    const out = { id: department.id, name: department.name, members: members().filter((u) => positionOf(u).departmentId === department.id && u.active !== false).length, teams: teams.map((t) => teamSummary(t, user)) }
    if (managesDepartment(p, department.id)) {
      out.tasks = taskStats(tasks)
      if (can(user, 'performance.view')) out.kpis = department.id === 'marketing' ? strategyStats() : { ...commercialStats(), ...accountStats() }
    }
    return out
  }

  /* ---------- Attribution d'une position ---------- */
  function cleanPosition(actor, input, target) {
    const a = positionOf(actor)
    const level = oneOf(input.level, ['department_manager', 'team_manager', 'member'], 'niveau', 'member')
    const departmentId = oneOf(input.departmentId, DEPARTMENTS.map((d) => d.id), 'service')
    if (!departmentId) throw httpError(400, 'service requis')
    const teamId = level === 'department_manager' ? null : oneOf(input.teamId, departmentById(departmentId).teams.map((t) => t.id), 'équipe')
    if (level !== 'department_manager' && !teamId) throw httpError(400, 'équipe requise')
    if (!managesDepartment(a, departmentId)) throw httpError(403, 'ce service est hors de votre périmètre')
    if (a.level !== 'pdg' && LEVEL_RANK[level] >= LEVEL_RANK[a.level]) throw httpError(403, 'vous ne pouvez pas attribuer ce niveau')
    if (target) {
      const current = positionOf(target)
      if (current && a.level !== 'pdg' && (LEVEL_RANK[current.level] >= LEVEL_RANK[a.level] || !managesDepartment(a, current.departmentId))) throw httpError(403, 'ce compte est hors de votre périmètre')
    }
    const previous = target ? positionOf(target)?.strategyManager === true : false
    let strategyManager = previous
    if ('strategyManager' in input) {
      if (a.level !== 'pdg') throw httpError(403, 'seul le PDG désigne le responsable des stratégies')
      strategyManager = input.strategyManager === true
    }
    if (strategyManager && departmentId !== 'marketing') throw httpError(400, 'le responsable des stratégies appartient au Service Marketing')
    return { level, departmentId, teamId, strategyManager }
  }
  const roleFor = (position, currentRole) => {
    if (!position.teamId) return currentRole && MANAGEABLE_ROLES.has(currentRole) ? currentRole : 'staff'
    const teamRole = teamById(position.teamId).role
    if (teamRole === 'agent' && currentRole === 'crm') return 'crm'
    return teamRole
  }

  /* ================================================================== */
  /* Routeur /api/org                                                    */
  /* ================================================================== */
  async function handle(req, res, url, user, cors) {
    if (!url.pathname.startsWith('/api/org/')) return false
    const position = positionOf(user)
    if (!position) { json(res, 403, { error: 'espace réservé à l’équipe interne' }, cors); return true }
    const path = url.pathname.slice('/api/org'.length)
    const q = url.searchParams
    const M = req.method
    const send = (code, body) => { json(res, code, body, cors); return true }
    const body = ['POST', 'PATCH', 'PUT'].includes(M) ? await readBody(req) : {}
    let m

    if (M === 'GET' && path === '/me') {
      const visibleDepartments = DEPARTMENTS.filter((d) => seesDepartment(position, d.id) || (position.strategyManager && d.id === 'marketing'))
        .map((d) => ({ id: d.id, name: d.name, teams: d.teams.map((t) => ({ id: t.id, name: t.name })).filter((t) => seesTeam(position, { ...t, departmentId: d.id }) || (position.strategyManager && d.id === 'marketing')) }))
      return send(200, { position: { ...position, levelLabel: position.strategyManager && position.level !== 'pdg' ? 'Responsable stratégies' : LABELS[position.level] }, permissions: permissionsOf(user), departments: visibleDepartments, structure: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, teams: d.teams.map((t) => ({ id: t.id, name: t.name })) })) })
    }

    if (M === 'GET' && path === '/overview') {
      need(user, 'org.overview')
      const allMembers = members()
      return send(200, {
        members: allMembers.filter((u) => u.active !== false).length,
        pendingInvitations: db.invitations.filter((i) => i.metadata?.orgPosition && !i.usedAt && !i.revokedAt && Date.parse(i.expiresAt) > Date.now()).length,
        unassigned: db.users.filter((u) => u.role === 'staff' && !positionOf(u)).length,
        tasks: taskStats(db.orgTasks),
        departments: DEPARTMENTS.map((d) => departmentSummary(d, user)),
        recentTasks: db.orgTasks.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6).map(taskOut),
      })
    }

    if ((m = path.match(/^\/departments\/([^/]+)$/)) && M === 'GET') {
      const department = departmentById(m[1])
      if (!department) throw httpError(404, 'service introuvable')
      if (!managesDepartment(position, department.id) && !(position.strategyManager && department.id === 'marketing')) throw httpError(403, 'service hors de votre périmètre')
      need(user, 'department.view')
      return send(200, departmentSummary(department, user))
    }

    if ((m = path.match(/^\/teams\/([^/]+)$/)) && M === 'GET') {
      const team = teamById(m[1])
      if (!team) throw httpError(404, 'équipe introuvable')
      if (!seesTeam(position, team) && !(position.strategyManager && team.departmentId === 'marketing')) throw httpError(403, 'équipe hors de votre périmètre')
      need(user, 'team.view')
      const summary = teamSummary(team, user)
      const canSeeMembers = can(user, 'members.view')
      return send(200, { ...summary, departmentName: departmentById(team.departmentId).name, memberList: canSeeMembers ? members().filter((u) => positionOf(u).teamId === team.id).map(publicMember) : [], tasks: summary.tasks, taskList: db.orgTasks.filter((t) => t.teamId === team.id && taskVisible(user, t)).map(taskOut) })
    }

    if (path === '/accounts' && M === 'GET') {
      need(user, 'accounts.view')
      if (!managesDepartment(position, 'commercial') && position.teamId !== 'account-manager') throw httpError(403, 'comptes clients hors de votre périmètre')
      const managers = db.users.filter((u) => u.role === 'concierge')
      const orgs = position.level === 'member' ? db.orgs.filter((o) => (user.orgIds || []).includes(o.id)) : db.orgs
      return send(200, orgs.map((o) => ({
        id: o.id, name: o.name, city: o.city || '', active: o.active !== false,
        accountManagers: managers.filter((u) => (u.orgIds || []).includes(o.id)).map((u) => u.name || u.email),
        openNeeds: db.needs.filter((n) => n.orgId === o.id && !['cloture', 'annule', 'valide'].includes(n.status)).length,
        missions: db.missions.filter((x) => x.orgId === o.id && x.status !== 'terminee').length,
        diagnostics: db.diagnostics.filter((d) => d.orgId === o.id).length,
      })))
    }

    /* ---------- Membres ---------- */
    if (path === '/members' && M === 'GET') {
      need(user, 'members.view')
      return send(200, { members: members().filter((u) => memberInScope(user, u)).map(publicMember), pending: can(user, 'members.manage') ? db.invitations.filter((i) => i.metadata?.orgPosition && !i.usedAt && !i.revokedAt && Date.parse(i.expiresAt) > Date.now() && (position.level === 'pdg' || i.metadata.orgPosition.departmentId === position.departmentId)).map((i) => ({ id: i.id, email: i.email, name: i.name, ...i.metadata.orgPosition, expiresAt: i.expiresAt })) : [], unplaced: position.level === 'pdg' ? db.users.filter((u) => MANAGEABLE_ROLES.has(u.role) && !u.orgPosition).map((u) => ({ id: u.id, name: u.name || u.email, role: u.role })) : [] })
    }
    if (path === '/members' && M === 'POST') {
      need(user, 'members.manage')
      const email = text(body.email, 200, 'e-mail', { required: true }).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'e-mail invalide')
      if (db.users.some((u) => u.email?.toLowerCase() === email)) throw httpError(409, 'cet e-mail possède déjà un compte')
      const name = text(body.name, 160, 'nom', { required: true })
      const orgPosition = cleanPosition(user, body, null)
      const role = roleFor(orgPosition, null)
      const { invitation, token } = createInvitation({ email, name, role, permissions: [], createdBy: user.id, kind: 'staff', metadata: { orgPosition } })
      const delivery = await sendInvitationEmail(invitation, token)
      saveDb(db)
      audit('org.member.invited', { by: user.id, invitation: invitation.id, departmentId: orgPosition.departmentId, teamId: orgPosition.teamId, level: orgPosition.level })
      return send(201, { invitationId: invitation.id, delivery })
    }
    if ((m = path.match(/^\/members\/([^/]+)$/)) && M === 'PATCH') {
      need(user, 'members.manage')
      const target = db.users.find((u) => u.id === m[1])
      if (!target || !MANAGEABLE_ROLES.has(target.role)) throw httpError(404, 'compte introuvable')
      if (target.id === user.id) throw httpError(400, 'vous ne pouvez pas modifier votre propre position')
      const orgPosition = cleanPosition(user, body, target)
      target.orgPosition = orgPosition
      target.role = roleFor(orgPosition, target.role)
      if (target.role === 'agent' || target.role === 'crm') target.crm ||= { databaseIds: [], campaignIds: [], zoneIds: [] }
      if ('active' in body && position.level === 'pdg') target.active = body.active === true
      saveDb(db)
      audit('org.member.updated', { by: user.id, target: target.id, ...orgPosition })
      return send(200, publicMember(target))
    }

    /* ---------- Tâches ---------- */
    if (path === '/assignees' && M === 'GET') {
      const departmentId = q.get('departmentId')
      const teamId = q.get('teamId')
      if (!departmentById(departmentId)) throw httpError(400, 'service invalide')
      if (!canManageTask(user, departmentId, teamId)) throw httpError(403, 'action non autorisée')
      return send(200, members().filter((u) => u.active !== false && positionOf(u).departmentId === departmentId && (!teamId || positionOf(u).teamId === teamId || positionOf(u).level === 'department_manager')).map((u) => ({ id: u.id, name: u.name || u.email })))
    }
    if (path === '/tasks' && M === 'GET') {
      need(user, 'tasks.view')
      let list = db.orgTasks.filter((t) => taskVisible(user, t))
      if (q.get('mine') === '1') list = list.filter((t) => t.assigneeId === user.id)
      for (const key of ['departmentId', 'teamId', 'status', 'strategyId']) if (q.get(key)) list = list.filter((t) => t[key] === q.get(key))
      list = list.slice().sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')) || String(b.updatedAt).localeCompare(String(a.updatedAt)))
      return send(200, { tasks: list.map(taskOut), stats: taskStats(list) })
    }
    if (path === '/tasks' && M === 'POST') {
      const departmentId = oneOf(body.departmentId, DEPARTMENTS.map((d) => d.id), 'service')
      if (!departmentId) throw httpError(400, 'service requis')
      const teamId = body.teamId ? oneOf(body.teamId, departmentById(departmentId).teams.map((t) => t.id), 'équipe') : null
      if (!canManageTask(user, departmentId, teamId)) throw httpError(403, 'action non autorisée')
      let strategyId = null
      let objectiveId = null
      if (body.strategyId) {
        const strategy = db.orgStrategies.find((s) => s.id === body.strategyId)
        if (!strategy || !canManageStrategies(user) || departmentId !== 'marketing') throw httpError(400, 'stratégie invalide')
        strategyId = strategy.id
        if (body.objectiveId) {
          if (!strategy.objectives.some((o) => o.id === body.objectiveId)) throw httpError(400, 'objectif invalide')
          objectiveId = body.objectiveId
        }
      }
      const task = {
        id: newId('task'), title: text(body.title, 200, 'titre', { required: true }), description: text(body.description, 4000, 'description'),
        departmentId, teamId, assigneeId: validateAssignee(body.assigneeId, departmentId, teamId), status: oneOf(body.status, TASK_STATUSES, 'statut', 'todo'),
        priority: oneOf(body.priority, TASK_PRIORITIES, 'priorité', 'normal'), dueDate: dateOrNull(body.dueDate, 'échéance'), strategyId, objectiveId,
        createdBy: user.id, createdAt: nowIso(), updatedAt: nowIso(),
      }
      db.orgTasks.push(task)
      if (task.assigneeId && task.assigneeId !== user.id) pushNotification({ userId: task.assigneeId, orgId: null, type: 'org.task.assigned', title: 'Nouvelle tâche', message: task.title, meta: { taskId: task.id } })
      saveDb(db)
      return send(201, taskOut(task))
    }
    if ((m = path.match(/^\/tasks\/([^/]+)$/))) {
      const task = db.orgTasks.find((t) => t.id === m[1])
      if (!task || !taskVisible(user, task)) throw httpError(404, 'tâche introuvable')
      const manager = canManageTask(user, task.departmentId, task.teamId)
      if (M === 'PATCH') {
        const keys = Object.keys(body)
        if (!manager && !(task.assigneeId === user.id && keys.every((k) => k === 'status'))) throw httpError(403, 'vous pouvez seulement changer le statut de vos tâches')
        if ('status' in body) task.status = oneOf(body.status, TASK_STATUSES, 'statut', task.status)
        if (manager) {
          if ('title' in body) task.title = text(body.title, 200, 'titre', { required: true })
          if ('description' in body) task.description = text(body.description, 4000, 'description')
          if ('priority' in body) task.priority = oneOf(body.priority, TASK_PRIORITIES, 'priorité', task.priority)
          if ('dueDate' in body) task.dueDate = dateOrNull(body.dueDate, 'échéance')
          if ('assigneeId' in body) {
            const next = validateAssignee(body.assigneeId, task.departmentId, task.teamId)
            if (next && next !== task.assigneeId && next !== user.id) pushNotification({ userId: next, orgId: null, type: 'org.task.assigned', title: 'Nouvelle tâche', message: task.title, meta: { taskId: task.id } })
            task.assigneeId = next
          }
        }
        task.updatedAt = nowIso()
        saveDb(db)
        return send(200, taskOut(task))
      }
      if (M === 'DELETE') {
        if (!manager) throw httpError(403, 'action non autorisée')
        db.orgTasks = db.orgTasks.filter((t) => t.id !== task.id)
        saveDb(db)
        return send(200, { ok: true })
      }
    }

    /* ---------- Stratégies marketing ---------- */
    if (path === '/strategies' && M === 'GET') {
      const list = db.orgStrategies.filter((s) => strategyVisible(user, s)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      return send(200, { strategies: list.map((s) => strategyOut(s, user)), canManage: canManageStrategies(user) })
    }
    if (path === '/strategies' && M === 'POST') {
      if (!canManageStrategies(user)) throw httpError(403, 'action réservée au responsable des stratégies')
      const strategy = {
        id: newId('strat'), title: text(body.title, 200, 'titre', { required: true }), summary: text(body.summary, 4000, 'résumé'), audience: text(body.audience, 500, 'cible'), channels: text(body.channels, 500, 'canaux'),
        status: oneOf(body.status, STRATEGY_STATUSES, 'statut', 'draft'), startDate: dateOrNull(body.startDate, 'date de début'), endDate: dateOrNull(body.endDate, 'date de fin'),
        objectives: cleanObjectives(body.objectives ?? []), ownerId: user.id, createdBy: user.id, createdAt: nowIso(), updatedAt: nowIso(),
      }
      db.orgStrategies.push(strategy)
      saveDb(db)
      audit('org.strategy.created', { by: user.id, strategy: strategy.id })
      return send(201, strategyOut(strategy, user))
    }
    if ((m = path.match(/^\/strategies\/([^/]+)$/))) {
      const strategy = db.orgStrategies.find((s) => s.id === m[1])
      if (!strategy || !strategyVisible(user, strategy)) throw httpError(404, 'stratégie introuvable')
      if (M === 'GET') return send(200, { strategy: strategyOut(strategy, user), tasks: db.orgTasks.filter((t) => t.strategyId === strategy.id && (canManageStrategies(user) || can(user, 'strategies.view') || t.assigneeId === user.id)).map(taskOut) })
      if (!canManageStrategies(user)) throw httpError(403, 'action réservée au responsable des stratégies')
      if (M === 'PATCH') {
        if ('title' in body) strategy.title = text(body.title, 200, 'titre', { required: true })
        for (const [key, max, label] of [['summary', 4000, 'résumé'], ['audience', 500, 'cible'], ['channels', 500, 'canaux']]) if (key in body) strategy[key] = text(body[key], max, label)
        if ('status' in body) strategy.status = oneOf(body.status, STRATEGY_STATUSES, 'statut', strategy.status)
        if ('startDate' in body) strategy.startDate = dateOrNull(body.startDate, 'date de début')
        if ('endDate' in body) strategy.endDate = dateOrNull(body.endDate, 'date de fin')
        if ('objectives' in body) {
          strategy.objectives = cleanObjectives(body.objectives)
          const ids = new Set(strategy.objectives.map((o) => o.id))
          for (const task of db.orgTasks) if (task.strategyId === strategy.id && task.objectiveId && !ids.has(task.objectiveId)) task.objectiveId = null
        }
        strategy.updatedAt = nowIso()
        saveDb(db)
        return send(200, strategyOut(strategy, user))
      }
      if (M === 'DELETE') {
        db.orgStrategies = db.orgStrategies.filter((s) => s.id !== strategy.id)
        for (const task of db.orgTasks) if (task.strategyId === strategy.id) { task.strategyId = null; task.objectiveId = null }
        saveDb(db)
        audit('org.strategy.deleted', { by: user.id, strategy: strategy.id })
        return send(200, { ok: true })
      }
    }

    /* ---------- Permissions par niveau (PDG) ---------- */
    if (path === '/settings' && M === 'GET') {
      need(user, 'settings.manage')
      return send(200, { levelPermissions: orgSettings().levelPermissions, permissions: PERMISSIONS, levels: Object.keys(DEFAULT_LEVEL_PERMISSIONS).map((id) => ({ id, label: LABELS[id] })) })
    }
    if (path === '/settings' && M === 'PATCH') {
      need(user, 'settings.manage')
      const s = orgSettings()
      if (!db.orgSettings.includes(s)) db.orgSettings.push(s)
      for (const level of Object.keys(DEFAULT_LEVEL_PERMISSIONS)) {
        if (!(level in (body.levelPermissions || {}))) continue
        const list = body.levelPermissions[level]
        if (!Array.isArray(list) || list.some((p) => !PERMISSIONS.includes(p))) throw httpError(400, 'permissions invalides')
        s.levelPermissions[level] = [...new Set(list)]
      }
      saveDb(db)
      audit('org.permissions.updated', { by: user.id })
      return send(200, { levelPermissions: s.levelPermissions })
    }

    throw httpError(404, 'route inconnue')
  }

  return { handle, permissionsOf }
}

import { randomBytes, randomUUID } from 'node:crypto'
import { createSessionToken, hashPassword, hashToken, verifyPassword } from './auth.mjs'
import {
  CLIENT_ROLES,
  accessibleOrgIds,
  auditScope,
  can,
  canAny,
  canAccessOrg,
  canReadDiagnostic,
  canReadOrg,
  canWriteDiagnostic,
  isValidRole,
} from './policy.mjs'

export const SESSION_COOKIE = 'allneeds_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const FORMATS = ['Complet', 'Express ★']
const LOGIN_WINDOW_MS = 5 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 10
const MIN_PASSWORD_LENGTH = 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const fail = (status, code, message, details) => new HttpError(status, code, message, details)

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

async function readBody(req, limit = 512 * 1024) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw fail(413, 'payload_too_large', 'Corps de requête trop volumineux')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw fail(400, 'invalid_json', 'Corps JSON invalide')
    }
    return parsed
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw fail(400, 'invalid_json', 'Corps JSON invalide')
  }
}

function requireString(value, field, { min = 1, max = 4096 } = {}) {
  if (typeof value !== 'string') throw fail(422, 'invalid_field', `Champ « ${field} » invalide`, [field])
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw fail(422, 'invalid_field', `Champ « ${field} » invalide`, [field])
  }
  return trimmed
}

function requireEmail(value, field = 'email') {
  const email = requireString(value, field, { min: 3, max: 320 }).toLowerCase()
  if (!EMAIL_RE.test(email)) throw fail(422, 'invalid_field', `Champ « ${field} » invalide`, [field])
  return email
}

function validatePassword(value, field) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw fail(422, 'weak_password', `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`, [field])
  }
  if (value.length > 200) throw fail(422, 'weak_password', 'Mot de passe trop long', [field])
  return value
}

function validateAnswers(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw fail(422, 'invalid_answers', 'Les réponses doivent être un objet', ['answers'])
  }
  const missingComments = []
  const out = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw fail(422, 'invalid_answers', `Réponse invalide pour la question ${id}`, [id])
    }
    const score = entry.score
    if (!Number.isInteger(score) || score < 0 || score > 5) {
      throw fail(422, 'invalid_score', `Note invalide pour la question ${id}`, [id])
    }
    const comment = entry.comment === undefined || entry.comment === null ? '' : entry.comment
    if (typeof comment !== 'string' || comment.length > 2000) {
      throw fail(422, 'invalid_comment', `Commentaire invalide pour la question ${id}`, [id])
    }
    if (score > 0 && comment.trim().length === 0) missingComments.push(id)
    out[id] = { score, comment: comment.trim(), set: true }
  }
  if (missingComments.length > 0) {
    throw fail(422, 'comment_required', 'Chaque note évaluée doit être justifiée', missingComments)
  }
  if (Object.keys(out).length === 0) {
    throw fail(422, 'empty_answers', 'Aucune réponse fournie', ['answers'])
  }
  return out
}

function validateConsent(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw fail(422, 'consent_required', 'Consentement obligatoire', ['consent'])
  }
  const by = requireString(raw.by, 'consent.by', { min: 2, max: 200 })
  const acceptedAt = requireString(raw.acceptedAt, 'consent.acceptedAt', { min: 10, max: 40 })
  const version = requireString(raw.version, 'consent.version', { min: 1, max: 40 })
  return { by, acceptedAt, version }
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
    ...headers,
  })
  res.end(payload)
}

const sendError = (res, err) => {
  const status = err instanceof HttpError ? err.status : 500
  const code = err instanceof HttpError ? err.code : 'internal_error'
  const message = err instanceof HttpError ? err.message : 'Erreur interne'
  const details = err instanceof HttpError ? err.details : undefined
  send(res, status, { error: { code, message, ...(details ? { details } : {}) } })
}

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  clientRole: user.clientRole ?? null,
  orgId: user.orgId ?? null,
  assignedOrgIds: Array.isArray(user.assignedOrgIds) ? user.assignedOrgIds : [],
  active: user.active !== false,
})

const publicInvitation = (invitation) => ({
  id: invitation.id,
  email: invitation.email,
  name: invitation.name ?? '',
  role: invitation.role,
  clientRole: invitation.clientRole ?? null,
  orgId: invitation.orgId ?? null,
  assignedOrgIds: Array.isArray(invitation.assignedOrgIds) ? invitation.assignedOrgIds : [],
  invitedBy: invitation.invitedBy,
  createdAt: invitation.createdAt,
  expiresAt: invitation.expiresAt,
  acceptedAt: invitation.acceptedAt ?? null,
})

export function createApp({ store, allowedOrigins = [], secureCookies = false }) {
  const loginAttempts = new Map()

  function isRateLimited(key) {
    const now = Date.now()
    const list = (loginAttempts.get(key) ?? []).filter((at) => now - at < LOGIN_WINDOW_MS)
    if (list.length >= LOGIN_MAX_ATTEMPTS) {
      loginAttempts.set(key, list)
      return true
    }
    list.push(now)
    loginAttempts.set(key, list)
    return false
  }

  function purgeExpiredSessions(state) {
    const now = Date.now()
    const before = state.sessions.length
    state.sessions = state.sessions.filter((s) => new Date(s.expiresAt).getTime() >= now)
    return state.sessions.length !== before
  }

  function audit(actor, action, target, orgId) {
    const state = store.get()
    state.audit.push({
      id: `aud-${randomUUID()}`,
      at: new Date().toISOString(),
      actorId: actor ? actor.id ?? null : null,
      actorRole: actor ? actor.role ?? null : null,
      action,
      target,
      orgId: orgId ?? null,
    })
    store.save()
  }

  function authenticate(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!token) return null
    const state = store.get()
    const row = state.sessions.find((s) => s.tokenHash === hashToken(token))
    if (!row) return null
    if (new Date(row.expiresAt).getTime() < Date.now()) return null
    const user = state.users.find((u) => u.id === row.userId)
    if (!user || user.active === false) return null
    return { user, token }
  }

  function requireAuth(req) {
    const session = authenticate(req)
    if (!session) throw fail(401, 'unauthenticated', 'Authentification requise')
    return session
  }

  function deny(actor, route, orgId) {
    audit(actor, 'access.denied', route, orgId ?? null)
    throw fail(403, 'forbidden', 'Action non autorisée')
  }

  function requirePermission(actor, route, permissions, orgId) {
    if (!canAny(actor, permissions)) deny(actor, route, orgId)
  }

  function requireOrgScope(actor, route, orgId) {
    const state = store.get()
    if (!canAccessOrg(actor, orgId, state)) {
      audit(actor, 'access.not_found', route, orgId ?? null)
      throw fail(404, 'not_found', 'Entreprise introuvable')
    }
    return state
  }

  function sessionCookie(token) {
    const secure = secureCookies ? '; Secure' : ''
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`
  }

  const clearedCookie = () =>
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies ? '; Secure' : ''}`

  const handlers = {
    'GET /api/health': async (req, res) => {
      send(res, 200, { ok: true, service: 'allneeds-api', environment: store.get().environment ?? null })
    },

    'POST /api/auth/login': async (req, res) => {
      const body = await readBody(req)
      const email = requireEmail(body.email, 'email')
      const password = typeof body.password === 'string' ? body.password : ''
      const key = `${req.socket.remoteAddress ?? 'unknown'}|${email}`
      if (isRateLimited(key)) throw fail(429, 'rate_limited', 'Trop de tentatives, réessayez plus tard')

      const state = store.get()
      const user = state.users.find((u) => u.email.toLowerCase() === email)
      if (!user || user.active === false || !verifyPassword(password, user.passwordHash)) {
        audit(null, 'auth.login_failed', `users/${email}`)
        throw fail(401, 'invalid_credentials', 'Identifiants incorrects')
      }

      purgeExpiredSessions(state)
      const token = createSessionToken()
      state.sessions.push({
        id: `ses-${randomUUID()}`,
        tokenHash: hashToken(token),
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      store.save()
      audit(user, 'auth.login', `users/${user.id}`)
      send(res, 200, { user: publicUser(user) }, { 'set-cookie': sessionCookie(token) })
    },

    'POST /api/auth/logout': async (req, res) => {
      const { user, token } = requireAuth(req)
      const state = store.get()
      state.sessions = state.sessions.filter((s) => s.tokenHash !== hashToken(token))
      store.save()
      audit(user, 'auth.logout', `users/${user.id}`)
      send(res, 200, { ok: true }, { 'set-cookie': clearedCookie() })
    },

    'POST /api/auth/logout-all': async (req, res) => {
      const { user } = requireAuth(req)
      const state = store.get()
      state.sessions = state.sessions.filter((s) => s.userId !== user.id)
      store.save()
      audit(user, 'auth.logout_all', `users/${user.id}`)
      send(res, 200, { ok: true }, { 'set-cookie': clearedCookie() })
    },

    'POST /api/auth/password': async (req, res) => {
      const { user, token } = requireAuth(req)
      const body = await readBody(req)
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
      const newPassword = validatePassword(body.newPassword, 'newPassword')

      if (!verifyPassword(currentPassword, user.passwordHash)) {
        audit(user, 'auth.password_change_failed', `users/${user.id}`)
        throw fail(401, 'invalid_credentials', 'Mot de passe actuel incorrect')
      }

      const state = store.get()
      user.passwordHash = hashPassword(newPassword)
      const keep = hashToken(token)
      state.sessions = state.sessions.filter((s) => s.userId !== user.id || s.tokenHash === keep)
      store.save()
      audit(user, 'auth.password_changed', `users/${user.id}`)
      send(res, 200, { ok: true, revokedOtherSessions: true })
    },

    'GET /api/auth/me': async (req, res) => {
      const { user } = requireAuth(req)
      send(res, 200, { user: publicUser(user) })
    },

    'GET /api/companies': async (req, res) => {
      const { user } = requireAuth(req)
      if (!canReadOrg(user)) deny(user, 'GET /api/companies')
      const state = store.get()
      const allowed = new Set(accessibleOrgIds(user, state))
      const orgs = state.orgs
        .filter((org) => allowed.has(org.id))
        .map((org) => ({ id: org.id, name: org.name, sector: org.sector }))
      send(res, 200, { companies: orgs })
    },

    'GET /api/companies/:id': async (req, res, params) => {
      const { user } = requireAuth(req)
      const state = requireOrgScope(user, 'GET /api/companies/:id', params.id)
      if (!canReadOrg(user)) deny(user, 'GET /api/companies/:id', params.id)
      const org = state.orgs.find((o) => o.id === params.id)
      if (!org) throw fail(404, 'not_found', 'Entreprise introuvable')
      audit(user, 'org.read', `orgs/${org.id}`, org.id)
      send(res, 200, { company: { id: org.id, name: org.name, sector: org.sector } })
    },

    'GET /api/companies/:id/members': async (req, res, params) => {
      const { user } = requireAuth(req)
      const state = requireOrgScope(user, 'GET /api/companies/:id/members', params.id)
      requirePermission(
        user,
        'GET /api/companies/:id/members',
        ['user:manage', 'member:invite', 'member:invite:own', 'concierge:manage', 'org:update', 'org:update:own', 'org:update:assigned'],
        params.id,
      )
      const members = state.users
        .filter((u) => u.active !== false && u.orgId === params.id)
        .map(publicUser)
      const support = state.users
        .filter((u) => u.active !== false && u.role !== 'client' && (u.assignedOrgIds ?? []).includes(params.id))
        .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
      send(res, 200, { members, support })
    },

    'GET /api/companies/:id/diagnostics': async (req, res, params) => {
      const { user } = requireAuth(req)
      const state = requireOrgScope(user, 'GET /api/companies/:id/diagnostics', params.id)
      if (!canReadDiagnostic(user)) deny(user, 'GET /api/companies/:id/diagnostics', params.id)
      const list = state.diagnostics.filter((d) => d.companyId === params.id)
      send(res, 200, { diagnostics: list.map(({ answers, ...meta }) => ({ ...meta, answered: Object.keys(answers).length })) })
    },

    'POST /api/companies/:id/diagnostics': async (req, res, params) => {
      const { user } = requireAuth(req)
      const state = requireOrgScope(user, 'POST /api/companies/:id/diagnostics', params.id)
      if (!canWriteDiagnostic(user)) deny(user, 'POST /api/companies/:id/diagnostics', params.id)

      const body = await readBody(req)
      const format = typeof body.format === 'string' ? body.format : ''
      if (!FORMATS.includes(format)) throw fail(422, 'invalid_format', 'Format de questionnaire invalide', ['format'])
      const consent = validateConsent(body.consent)
      const answers = validateAnswers(body.answers)

      const now = new Date().toISOString()
      const record = {
        id: `dx-${randomUUID()}`,
        companyId: params.id,
        format,
        status: 'termine',
        consent,
        answers,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      }
      state.diagnostics.push(record)
      store.save()
      audit(user, 'diagnostic.create', `diagnostics/${record.id}`, params.id)
      send(res, 201, { diagnostic: { id: record.id, companyId: record.companyId, format, status: record.status } })
    },

    'GET /api/invitations': async (req, res) => {
      const { user } = requireAuth(req)
      if (!can(user, 'member:invite')) deny(user, 'GET /api/invitations')
      const state = store.get()
      send(res, 200, { invitations: state.invitations.map(publicInvitation) })
    },

    'POST /api/invitations': async (req, res) => {
      const { user } = requireAuth(req)
      if (!can(user, 'member:invite')) deny(user, 'POST /api/invitations')

      const body = await readBody(req)
      const email = requireEmail(body.email, 'email')
      const role = requireString(body.role, 'role', { min: 3, max: 32 })
      if (!isValidRole(role)) throw fail(422, 'invalid_field', 'Champ « role » invalide', ['role'])

      const state = store.get()
      if (state.users.some((u) => u.email.toLowerCase() === email)) {
        throw fail(409, 'email_already_used', 'Un compte existe déjà pour cette adresse', ['email'])
      }
      if (state.invitations.some((i) => i.email === email && !i.acceptedAt)) {
        throw fail(409, 'invitation_pending', 'Une invitation est déjà en attente pour cette adresse', ['email'])
      }

      const invitation = {
        id: `inv-${randomUUID()}`,
        email,
        name: typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '',
        role,
        clientRole: null,
        orgId: null,
        assignedOrgIds: [],
        invitedBy: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
        tokenHash: null,
        acceptedAt: null,
      }

      if (role === 'client') {
        const orgId = requireString(body.orgId, 'orgId', { min: 1, max: 64 })
        if (!state.orgs.some((o) => o.id === orgId)) {
          throw fail(422, 'invalid_field', 'Entreprise inconnue', ['orgId'])
        }
        invitation.orgId = orgId
        const clientRole = body.clientRole === undefined || body.clientRole === null ? 'dirigeant' : body.clientRole
        if (!CLIENT_ROLES.includes(clientRole)) {
          throw fail(422, 'invalid_field', 'Champ « clientRole » invalide', ['clientRole'])
        }
        invitation.clientRole = clientRole
      } else if (role === 'concierge' || role === 'expert') {
        const ids = body.assignedOrgIds === undefined || body.assignedOrgIds === null ? [] : body.assignedOrgIds
        if (!Array.isArray(ids)) throw fail(422, 'invalid_field', 'Champ « assignedOrgIds » invalide', ['assignedOrgIds'])
        for (const id of ids) {
          if (typeof id !== 'string' || !state.orgs.some((o) => o.id === id)) {
            throw fail(422, 'invalid_field', 'Entreprise inconnue dans assignedOrgIds', ['assignedOrgIds'])
          }
        }
        invitation.assignedOrgIds = [...new Set(ids)]
      }

      const token = randomBytes(24).toString('hex')
      invitation.tokenHash = hashToken(token)
      state.invitations.push(invitation)
      store.save()
      audit(user, 'member.invited', `invitations/${invitation.id}`, invitation.orgId)
      send(res, 201, { invitation: { ...publicInvitation(invitation), token } })
    },

    'POST /api/invitations/:token/accept': async (req, res, params) => {
      const body = await readBody(req)
      const name = requireString(body.name, 'name', { min: 2, max: 200 })
      const password = validatePassword(body.password, 'password')

      const state = store.get()
      const tokenHash = hashToken(params.token)
      const invitation = state.invitations.find((i) => i.tokenHash === tokenHash && !i.acceptedAt)
      if (!invitation) throw fail(404, 'invitation_invalid', 'Invitation inconnue ou déjà utilisée')
      if (new Date(invitation.expiresAt).getTime() < Date.now()) {
        throw fail(400, 'invitation_expired', 'Invitation expirée, demandez-en une nouvelle')
      }
      if (state.users.some((u) => u.email.toLowerCase() === invitation.email)) {
        throw fail(409, 'email_already_used', 'Un compte existe déjà pour cette adresse', ['email'])
      }

      const now = new Date().toISOString()
      const user = {
        id: `usr-${randomUUID()}`,
        email: invitation.email,
        name,
        role: invitation.role,
        clientRole: invitation.clientRole ?? null,
        orgId: invitation.orgId ?? null,
        assignedOrgIds: invitation.assignedOrgIds ?? [],
        passwordHash: hashPassword(password),
        active: true,
        createdAt: now,
      }
      state.users.push(user)
      invitation.acceptedAt = now
      store.save()
      audit(user, 'member.joined', `users/${user.id}`, user.orgId)
      send(res, 201, { user: publicUser(user) })
    },

    'PATCH /api/users/:id': async (req, res, params) => {
      const { user } = requireAuth(req)
      if (!can(user, 'user:manage')) deny(user, 'PATCH /api/users/:id')
      const state = store.get()
      const target = state.users.find((u) => u.id === params.id)
      if (!target) throw fail(404, 'not_found', 'Compte introuvable')
      if (target.id === user.id) throw fail(403, 'self_action', 'Vous ne pouvez pas modifier votre propre compte')

      const body = await readBody(req)
      const changes = []

      if ('active' in body) {
        if (typeof body.active !== 'boolean') throw fail(422, 'invalid_field', 'Champ « active » invalide', ['active'])
        target.active = body.active
        if (!body.active) state.sessions = state.sessions.filter((s) => s.userId !== target.id)
        changes.push(`active=${body.active}`)
      }

      if ('role' in body) {
        const role = requireString(body.role, 'role', { min: 3, max: 32 })
        if (!isValidRole(role)) throw fail(422, 'invalid_field', 'Champ « role » invalide', ['role'])
        target.role = role
        if (role !== 'client') target.clientRole = null
        changes.push(`role=${role}`)
      }

      if ('clientRole' in body) {
        const clientRole = body.clientRole
        if (clientRole !== null && !CLIENT_ROLES.includes(clientRole)) {
          throw fail(422, 'invalid_field', 'Champ « clientRole » invalide', ['clientRole'])
        }
        if (clientRole !== null && target.role !== 'client') {
          throw fail(422, 'invalid_field', 'clientRole n\'est pertinent que pour un compte client', ['clientRole'])
        }
        target.clientRole = clientRole
        changes.push(`clientRole=${clientRole ?? 'null'}`)
      }

      if ('assignedOrgIds' in body) {
        const ids = body.assignedOrgIds
        if (!Array.isArray(ids)) throw fail(422, 'invalid_field', 'Champ « assignedOrgIds » invalide', ['assignedOrgIds'])
        for (const id of ids) {
          if (typeof id !== 'string' || !state.orgs.some((o) => o.id === id)) {
            throw fail(422, 'invalid_field', 'Entreprise inconnue dans assignedOrgIds', ['assignedOrgIds'])
          }
        }
        target.assignedOrgIds = [...new Set(ids)]
        changes.push(`assignedOrgIds=${target.assignedOrgIds.join('|') || '[]'}`)
      }

      if (changes.length === 0) throw fail(422, 'empty_patch', 'Aucune modification fournie', ['body'])

      store.save()
      audit(user, 'user.updated', `users/${target.id}`, target.orgId)
      send(res, 200, { user: publicUser(target), changes })
    },

    'GET /api/audit': async (req, res) => {
      const { user } = requireAuth(req)
      const scope = auditScope(user)
      if (!scope) deny(user, 'GET /api/audit')
      const state = store.get()
      let entries = state.audit
      if (scope === 'assigned') {
        const allowed = new Set(accessibleOrgIds(user, state))
        entries = entries.filter((entry) => entry.orgId && allowed.has(entry.orgId))
      }
      send(res, 200, { audit: entries.slice(-200).reverse() })
    },

    'POST /api/registrations': async (req, res) => {
      const body = await readBody(req)
      const email = requireEmail(body.email, 'email')
      const org = requireString(body.org, 'org', { min: 2, max: 160 })
      const name = requireString(body.name, 'name', { min: 2, max: 200 })
      if (body.accept !== true) throw fail(422, 'invalid_field', 'L’acceptation des conditions est obligatoire', ['accept'])

      const key = `register|${req.socket.remoteAddress ?? 'unknown'}`
      if (isRateLimited(key)) throw fail(429, 'rate_limited', 'Trop de demandes envoyées, réessayez plus tard')

      const state = store.get()
      if (state.users.some((u) => u.email.toLowerCase() === email)) {
        throw fail(409, 'email_already_used', 'Un compte existe déjà pour cette adresse', ['email'])
      }
      if (state.registrations.some((r) => r.email === email && r.status === 'pending')) {
        throw fail(409, 'registration_pending', 'Une demande est déjà en attente pour cette adresse', ['email'])
      }

      const record = {
        id: `reg-${randomUUID()}`,
        status: 'pending',
        org,
        kind: typeof body.kind === 'string' ? body.kind.trim().slice(0, 120) : '',
        sector: typeof body.sector === 'string' ? body.sector.trim().slice(0, 40) : '',
        workspaceProfile: typeof body.workspaceProfile === 'string' ? body.workspaceProfile.trim().slice(0, 40) : '',
        situation: ['entreprise_existante', 'creation', 'investisseur'].includes(body.situation)
          ? body.situation
          : 'entreprise_existante',
        city: typeof body.city === 'string' ? body.city.trim().slice(0, 80) : '',
        size: typeof body.size === 'string' ? body.size.trim().slice(0, 60) : '',
        name,
        jobTitle: typeof body.role === 'string' ? body.role.trim().slice(0, 80) : '',
        email,
        phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '',
        assignedTo: null,
        createdAt: new Date().toISOString(),
        decidedAt: null,
      }
      state.registrations.push(record)
      store.save()
      audit(null, 'registration.received', `registrations/${record.id}`)
      send(res, 201, { registration: { id: record.id, status: record.status }, reference: record.id })
    },

    'GET /api/registrations': async (req, res) => {
      const { user } = requireAuth(req)
      if (!can(user, 'user:manage')) deny(user, 'GET /api/registrations')
      const state = store.get()
      send(res, 200, { registrations: state.registrations.slice().reverse() })
    },
  }

  function match(method, pathname) {
    const exact = handlers[`${method} ${pathname}`]
    if (exact) return { handler: exact, params: {} }
    const segments = pathname.split('/').filter(Boolean)
    if (segments[0] !== 'api') return null

    if (method === 'GET' && segments[1] === 'companies' && segments.length === 4) {
      const id = decodeURIComponent(segments[2])
      if (segments[3] === 'diagnostics') return { handler: handlers['GET /api/companies/:id/diagnostics'], params: { id } }
      if (segments[3] === 'members') return { handler: handlers['GET /api/companies/:id/members'], params: { id } }
    }
    if (method === 'POST' && segments[1] === 'companies' && segments.length === 4 && segments[3] === 'diagnostics') {
      return { handler: handlers['POST /api/companies/:id/diagnostics'], params: { id: decodeURIComponent(segments[2]) } }
    }
    if (method === 'GET' && segments[1] === 'companies' && segments.length === 3) {
      return { handler: handlers['GET /api/companies/:id'], params: { id: decodeURIComponent(segments[2]) } }
    }
    if (method === 'POST' && segments[1] === 'invitations' && segments.length === 4 && segments[3] === 'accept') {
      return { handler: handlers['POST /api/invitations/:token/accept'], params: { token: decodeURIComponent(segments[2]) } }
    }
    if (method === 'PATCH' && segments[1] === 'users' && segments.length === 3) {
      return { handler: handlers['PATCH /api/users/:id'], params: { id: decodeURIComponent(segments[2]) } }
    }
    return null
  }

  return async function handler(req, res) {
    const origin = req.headers.origin
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('access-control-allow-credentials', 'true')
      res.setHeader('access-control-allow-headers', 'content-type')
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS')
      res.setHeader('vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(origin && allowedOrigins.includes(origin) ? 204 : 403)
      res.end()
      return
    }

    try {
      const url = new URL(req.url, 'http://localhost')
      const route = match(req.method, url.pathname)
      if (!route) throw fail(404, 'not_found', 'Route inconnue')
      await route.handler(req, res, route.params)
    } catch (err) {
      if (!(err instanceof HttpError)) console.error('[allneeds-api]', err)
      sendError(res, err)
    }
  }
}

export { hashPassword, verifyPassword }

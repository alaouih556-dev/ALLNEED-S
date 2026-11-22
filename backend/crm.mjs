/*
 * ALLNEEDS CRM — API métier (contacts, appels, rendez-vous, campagnes, zones, agents).
 *
 * Branché dans backend/server.mjs : même session, même base (collections `crm*` persistées
 * en local et dans Supabase via les tables v46_crm_*), même hachage de mot de passe (scrypt).
 *
 * Règles de sécurité :
 *  - Toutes les routes /api/crm/* exigent une session valide et une permission explicite.
 *  - Un agent ne voit que ses contacts (assignés à lui, ou non assignés dans ses bases),
 *    ses rendez-vous, ses campagnes et ses zones. Tout est filtré ici, côté serveur.
 *  - Aucune route ne renvoie de mot de passe ni d'empreinte.
 */
import { randomBytes } from 'node:crypto'

export const CRM_COLLECTIONS = {
  crmDatabases: 'v46_crm_databases',
  crmContacts: 'v46_crm_contacts',
  crmCalls: 'v46_crm_calls',
  crmAppointments: 'v46_crm_appointments',
  crmCampaigns: 'v46_crm_campaigns',
  crmZones: 'v46_crm_zones',
  crmActivity: 'v46_crm_activity',
  crmImports: 'v46_crm_imports',
  crmSettings: 'v46_crm_settings',
}

/* ------------------------------------------------------------------ */
/* Référentiels                                                        */
/* ------------------------------------------------------------------ */

export const CONTACT_STATUSES = ['new', 'not_contacted', 'contacted', 'interested', 'not_interested', 'callback_requested', 'appointment_booked', 'invalid_number', 'completed']
export const CALL_STATUSES = ['new', 'called', 'answered', 'no_answer', 'busy', 'invalid_number', 'callback_requested', 'interested', 'not_interested', 'appointment_booked', 'completed']
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show']
const DATABASE_STATUSES = ['draft', 'active', 'completed', 'archived']
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived']
const USER_STATUSES = ['active', 'inactive', 'suspended']
/** Appels où le contact a effectivement été joint. */
const REACHED_CALL_STATUSES = new Set(['answered', 'callback_requested', 'interested', 'not_interested', 'appointment_booked', 'completed'])
const CALL_TO_CONTACT_STATUS = { answered: 'contacted', interested: 'interested', not_interested: 'not_interested', callback_requested: 'callback_requested', appointment_booked: 'appointment_booked', invalid_number: 'invalid_number', completed: 'completed' }

const DEFAULT_LABELS = {
  contact: { new: 'Nouveau', not_contacted: 'Non contacté', contacted: 'Contacté', interested: 'Intéressé', not_interested: 'Pas intéressé', callback_requested: 'Rappel demandé', appointment_booked: 'RDV pris', invalid_number: 'Numéro invalide', completed: 'Terminé' },
  call: { new: 'Nouveau', called: 'Appelé', answered: 'Répondu', no_answer: 'Pas de réponse', busy: 'Occupé', invalid_number: 'Numéro invalide', callback_requested: 'Rappel demandé', interested: 'Intéressé', not_interested: 'Pas intéressé', appointment_booked: 'RDV pris', completed: 'Terminé' },
  appointment: { pending: 'À confirmer', confirmed: 'Confirmé', completed: 'Réalisé', cancelled: 'Annulé', rescheduled: 'Reporté', no_show: 'Absent' },
}

/** Permissions qu'un rôle non administrateur peut recevoir. L'administrateur a toujours tout. */
export const AGENT_PERMISSIONS = ['dashboard.view', 'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.export', 'calls.create', 'calls.edit', 'appointments.view', 'appointments.create', 'appointments.edit', 'map.view', 'campaigns.view', 'reports.view', 'notifications.view']
/** Permissions réservées à l'administration (jamais attribuables à un agent). */
export const ADMIN_PERMISSIONS = ['users.manage', 'databases.manage', 'imports.run', 'campaigns.manage', 'zones.manage', 'agents.view', 'settings.manage', 'audit.view', 'geocode.run']
/** Rôles CRM. Ajouter un rôle = ajouter une entrée ici + ses permissions par défaut dans les réglages. */
export const CRM_ROLES = {
  admin: { label: 'Administrateur', admin: true },
  agent: { label: 'Agent', admin: false },
  // Rôle « CRM » : mêmes droits qu'un agent dans le CRM, plus la présentation commerciale (rien d'autre dans ALLNEEDS).
  crm: { label: 'CRM', admin: false },
}

const NOTIFICATION_TYPES = ['appointment.created', 'appointment.confirmed', 'appointment.cancelled', 'appointment.rescheduled', 'callback.reminder', 'database.assigned', 'contacts.assigned', 'campaign.assigned', 'campaign.started', 'campaign.completed', 'user.created', 'agent.alert', 'import.completed', 'import.failed']

function defaultSettings() {
  return {
    id: 'settings',
    general: { crmName: 'ALLNEEDS CRM', defaultCountry: 'Maroc', timezone: 'Africa/Casablanca', currency: 'MAD' },
    appointments: { defaultDurationMin: 60, types: ['Diagnostic', 'Rendez-vous commercial', 'Visite sur site', 'Visio', 'Suivi'], agentsCanCreate: true, workdayStart: '08:00', workdayEnd: '19:00' },
    calls: { callbackReminderMinutes: 15, requireNotesOnFailure: false, inactivityAlertDays: 3 },
    campaigns: { types: ['Prospection', 'Relance', 'Fidélisation', 'Événement'], defaultGoalAppointments: 20 },
    imports: { duplicateKey: 'phone_or_email', defaultStrategy: 'skip', maxRows: 20000 },
    labels: JSON.parse(JSON.stringify(DEFAULT_LABELS)),
    rolePermissions: { agent: [...AGENT_PERMISSIONS], crm: [...AGENT_PERMISSIONS] },
    notifications: Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, true])),
    integrations: { geocoding: 'disabled', telephony: 'none' },
    updatedAt: null,
    updatedBy: null,
  }
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const id = (prefix) => `${prefix}-${randomBytes(9).toString('hex')}`
const nowIso = () => new Date().toISOString()
const httpError = (status, message) => Object.assign(new Error(message), { status })
const lower = (v) => String(v ?? '').trim().toLowerCase()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function text(value, max, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `${field} requis`)
    return ''
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw httpError(400, `${field} invalide`)
  const v = String(value).trim()
  if (required && !v) throw httpError(400, `${field} requis`)
  if (v.length > max) throw httpError(400, `${field} trop long (${max} caractères maximum)`)
  return v
}
function oneOf(value, list, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (!list.includes(value)) throw httpError(400, `${field} invalide`)
  return value
}
function idList(value, exists, field) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw httpError(400, `${field} invalide`)
  const out = [...new Set(value.map(String))]
  for (const v of out) if (!exists(v)) throw httpError(400, `${field} : élément introuvable`)
  return out
}
function optDate(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (!DATE_RE.test(String(value))) throw httpError(400, `${field} invalide (AAAA-MM-JJ)`)
  return String(value)
}
function optDateTime(value, field) {
  if (value === undefined || value === null || value === '') return null
  const t = Date.parse(String(value))
  if (Number.isNaN(t)) throw httpError(400, `${field} invalide`)
  return new Date(t).toISOString()
}
function optCoord(value, min, max, field) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${field} invalide`)
  return Math.round(n * 1e6) / 1e6
}
function normalizePhone(value) {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (!/^[+0-9\s().-]{4,30}$/.test(v)) throw httpError(400, 'numéro de téléphone invalide')
  return v
}
const phoneKey = (v) => String(v ?? '').replace(/[^0-9]/g, '').replace(/^(00212|212|0)/, '')
function optEmail(value) {
  const v = lower(value)
  if (!v) return ''
  if (v.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw httpError(400, 'e-mail invalide')
  return v
}
function tagList(value) {
  if (value === undefined) return undefined
  const arr = Array.isArray(value) ? value : String(value).split(/[,;]/)
  return [...new Set(arr.map((t) => String(t).trim()).filter(Boolean).map((t) => t.slice(0, 40)))].slice(0, 30)
}
const dayOf = (iso) => (iso ? String(iso).slice(0, 10) : '')
function inRange(day, from, to) {
  if (!day) return !from && !to
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}
function paginate(list, query, sorters) {
  const pageSize = Math.min(200, Math.max(1, Number(query.get('pageSize')) || 25))
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pages, Math.max(1, Number(query.get('page')) || 1))
  const sort = query.get('sort')
  const dir = query.get('dir') === 'asc' ? 1 : -1
  let rows = list
  if (sort && sorters[sort]) {
    const get = sorters[sort]
    rows = [...list].sort((a, b) => {
      const x = get(a), y = get(b)
      if (x === y) return 0
      if (x === null || x === undefined || x === '') return 1
      if (y === null || y === undefined || y === '') return -1
      return (x > y ? 1 : -1) * dir
    })
  }
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total, pages }
}
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
function eachDay(from, to, limit = 400) {
  const out = []
  if (!from || !to) return out
  let d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end && out.length < limit) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000) }
  return out
}
function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v)
  // Neutralise les formules tableur (injection CSV).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/* ------------------------------------------------------------------ */
/* Module                                                              */
/* ------------------------------------------------------------------ */

export function createCrm({ db, saveDb, json, readBody, audit, hashPassword, createInvitation, sendInvitationEmail, pushNotification, isCrmManagerPosition = () => false }) {
  for (const key of Object.keys(CRM_COLLECTIONS)) if (!Array.isArray(db[key])) db[key] = []

  function settings() {
    let s = db.crmSettings.find((x) => x.id === 'settings')
    if (!s) { s = defaultSettings(); db.crmSettings.push(s) }
    const d = defaultSettings()
    for (const key of Object.keys(d)) if (s[key] === undefined) s[key] = d[key]
    for (const k of ['contact', 'call', 'appointment']) s.labels[k] = { ...d.labels[k], ...(s.labels[k] || {}) }
    // Un rôle ajouté après coup reçoit ses permissions par défaut.
    for (const role of Object.keys(CRM_ROLES)) if (!CRM_ROLES[role].admin && !Array.isArray(s.rolePermissions[role])) s.rolePermissions[role] = [...(d.rolePermissions[role] || AGENT_PERMISSIONS)]
    return s
  }

  /* ---------- Rôles, permissions, périmètre ---------- */
  // La direction commerciale et le responsable de la téléprospection administrent le CRM.
  const isCrmUser = (u) => Boolean(u && (CRM_ROLES[u.role] || isCrmManagerPosition(u)))
  const isCrmAdmin = (u) => Boolean(u && (CRM_ROLES[u.role]?.admin || isCrmManagerPosition(u)))
  function permissionsOf(u) {
    if (!isCrmUser(u)) return []
    if (isCrmAdmin(u)) return [...AGENT_PERMISSIONS, ...ADMIN_PERMISSIONS]
    const base = Array.isArray(u.crm?.permissions) ? u.crm.permissions : settings().rolePermissions[u.role] || []
    return base.filter((p) => AGENT_PERMISSIONS.includes(p))
  }
  const can = (u, perm) => permissionsOf(u).includes(perm)
  function need(u, perm) { if (!can(u, perm)) throw httpError(403, 'permission refusée') }
  function scopeOf(u) {
    if (isCrmAdmin(u)) return { all: true }
    return { all: false, dbs: new Set(u.crm?.databaseIds || []), camps: new Set(u.crm?.campaignIds || []), zones: new Set(u.crm?.zoneIds || []) }
  }
  const dbById = (x) => db.crmDatabases.find((d) => d.id === x)
  const campById = (x) => db.crmCampaigns.find((c) => c.id === x)
  const zoneById = (x) => db.crmZones.find((z) => z.id === x)
  const contactById = (x) => db.crmContacts.find((c) => c.id === x)
  const userById = (x) => db.users.find((u) => u.id === x)
  const crmUsers = () => db.users.filter(isCrmUser)
  const isFieldRole = (u) => Boolean(u && CRM_ROLES[u.role] && !isCrmAdmin(u))
  const agents = () => db.users.filter(isFieldRole)
  const campaignOfContact = (c) => c.campaignId || dbById(c.databaseId)?.campaignId || null

  function contactVisible(u, c, sc = scopeOf(u)) {
    if (sc.all) return true
    if (c.archived) return false
    return c.agentId === u.id || (!c.agentId && sc.dbs.has(c.databaseId))
  }
  function appointmentVisible(u, a, sc = scopeOf(u)) {
    if (sc.all) return true
    if (a.agentId === u.id) return true
    const c = contactById(a.contactId)
    return Boolean(c && contactVisible(u, c, sc))
  }
  function callVisible(u, call, sc = scopeOf(u)) {
    if (sc.all) return true
    if (call.agentId === u.id) return true
    const c = contactById(call.contactId)
    return Boolean(c && contactVisible(u, c, sc))
  }
  const databaseVisible = (u, d, sc = scopeOf(u)) => sc.all || (sc.dbs.has(d.id) && d.status !== 'archived')
  const campaignVisible = (u, c, sc = scopeOf(u)) => sc.all || (sc.camps.has(c.id) && c.status !== 'archived')
  const zoneVisible = (u, z, sc = scopeOf(u)) => sc.all || sc.zones.has(z.id)

  /* ---------- Journal d'activité ---------- */
  function log(u, action, entityType, entityId, details = {}) {
    db.crmActivity.push({ id: id('act'), at: nowIso(), userId: u?.id || null, userName: u?.name || 'Système', action, entityType, entityId: entityId || null, details })
    if (db.crmActivity.length > 50000) db.crmActivity.splice(0, db.crmActivity.length - 50000)
    audit(`crm.${action}`, { by: u?.id || null, entityType, entityId })
  }

  /* ---------- Notifications ---------- */
  function notify(userIds, type, title, message, meta = {}) {
    if (settings().notifications[type] === false) return
    for (const uid of new Set(userIds.filter(Boolean))) {
      const target = userById(uid)
      if (!target || target.active === false || !isCrmUser(target)) continue
      if (target.crm?.notificationPrefs?.[type] === false) continue
      pushNotification({ userId: uid, type: `crm.${type}`, title, message, meta })
    }
  }
  const adminIds = () => crmUsers().filter((u) => isCrmAdmin(u) && u.active !== false).map((u) => u.id)

  /* ---------- Zones ---------- */
  function inZone(zone, rec) {
    if (!zone || !rec) return false
    const city = lower(rec.city), region = lower(rec.region)
    if (city && (zone.cities || []).some((c) => lower(c) === city)) return true
    if (region && (zone.regions || []).some((r) => lower(r) === region)) return true
    const lat = Number(rec.lat), lng = Number(rec.lng)
    if (rec.lat === null || rec.lat === undefined || rec.lng === null || rec.lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return false
    const shape = zone.shape
    if (shape?.type === 'circle') {
      const R = 6371, toRad = (x) => (x * Math.PI) / 180
      const dLat = toRad(lat - shape.lat), dLng = toRad(lng - shape.lng)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(shape.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
      return 2 * R * Math.asin(Math.sqrt(a)) <= shape.radiusKm
    }
    if (shape?.type === 'polygon' && Array.isArray(shape.points) && shape.points.length >= 3) {
      let inside = false
      const pts = shape.points
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [yi, xi] = pts[i], [yj, xj] = pts[j]
        if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }
    return false
  }

  /* ---------- Sérialisation ---------- */
  function userStatus(u) { return u.status && USER_STATUSES.includes(u.status) ? u.status : u.active === false ? 'inactive' : 'active' }
  function publicUser(u, withStats = false) {
    const out = {
      id: u.id, name: u.name || '', email: u.email, phone: u.phone || '', role: u.role, roleLabel: CRM_ROLES[u.role]?.label || u.role,
      status: userStatus(u), active: u.active !== false, passwordConfigured: u.passwordConfigured === true, lastLoginAt: u.lastLoginAt || null, createdAt: u.createdAt || null,
      databaseIds: u.crm?.databaseIds || [], campaignIds: u.crm?.campaignIds || [], zoneIds: u.crm?.zoneIds || [],
      permissions: Array.isArray(u.crm?.permissions) ? u.crm.permissions : null, effectivePermissions: permissionsOf(u),
      lastActivityAt: lastActivityOf(u.id) || u.lastLoginAt || null,
    }
    if (withStats) Object.assign(out, agentMetrics(u))
    return out
  }
  function lastActivityOf(userId) {
    for (let i = db.crmActivity.length - 1; i >= 0; i--) if (db.crmActivity[i].userId === userId) return db.crmActivity[i].at
    return null
  }
  function contactOut(c) {
    const d = dbById(c.databaseId), campId = campaignOfContact(c), camp = campId ? campById(campId) : null, agent = c.agentId ? userById(c.agentId) : null
    return { ...c, databaseName: d?.name || '', campaignId: campId, campaignName: camp?.name || '', agentName: agent?.name || '' }
  }
  function callOut(call) {
    const c = contactById(call.contactId), agent = userById(call.agentId)
    return { ...call, contactName: c?.fullName || '', agentName: agent?.name || '', campaignName: call.campaignId ? campById(call.campaignId)?.name || '' : '', databaseName: call.databaseId ? dbById(call.databaseId)?.name || '' : '' }
  }
  function appointmentOut(a) {
    const c = contactById(a.contactId), agent = a.agentId ? userById(a.agentId) : null
    return { ...a, contactName: c?.fullName || '', agentName: agent?.name || '', campaignName: a.campaignId ? campById(a.campaignId)?.name || '' : '', databaseName: a.databaseId ? dbById(a.databaseId)?.name || '' : '' }
  }

  /* ---------- Métriques ---------- */
  function contactStats(contacts, calls, appts) {
    const called = new Set(calls.map((c) => c.contactId))
    const reached = new Set(calls.filter((c) => REACHED_CALL_STATUSES.has(c.status)).map((c) => c.contactId))
    const booked = new Set(appts.filter((a) => a.status !== 'cancelled').map((a) => a.contactId))
    return { total: contacts.length, called: contacts.filter((c) => called.has(c.id)).length, reached: contacts.filter((c) => reached.has(c.id)).length, booked: contacts.filter((c) => booked.has(c.id)).length }
  }
  function agentMetrics(u, filter = {}) {
    const calls = db.crmCalls.filter((c) => c.agentId === u.id && inRange(dayOf(c.at), filter.from, filter.to))
    const appts = db.crmAppointments.filter((a) => a.agentId === u.id && inRange(dayOf(a.createdAt), filter.from, filter.to))
    const today = filter.today || dayOf(nowIso())
    const reachedContacts = new Set(calls.filter((c) => REACHED_CALL_STATUSES.has(c.status)).map((c) => c.contactId))
    const calledContacts = new Set(calls.map((c) => c.contactId))
    const durations = calls.map((c) => Number(c.durationSec)).filter((n) => Number.isFinite(n) && n > 0)
    const assigned = db.crmContacts.filter((c) => !c.archived && c.agentId === u.id).length
    return {
      contactsAssigned: assigned,
      callsMade: calls.length,
      callsToday: calls.filter((c) => dayOf(c.at) === today).length,
      contactsReached: reachedContacts.size,
      contactRate: pct(reachedContacts.size, calledContacts.size),
      appointmentsBooked: appts.filter((a) => a.status !== 'cancelled').length,
      confirmedAppointments: appts.filter((a) => a.status === 'confirmed').length,
      completedAppointments: appts.filter((a) => a.status === 'completed').length,
      conversionRate: pct(new Set(appts.filter((a) => a.status !== 'cancelled').map((a) => a.contactId)).size, calledContacts.size),
      callbacks: calls.filter((c) => c.callbackAt).length,
      avgCallDurationSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    }
  }

  /* ---------- Filtres communs ---------- */
  function readFilters(q) {
    return {
      from: q.get('from') && DATE_RE.test(q.get('from')) ? q.get('from') : null,
      to: q.get('to') && DATE_RE.test(q.get('to')) ? q.get('to') : null,
      today: q.get('today') && DATE_RE.test(q.get('today')) ? q.get('today') : dayOf(nowIso()),
      agentId: q.get('agentId') || null,
      campaignId: q.get('campaignId') || null,
      databaseId: q.get('databaseId') || null,
      zoneId: q.get('zoneId') || null,
      city: q.get('city') || null,
      region: q.get('region') || null,
      callStatus: q.get('callStatus') || null,
      appointmentStatus: q.get('appointmentStatus') || null,
      contactStatus: q.get('status') || q.get('contactStatus') || null,
      q: lower(q.get('q') || ''),
    }
  }
  /** Contacts, appels et RDV visibles, filtrés de façon cohérente pour les tableaux de bord et rapports. */
  function filteredData(u, f) {
    const sc = scopeOf(u)
    const zone = f.zoneId ? zoneById(f.zoneId) : null
    const contactOk = (c) => contactVisible(u, c, sc) && !c.archived
      && (!f.agentId || c.agentId === f.agentId)
      && (!f.campaignId || campaignOfContact(c) === f.campaignId)
      && (!f.databaseId || c.databaseId === f.databaseId)
      && (!zone || inZone(zone, c))
      && (!f.city || lower(c.city) === lower(f.city))
      && (!f.region || lower(c.region) === lower(f.region))
      && (!f.contactStatus || c.status === f.contactStatus)
    const contacts = db.crmContacts.filter(contactOk)
    const visibleIds = new Set(contacts.map((c) => c.id))
    const calls = db.crmCalls.filter((call) => callVisible(u, call, sc)
      && (!f.agentId || call.agentId === f.agentId)
      && (!f.campaignId || call.campaignId === f.campaignId)
      && (!f.databaseId || call.databaseId === f.databaseId)
      && (!zone && !f.city && !f.region && !f.contactStatus ? true : visibleIds.has(call.contactId))
      && (!f.callStatus || call.status === f.callStatus))
    const appts = db.crmAppointments.filter((a) => appointmentVisible(u, a, sc)
      && (!f.agentId || a.agentId === f.agentId)
      && (!f.campaignId || a.campaignId === f.campaignId)
      && (!f.databaseId || a.databaseId === f.databaseId)
      && (!zone || inZone(zone, a))
      && (!f.city || lower(a.city) === lower(f.city))
      && (!f.region || lower(a.region) === lower(f.region))
      && (!f.appointmentStatus || a.status === f.appointmentStatus))
    return { contacts, calls, appts, sc }
  }

  /* ---------- Contacts : création / mise à jour ---------- */
  const CONTACT_TEXT_FIELDS = { firstName: 80, lastName: 80, address: 240, city: 100, region: 100, postalCode: 20, country: 80, notes: 4000 }
  function applyContactFields(c, body, { partial }) {
    for (const [k, max] of Object.entries(CONTACT_TEXT_FIELDS)) if (!partial || k in body) c[k] = text(body[k], max, k)
    if (!partial || 'phone' in body) c.phone = normalizePhone(body.phone)
    if (!partial || 'phone2' in body) c.phone2 = normalizePhone(body.phone2)
    if (!partial || 'email' in body) c.email = optEmail(body.email)
    if (!partial || 'lat' in body) c.lat = optCoord(body.lat, -90, 90, 'latitude')
    if (!partial || 'lng' in body) c.lng = optCoord(body.lng, -180, 180, 'longitude')
    if ((c.lat === null) !== (c.lng === null)) throw httpError(400, 'latitude et longitude vont ensemble')
    if (!partial || 'tags' in body) c.tags = tagList(body.tags) || []
    if (!partial || 'status' in body) c.status = oneOf(body.status, CONTACT_STATUSES, 'statut', c.status || 'new')
    if (!partial || 'nextCallbackAt' in body) c.nextCallbackAt = optDateTime(body.nextCallbackAt, 'date de rappel')
    if (body.custom !== undefined) {
      if (typeof body.custom !== 'object' || Array.isArray(body.custom) || body.custom === null) throw httpError(400, 'champs personnalisés invalides')
      const entries = Object.entries(body.custom).slice(0, 30).map(([k, v]) => [String(k).slice(0, 60), String(v ?? '').slice(0, 500)])
      c.custom = Object.fromEntries(entries)
    }
    const full = text(body.fullName, 160, 'nom complet')
    c.fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || full || c.fullName || ''
    if (!c.fullName) throw httpError(400, 'nom du contact requis')
    if (!c.phone && !c.email) throw httpError(400, 'un téléphone ou un e-mail est requis')
  }
  function findDuplicate(contact, keyMode, exceptId = null) {
    const pk = phoneKey(contact.phone), em = lower(contact.email)
    return db.crmContacts.find((c) => c.id !== exceptId && !c.archived && (
      (keyMode !== 'email' && pk && pk.length >= 6 && (phoneKey(c.phone) === pk || phoneKey(c.phone2) === pk)) ||
      (keyMode !== 'phone' && em && lower(c.email) === em)
    )) || null
  }

  function assignAgentToContacts(u, contactIds, agentId) {
    const agent = agentId ? userById(agentId) : null
    if (agentId && (!agent || !isCrmUser(agent))) throw httpError(400, 'agent introuvable')
    let n = 0
    for (const cid of contactIds) {
      const c = contactById(cid)
      if (!c) continue
      c.agentId = agentId || null; c.updatedAt = nowIso(); n++
    }
    if (agentId && n) notify([agentId], 'contacts.assigned', 'Nouveaux contacts assignés', `${n} contact(s) vous ont été assignés.`, { count: n })
    log(u, 'contact.assigned', 'contact', null, { count: n, agentId: agentId || null })
    return n
  }

  /* ---------- Appels ---------- */
  function recordCall(u, body) {
    const c = contactById(String(body.contactId || ''))
    if (!c || !contactVisible(u, c)) throw httpError(404, 'contact introuvable')
    const status = oneOf(body.status, CALL_STATUSES, 'statut d’appel', null)
    if (!status) throw httpError(400, 'statut d’appel requis')
    const notes = text(body.notes, 4000, 'notes')
    if (settings().calls.requireNotesOnFailure && ['no_answer', 'busy', 'invalid_number', 'not_interested'].includes(status) && !notes) throw httpError(400, 'une note est requise pour ce résultat')
    const duration = body.durationSec === undefined || body.durationSec === null || body.durationSec === '' ? null : Number(body.durationSec)
    if (duration !== null && (!Number.isFinite(duration) || duration < 0 || duration > 86400)) throw httpError(400, 'durée invalide')
    const agentId = isCrmAdmin(u) && body.agentId ? String(body.agentId) : u.id
    if (!userById(agentId)) throw httpError(400, 'agent introuvable')
    const call = {
      id: id('call'), contactId: c.id, agentId, phone: normalizePhone(body.phone || c.phone), at: optDateTime(body.at, 'date') || nowIso(),
      durationSec: duration === null ? null : Math.round(duration), status, result: text(body.result, 200, 'résultat'), notes,
      callbackAt: optDateTime(body.callbackAt, 'date de rappel'), campaignId: campaignOfContact(c), databaseId: c.databaseId, appointmentId: null,
      recordingUrl: null, createdAt: nowIso(), createdBy: u.id,
    }
    db.crmCalls.push(call)
    c.callStatus = status
    c.status = CALL_TO_CONTACT_STATUS[status] || (c.status === 'new' ? 'not_contacted' : c.status)
    c.lastContactAt = call.at
    if (call.callbackAt) { c.nextCallbackAt = call.callbackAt; c.status = 'callback_requested' }
    else if (c.nextCallbackAt && Date.parse(c.nextCallbackAt) <= Date.now() + 3600000) c.nextCallbackAt = null
    c.updatedAt = nowIso()
    log(u, 'call.recorded', 'call', call.id, { contactId: c.id, status })
    return call
  }

  /* ---------- Rendez-vous ---------- */
  function validateAppointment(a) {
    if (!a.date) throw httpError(400, 'date requise')
    if (!TIME_RE.test(a.start || '')) throw httpError(400, 'heure de début invalide (HH:MM)')
    if (!TIME_RE.test(a.end || '')) throw httpError(400, 'heure de fin invalide (HH:MM)')
    if (a.end <= a.start) throw httpError(400, 'la fin doit être après le début')
  }
  function addMinutes(hhmm, minutes) {
    const [h, m] = hhmm.split(':').map(Number)
    const t = Math.min(23 * 60 + 59, h * 60 + m + minutes)
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }

  /* ---------- Statistiques (tableau de bord) ---------- */
  function stats(u, f) {
    const { contacts, calls: allCalls, appts: allAppts } = filteredData(u, f)
    const calls = allCalls.filter((c) => inRange(dayOf(c.at), f.from, f.to))
    const appts = allAppts.filter((a) => inRange(dayOf(a.createdAt), f.from, f.to))
    const cs = contactStats(contacts, allCalls.filter((c) => inRange(dayOf(c.at), f.from, f.to)), appts)
    const successful = calls.filter((c) => REACHED_CALL_STATUSES.has(c.status)).length
    const byStatus = (list, statuses, key = 'status') => statuses.map((s) => ({ key: s, value: list.filter((x) => x[key] === s).length }))
    const days = f.from && f.to ? eachDay(f.from, f.to) : []
    const series = days.map((d) => ({ day: d, calls: calls.filter((c) => dayOf(c.at) === d).length, reached: calls.filter((c) => dayOf(c.at) === d && REACHED_CALL_STATUSES.has(c.status)).length, appointments: appts.filter((a) => dayOf(a.createdAt) === d).length }))
    const agentList = isCrmAdmin(u) ? agents().filter((a) => !f.agentId || a.id === f.agentId) : [u]
    const perAgent = agentList.map((a) => {
      const ac = calls.filter((c) => c.agentId === a.id), aa = appts.filter((x) => x.agentId === a.id)
      const called = new Set(ac.map((c) => c.contactId)).size
      return { id: a.id, name: a.name, active: a.active !== false, calls: ac.length, reached: ac.filter((c) => REACHED_CALL_STATUSES.has(c.status)).length, appointments: aa.filter((x) => x.status !== 'cancelled').length, conversionRate: pct(new Set(aa.filter((x) => x.status !== 'cancelled').map((x) => x.contactId)).size, called), lastActivityAt: lastActivityOf(a.id) }
    }).sort((a, b) => b.appointments - a.appointments || b.calls - a.calls)
    const sc = scopeOf(u)
    const perDatabase = db.crmDatabases.filter((d) => databaseVisible(u, d, sc) && (!f.databaseId || d.id === f.databaseId)).map((d) => {
      const dc = contacts.filter((c) => c.databaseId === d.id), dcalls = calls.filter((c) => c.databaseId === d.id), dap = appts.filter((a) => a.databaseId === d.id)
      const s = contactStats(dc, dcalls, dap)
      return { id: d.id, name: d.name, contacts: s.total, called: s.called, reached: s.reached, appointments: dap.filter((a) => a.status !== 'cancelled').length, conversionRate: pct(s.booked, s.called) }
    })
    const perCampaign = db.crmCampaigns.filter((c) => campaignVisible(u, c, sc) && (!f.campaignId || c.id === f.campaignId)).map((camp) => {
      const cc = contacts.filter((c) => campaignOfContact(c) === camp.id), ccalls = calls.filter((c) => c.campaignId === camp.id), cap = appts.filter((a) => a.campaignId === camp.id)
      const s = contactStats(cc, ccalls, cap)
      const goal = Number(camp.goals?.appointments) || 0
      const booked = cap.filter((a) => a.status !== 'cancelled').length
      return { id: camp.id, name: camp.name, status: camp.status, contacts: s.total, calls: ccalls.length, reached: s.reached, appointments: booked, conversionRate: pct(s.booked, s.called), goal, progress: goal ? Math.min(100, pct(booked, goal)) : null }
    })
    const geoMap = new Map()
    for (const c of contacts) { const k = c.city || 'Ville non renseignée'; const g = geoMap.get(k) || { city: k, contacts: 0, appointments: 0 }; g.contacts++; geoMap.set(k, g) }
    for (const a of appts) { const k = a.city || 'Ville non renseignée'; const g = geoMap.get(k) || { city: k, contacts: 0, appointments: 0 }; g.appointments++; geoMap.set(k, g) }
    const today = f.today
    const upcoming = allAppts.filter((a) => a.date >= today && !['cancelled', 'completed', 'no_show'].includes(a.status)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
    const inactivityDays = settings().calls.inactivityAlertDays
    const attention = perAgent.filter((a) => a.active && (!a.lastActivityAt || Date.now() - Date.parse(a.lastActivityAt) > inactivityDays * 86400000 || (a.calls >= 10 && pct(a.reached, a.calls) < 15)))
    return {
      kpis: {
        totalContacts: contacts.length,
        totalDatabases: perDatabase.length,
        callsToday: allCalls.filter((c) => dayOf(c.at) === today).length,
        totalCalls: calls.length,
        contactsReached: cs.reached,
        contactsNotReached: Math.max(0, cs.called - cs.reached),
        contactsNeverCalled: Math.max(0, cs.total - cs.called),
        appointmentsBooked: appts.filter((a) => a.status !== 'cancelled').length,
        confirmedAppointments: appts.filter((a) => a.status === 'confirmed').length,
        pendingAppointments: appts.filter((a) => a.status === 'pending').length,
        cancelledAppointments: appts.filter((a) => a.status === 'cancelled').length,
        noShowAppointments: appts.filter((a) => a.status === 'no_show').length,
        activeAgents: agents().filter((a) => a.active !== false).length,
        conversionRate: pct(cs.booked, cs.called),
        successfulCalls: successful,
        unsuccessfulCalls: calls.length - successful,
        callbacksDue: contacts.filter((c) => c.nextCallbackAt && dayOf(c.nextCallbackAt) <= today).length,
      },
      series,
      callStatus: byStatus(calls, CALL_STATUSES),
      appointmentStatus: byStatus(appts, APPOINTMENT_STATUSES),
      perAgent: isCrmAdmin(u) ? perAgent : perAgent.filter((a) => a.id === u.id),
      perDatabase,
      perCampaign,
      geo: [...geoMap.values()].sort((a, b) => b.contacts + b.appointments - (a.contacts + a.appointments)).slice(0, 15),
      todayAppointments: allAppts.filter((a) => a.date === today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 20).map(appointmentOut),
      upcomingAppointments: upcoming.slice(0, 10).map(appointmentOut),
      recentCalls: [...calls].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10).map(callOut),
      recentActivity: db.crmActivity.filter((a) => isCrmAdmin(u) || a.userId === u.id).slice(-12).reverse(),
      topAgents: isCrmAdmin(u) ? perAgent.slice(0, 5) : [],
      agentsNeedingAttention: isCrmAdmin(u) ? attention.slice(0, 5) : [],
      recentImports: isCrmAdmin(u) ? db.crmImports.slice(-6).reverse().map((i) => ({ ...i, errors: undefined, databaseName: dbById(i.databaseId)?.name || '' })) : [],
    }
  }

  /* ---------- Rapports ---------- */
  function report(u, type, f, q) {
    const { contacts, calls: allCalls, appts: allAppts } = filteredData(u, f)
    const calls = allCalls.filter((c) => inRange(dayOf(c.at), f.from, f.to))
    const appts = allAppts.filter((a) => inRange(dayOf(a.createdAt), f.from, f.to))
    const days = f.from && f.to ? eachDay(f.from, f.to) : []
    const L = settings().labels
    switch (type) {
      case 'calls': return {
        columns: ['Date', 'Contact', 'Agent', 'Téléphone', 'Statut', 'Résultat', 'Durée (s)', 'Rappel', 'Campagne', 'Base de contacts', 'Notes'],
        rows: calls.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5000).map((c) => { const o = callOut(c); return [c.at, o.contactName, o.agentName, c.phone, L.call[c.status] || c.status, c.result, c.durationSec ?? '', c.callbackAt || '', o.campaignName, o.databaseName, c.notes] }),
        series: days.map((d) => ({ label: d, value: calls.filter((c) => dayOf(c.at) === d).length, value2: calls.filter((c) => dayOf(c.at) === d && REACHED_CALL_STATUSES.has(c.status)).length })),
        totals: { 'Appels': calls.length, 'Joints': calls.filter((c) => REACHED_CALL_STATUSES.has(c.status)).length, 'Taux de joignabilité (%)': pct(calls.filter((c) => REACHED_CALL_STATUSES.has(c.status)).length, calls.length) },
      }
      case 'contacts': return {
        columns: ['Nom', 'Téléphone', 'E-mail', 'Ville', 'Région', 'Statut', 'Statut d’appel', 'Agent', 'Base de contacts', 'Campagne', 'Dernier contact', 'Prochain rappel'],
        rows: contacts.filter((c) => inRange(dayOf(c.createdAt), f.from, f.to)).slice(0, 5000).map((c) => { const o = contactOut(c); return [c.fullName, c.phone, c.email, c.city, c.region, L.contact[c.status] || c.status, c.callStatus ? L.call[c.callStatus] || c.callStatus : '', o.agentName, o.databaseName, o.campaignName, c.lastContactAt || '', c.nextCallbackAt || ''] }),
        series: CONTACT_STATUSES.map((s) => ({ label: L.contact[s], value: contacts.filter((c) => c.status === s).length })),
        totals: { 'Contacts': contacts.length },
      }
      case 'appointments': return {
        columns: ['Date', 'Début', 'Fin', 'Titre', 'Contact', 'Téléphone', 'Agent', 'Ville', 'Statut', 'Type', 'Campagne'],
        rows: appts.sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)).slice(0, 5000).map((a) => { const o = appointmentOut(a); return [a.date, a.start, a.end, a.title, o.contactName, a.phone, o.agentName, a.city, L.appointment[a.status] || a.status, a.type, o.campaignName] }),
        series: days.map((d) => ({ label: d, value: appts.filter((a) => dayOf(a.createdAt) === d).length })),
        totals: Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [L.appointment[s], appts.filter((a) => a.status === s).length])),
      }
      case 'agents': {
        const list = (isCrmAdmin(u) ? agents() : [u]).filter((a) => !f.agentId || a.id === f.agentId)
        const rows = list.map((a) => { const m = agentMetrics(a, f); return [a.name, a.email, m.contactsAssigned, m.callsMade, m.contactsReached, m.contactRate, m.appointmentsBooked, m.confirmedAppointments, m.completedAppointments, m.conversionRate, m.callbacks, m.avgCallDurationSec ?? ''] })
        return { columns: ['Agent', 'E-mail', 'Contacts assignés', 'Appels', 'Contacts joints', 'Taux de contact (%)', 'RDV pris', 'RDV confirmés', 'RDV réalisés', 'Conversion (%)', 'Rappels', 'Durée moy. (s)'], rows, series: rows.map((r) => ({ label: r[0], value: r[3], value2: r[6] })), totals: { 'Agents': rows.length } }
      }
      case 'databases': case 'campaigns': {
        const s = stats(u, f)
        if (type === 'databases') return { columns: ['Base de contacts', 'Contacts', 'Appelés', 'Joints', 'RDV', 'Conversion (%)'], rows: s.perDatabase.map((d) => [d.name, d.contacts, d.called, d.reached, d.appointments, d.conversionRate]), series: s.perDatabase.map((d) => ({ label: d.name, value: d.contacts, value2: d.appointments })), totals: { 'Bases': s.perDatabase.length } }
        return { columns: ['Campagne', 'Statut', 'Contacts', 'Appels', 'Joints', 'RDV', 'Conversion (%)', 'Objectif RDV', 'Progression (%)'], rows: s.perCampaign.map((c) => [c.name, c.status, c.contacts, c.calls, c.reached, c.appointments, c.conversionRate, c.goal || '', c.progress ?? '']), series: s.perCampaign.map((c) => ({ label: c.name, value: c.calls, value2: c.appointments })), totals: { 'Campagnes': s.perCampaign.length } }
      }
      case 'zones': {
        const sc = scopeOf(u)
        const zones = db.crmZones.filter((z) => zoneVisible(u, z, sc))
        const rows = zones.map((z) => { const zc = contacts.filter((c) => inZone(z, c)), za = appts.filter((a) => inZone(z, a)); const ids = new Set(zc.map((c) => c.id)); const zcalls = calls.filter((c) => ids.has(c.contactId)); return [z.name, zc.length, zcalls.length, new Set(zcalls.filter((c) => REACHED_CALL_STATUSES.has(c.status)).map((c) => c.contactId)).size, za.filter((a) => a.status !== 'cancelled').length] })
        const byCity = new Map(); for (const c of contacts) byCity.set(c.city || '—', (byCity.get(c.city || '—') || 0) + 1)
        return { columns: ['Zone', 'Contacts', 'Appels', 'Contacts joints', 'RDV'], rows, series: [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([label, value]) => ({ label, value })), totals: { 'Zones': rows.length } }
      }
      case 'conversion': {
        const cs = contactStats(contacts, calls, appts)
        const funnel = [['Contacts', cs.total], ['Appelés', cs.called], ['Joints', cs.reached], ['RDV pris', cs.booked], ['RDV réalisés', new Set(appts.filter((a) => a.status === 'completed').map((a) => a.contactId)).size]]
        return { columns: ['Étape', 'Contacts', '% du total', '% de l’étape précédente'], rows: funnel.map(([label, v], i) => [label, v, pct(v, cs.total), i ? pct(v, funnel[i - 1][1]) : 100]), series: funnel.map(([label, value]) => ({ label, value })), totals: { 'Conversion (%)': pct(cs.booked, cs.called) } }
      }
      case 'callbacks': {
        const withCb = calls.filter((c) => c.callbackAt)
        const rows = withCb.sort((a, b) => b.callbackAt.localeCompare(a.callbackAt)).slice(0, 5000).map((c) => {
          const followUp = db.crmCalls.find((x) => x.contactId === c.contactId && x.at > c.at)
          const o = callOut(c)
          const onTime = followUp ? Date.parse(followUp.at) <= Date.parse(c.callbackAt) + 3600000 : null
          return [o.contactName, o.agentName, c.callbackAt, followUp?.at || '', followUp ? (onTime ? 'À l’heure' : 'En retard') : Date.parse(c.callbackAt) < Date.now() ? 'Manqué' : 'À venir', followUp ? L.call[followUp.status] || followUp.status : '']
        })
        const done = rows.filter((r) => r[3]).length
        return { columns: ['Contact', 'Agent', 'Rappel prévu', 'Rappel effectué', 'Ponctualité', 'Résultat'], rows, series: ['À l’heure', 'En retard', 'Manqué', 'À venir'].map((label) => ({ label, value: rows.filter((r) => r[4] === label).length })), totals: { 'Rappels programmés': rows.length, 'Rappels effectués': done, 'Taux de rappel (%)': pct(done, rows.length) } }
      }
      default: throw httpError(400, 'type de rapport inconnu')
    }
  }

  /* ---------- Rappels automatiques ---------- */
  function runCallbackReminders() {
    const minutes = settings().calls.callbackReminderMinutes
    const horizon = Date.now() + minutes * 60000
    let changed = false
    for (const c of db.crmContacts) {
      if (!c.nextCallbackAt || c.archived || c.callbackNotifiedFor === c.nextCallbackAt) continue
      const t = Date.parse(c.nextCallbackAt)
      if (!Number.isFinite(t) || t > horizon || t < Date.now() - 86400000) continue
      notify(c.agentId ? [c.agentId] : adminIds(), 'callback.reminder', 'Rappel à effectuer', `Rappeler ${c.fullName} (${c.phone || c.email}) à ${new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`, { contactId: c.id })
      c.callbackNotifiedFor = c.nextCallbackAt
      changed = true
    }
    if (changed) saveDb(db)
  }
  // Sur Vercel il n'y a pas de processus permanent : les rappels sont lancés par les requêtes CRM.
  if (!process.env.VERCEL) setInterval(runCallbackReminders, 60000).unref?.()

  /* ---------- Géocodage (opt-in, déclenché par un administrateur) ---------- */
  async function geocodeOne(rec) {
    const query = [rec.address, rec.postalCode, rec.city, rec.region, rec.country || settings().general.defaultCountry].filter(Boolean).join(', ')
    if (!query.trim() || (!rec.city && !rec.address)) return { ok: false, reason: 'adresse insuffisante' }
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { 'user-agent': 'ALLNEEDS-CRM/1.0 (self-hosted)', 'accept-language': 'fr' }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return { ok: false, reason: `service indisponible (${r.status})` }
    const rows = await r.json()
    if (!Array.isArray(rows) || !rows.length) return { ok: false, reason: 'adresse introuvable' }
    return { ok: true, lat: Math.round(Number(rows[0].lat) * 1e6) / 1e6, lng: Math.round(Number(rows[0].lon) * 1e6) / 1e6 }
  }

  /* ================================================================== */
  /* Routeur                                                            */
  /* ================================================================== */
  async function handle(req, res, url, user, cors) {
    if (!url.pathname.startsWith('/api/crm/')) return false
    if (!isCrmUser(user)) { json(res, 403, { error: 'accès CRM réservé aux administrateurs et aux agents' }, cors); return true }
    if (user.status === 'suspended' || user.active === false) { json(res, 403, { error: 'compte suspendu' }, cors); return true }
    const path = url.pathname.slice('/api/crm'.length)
    const q = url.searchParams
    const M = req.method
    const send = (code, body) => { json(res, code, body, cors); return true }
    const body = ['POST', 'PATCH', 'PUT'].includes(M) ? await readBody(req) : {}
    let m

    // Un responsable CRM n'est pas PDG : il ne peut ni accorder ce rôle, ni agir sur un compte PDG.
    if (user.role !== 'admin' && path.startsWith('/users')) {
      const targetId = path.match(/^\/users\/([^/]+)/)?.[1]
      if (body.role === 'admin') throw httpError(403, 'rôle réservé au PDG')
      if (M !== 'GET' && targetId && userById(targetId)?.role === 'admin') throw httpError(403, 'compte réservé au PDG')
    }

    /* ---------- Session ---------- */
    if (M === 'GET' && path === '/me') {
      const s = settings()
      return send(200, { user: publicUser(user), isAdmin: isCrmAdmin(user), permissions: permissionsOf(user), labels: s.labels, appointmentTypes: s.appointments.types, campaignTypes: s.campaigns.types, defaultDurationMin: s.appointments.defaultDurationMin, geocoding: s.integrations.geocoding, crmName: s.general.crmName, unread: db.notifications.filter((n) => n.userId === user.id && !n.readAt && String(n.type).startsWith('crm.')).length })
    }
    if (M === 'GET' && path === '/lookups') {
      const sc = scopeOf(user)
      return send(200, {
        agents: (isCrmAdmin(user) ? crmUsers() : [user]).map((a) => ({ id: a.id, name: a.name, role: a.role, active: a.active !== false })),
        databases: db.crmDatabases.filter((d) => databaseVisible(user, d, sc)).map((d) => ({ id: d.id, name: d.name, status: d.status })),
        campaigns: db.crmCampaigns.filter((c) => campaignVisible(user, c, sc)).map((c) => ({ id: c.id, name: c.name, status: c.status })),
        zones: db.crmZones.filter((z) => zoneVisible(user, z, sc)).map((z) => ({ id: z.id, name: z.name, color: z.color })),
        cities: [...new Set(db.crmContacts.filter((c) => contactVisible(user, c, sc)).map((c) => c.city).filter(Boolean))].sort().slice(0, 500),
        regions: [...new Set(db.crmContacts.filter((c) => contactVisible(user, c, sc)).map((c) => c.region).filter(Boolean))].sort().slice(0, 200),
      })
    }

    /* ---------- Tableau de bord & rapports ---------- */
    if (M === 'GET' && path === '/stats') { need(user, 'dashboard.view'); return send(200, stats(user, readFilters(q))) }
    if (M === 'GET' && path === '/reports') {
      need(user, 'reports.view')
      const f = readFilters(q)
      const type = q.get('type') || 'calls'
      const current = report(user, type, f, q)
      let previous = null
      if (q.get('compare') === '1' && f.from && f.to) {
        const span = eachDay(f.from, f.to).length
        const pTo = new Date(Date.parse(`${f.from}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
        const pFrom = new Date(Date.parse(`${pTo}T00:00:00Z`) - (span - 1) * 86400000).toISOString().slice(0, 10)
        previous = { from: pFrom, to: pTo, totals: report(user, type, { ...f, from: pFrom, to: pTo }, q).totals }
      }
      return send(200, { ...current, previous })
    }

    /* ---------- Utilisateurs ---------- */
    if (path === '/users' && M === 'GET') {
      need(user, 'users.manage')
      const f = { q: lower(q.get('q')), role: q.get('role'), status: q.get('status'), campaignId: q.get('campaignId'), databaseId: q.get('databaseId') }
      const list = crmUsers().filter((u) => (!f.q || `${u.name} ${u.email} ${u.phone || ''}`.toLowerCase().includes(f.q)) && (!f.role || u.role === f.role) && (!f.status || userStatus(u) === f.status) && (!f.campaignId || (u.crm?.campaignIds || []).includes(f.campaignId)) && (!f.databaseId || (u.crm?.databaseIds || []).includes(f.databaseId))).map((u) => publicUser(u, true))
      return send(200, { ...paginate(list, q, { name: (u) => lower(u.name), email: (u) => u.email, role: (u) => u.role, status: (u) => u.status, calls: (u) => u.callsMade, appointments: (u) => u.appointmentsBooked, lastActivity: (u) => u.lastActivityAt || '' }), roles: Object.entries(CRM_ROLES).map(([key, r]) => ({ key, label: r.label })) })
    }
    if (path === '/users' && M === 'POST') {
      need(user, 'users.manage')
      const name = text(body.name, 160, 'nom complet', { required: true })
      const email = optEmail(body.email)
      if (!email) throw httpError(400, 'e-mail requis')
      if (db.users.some((u) => lower(u.email) === email)) throw httpError(409, 'cet e-mail possède déjà un compte')
      const role = oneOf(body.role, Object.keys(CRM_ROLES), 'rôle', 'agent')
      const status = oneOf(body.status, USER_STATUSES, 'statut', 'active')
      const mode = body.password ? 'password' : 'invite'
      const newUser = {
        id: `usr-${randomBytes(10).toString('hex')}`, email, name, phone: normalizePhone(body.phone), role, orgIds: role === 'admin' ? ['*'] : [], sectors: [],
        active: status === 'active', status, passwordHash: null, passwordConfigured: false, permissions: role === 'admin' ? ['*'] : [], createdAt: nowIso(), createdBy: user.id,
        crm: { databaseIds: idList(body.databaseIds, (x) => dbById(x), 'bases') || [], campaignIds: idList(body.campaignIds, (x) => campById(x), 'campagnes') || [], zoneIds: idList(body.zoneIds, (x) => zoneById(x), 'zones') || [], permissions: Array.isArray(body.permissions) && role !== 'admin' ? body.permissions.filter((p) => AGENT_PERMISSIONS.includes(p)) : null },
      }
      if (mode === 'password') {
        const pw = String(body.password)
        if (pw.length < 12 || pw.length > 1024) throw httpError(400, 'le mot de passe doit contenir au moins 12 caractères')
        newUser.passwordHash = await hashPassword(pw); newUser.passwordConfigured = true
      }
      db.users.push(newUser)
      let delivery = null
      if (mode === 'invite') {
        const { invitation, token } = createInvitation({ email, name, role, permissions: newUser.permissions, createdBy: user.id, kind: 'crm', metadata: {} })
        delivery = await sendInvitationEmail(invitation, token)
      }
      notify([newUser.id], 'user.created', 'Bienvenue dans le CRM', 'Votre compte CRM a été créé.')
      if (newUser.crm.databaseIds.length) notify([newUser.id], 'database.assigned', 'Bases assignées', `${newUser.crm.databaseIds.length} base(s) vous ont été assignées.`)
      if (newUser.crm.campaignIds.length) notify([newUser.id], 'campaign.assigned', 'Campagnes assignées', `${newUser.crm.campaignIds.length} campagne(s) vous ont été assignées.`)
      log(user, 'user.created', 'user', newUser.id, { email, role, mode })
      saveDb(db)
      return send(201, { user: publicUser(newUser, true), delivery })
    }
    if ((m = path.match(/^\/users\/([^/]+)$/))) {
      const target = userById(m[1])
      if (M === 'GET' && target && target.id === user.id) return send(200, publicUser(target, true))
      need(user, 'users.manage')
      if (!target || !isCrmUser(target)) throw httpError(404, 'utilisateur introuvable')
      if (M === 'GET') return send(200, publicUser(target, true))
      if (M === 'PATCH') {
        const changes = {}
        if ('name' in body) target.name = changes.name = text(body.name, 160, 'nom complet', { required: true })
        if ('phone' in body) target.phone = changes.phone = normalizePhone(body.phone)
        if ('email' in body) {
          const email = optEmail(body.email)
          if (!email) throw httpError(400, 'e-mail requis')
          if (db.users.some((u) => u.id !== target.id && lower(u.email) === email)) throw httpError(409, 'cet e-mail possède déjà un compte')
          target.email = changes.email = email
        }
        if ('role' in body) {
          const role = oneOf(body.role, Object.keys(CRM_ROLES), 'rôle', target.role)
          if (target.id === user.id && role !== target.role) throw httpError(400, 'vous ne pouvez pas changer votre propre rôle')
          target.role = changes.role = role
          target.orgIds = role === 'admin' ? ['*'] : []
          target.permissions = role === 'admin' ? ['*'] : []
        }
        if ('status' in body) {
          const status = oneOf(body.status, USER_STATUSES, 'statut', userStatus(target))
          if (target.id === user.id && status !== 'active') throw httpError(400, 'vous ne pouvez pas désactiver votre propre compte')
          target.status = changes.status = status; target.active = status === 'active'
        }
        target.crm = target.crm || {}
        const before = { databaseIds: [...(target.crm.databaseIds || [])], campaignIds: [...(target.crm.campaignIds || [])], zoneIds: [...(target.crm.zoneIds || [])] }
        const dbs = idList(body.databaseIds, (x) => dbById(x), 'bases'); if (dbs) target.crm.databaseIds = changes.databaseIds = dbs
        const camps = idList(body.campaignIds, (x) => campById(x), 'campagnes'); if (camps) target.crm.campaignIds = changes.campaignIds = camps
        const zones = idList(body.zoneIds, (x) => zoneById(x), 'zones'); if (zones) target.crm.zoneIds = changes.zoneIds = zones
        if ('permissions' in body) target.crm.permissions = changes.permissions = body.permissions === null ? null : (Array.isArray(body.permissions) ? body.permissions.filter((p) => AGENT_PERMISSIONS.includes(p)) : null)
        const newDbs = (target.crm.databaseIds || []).filter((x) => !before.databaseIds.includes(x)); if (newDbs.length) notify([target.id], 'database.assigned', 'Nouvelle base assignée', `${newDbs.map((x) => dbById(x)?.name).join(', ')} vous a été assignée.`)
        const newCamps = (target.crm.campaignIds || []).filter((x) => !before.campaignIds.includes(x)); if (newCamps.length) notify([target.id], 'campaign.assigned', 'Nouvelle campagne assignée', `${newCamps.map((x) => campById(x)?.name).join(', ')} vous a été assignée.`)
        target.updatedAt = nowIso()
        log(user, changes.status && changes.status !== 'active' ? 'user.deactivated' : 'user.updated', 'user', target.id, { fields: Object.keys(changes) })
        saveDb(db)
        return send(200, publicUser(target, true))
      }
      if (M === 'DELETE') {
        if (target.id === user.id) throw httpError(400, 'vous ne pouvez pas supprimer votre propre compte')
        const history = db.crmCalls.some((c) => c.agentId === target.id) || db.crmAppointments.some((a) => a.agentId === target.id)
        if (history) throw httpError(409, 'ce compte a un historique d’appels ou de rendez-vous : désactivez-le plutôt que de le supprimer')
        for (const c of db.crmContacts) if (c.agentId === target.id) c.agentId = null
        db.users.splice(db.users.indexOf(target), 1)
        for (const inv of db.invitations) if (inv.email === target.email && !inv.usedAt) inv.revokedAt = nowIso()
        log(user, 'user.deleted', 'user', target.id, { email: target.email })
        saveDb(db)
        return send(200, { ok: true })
      }
    }
    if ((m = path.match(/^\/users\/([^/]+)\/reset$/)) && M === 'POST') {
      need(user, 'users.manage')
      const target = userById(m[1])
      if (!target || !isCrmUser(target)) throw httpError(404, 'utilisateur introuvable')
      if (body.mode === 'password') {
        const pw = String(body.password || '')
        if (pw.length < 12 || pw.length > 1024) throw httpError(400, 'le mot de passe doit contenir au moins 12 caractères')
        target.passwordHash = await hashPassword(pw); target.passwordConfigured = true
        log(user, 'user.password_reset', 'user', target.id, { mode: 'password' })
        saveDb(db)
        return send(200, { ok: true })
      }
      const { invitation, token } = createInvitation({ email: target.email, name: target.name, role: target.role, permissions: target.permissions || [], createdBy: user.id, kind: 'crm', metadata: {} })
      const delivery = await sendInvitationEmail(invitation, token)
      log(user, 'user.password_reset', 'user', target.id, { mode: 'invite', sent: delivery.sent })
      saveDb(db)
      return send(200, { ok: true, delivery })
    }
    if ((m = path.match(/^\/users\/([^/]+)\/activity$/)) && M === 'GET') {
      if (m[1] !== user.id) need(user, 'users.manage')
      const list = db.crmActivity.filter((a) => a.userId === m[1]).slice().reverse()
      return send(200, paginate(list, q, {}))
    }

    /* ---------- Bases de données ---------- */
    if (path === '/databases' && M === 'GET') {
      const sc = scopeOf(user)
      const f = { q: lower(q.get('q')), status: q.get('status'), campaignId: q.get('campaignId'), zoneId: q.get('zoneId') }
      const list = db.crmDatabases.filter((d) => databaseVisible(user, d, sc) && (!f.q || `${d.name} ${d.source} ${d.description}`.toLowerCase().includes(f.q)) && (!f.status || d.status === f.status) && (!f.campaignId || d.campaignId === f.campaignId) && (!f.zoneId || d.zoneId === f.zoneId)).map((d) => databaseOut(d, user))
      return send(200, paginate(list, q, { name: (d) => lower(d.name), source: (d) => lower(d.source), total: (d) => d.totalContacts, called: (d) => d.contactsCalled, remaining: (d) => d.contactsRemaining, appointments: (d) => d.appointmentsBooked, status: (d) => d.status, createdAt: (d) => d.createdAt }))
    }
    if (path === '/databases' && M === 'POST') {
      need(user, 'databases.manage')
      const d = { id: id('db'), name: text(body.name, 120, 'nom', { required: true }), description: text(body.description, 1000, 'description'), source: text(body.source, 120, 'source'), status: oneOf(body.status, DATABASE_STATUSES, 'statut', 'draft'), campaignId: body.campaignId ? (campById(body.campaignId) ? body.campaignId : (() => { throw httpError(400, 'campagne introuvable') })()) : null, zoneId: body.zoneId ? (zoneById(body.zoneId) ? body.zoneId : (() => { throw httpError(400, 'zone introuvable') })()) : null, createdBy: user.id, createdAt: nowIso(), updatedAt: nowIso(), importedAt: null, history: [{ at: nowIso(), by: user.id, byName: user.name, action: 'Création' }] }
      if (db.crmDatabases.some((x) => lower(x.name) === lower(d.name) && x.status !== 'archived')) throw httpError(409, 'une base porte déjà ce nom')
      db.crmDatabases.push(d)
      const agentIds = idList(body.agentIds, (x) => isFieldRole(userById(x)), 'agents') || []
      setDatabaseAgents(user, d, agentIds)
      log(user, 'database.created', 'database', d.id, { name: d.name })
      saveDb(db)
      return send(201, databaseOut(d, user))
    }
    if ((m = path.match(/^\/databases\/([^/]+)$/))) {
      const d = dbById(m[1])
      if (!d || !databaseVisible(user, d)) throw httpError(404, 'base introuvable')
      if (M === 'GET') {
        const imports = db.crmImports.filter((i) => i.databaseId === d.id).slice().reverse()
        return send(200, { ...databaseOut(d, user), history: d.history || [], imports })
      }
      need(user, 'databases.manage')
      if (M === 'PATCH') {
        const changed = []
        if ('name' in body) { const n = text(body.name, 120, 'nom', { required: true }); if (db.crmDatabases.some((x) => x.id !== d.id && lower(x.name) === lower(n) && x.status !== 'archived')) throw httpError(409, 'une base porte déjà ce nom'); d.name = n; changed.push('nom') }
        if ('description' in body) { d.description = text(body.description, 1000, 'description'); changed.push('description') }
        if ('source' in body) { d.source = text(body.source, 120, 'source'); changed.push('source') }
        if ('status' in body) { d.status = oneOf(body.status, DATABASE_STATUSES, 'statut', d.status); changed.push(`statut → ${d.status}`) }
        if ('campaignId' in body) { if (body.campaignId && !campById(body.campaignId)) throw httpError(400, 'campagne introuvable'); d.campaignId = body.campaignId || null; changed.push('campagne') }
        if ('zoneId' in body) { if (body.zoneId && !zoneById(body.zoneId)) throw httpError(400, 'zone introuvable'); d.zoneId = body.zoneId || null; changed.push('zone') }
        if ('agentIds' in body) { setDatabaseAgents(user, d, idList(body.agentIds, (x) => isFieldRole(userById(x)), 'agents') || []); changed.push('agents') }
        d.updatedAt = nowIso(); d.history = [...(d.history || []), { at: nowIso(), by: user.id, byName: user.name, action: `Modification : ${changed.join(', ')}` }].slice(-200)
        log(user, 'database.updated', 'database', d.id, { changed })
        saveDb(db)
        return send(200, databaseOut(d, user))
      }
      if (M === 'DELETE') {
        if (q.get('hard') === '1') {
          const contactIds = new Set(db.crmContacts.filter((c) => c.databaseId === d.id).map((c) => c.id))
          if (db.crmCalls.some((c) => contactIds.has(c.contactId)) || db.crmAppointments.some((a) => contactIds.has(a.contactId))) throw httpError(409, 'cette base a des appels ou rendez-vous : archivez-la plutôt que de la supprimer')
          db.crmContacts = db.crmContacts.filter((c) => c.databaseId !== d.id)
          db.crmDatabases.splice(db.crmDatabases.indexOf(d), 1)
          for (const u of crmUsers()) if (u.crm?.databaseIds) u.crm.databaseIds = u.crm.databaseIds.filter((x) => x !== d.id)
          for (const z of db.crmZones) z.databaseIds = (z.databaseIds || []).filter((x) => x !== d.id)
          log(user, 'database.deleted', 'database', d.id, { name: d.name, contacts: contactIds.size })
          saveDb(db)
          return send(200, { ok: true, deleted: true })
        }
        d.status = 'archived'; d.updatedAt = nowIso(); d.history = [...(d.history || []), { at: nowIso(), by: user.id, byName: user.name, action: 'Archivage' }]
        log(user, 'database.updated', 'database', d.id, { archived: true })
        saveDb(db)
        return send(200, { ok: true, archived: true })
      }
    }

    /* ---------- Import ---------- */
    if (path === '/imports/check' && M === 'POST') {
      need(user, 'imports.run')
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : []
      const keyMode = ['phone', 'email', 'phone_or_email'].includes(body.duplicateKey) ? body.duplicateKey : settings().imports.duplicateKey
      const out = rows.map((r, i) => {
        const errors = []
        const c = {}
        try { applyContactFields(c, r || {}, { partial: false }) } catch (e) { errors.push(e.message) }
        const dup = errors.length ? null : findDuplicate(c, keyMode)
        return { index: Number(body.offset || 0) + i, errors, duplicateOf: dup ? { id: dup.id, name: dup.fullName, databaseName: dbById(dup.databaseId)?.name || '' } : null }
      })
      return send(200, { results: out })
    }
    if (path === '/imports' && M === 'GET') {
      need(user, 'imports.run')
      const list = db.crmImports.filter((i) => !q.get('databaseId') || i.databaseId === q.get('databaseId')).slice().reverse().map((i) => ({ ...i, databaseName: dbById(i.databaseId)?.name || '' }))
      return send(200, paginate(list, q, {}))
    }
    if (path === '/imports' && M === 'POST') {
      need(user, 'imports.run')
      const d = dbById(String(body.databaseId || ''))
      if (!d || d.status === 'archived') throw httpError(400, 'base introuvable ou archivée')
      const total = Number(body.total) || 0
      if (total < 1 || total > settings().imports.maxRows) throw httpError(400, `le fichier doit contenir entre 1 et ${settings().imports.maxRows} lignes`)
      const job = { id: id('imp'), databaseId: d.id, fileName: text(body.fileName, 200, 'nom du fichier') || 'import', status: 'running', total, received: 0, inserted: 0, updated: 0, skipped: 0, invalid: 0, duplicates: 0, errors: [], mapping: typeof body.mapping === 'object' && body.mapping ? body.mapping : {}, duplicateStrategy: ['skip', 'update', 'create'].includes(body.duplicateStrategy) ? body.duplicateStrategy : settings().imports.defaultStrategy, duplicateKey: ['phone', 'email', 'phone_or_email'].includes(body.duplicateKey) ? body.duplicateKey : settings().imports.duplicateKey, createdBy: user.id, createdAt: nowIso(), completedAt: null }
      db.crmImports.push(job)
      saveDb(db)
      return send(201, job)
    }
    if ((m = path.match(/^\/imports\/([^/]+)\/rows$/)) && M === 'POST') {
      need(user, 'imports.run')
      const job = db.crmImports.find((i) => i.id === m[1])
      if (!job || job.status !== 'running' || job.createdBy !== user.id) throw httpError(404, 'import introuvable ou terminé')
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : []
      if (job.received + rows.length > job.total) throw httpError(400, 'nombre de lignes supérieur au total annoncé')
      const offset = Number(body.offset) || job.received
      const d = dbById(job.databaseId)
      const stamp = nowIso()
      rows.forEach((r, i) => {
        const c = { id: id('ct'), databaseId: d.id, campaignId: null, agentId: null, callStatus: null, lastContactAt: null, archived: false, createdAt: stamp, updatedAt: stamp, createdBy: user.id, importId: job.id, noteLog: [] }
        try { applyContactFields(c, r || {}, { partial: false }) } catch (e) { job.invalid++; if (job.errors.length < 300) job.errors.push({ row: offset + i + 1, error: e.message }); return }
        const dup = findDuplicate(c, job.duplicateKey)
        if (dup) {
          job.duplicates++
          if (job.duplicateStrategy === 'skip') { job.skipped++; return }
          if (job.duplicateStrategy === 'update') {
            for (const k of ['firstName', 'lastName', 'fullName', 'phone2', 'email', 'address', 'city', 'region', 'postalCode', 'country', 'notes']) if (c[k]) dup[k] = c[k]
            if (c.lat !== null) { dup.lat = c.lat; dup.lng = c.lng }
            dup.tags = [...new Set([...(dup.tags || []), ...(c.tags || [])])]
            dup.updatedAt = stamp; job.updated++; return
          }
        }
        db.crmContacts.push(c); job.inserted++
      })
      job.received += rows.length
      saveDb(db)
      return send(200, { received: job.received, total: job.total, inserted: job.inserted, updated: job.updated, skipped: job.skipped, invalid: job.invalid, duplicates: job.duplicates })
    }
    if ((m = path.match(/^\/imports\/([^/]+)\/(complete|fail)$/)) && M === 'POST') {
      need(user, 'imports.run')
      const job = db.crmImports.find((i) => i.id === m[1])
      if (!job || job.createdBy !== user.id) throw httpError(404, 'import introuvable')
      const d = dbById(job.databaseId)
      job.completedAt = nowIso()
      if (m[2] === 'fail') {
        job.status = 'failed'; job.failure = text(body.error, 500, 'erreur') || 'interrompu'
        notify(adminIds(), 'import.failed', 'Import échoué', `L’import « ${job.fileName} » vers ${d?.name} a échoué : ${job.failure}.`, { importId: job.id })
        log(user, 'database.import_failed', 'database', job.databaseId, { importId: job.id })
      } else {
        job.status = job.received === job.total ? 'completed' : 'partial'
        if (d) { d.importedAt = job.completedAt; d.updatedAt = job.completedAt; if (d.status === 'draft' && job.inserted) d.status = 'active'; d.history = [...(d.history || []), { at: job.completedAt, by: user.id, byName: user.name, action: `Import « ${job.fileName} » : ${job.inserted} ajoutés, ${job.updated} mis à jour, ${job.skipped} ignorés, ${job.invalid} invalides` }].slice(-200) }
        notify(adminIds(), 'import.completed', 'Import terminé', `${job.inserted} contact(s) importés dans ${d?.name}.`, { importId: job.id })
        log(user, 'database.imported', 'database', job.databaseId, { importId: job.id, inserted: job.inserted, updated: job.updated, skipped: job.skipped, invalid: job.invalid })
      }
      saveDb(db)
      return send(200, job)
    }

    /* ---------- Contacts ---------- */
    if (path === '/contacts' && M === 'GET') {
      need(user, 'contacts.view')
      return send(200, withContactPage(user, q))
    }
    if (path === '/contacts/export' && M === 'GET') {
      need(user, 'contacts.export')
      const list = filterContacts(user, q).slice(0, 50000).map(contactOut)
      log(user, 'contact.exported', 'contact', null, { count: list.length })
      saveDb(db)
      return send(200, { rows: list.map((c) => ({ ...c, noteLog: undefined, custom: c.custom || {} })) })
    }
    if (path === '/contacts' && M === 'POST') {
      need(user, 'contacts.create')
      const d = dbById(String(body.databaseId || ''))
      if (!d || !databaseVisible(user, d)) throw httpError(400, 'base introuvable')
      const c = { id: id('ct'), databaseId: d.id, campaignId: null, agentId: isCrmAdmin(user) ? (body.agentId || null) : user.id, callStatus: null, lastContactAt: null, archived: false, createdAt: nowIso(), updatedAt: nowIso(), createdBy: user.id, noteLog: [] }
      if (c.agentId && !isCrmUser(userById(c.agentId))) throw httpError(400, 'agent introuvable')
      if (isCrmAdmin(user) && body.campaignId) { if (!campById(body.campaignId)) throw httpError(400, 'campagne introuvable'); c.campaignId = body.campaignId }
      applyContactFields(c, body, { partial: false })
      const dup = findDuplicate(c, settings().imports.duplicateKey)
      if (dup && !body.allowDuplicate) return send(409, { error: `doublon possible : ${dup.fullName}`, duplicateOf: { id: dup.id, name: dup.fullName } })
      db.crmContacts.push(c)
      if (c.agentId && c.agentId !== user.id) notify([c.agentId], 'contacts.assigned', 'Nouveau contact assigné', `${c.fullName} vous a été assigné.`, { contactId: c.id })
      log(user, 'contact.created', 'contact', c.id, { name: c.fullName })
      saveDb(db)
      return send(201, contactOut(c))
    }
    if (path === '/contacts/bulk' && M === 'POST') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 5000) : []
      const sc = scopeOf(user)
      const targets = ids.map(contactById).filter((c) => c && contactVisible(user, c, sc))
      if (!targets.length) throw httpError(400, 'aucun contact sélectionné')
      if (body.action === 'assign') { need(user, 'databases.manage'); const n = assignAgentToContacts(user, targets.map((c) => c.id), body.agentId || null); saveDb(db); return send(200, { updated: n }) }
      need(user, 'contacts.edit')
      if (body.action === 'status') { const s = oneOf(body.status, CONTACT_STATUSES, 'statut', null); if (!s) throw httpError(400, 'statut requis'); for (const c of targets) { c.status = s; c.updatedAt = nowIso() } log(user, 'contact.updated', 'contact', null, { bulk: targets.length, status: s }) }
      else if (body.action === 'tags') { const tags = tagList(body.tags) || []; for (const c of targets) { c.tags = [...new Set([...(c.tags || []), ...tags])].slice(0, 30); c.updatedAt = nowIso() } log(user, 'contact.updated', 'contact', null, { bulk: targets.length, tags }) }
      else if (body.action === 'archive') { need(user, 'databases.manage'); for (const c of targets) { c.archived = true; c.updatedAt = nowIso() } log(user, 'contact.archived', 'contact', null, { bulk: targets.length }) }
      else if (body.action === 'unarchive') { need(user, 'databases.manage'); for (const c of targets) { c.archived = false; c.updatedAt = nowIso() } log(user, 'contact.updated', 'contact', null, { bulk: targets.length, unarchived: true }) }
      else if (body.action === 'campaign') { need(user, 'databases.manage'); if (body.campaignId && !campById(body.campaignId)) throw httpError(400, 'campagne introuvable'); for (const c of targets) { c.campaignId = body.campaignId || null; c.updatedAt = nowIso() } log(user, 'contact.updated', 'contact', null, { bulk: targets.length, campaignId: body.campaignId || null }) }
      else throw httpError(400, 'action inconnue')
      saveDb(db)
      return send(200, { updated: targets.length })
    }
    if ((m = path.match(/^\/contacts\/([^/]+)$/))) {
      need(user, 'contacts.view')
      const c = contactById(m[1])
      if (!c || !contactVisible(user, c)) throw httpError(404, 'contact introuvable')
      if (M === 'GET') {
        const calls = db.crmCalls.filter((x) => x.contactId === c.id).sort((a, b) => b.at.localeCompare(a.at)).map(callOut)
        const appointments = db.crmAppointments.filter((x) => x.contactId === c.id).sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)).map(appointmentOut)
        const timeline = [
          ...calls.map((x) => ({ at: x.at, kind: 'call', title: `Appel · ${settings().labels.call[x.status] || x.status}`, detail: x.notes, by: x.agentName })),
          ...appointments.map((x) => ({ at: x.createdAt, kind: 'appointment', title: `Rendez-vous ${x.date} ${x.start}`, detail: settings().labels.appointment[x.status] || x.status, by: x.agentName })),
          ...(c.noteLog || []).map((n) => ({ at: n.at, kind: 'note', title: 'Note', detail: n.text, by: n.byName })),
          ...db.crmActivity.filter((a) => a.entityId === c.id && ['contact.updated', 'contact.created'].includes(a.action)).map((a) => ({ at: a.at, kind: 'activity', title: a.action === 'contact.created' ? 'Contact créé' : 'Fiche modifiée', detail: (a.details?.fields || []).join(', '), by: a.userName })),
        ].sort((a, b) => b.at.localeCompare(a.at))
        const zones = db.crmZones.filter((z) => inZone(z, c)).map((z) => ({ id: z.id, name: z.name, color: z.color }))
        return send(200, { contact: contactOut(c), calls, appointments, timeline, zones })
      }
      if (M === 'PATCH') {
        need(user, 'contacts.edit')
        const before = { ...c }
        const editable = { ...body }
        if (!isCrmAdmin(user)) { delete editable.databaseId; delete editable.agentId; delete editable.campaignId }
        if (isCrmAdmin(user)) {
          if ('databaseId' in editable) { if (!dbById(editable.databaseId)) throw httpError(400, 'base introuvable'); c.databaseId = editable.databaseId }
          if ('campaignId' in editable) { if (editable.campaignId && !campById(editable.campaignId)) throw httpError(400, 'campagne introuvable'); c.campaignId = editable.campaignId || null }
          if ('agentId' in editable && editable.agentId !== c.agentId) assignAgentToContacts(user, [c.id], editable.agentId || null)
        }
        applyContactFields(c, { ...c, ...editable }, { partial: true })
        if ('nextCallbackAt' in editable && editable.nextCallbackAt) c.callbackNotifiedFor = null
        c.updatedAt = nowIso()
        log(user, 'contact.updated', 'contact', c.id, { fields: Object.keys(editable).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(c[k])) })
        saveDb(db)
        return send(200, contactOut(c))
      }
      if (M === 'DELETE') {
        need(user, 'databases.manage')
        if (q.get('hard') === '1') {
          if (db.crmCalls.some((x) => x.contactId === c.id) || db.crmAppointments.some((x) => x.contactId === c.id)) throw httpError(409, 'ce contact a un historique : archivez-le plutôt que de le supprimer')
          db.crmContacts.splice(db.crmContacts.indexOf(c), 1)
          log(user, 'contact.deleted', 'contact', c.id, { name: c.fullName })
        } else { c.archived = true; c.updatedAt = nowIso(); log(user, 'contact.archived', 'contact', c.id, {}) }
        saveDb(db)
        return send(200, { ok: true })
      }
    }
    if ((m = path.match(/^\/contacts\/([^/]+)\/notes$/)) && M === 'POST') {
      need(user, 'contacts.edit')
      const c = contactById(m[1])
      if (!c || !contactVisible(user, c)) throw httpError(404, 'contact introuvable')
      const note = { id: id('note'), at: nowIso(), by: user.id, byName: user.name, text: text(body.text, 4000, 'note', { required: true }) }
      c.noteLog = [...(c.noteLog || []), note].slice(-200); c.updatedAt = nowIso()
      log(user, 'contact.updated', 'contact', c.id, { fields: ['note'] })
      saveDb(db)
      return send(201, note)
    }
    if ((m = path.match(/^\/contacts\/([^/]+)\/location$/)) && M === 'POST') {
      need(user, 'contacts.edit')
      const c = contactById(m[1])
      if (!c || !contactVisible(user, c)) throw httpError(404, 'contact introuvable')
      c.lat = optCoord(body.lat, -90, 90, 'latitude'); c.lng = optCoord(body.lng, -180, 180, 'longitude')
      if ((c.lat === null) !== (c.lng === null)) throw httpError(400, 'latitude et longitude vont ensemble')
      c.locationSource = c.lat === null ? null : 'manual'; c.updatedAt = nowIso()
      log(user, 'contact.updated', 'contact', c.id, { fields: ['location'] })
      saveDb(db)
      return send(200, contactOut(c))
    }

    /* ---------- Appels ---------- */
    if (path === '/calls' && M === 'GET') {
      need(user, 'contacts.view')
      const f = readFilters(q)
      const sc = scopeOf(user)
      const list = db.crmCalls.filter((c) => callVisible(user, c, sc) && inRange(dayOf(c.at), f.from, f.to) && (!f.agentId || c.agentId === f.agentId) && (!f.campaignId || c.campaignId === f.campaignId) && (!f.databaseId || c.databaseId === f.databaseId) && (!f.callStatus || c.status === f.callStatus) && (!q.get('contactId') || c.contactId === q.get('contactId'))).map(callOut).filter((c) => !f.q || `${c.contactName} ${c.phone} ${c.notes} ${c.agentName}`.toLowerCase().includes(f.q))
      return send(200, paginate(list, q, { at: (c) => c.at, contact: (c) => lower(c.contactName), agent: (c) => lower(c.agentName), status: (c) => c.status, duration: (c) => c.durationSec ?? -1 }))
    }
    if (path === '/calls' && M === 'POST') {
      need(user, 'calls.create')
      const call = recordCall(user, body)
      saveDb(db)
      return send(201, callOut(call))
    }
    if ((m = path.match(/^\/calls\/([^/]+)$/)) && M === 'PATCH') {
      need(user, 'calls.edit')
      const call = db.crmCalls.find((c) => c.id === m[1])
      if (!call || !callVisible(user, call)) throw httpError(404, 'appel introuvable')
      if (!isCrmAdmin(user) && call.agentId !== user.id) throw httpError(403, 'seul l’agent auteur peut modifier cet appel')
      if ('status' in body) call.status = oneOf(body.status, CALL_STATUSES, 'statut d’appel', call.status)
      if ('notes' in body) call.notes = text(body.notes, 4000, 'notes')
      if ('result' in body) call.result = text(body.result, 200, 'résultat')
      if ('durationSec' in body) { const n = body.durationSec === null || body.durationSec === '' ? null : Number(body.durationSec); if (n !== null && (!Number.isFinite(n) || n < 0 || n > 86400)) throw httpError(400, 'durée invalide'); call.durationSec = n === null ? null : Math.round(n) }
      if ('callbackAt' in body) { call.callbackAt = optDateTime(body.callbackAt, 'date de rappel'); const c = contactById(call.contactId); if (c && call.callbackAt) { c.nextCallbackAt = call.callbackAt; c.callbackNotifiedFor = null } }
      call.updatedAt = nowIso()
      const c = contactById(call.contactId)
      const latest = db.crmCalls.filter((x) => x.contactId === call.contactId).sort((a, b) => b.at.localeCompare(a.at))[0]
      if (c && latest?.id === call.id) { c.callStatus = call.status; c.status = CALL_TO_CONTACT_STATUS[call.status] || c.status; c.updatedAt = nowIso() }
      log(user, 'call.updated', 'call', call.id, {})
      saveDb(db)
      return send(200, callOut(call))
    }

    /* ---------- Rendez-vous ---------- */
    if (path === '/appointments' && M === 'GET') {
      need(user, 'appointments.view')
      const f = readFilters(q)
      const sc = scopeOf(user)
      const list = db.crmAppointments.filter((a) => appointmentVisible(user, a, sc) && inRange(a.date, f.from, f.to) && (!f.agentId || a.agentId === f.agentId) && (!f.campaignId || a.campaignId === f.campaignId) && (!f.databaseId || a.databaseId === f.databaseId) && (!f.appointmentStatus || a.status === f.appointmentStatus) && (!f.city || lower(a.city) === lower(f.city)) && (!q.get('contactId') || a.contactId === q.get('contactId'))).map(appointmentOut).filter((a) => !f.q || `${a.title} ${a.contactName} ${a.phone} ${a.address} ${a.city} ${a.agentName}`.toLowerCase().includes(f.q))
      if (q.get('all') === '1') return send(200, { rows: list.slice(0, 3000), total: list.length })
      return send(200, paginate(list, q, { date: (a) => `${a.date}${a.start}`, contact: (a) => lower(a.contactName), agent: (a) => lower(a.agentName), status: (a) => a.status, city: (a) => lower(a.city) }))
    }
    if (path === '/appointments' && M === 'POST') {
      need(user, 'appointments.create')
      if (!isCrmAdmin(user) && !settings().appointments.agentsCanCreate) throw httpError(403, 'la création de rendez-vous est réservée à l’administration')
      const c = contactById(String(body.contactId || ''))
      if (!c || !contactVisible(user, c)) throw httpError(400, 'contact introuvable')
      const agentId = isCrmAdmin(user) ? (body.agentId || c.agentId || null) : user.id
      if (agentId && !isCrmUser(userById(agentId))) throw httpError(400, 'agent introuvable')
      const s = settings()
      const a = {
        id: id('rdv'), title: text(body.title, 160, 'titre') || `Rendez-vous · ${c.fullName}`, contactId: c.id, phone: normalizePhone(body.phone || c.phone), agentId,
        date: optDate(body.date, 'date'), start: String(body.start || ''), end: String(body.end || (TIME_RE.test(String(body.start || '')) ? addMinutes(String(body.start), s.appointments.defaultDurationMin) : '')),
        address: text(body.address ?? c.address, 240, 'adresse'), city: text(body.city ?? c.city, 100, 'ville'), region: text(body.region ?? c.region, 100, 'région'),
        lat: optCoord(body.lat ?? c.lat, -90, 90, 'latitude'), lng: optCoord(body.lng ?? c.lng, -180, 180, 'longitude'),
        type: text(body.type, 80, 'type') || s.appointments.types[0] || '', status: oneOf(body.status, ['pending', 'confirmed'], 'statut', 'pending'), notes: text(body.notes, 4000, 'notes'),
        campaignId: campaignOfContact(c), databaseId: c.databaseId, createdBy: user.id, createdAt: nowIso(), updatedAt: nowIso(),
        history: [{ at: nowIso(), by: user.id, byName: user.name, action: 'Création' }],
      }
      validateAppointment(a)
      db.crmAppointments.push(a)
      c.appointmentStatus = a.status; c.status = 'appointment_booked'; c.updatedAt = nowIso()
      if (body.callId) { const call = db.crmCalls.find((x) => x.id === body.callId && x.contactId === c.id); if (call) call.appointmentId = a.id }
      notify([a.agentId, ...adminIds()].filter((x) => x !== user.id), 'appointment.created', 'Nouveau rendez-vous', `${a.title} · ${a.date} ${a.start}`, { appointmentId: a.id })
      log(user, 'appointment.created', 'appointment', a.id, { contactId: c.id, date: a.date })
      saveDb(db)
      return send(201, appointmentOut(a))
    }
    if ((m = path.match(/^\/appointments\/([^/]+)$/))) {
      need(user, 'appointments.view')
      const a = db.crmAppointments.find((x) => x.id === m[1])
      if (!a || !appointmentVisible(user, a)) throw httpError(404, 'rendez-vous introuvable')
      if (M === 'GET') return send(200, appointmentOut(a))
      if (M === 'PATCH') {
        need(user, 'appointments.edit')
        if (!isCrmAdmin(user) && a.agentId !== user.id) throw httpError(403, 'ce rendez-vous est suivi par un autre agent')
        const prev = { date: a.date, start: a.start, end: a.end, status: a.status, agentId: a.agentId }
        for (const k of ['title', 'address', 'city', 'region', 'type']) if (k in body) a[k] = text(body[k], k === 'address' ? 240 : 160, k)
        if ('notes' in body) a.notes = text(body.notes, 4000, 'notes')
        if ('phone' in body) a.phone = normalizePhone(body.phone)
        if ('lat' in body || 'lng' in body) { a.lat = optCoord(body.lat, -90, 90, 'latitude'); a.lng = optCoord(body.lng, -180, 180, 'longitude') }
        if ('date' in body) a.date = optDate(body.date, 'date')
        if ('start' in body) a.start = String(body.start || '')
        if ('end' in body) a.end = String(body.end || '')
        if ('agentId' in body && isCrmAdmin(user)) { if (body.agentId && !isCrmUser(userById(body.agentId))) throw httpError(400, 'agent introuvable'); a.agentId = body.agentId || null }
        validateAppointment(a)
        const moved = a.date !== prev.date || a.start !== prev.start
        if ('status' in body) a.status = oneOf(body.status, APPOINTMENT_STATUSES, 'statut', a.status)
        else if (moved && ['pending', 'confirmed'].includes(a.status)) a.status = 'rescheduled'
        const changes = []
        if (moved) changes.push(`Reporté du ${prev.date} ${prev.start} au ${a.date} ${a.start}`)
        if (a.status !== prev.status) changes.push(`Statut : ${settings().labels.appointment[prev.status]} → ${settings().labels.appointment[a.status]}`)
        if (a.agentId !== prev.agentId) changes.push(`Agent : ${userById(a.agentId)?.name || 'aucun'}`)
        a.updatedAt = nowIso()
        a.history = [...(a.history || []), { at: nowIso(), by: user.id, byName: user.name, action: changes.join(' · ') || 'Modification' }].slice(-100)
        const c = contactById(a.contactId)
        if (c) { c.appointmentStatus = a.status; if (a.status === 'completed') c.status = 'completed'; c.updatedAt = nowIso() }
        const recipients = [a.agentId, ...adminIds()].filter((x) => x && x !== user.id)
        if (a.status !== prev.status && a.status === 'confirmed') notify(recipients, 'appointment.confirmed', 'Rendez-vous confirmé', `${a.title} · ${a.date} ${a.start}`, { appointmentId: a.id })
        if (a.status !== prev.status && a.status === 'cancelled') notify(recipients, 'appointment.cancelled', 'Rendez-vous annulé', `${a.title} · ${a.date} ${a.start}`, { appointmentId: a.id })
        if (moved) notify(recipients, 'appointment.rescheduled', 'Rendez-vous reporté', `${a.title} · nouveau créneau ${a.date} ${a.start}`, { appointmentId: a.id })
        log(user, a.status === 'cancelled' && prev.status !== 'cancelled' ? 'appointment.cancelled' : 'appointment.updated', 'appointment', a.id, { changes })
        saveDb(db)
        return send(200, appointmentOut(a))
      }
    }

    /* ---------- Campagnes ---------- */
    if (path === '/campaigns' && M === 'GET') {
      need(user, 'campaigns.view')
      const sc = scopeOf(user)
      const st = stats(user, readFilters(new URLSearchParams()))
      const metrics = new Map(st.perCampaign.map((c) => [c.id, c]))
      const f = { q: lower(q.get('q')), status: q.get('status') }
      const list = db.crmCampaigns.filter((c) => campaignVisible(user, c, sc) && (!f.q || `${c.name} ${c.description} ${c.type}`.toLowerCase().includes(f.q)) && (!f.status || c.status === f.status)).map((c) => campaignOut(c, metrics.get(c.id)))
      return send(200, paginate(list, q, { name: (c) => lower(c.name), status: (c) => c.status, startDate: (c) => c.startDate || '', appointments: (c) => c.metrics.appointments, progress: (c) => c.metrics.progress ?? -1 }))
    }
    if (path === '/campaigns' && M === 'POST') {
      need(user, 'campaigns.manage')
      const c = { id: id('cmp'), createdBy: user.id, createdAt: nowIso() }
      applyCampaign(c, body, false)
      db.crmCampaigns.push(c)
      if (Array.isArray(body.agentIds)) setCampaignAgents(user, c, idList(body.agentIds, (x) => isFieldRole(userById(x)), 'agents'))
      if (Array.isArray(body.databaseIds)) for (const dId of idList(body.databaseIds, (x) => dbById(x), 'bases')) dbById(dId).campaignId = c.id
      log(user, 'campaign.created', 'campaign', c.id, { name: c.name })
      saveDb(db)
      return send(201, campaignOut(c))
    }
    if ((m = path.match(/^\/campaigns\/([^/]+)$/))) {
      need(user, 'campaigns.view')
      const c = campById(m[1])
      if (!c || !campaignVisible(user, c)) throw httpError(404, 'campagne introuvable')
      if (M === 'GET') {
        const st = stats(user, { ...readFilters(q), campaignId: c.id })
        const campContacts = db.crmContacts.filter((x) => !x.archived && campaignOfContact(x) === c.id && contactVisible(user, x))
        const extra = { contactsAssigned: campContacts.filter((x) => x.agentId).length, interested: campContacts.filter((x) => ['interested', 'appointment_booked'].includes(x.status)).length, completedAppointments: st.appointmentStatus.find((s) => s.key === 'completed')?.value || 0 }
        return send(200, { ...campaignOut(c, st.perCampaign.find((x) => x.id === c.id)), extra, stats: { kpis: st.kpis, series: st.series, perAgent: st.perAgent, callStatus: st.callStatus, appointmentStatus: st.appointmentStatus } })
      }
      need(user, 'campaigns.manage')
      if (M === 'PATCH') {
        const prevStatus = c.status
        applyCampaign(c, body, true)
        if (Array.isArray(body.agentIds)) setCampaignAgents(user, c, idList(body.agentIds, (x) => isFieldRole(userById(x)), 'agents'))
        if (Array.isArray(body.databaseIds)) { const ids = idList(body.databaseIds, (x) => dbById(x), 'bases'); for (const d of db.crmDatabases) { if (ids.includes(d.id)) d.campaignId = c.id; else if (d.campaignId === c.id) d.campaignId = null } }
        c.updatedAt = nowIso()
        const team = crmUsers().filter((u) => (u.crm?.campaignIds || []).includes(c.id)).map((u) => u.id)
        if (prevStatus !== c.status && c.status === 'active') notify([...team, ...adminIds()], 'campaign.started', 'Campagne démarrée', `La campagne « ${c.name} » est active.`, { campaignId: c.id })
        if (prevStatus !== c.status && c.status === 'completed') notify([...team, ...adminIds()], 'campaign.completed', 'Campagne terminée', `La campagne « ${c.name} » est terminée.`, { campaignId: c.id })
        log(user, 'campaign.updated', 'campaign', c.id, { status: c.status })
        saveDb(db)
        return send(200, campaignOut(c))
      }
      if (M === 'DELETE') {
        const used = db.crmCalls.some((x) => x.campaignId === c.id) || db.crmAppointments.some((x) => x.campaignId === c.id)
        if (q.get('hard') === '1' && !used) {
          db.crmCampaigns.splice(db.crmCampaigns.indexOf(c), 1)
          for (const d of db.crmDatabases) if (d.campaignId === c.id) d.campaignId = null
          for (const ct of db.crmContacts) if (ct.campaignId === c.id) ct.campaignId = null
          for (const u of crmUsers()) if (u.crm?.campaignIds) u.crm.campaignIds = u.crm.campaignIds.filter((x) => x !== c.id)
          for (const z of db.crmZones) z.campaignIds = (z.campaignIds || []).filter((x) => x !== c.id)
          log(user, 'campaign.deleted', 'campaign', c.id, { name: c.name })
          saveDb(db)
          return send(200, { ok: true, deleted: true })
        }
        if (q.get('hard') === '1') throw httpError(409, 'cette campagne a des appels ou rendez-vous : archivez-la plutôt que de la supprimer')
        c.status = 'archived'; c.updatedAt = nowIso()
        log(user, 'campaign.updated', 'campaign', c.id, { archived: true })
        saveDb(db)
        return send(200, { ok: true, archived: true })
      }
    }

    /* ---------- Zones géographiques ---------- */
    if (path === '/zones' && M === 'GET') {
      need(user, 'map.view')
      const sc = scopeOf(user)
      const visibleContacts = db.crmContacts.filter((c) => contactVisible(user, c, sc) && !c.archived)
      const visibleAppts = db.crmAppointments.filter((a) => appointmentVisible(user, a, sc))
      return send(200, { rows: db.crmZones.filter((z) => zoneVisible(user, z, sc)).map((z) => ({ ...z, agentIds: crmUsers().filter((u) => (u.crm?.zoneIds || []).includes(z.id)).map((u) => u.id), contacts: visibleContacts.filter((c) => inZone(z, c)).length, appointments: visibleAppts.filter((a) => inZone(z, a)).length })) })
    }
    if (path === '/zones' && M === 'POST') {
      need(user, 'zones.manage')
      const z = { id: id('zone'), createdBy: user.id, createdAt: nowIso() }
      applyZone(z, body, false)
      db.crmZones.push(z)
      if (Array.isArray(body.agentIds)) setZoneAgents(user, z, idList(body.agentIds, (x) => isFieldRole(userById(x)), 'agents'))
      log(user, 'zone.created', 'zone', z.id, { name: z.name })
      saveDb(db)
      return send(201, z)
    }
    if ((m = path.match(/^\/zones\/([^/]+)$/))) {
      need(user, 'zones.manage')
      const z = zoneById(m[1])
      if (!z) throw httpError(404, 'zone introuvable')
      if (M === 'PATCH') {
        applyZone(z, body, true)
        if (Array.isArray(body.agentIds)) setZoneAgents(user, z, idList(body.agentIds, (x) => isFieldRole(userById(x)), 'agents'))
        z.updatedAt = nowIso()
        log(user, 'zone.updated', 'zone', z.id, {})
        saveDb(db)
        return send(200, z)
      }
      if (M === 'DELETE') {
        db.crmZones.splice(db.crmZones.indexOf(z), 1)
        for (const u of crmUsers()) if (u.crm?.zoneIds) u.crm.zoneIds = u.crm.zoneIds.filter((x) => x !== z.id)
        for (const d of db.crmDatabases) if (d.zoneId === z.id) d.zoneId = null
        log(user, 'zone.deleted', 'zone', z.id, { name: z.name })
        saveDb(db)
        return send(200, { ok: true })
      }
    }

    /* ---------- Carte ---------- */
    if (path === '/map' && M === 'GET') {
      need(user, 'map.view')
      const f = readFilters(q)
      const { contacts, appts } = filteredData(user, f)
      const lastCall = new Map()
      for (const c of db.crmCalls) { const p = lastCall.get(c.contactId); if (!p || c.at > p.at) lastCall.set(c.contactId, c) }
      const nextAppt = new Map()
      for (const a of db.crmAppointments) if (!['cancelled', 'completed', 'no_show'].includes(a.status)) { const p = nextAppt.get(a.contactId); if (!p || `${a.date}${a.start}` < `${p.date}${p.start}`) nextAppt.set(a.contactId, a) }
      const located = (r) => r.lat !== null && r.lat !== undefined && r.lng !== null && r.lng !== undefined
      const showContacts = q.get('layer') !== 'appointments'
      const showAppts = q.get('layer') !== 'contacts'
      const cList = showContacts ? contacts.filter((c) => (!f.callStatus || c.callStatus === f.callStatus) && (!f.from && !f.to ? true : inRange(dayOf(c.lastContactAt || c.createdAt), f.from, f.to))) : []
      const aList = showAppts ? appts.filter((a) => inRange(a.date, f.from, f.to)) : []
      return send(200, {
        contacts: cList.filter(located).slice(0, 8000).map((c) => { const lc = lastCall.get(c.id), na = nextAppt.get(c.id); return { id: c.id, name: c.fullName, phone: c.phone, address: [c.address, c.city].filter(Boolean).join(', '), lat: c.lat, lng: c.lng, status: c.status, callStatus: c.callStatus, agentName: c.agentId ? userById(c.agentId)?.name || '' : '', lastCallAt: lc?.at || null, lastCallStatus: lc?.status || null, nextCallbackAt: c.nextCallbackAt || null, appointment: na ? { id: na.id, date: na.date, start: na.start, status: na.status } : null } }),
        appointments: aList.filter(located).slice(0, 5000).map((a) => { const o = appointmentOut(a); return { id: a.id, title: a.title, contactId: a.contactId, contactName: o.contactName, phone: a.phone, date: a.date, start: a.start, end: a.end, agentName: o.agentName, status: a.status, address: [a.address, a.city].filter(Boolean).join(', '), lat: a.lat, lng: a.lng } }),
        missing: { contacts: cList.filter((c) => !located(c)).length, appointments: aList.filter((a) => !located(a)).length },
        zones: db.crmZones.filter((z) => zoneVisible(user, z)),
      })
    }
    if (path === '/geocode' && M === 'POST') {
      need(user, 'geocode.run')
      if (settings().integrations.geocoding !== 'nominatim') throw httpError(400, 'le géocodage est désactivé : activez-le dans Réglages → Intégrations')
      const contactIds = Array.isArray(body.contactIds) ? body.contactIds.slice(0, 25) : []
      const results = []
      for (const cid of contactIds) {
        const c = contactById(String(cid))
        if (!c) continue
        try {
          const r = await geocodeOne(c)
          if (r.ok) { c.lat = r.lat; c.lng = r.lng; c.locationSource = 'geocoded'; c.geocodeError = null; c.updatedAt = nowIso() } else c.geocodeError = r.reason
          results.push({ id: c.id, ...r })
        } catch (e) { c.geocodeError = 'service indisponible'; results.push({ id: c.id, ok: false, reason: 'service indisponible' }) }
        await new Promise((r) => setTimeout(r, 1100))
      }
      log(user, 'contact.geocoded', 'contact', null, { count: results.length, ok: results.filter((r) => r.ok).length })
      saveDb(db)
      return send(200, { results })
    }

    /* ---------- Agents ---------- */
    if (path === '/agents' && M === 'GET') {
      need(user, 'agents.view')
      const f = readFilters(q)
      const list = agents().filter((a) => (!f.q || `${a.name} ${a.email}`.toLowerCase().includes(f.q)) && (!q.get('status') || userStatus(a) === q.get('status')) && (!f.campaignId || (a.crm?.campaignIds || []).includes(f.campaignId)) && (!f.zoneId || (a.crm?.zoneIds || []).includes(f.zoneId))).map((a) => ({ ...publicUser(a), ...agentMetrics(a, f) }))
      return send(200, paginate(list, q, { name: (a) => lower(a.name), calls: (a) => a.callsMade, reached: (a) => a.contactsReached, appointments: (a) => a.appointmentsBooked, conversion: (a) => a.conversionRate, lastActivity: (a) => a.lastActivityAt || '' }))
    }
    if ((m = path.match(/^\/agents\/([^/]+)$/)) && M === 'GET') {
      if (m[1] !== user.id) need(user, 'agents.view')
      const a = userById(m[1])
      if (!a || !isCrmUser(a)) throw httpError(404, 'agent introuvable')
      const f = readFilters(q)
      const st = stats(isCrmAdmin(user) ? user : a, { ...f, agentId: a.id })
      return send(200, { agent: publicUser(a), metrics: agentMetrics(a, f), series: st.series, callStatus: st.callStatus, appointmentStatus: st.appointmentStatus, activity: db.crmActivity.filter((x) => x.userId === a.id).slice(-30).reverse(), upcoming: st.upcomingAppointments })
    }

    /* ---------- Notifications ---------- */
    if (path === '/notifications' && M === 'GET') {
      const list = db.notifications.filter((n) => n.userId === user.id && String(n.type).startsWith('crm.') && (q.get('unread') !== '1' || !n.readAt)).slice().reverse()
      return send(200, { ...paginate(list, q, {}), unread: list.filter((n) => !n.readAt).length })
    }
    if ((m = path.match(/^\/notifications\/([^/]+)\/read$/)) && M === 'POST') {
      const n = db.notifications.find((x) => x.id === m[1] && x.userId === user.id)
      if (!n) throw httpError(404, 'notification introuvable')
      n.readAt = n.readAt || nowIso(); saveDb(db)
      return send(200, { ok: true })
    }
    if (path === '/notifications/read-all' && M === 'POST') {
      const t = nowIso()
      for (const n of db.notifications) if (n.userId === user.id && !n.readAt && String(n.type).startsWith('crm.')) n.readAt = t
      saveDb(db)
      return send(200, { ok: true })
    }
    if (path === '/notifications/preferences') {
      if (M === 'GET') return send(200, { types: NOTIFICATION_TYPES, preferences: Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, user.crm?.notificationPrefs?.[t] !== false])), globallyDisabled: NOTIFICATION_TYPES.filter((t) => settings().notifications[t] === false) })
      if (M === 'PUT') {
        user.crm = user.crm || {}
        user.crm.notificationPrefs = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, body?.[t] !== false]))
        saveDb(db)
        return send(200, { ok: true })
      }
    }

    /* ---------- Réglages ---------- */
    if (path === '/settings' && M === 'GET') { need(user, 'settings.manage'); return send(200, { settings: settings(), agentPermissions: AGENT_PERMISSIONS, roles: Object.entries(CRM_ROLES).map(([key, r]) => ({ key, ...r })), notificationTypes: NOTIFICATION_TYPES, statuses: { contact: CONTACT_STATUSES, call: CALL_STATUSES, appointment: APPOINTMENT_STATUSES } }) }
    if (path === '/settings' && M === 'PATCH') {
      need(user, 'settings.manage')
      const s = settings()
      const section = String(body.section || '')
      const v = body.values || {}
      if (section === 'general') s.general = { crmName: text(v.crmName, 80, 'nom du CRM', { required: true }), defaultCountry: text(v.defaultCountry, 80, 'pays'), timezone: text(v.timezone, 60, 'fuseau horaire'), currency: text(v.currency, 8, 'devise') }
      else if (section === 'appointments') {
        const types = (Array.isArray(v.types) ? v.types : []).map((t) => text(t, 60, 'type')).filter(Boolean).slice(0, 30)
        const dur = Number(v.defaultDurationMin)
        if (!Number.isInteger(dur) || dur < 5 || dur > 480) throw httpError(400, 'durée par défaut invalide (5 à 480 minutes)')
        if (!TIME_RE.test(v.workdayStart) || !TIME_RE.test(v.workdayEnd) || v.workdayEnd <= v.workdayStart) throw httpError(400, 'horaires de travail invalides')
        s.appointments = { defaultDurationMin: dur, types: types.length ? types : s.appointments.types, agentsCanCreate: v.agentsCanCreate !== false, workdayStart: v.workdayStart, workdayEnd: v.workdayEnd }
      } else if (section === 'calls') {
        const rem = Number(v.callbackReminderMinutes), days = Number(v.inactivityAlertDays)
        if (!Number.isInteger(rem) || rem < 0 || rem > 1440) throw httpError(400, 'délai de rappel invalide')
        if (!Number.isInteger(days) || days < 1 || days > 60) throw httpError(400, 'seuil d’inactivité invalide')
        s.calls = { callbackReminderMinutes: rem, requireNotesOnFailure: Boolean(v.requireNotesOnFailure), inactivityAlertDays: days }
      } else if (section === 'campaigns') {
        const types = (Array.isArray(v.types) ? v.types : []).map((t) => text(t, 60, 'type')).filter(Boolean).slice(0, 30)
        const goal = Number(v.defaultGoalAppointments)
        if (!Number.isInteger(goal) || goal < 0 || goal > 100000) throw httpError(400, 'objectif invalide')
        s.campaigns = { types: types.length ? types : s.campaigns.types, defaultGoalAppointments: goal }
      } else if (section === 'imports') {
        const max = Number(v.maxRows)
        if (!Number.isInteger(max) || max < 100 || max > 100000) throw httpError(400, 'limite de lignes invalide (100 à 100 000)')
        s.imports = { duplicateKey: oneOf(v.duplicateKey, ['phone', 'email', 'phone_or_email'], 'clé de doublon', 'phone_or_email'), defaultStrategy: oneOf(v.defaultStrategy, ['skip', 'update', 'create'], 'stratégie', 'skip'), maxRows: max }
      } else if (section === 'labels') {
        for (const kind of ['contact', 'call', 'appointment']) {
          const keys = kind === 'contact' ? CONTACT_STATUSES : kind === 'call' ? CALL_STATUSES : APPOINTMENT_STATUSES
          for (const k of keys) if (v[kind]?.[k] !== undefined) s.labels[kind][k] = text(v[kind][k], 40, 'libellé', { required: true })
        }
      } else if (section === 'permissions') {
        for (const role of Object.keys(CRM_ROLES).filter((r) => !CRM_ROLES[r].admin)) if (Array.isArray(v[role])) s.rolePermissions[role] = v[role].filter((p) => AGENT_PERMISSIONS.includes(p))
      } else if (section === 'notifications') {
        s.notifications = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, v[t] !== false]))
      } else if (section === 'integrations') {
        s.integrations = { geocoding: oneOf(v.geocoding, ['disabled', 'nominatim'], 'géocodage', 'disabled'), telephony: 'none' }
      } else throw httpError(400, 'section inconnue')
      s.updatedAt = nowIso(); s.updatedBy = user.id
      log(user, 'settings.changed', 'settings', section, {})
      saveDb(db)
      return send(200, { settings: s })
    }

    /* ---------- Journal d'activité ---------- */
    if (path === '/activity' && M === 'GET') {
      need(user, 'audit.view')
      const f = readFilters(q)
      const list = db.crmActivity.filter((a) => (!q.get('userId') || a.userId === q.get('userId')) && (!q.get('action') || a.action.startsWith(q.get('action'))) && (!q.get('entityType') || a.entityType === q.get('entityType')) && inRange(dayOf(a.at), f.from, f.to) && (!f.q || `${a.userName} ${a.action} ${a.entityType} ${a.entityId} ${JSON.stringify(a.details)}`.toLowerCase().includes(f.q))).slice().reverse()
      return send(200, paginate(list, q, {}))
    }

    return send(404, { error: 'route CRM inconnue' })
  }

  /* ---------- Aides dépendantes du routeur ---------- */
  const contactSorters = { name: (c) => lower(c.fullName), city: (c) => lower(c.city), status: (c) => c.status, lastContact: (c) => c.lastContactAt || '', nextCallback: (c) => c.nextCallbackAt || '', createdAt: (c) => c.createdAt, updatedAt: (c) => c.updatedAt }
  function filterContacts(u, q) {
    const f = readFilters(q)
    const sc = scopeOf(u)
    const zone = f.zoneId ? zoneById(f.zoneId) : null
    const archived = q.get('archived') === '1'
    const tag = q.get('tag')
    const callbackDue = q.get('callbackDue') === '1'
    const hasLocation = q.get('hasLocation')
    const unassigned = q.get('unassigned') === '1'
    return db.crmContacts.filter((c) => contactVisible(u, c, sc) && Boolean(c.archived) === archived
      && (!f.q || `${c.fullName} ${c.phone} ${c.phone2} ${c.email} ${c.city} ${c.address} ${(c.tags || []).join(' ')}`.toLowerCase().includes(f.q))
      && (!f.databaseId || c.databaseId === f.databaseId)
      && (!f.campaignId || campaignOfContact(c) === f.campaignId)
      && (!f.agentId || c.agentId === f.agentId) && (!unassigned || !c.agentId)
      && (!f.contactStatus || c.status === f.contactStatus)
      && (!f.callStatus || c.callStatus === f.callStatus)
      && (!f.appointmentStatus || c.appointmentStatus === f.appointmentStatus)
      && (!f.city || lower(c.city) === lower(f.city)) && (!f.region || lower(c.region) === lower(f.region))
      && (!zone || inZone(zone, c)) && (!tag || (c.tags || []).includes(tag))
      && (!callbackDue || (c.nextCallbackAt && dayOf(c.nextCallbackAt) <= f.today))
      && (hasLocation === null || hasLocation === '' || (hasLocation === '1') === (c.lat !== null && c.lat !== undefined))
      && inRange(dayOf(c.createdAt), f.from, f.to))
  }
  function withContactPage(u, q) {
    const p = paginate(filterContacts(u, q), q, contactSorters)
    return { ...p, rows: p.rows.map((c) => ({ ...contactOut(c), noteLog: undefined })) }
  }
  function databaseOut(d, u) {
    const contacts = db.crmContacts.filter((c) => c.databaseId === d.id && !c.archived && contactVisible(u, c))
    const ids = new Set(contacts.map((c) => c.id))
    const calls = db.crmCalls.filter((c) => ids.has(c.contactId))
    const appts = db.crmAppointments.filter((a) => ids.has(a.contactId))
    const s = contactStats(contacts, calls, appts)
    const assigned = agents().filter((a) => (a.crm?.databaseIds || []).includes(d.id))
    return { ...d, history: undefined, totalContacts: s.total, contactsCalled: s.called, contactsRemaining: s.total - s.called, contactsReached: s.reached, appointmentsBooked: appts.filter((a) => a.status !== 'cancelled').length, agentIds: assigned.map((a) => a.id), agentNames: assigned.map((a) => a.name), campaignName: d.campaignId ? campById(d.campaignId)?.name || '' : '', zoneName: d.zoneId ? zoneById(d.zoneId)?.name || '' : '', createdByName: userById(d.createdBy)?.name || '' }
  }
  function setDatabaseAgents(u, d, agentIds) {
    for (const a of agents()) {
      a.crm = a.crm || {}
      const has = (a.crm.databaseIds || []).includes(d.id), want = agentIds.includes(a.id)
      if (want && !has) { a.crm.databaseIds = [...(a.crm.databaseIds || []), d.id]; notify([a.id], 'database.assigned', 'Nouvelle base assignée', `La base « ${d.name} » vous a été assignée.`, { databaseId: d.id }) }
      if (!want && has) a.crm.databaseIds = a.crm.databaseIds.filter((x) => x !== d.id)
    }
    log(u, 'database.assigned', 'database', d.id, { agentIds })
  }
  function setCampaignAgents(u, c, agentIds) {
    for (const a of agents()) {
      a.crm = a.crm || {}
      const has = (a.crm.campaignIds || []).includes(c.id), want = agentIds.includes(a.id)
      if (want && !has) { a.crm.campaignIds = [...(a.crm.campaignIds || []), c.id]; notify([a.id], 'campaign.assigned', 'Nouvelle campagne', `La campagne « ${c.name} » vous a été assignée.`, { campaignId: c.id }) }
      if (!want && has) a.crm.campaignIds = a.crm.campaignIds.filter((x) => x !== c.id)
    }
    log(u, 'campaign.assigned', 'campaign', c.id, { agentIds })
  }
  function setZoneAgents(u, z, agentIds) {
    for (const a of agents()) {
      a.crm = a.crm || {}
      const has = (a.crm.zoneIds || []).includes(z.id), want = agentIds.includes(a.id)
      if (want && !has) a.crm.zoneIds = [...(a.crm.zoneIds || []), z.id]
      if (!want && has) a.crm.zoneIds = a.crm.zoneIds.filter((x) => x !== z.id)
    }
    log(u, 'zone.assigned', 'zone', z.id, { agentIds })
  }
  function applyCampaign(c, body, partial) {
    if (!partial || 'name' in body) c.name = text(body.name, 120, 'nom', { required: true })
    if (!partial || 'description' in body) c.description = text(body.description, 2000, 'description')
    if (!partial || 'type' in body) c.type = text(body.type, 60, 'type')
    if (!partial || 'startDate' in body) c.startDate = optDate(body.startDate, 'date de début')
    if (!partial || 'endDate' in body) c.endDate = optDate(body.endDate, 'date de fin')
    if (c.startDate && c.endDate && c.endDate < c.startDate) throw httpError(400, 'la date de fin doit suivre la date de début')
    if (!partial || 'status' in body) c.status = oneOf(body.status, CAMPAIGN_STATUSES, 'statut', c.status || 'draft')
    if (!partial || 'zoneIds' in body) c.zoneIds = idList(body.zoneIds ?? [], (x) => zoneById(x), 'zones')
    if (!partial || 'goals' in body) {
      const g = body.goals || {}
      const num = (v, field) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 1000000) throw httpError(400, `${field} invalide`); return n }
      c.goals = { appointments: num(g.appointments, 'objectif de rendez-vous'), calls: num(g.calls, 'objectif d’appels'), contacts: num(g.contacts, 'objectif de contacts') }
    }
    if (db.crmCampaigns.some((x) => x.id !== c.id && lower(x.name) === lower(c.name) && x.status !== 'archived')) throw httpError(409, 'une campagne porte déjà ce nom')
    c.updatedAt = nowIso()
  }
  function campaignOut(c, metrics) {
    const team = agents().filter((a) => (a.crm?.campaignIds || []).includes(c.id))
    const dbs = db.crmDatabases.filter((d) => d.campaignId === c.id)
    return { ...c, agentIds: team.map((a) => a.id), agentNames: team.map((a) => a.name), databaseIds: dbs.map((d) => d.id), databaseNames: dbs.map((d) => d.name), zoneNames: (c.zoneIds || []).map((z) => zoneById(z)?.name).filter(Boolean), createdByName: userById(c.createdBy)?.name || '', metrics: metrics || { contacts: 0, calls: 0, reached: 0, appointments: 0, conversionRate: 0, goal: Number(c.goals?.appointments) || 0, progress: null } }
  }
  function applyZone(z, body, partial) {
    if (!partial || 'name' in body) z.name = text(body.name, 100, 'nom', { required: true })
    if (!partial || 'description' in body) z.description = text(body.description, 500, 'description')
    if (!partial || 'color' in body) { const col = String(body.color || '#6366f1'); if (!/^#[0-9a-fA-F]{6}$/.test(col)) throw httpError(400, 'couleur invalide'); z.color = col }
    if (!partial || 'cities' in body) z.cities = tagList(body.cities) || []
    if (!partial || 'regions' in body) z.regions = tagList(body.regions) || []
    if (!partial || 'databaseIds' in body) z.databaseIds = idList(body.databaseIds ?? [], (x) => dbById(x), 'bases')
    if (!partial || 'campaignIds' in body) z.campaignIds = idList(body.campaignIds ?? [], (x) => campById(x), 'campagnes')
    if (!partial || 'shape' in body) {
      const s = body.shape
      if (!s) z.shape = null
      else if (s.type === 'circle') { const radius = Number(s.radiusKm); if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) throw httpError(400, 'rayon invalide (0 à 1000 km)'); z.shape = { type: 'circle', lat: optCoord(s.lat, -90, 90, 'latitude'), lng: optCoord(s.lng, -180, 180, 'longitude'), radiusKm: radius }; if (z.shape.lat === null || z.shape.lng === null) throw httpError(400, 'centre de zone requis') }
      else if (s.type === 'polygon' && Array.isArray(s.points) && s.points.length >= 3 && s.points.length <= 200) z.shape = { type: 'polygon', points: s.points.map((p) => [optCoord(p[0], -90, 90, 'latitude'), optCoord(p[1], -180, 180, 'longitude')]) }
      else throw httpError(400, 'forme de zone invalide')
    }
    if (!z.shape && !(z.cities || []).length && !(z.regions || []).length) throw httpError(400, 'définissez une zone sur la carte, ou au moins une ville ou une région')
  }

  return { handle, isCrmUser, permissionsOf, runCallbackReminders }
}

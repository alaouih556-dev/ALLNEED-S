import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import net from 'node:net'
import tls from 'node:tls'
import { SALES_PRESENTATION } from './sales-presentation.mjs'
import { createCrm, CRM_COLLECTIONS } from './crm.mjs'

const scrypt = promisify(scryptCallback)
const ROOT = process.env.ALLNEEDS_DATA_DIR || join(process.cwd(), 'backend', 'data')
const DB_PATH = join(ROOT, 'db.json')
const AUDIT_PATH = join(ROOT, 'audit.jsonl')
const COOKIE_NAME = 'allneeds_session'
// Durée d'inactivité avant expiration : la session est renouvelée à chaque chargement de page (/api/me).
const SESSION_TTL_SECONDS = Math.round((Number(process.env.ALLNEEDS_SESSION_TTL_HOURS) || 8) * 60 * 60)
const INVITATION_TTL_SECONDS = 48 * 60 * 60
const MAX_BODY_BYTES = 1024 * 1024
const FRONTEND_ORIGIN = (process.env.ALLNEEDS_FRONTEND_ORIGIN || 'http://127.0.0.1:5176').trim().replace(/\/$/, '')
// Origines autorisées : ALLNEEDS_FRONTEND_ORIGIN + liste CORS_ORIGINS (séparées par des virgules)
const ALLOWED_ORIGINS = new Set([FRONTEND_ORIGIN, ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)])
const isAllowedOrigin = (origin) => ALLOWED_ORIGINS.has(origin)
const isProduction = process.env.NODE_ENV === 'production'
const sessionSecret = process.env.ALLNEEDS_SESSION_SECRET || (!isProduction ? randomBytes(32).toString('base64url') : '')

if (sessionSecret.length < 32) throw new Error('ALLNEEDS_SESSION_SECRET doit contenir au moins 32 caractères en production.')
if (!process.env.ALLNEEDS_SESSION_SECRET) console.warn('Session secret temporaire : les sessions expireront au redémarrage du serveur.')
mkdirSync(ROOT, { recursive: true })

const emptyDb = () => ({
  users: [], orgs: [], diagnostics: [], needs: [], consents: [], registrations: [], invitations: [],
  missions: [], offers: [], documents: [], messages: [], meetings: [], quotes: [], notifications: [],
  needsSubscriptions: [], saasSubscriptions: [], conversations: [],
  crmDatabases: [], crmContacts: [], crmCalls: [], crmAppointments: [], crmCampaigns: [], crmZones: [], crmActivity: [], crmImports: [], crmSettings: [],
})

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const remoteStoreEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
let remoteSaveQueue = Promise.resolve()

function normalizeDb(input) {
  const data = input && typeof input === 'object' ? input : emptyDb()
  for (const key of ['users','orgs','diagnostics','needs','consents','registrations','invitations','missions','offers','documents','messages','meetings','quotes','notifications','needsSubscriptions','saasSubscriptions','conversations', ...Object.keys(CRM_COLLECTIONS)]) if (!Array.isArray(data[key])) data[key] = []
  return data
}

function localLoadDb() {
  try { return existsSync(DB_PATH) ? normalizeDb(JSON.parse(readFileSync(DB_PATH, 'utf8'))) : emptyDb() }
  catch (error) { console.error('DB locale illisible:', error.message); return emptyDb() }
}

async function remoteRequest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`)
  return response
}

async function remoteRows(table) {
  const response = await remoteRequest(`${table}?select=*`)
  return response.json()
}

/*
 * Lecture d'une table de collection : tolère l'absence de la table (migration
 * non encore appliquée) pour ne jamais casser le chargement global. Les tables
 * "cœur" (organizations/users/invitations) restent, elles, obligatoires.
 */
async function remoteRowsOptional(table) {
  try {
    return await remoteRows(table)
  } catch (error) {
    const message = String(error?.message || error)
    if (/Could not find the table|PGRST205|does not exist|relation .* does not exist/i.test(message)) {
      console.warn(`Table Supabase absente (${table}). Appliquez database/migrations/2026-10-10-01-parcours-v46.sql.`)
      return []
    }
    throw error
  }
}

const COLLECTION_TABLES = {
  registrations: 'v46_registrations', diagnostics: 'v46_diagnostics', needs: 'v46_needs', consents: 'v46_diagnostic_consents', missions: 'v46_missions', offers: 'v46_offers', documents: 'v46_documents', messages: 'v46_messages', meetings: 'v46_appointments', quotes: 'v46_quotes', notifications: 'v46_notifications',
  needsSubscriptions: 'v46_needs_subscriptions', saasSubscriptions: 'v46_saas_subscriptions', conversations: 'v46_conversations',
}

async function loadDb() {
  if (!remoteStoreEnabled) return localLoadDb()
  try {
    const [orgRows,userRows,assignmentRows,inviteRows,...collectionRows] = await Promise.all([
      remoteRows('v46_organizations'), remoteRows('v46_users'), remoteRows('v46_concierge_organizations'), remoteRows('v46_invitations'), ...Object.values(COLLECTION_TABLES).map(remoteRowsOptional),
    ])
    const data = emptyDb()
    data.orgs = orgRows.map((row) => ({ ...(row.metadata || {}), id: row.id, name: row.name, slug: row.slug, sector: row.sector, active: row.active !== false, modules: row.modules || {} }))
    const assignments = new Map()
    for (const row of assignmentRows) { if (!assignments.has(row.concierge_user_id)) assignments.set(row.concierge_user_id, []); assignments.get(row.concierge_user_id).push(row.organization_id) }
    data.users = userRows.map((row) => ({ ...(row.metadata || {}), id: row.id, email: row.email, role: row.role, orgIds: row.role === 'admin' ? ['*'] : row.role === 'concierge' ? (assignments.get(row.id) || []) : row.organization_id ? [row.organization_id] : [], sectors: row.sectors || [], name: row.name, active: row.active !== false, passwordHash: row.password_hash, passwordConfigured: row.password_configured === true, permissions: row.permissions || [] }))
    data.invitations = inviteRows.map((row) => ({ ...(row.metadata || {}), id: row.id, orgId: row.organization_id, email: row.email, name: row.name, role: row.role, permissions: row.permissions || [], kind: row.kind, metadata: row.invitation_metadata || {}, tokenHash: row.token_hash, createdBy: row.created_by, createdAt: row.created_at, expiresAt: row.expires_at, usedAt: row.used_at, revokedAt: row.revoked_at, lastEmailAt: row.last_email_at, lastEmailStatus: row.last_email_status, lastEmailError: row.last_email_error }))
    Object.keys(COLLECTION_TABLES).forEach((key,index) => { data[key] = collectionRows[index].map((row) => row.payload || { id: row.id, orgId: row.organization_id }) })
    // CRM : tables chargées une fois, puis synchronisées de façon incrémentale (seules les lignes modifiées partent).
    const crmRows = await Promise.all(Object.values(CRM_COLLECTIONS).map(remoteRowsOptional))
    Object.entries(CRM_COLLECTIONS).forEach(([key, table], index) => {
      data[key] = crmRows[index].map((row) => row.payload || { id: row.id })
      crmSynced.set(table, new Map(data[key].map((item) => [item.id, JSON.stringify(item)])))
    })
    return normalizeDb(data)
  } catch (error) {
    if (isProduction) throw error
    console.warn('Supabase relationnel indisponible, fallback local:', error.message)
    return localLoadDb()
  }
}

/** Dernier état envoyé à Supabase pour chaque ligne CRM (id → JSON), pour n'envoyer que les différences. */
const crmSynced = new Map()
async function syncCrmTable(table, items) {
  const previous = crmSynced.get(table) || new Map()
  const current = new Map(items.filter((item) => item?.id).map((item) => [item.id, JSON.stringify(item)]))
  const changed = []
  for (const [id, value] of current) if (previous.get(id) !== value) changed.push({ id, organization_id: null, payload: JSON.parse(value) })
  const gone = [...previous.keys()].filter((id) => !current.has(id))
  for (let i = 0; i < changed.length; i += 500) await upsertTable(table, changed.slice(i, i + 500))
  for (let i = 0; i < gone.length; i += 100) await remoteRequest(`${table}?id=in.(${gone.slice(i, i + 100).map((id) => `"${encodeURIComponent(id)}"`).join(',')})`, { method: 'DELETE' })
  crmSynced.set(table, current)
}

async function upsertTable(table, rows) {
  if (rows.length) await remoteRequest(`${table}?on_conflict=id`, { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) })
}
async function pruneTable(table, rows) {
  const remote = await remoteRows(table)
  const wanted = new Set(rows.map((row) => row.id))
  for (const row of remote) if (row.id && !wanted.has(row.id)) await remoteRequest(`${table}?id=eq.${encodeURIComponent(row.id)}`, { method: 'DELETE' })
}
async function syncTable(table, rows) { await upsertTable(table, rows); await pruneTable(table, rows) }

async function syncRemote(data) {
  const orgRows = data.orgs.map((org) => ({ id: org.id, name: org.name, slug: org.slug, sector: org.sector, active: org.active !== false, modules: org.modules || {}, metadata: Object.fromEntries(Object.entries(org).filter(([key]) => !['id','name','slug','sector','active','modules'].includes(key))) }))
  const userRows = data.users.map((user) => ({ id: user.id, organization_id: ['admin','concierge','prestataire','sales','agent'].includes(user.role) ? null : (user.orgIds?.[0] || null), email: user.email, name: user.name || '', role: user.role, active: user.active !== false, password_hash: user.passwordHash || null, password_configured: user.passwordConfigured === true, permissions: user.permissions || [], sectors: user.sectors || [], metadata: Object.fromEntries(Object.entries(user).filter(([key]) => !['id','organization_id','email','name','role','active','passwordHash','passwordConfigured','permissions','sectors','orgIds'].includes(key))) }))
  const assignmentRows = data.users.filter((user) => user.role === 'concierge').flatMap((user) => (user.orgIds || []).filter((id) => id !== '*').map((orgId) => ({ id: `${user.id}:${orgId}`, concierge_user_id: user.id, organization_id: orgId })))
  const inviteRows = data.invitations.map((inv) => ({ id: inv.id, organization_id: inv.orgId || null, email: inv.email, name: inv.name || '', role: inv.role, permissions: inv.permissions || [], kind: inv.kind, invitation_metadata: inv.metadata || {}, token_hash: inv.tokenHash, created_by: inv.createdBy || null, created_at: inv.createdAt, expires_at: inv.expiresAt, used_at: inv.usedAt || null, revoked_at: inv.revokedAt || null, last_email_at: inv.lastEmailAt || null, last_email_status: inv.lastEmailStatus || null, last_email_error: inv.lastEmailError || null, metadata: {} }))
  // Insert/update parents first, then children. Deletions are pruned in reverse dependency order.
  await upsertTable('v46_organizations', orgRows)
  await upsertTable('v46_users', userRows)
  await syncTable('v46_concierge_organizations', assignmentRows)
  await syncTable('v46_invitations', inviteRows)
  for (const [key,table] of Object.entries(COLLECTION_TABLES)) {
    const rows = (data[key] || []).filter((item) => item?.id).map((item) => ({ id: item.id, organization_id: item.orgId || null, payload: item }))
    await syncTable(table, rows)
  }
  for (const [key, table] of Object.entries(CRM_COLLECTIONS)) await syncCrmTable(table, data[key] || [])
  await pruneTable('v46_users', userRows)
  await pruneTable('v46_organizations', orgRows)
}

function saveDb(data) {
  const snapshot = normalizeDb(data)
  writeFileSync(DB_PATH, JSON.stringify(snapshot, null, 2), { mode: 0o600 })
  if (remoteStoreEnabled) {
    remoteSaveQueue = remoteSaveQueue.then(() => syncRemote(snapshot)).catch((error) => console.error('ERREUR PERSISTANCE SUPABASE:', error.message))
  }
}

let db = await loadDb()
const DEFAULT_MODULES = { diagnostic: true, besoins: true, missions: true, rendezVous: true, documents: true, messages: true, devis: true, prestataires: true, abonnement: true, notifications: true, equipe: true, results: true }
const ORGANIZATION_DEFAULT_MODULES = { diagnostic: true, besoins: false, missions: false, rendezVous: false, documents: false, messages: false, devis: false, prestataires: false, abonnement: false, notifications: false, equipe: false, results: false }
const DEFAULT_SAAS = { subscriptionActive: false, enabled: false, startDate: null, endDate: null, plan: null }
const ACCESS_PLANS = new Set(['BASE', 'PRO', 'PERFORMANCE'])

/* ------------------------------------------------------------------ */
/* PHASE 5 — Offres d'accompagnement & missions (source de vérité      */
/* backend). Les contenus non encore définis sont marqués              */
/* `contentStatus: 'a_valider'` (« Contenu à valider »), jamais        */
/* présentés comme validés. Mapping historique : STARTER -> BASIQUE.   */
/* ------------------------------------------------------------------ */
const OFFER_CODES = ['BASIQUE', 'PRO', 'PERFORMANCE']
const OFFER_PRICES = { BASIQUE: 3445, PRO: 6445, PERFORMANCE: 10945 }
const OFFER_CATALOG = [
  {
    code: 'BASIQUE',
    name: 'BASIQUE',
    price: OFFER_PRICES.BASIQUE,
    summary: 'Structurer les priorités issues du diagnostic et sécuriser les premières actions avec votre concierge.',
  },
  {
    code: 'PRO',
    name: 'PRO',
    price: OFFER_PRICES.PRO,
    summary: 'Mettre en œuvre les actions prioritaires et suivre leur avancement avec un accompagnement régulier.',
  },
  {
    code: 'PERFORMANCE',
    name: 'PERFORMANCE',
    price: OFFER_PRICES.PERFORMANCE,
    summary: 'Piloter l’ensemble des chantiers avec un accompagnement renforcé jusqu’au bilan.',
  },
]
const MISSION_AXES = [
  { key: 'commercial', title: 'Commercial & force de vente', description: 'Structurer la démarche commerciale et renforcer la performance de vente.', minimumOffer: 'BASIQUE' },
  { key: 'marketing', title: 'Visibilité, marketing & communication', description: 'Développer la visibilité et coordonner les actions marketing et de communication.', minimumOffer: 'BASIQUE' },
  { key: 'rh', title: 'RH & organisation', description: 'Faire progresser l’organisation, les rôles et les pratiques RH.', minimumOffer: 'PRO' },
  { key: 'juridique', title: 'Réduction des charges & juridique', description: 'Identifier les leviers de maîtrise des charges et sécuriser les sujets juridiques.', minimumOffer: 'PRO' },
  { key: 'financement', title: 'Accompagnement & programmes de financement', description: 'Identifier et piloter les accompagnements et financements adaptés.', minimumOffer: 'PERFORMANCE' },
]
const MISSION_STATUSES = new Set(['a_faire', 'en_cours', 'a_valider_client', 'validee_client', 'terminee'])
const STAFF_MISSION_STATUSES = new Set(['a_faire', 'en_cours', 'a_valider_client', 'terminee'])
const OFFER_STATUSES = new Set(['draft', 'en_attente_validation', 'actif', 'refuse', 'suspendu', 'expire'])

function normalizeOfferStatus(value) {
  return ({ disponible: 'draft', selectionnee: 'en_attente_validation', acceptee: 'actif', annulee: 'expire' })[value] || (OFFER_STATUSES.has(value) ? value : null)
}

function normalizeMissionStatus(value) {
  return ({ en_attente_client: 'a_valider_client', termine: 'terminee' })[value] || (MISSION_STATUSES.has(value) ? value : null)
}

/** STARTER (héritage) équivaut à BASIQUE. Retourne null si l'offre est inconnue. */
function normalizeOfferCode(value) {
  const code = String(value || '').trim().toUpperCase()
  if (code === 'STARTER') return 'BASIQUE'
  return OFFER_CODES.includes(code) ? code : null
}

/** Axes métier inclus dans l'offre acceptée. STARTER est traité comme BASIQUE. */
function missionAxesForOffer(code) {
  const normalized = normalizeOfferCode(code)
  if (!normalized) return []
  const levels = { BASIQUE: 1, PRO: 2, PERFORMANCE: 3 }
  return MISSION_AXES.filter((axis) => levels[axis.minimumOffer] <= levels[normalized]).map(({ minimumOffer, ...axis }) => ({ ...axis, contentStatus: 'a_valider' }))
}

function offerCatalogItem(code) {
  const normalized = normalizeOfferCode(code)
  const item = OFFER_CATALOG.find((offer) => offer.code === normalized)
  if (!item) return null
  return { ...item, missions: missionAxesForOffer(normalized), contentStatus: 'a_valider' }
}

/** Offre d'accompagnement actuellement acceptée pour une entreprise (une seule). */
function activeOfferForOrg(orgId) {
  return db.offers.filter((offer) => offer.orgId === orgId && normalizeOfferStatus(offer.status) === 'actif').sort((a, b) => (b.decidedAt || b.acceptedAt || '').localeCompare(a.decidedAt || a.acceptedAt || ''))[0] || null
}

function normalizedOfferRecord(offer) {
  if (!offer) return null
  const offerCode = normalizeOfferCode(offer.offerCode)
  return { ...offer, status: normalizeOfferStatus(offer.status) || 'draft', offerCode, offerName: offerCode || offer.offerName }
}

/** Dernier diagnostic publié (et visible) d'une entreprise. */
function latestPublishedDiagnosticForOrg(orgId) {
  return db.diagnostics
    .filter((diagnostic) => diagnostic.orgId === orgId && canClientViewRestitution(diagnostic))
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))[0] || null
}

/** Recommandation d'offre à partir du diagnostic publié (volets/priorités). */
function recommendOfferCode(diagnostic) {
  if (!diagnostic) return 'BASIQUE'
  const analysis = diagnostic.analysis && typeof diagnostic.analysis === 'object' ? diagnostic.analysis : {}
  const explicit = normalizeOfferCode(analysis.recommendedOfferCode || diagnostic.recommendedOfferCode)
  if (explicit) return explicit
  const priorities = Array.isArray(analysis.priorities)
    ? analysis.priorities.length
    : Array.isArray(diagnostic.synthesis?.priorities) ? diagnostic.synthesis.priorities.length : 0
  if (priorities >= 3) return 'PERFORMANCE'
  if (priorities === 2) return 'PRO'
  return 'BASIQUE'
}

/*
 * Origine de la recommandation d'offre : `explicit` quand le concierge a posé
 * `recommendedOfferCode` sur le diagnostic, sinon `heuristique_a_valider` quand
 * la valeur provient du seul nombre de priorités (règle d'appoint à valider
 * métier, jamais présentée comme une validation de concierge).
 */
function recommendOfferSource(diagnostic) {
  if (!diagnostic) return null
  const analysis = diagnostic.analysis && typeof diagnostic.analysis === 'object' ? diagnostic.analysis : {}
  return normalizeOfferCode(analysis.recommendedOfferCode || diagnostic.recommendedOfferCode) ? 'explicit' : 'heuristique_a_valider'
}

/** Génère les missions d'une offre acceptée de façon idempotente (jamais de doublon). */
function ensureMissionsForOffer(offer) {
  const existing = db.missions.filter((mission) => mission.offerRecordId === offer.id)
  const now = new Date().toISOString()
  const concierge = conciergeForOrg(offer.orgId)
  const existingAxes = existing.filter((mission, index, rows) => mission.axisKey && rows.findIndex((item) => item.axisKey === mission.axisKey) === index)
  const existingAxisKeys = new Set(existingAxes.map((mission) => mission.axisKey))
  const created = missionAxesForOffer(offer.offerCode).filter((axis) => !existingAxisKeys.has(axis.key)).map((template, index) => ({
    id: `mis-${randomBytes(12).toString('hex')}`,
    orgId: offer.orgId,
    offerRecordId: offer.id,
    offerCode: normalizeOfferCode(offer.offerCode),
    axisKey: template.key,
    title: template.title,
    description: template.description,
    contentStatus: template.contentStatus || 'a_valider',
    status: 'a_faire',
    priority: index === 0 ? 'haute' : 'normale',
    dueDate: null,
    assignedConciergeId: (concierge?.id) || offer.acceptedByConciergeId || null,
    instructions: '',
    deliverables: [],
    documents: [],
    clientFeedback: null,
    order: missionAxesForOffer(offer.offerCode).findIndex((axis) => axis.key === template.key),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }))
  db.missions.push(...created)
  return [...existingAxes, ...created].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function missionsForAcceptedOffer(offer) {
  const axes = ensureMissionsForOffer(offer)
  const allowedKeys = new Set(missionAxesForOffer(offer.offerCode).map((axis) => axis.key))
  const legacyActions = db.missions.filter((mission) => mission.offerRecordId === offer.id && !mission.axisKey)
  return axes
    .filter((mission) => allowedKeys.has(mission.axisKey))
    .map((mission) => ({
      ...mission,
      offerCode: normalizeOfferCode(offer.offerCode),
      actions: legacyActions
        .filter((action, actionIndex) => (action.parentAxisKey || [...allowedKeys][actionIndex % allowedKeys.size]) === mission.axisKey)
        .map((action) => ({ ...action, offerCode: normalizeOfferCode(offer.offerCode) })),
    }))
}

function missionAllowedByAcceptedOffer(mission) {
  const offer = activeOfferForOrg(mission.orgId)
  if (!offer || mission.offerRecordId !== offer.id) return false
  const allowedKeys = new Set(missionAxesForOffer(offer.offerCode).map((axis) => axis.key))
  return Boolean(mission.axisKey && allowedKeys.has(mission.axisKey))
}

/* ------------------------------------------------------------------ */
/* PHASE 6 — Abonnements Besoins (ESSENTIEL / AVANCÉ / PREMIUM)        */
/* Source de vérité backend. Réutilise v46_needs_subscriptions et      */
/* v46_quotes. Mapping historique : CONNECT -> ESSENTIEL,              */
/* PLUS -> AVANCÉ, PRIORITE -> PREMIUM (jamais affichés au client).     */
/* Les contenus non encore figés portent `contentStatus: a_valider`.   */
/* ------------------------------------------------------------------ */
const NEEDS_PLAN_CODES = ['ESSENTIEL', 'AVANCE', 'PREMIUM']
const NEEDS_PLAN_NAMES = { ESSENTIEL: 'ESSENTIEL', AVANCE: 'AVANCÉ', PREMIUM: 'PREMIUM' }
const NEEDS_PLAN_PRICES = { ESSENTIEL: 149, AVANCE: 349, PREMIUM: 549 }
const NEEDS_PLAN_LIMITS = {
  ESSENTIEL: { monthlyLimit: 2, proposalsLimit: 2, targetDelayHours: 72 },
  AVANCE: { monthlyLimit: 5, proposalsLimit: 3, targetDelayHours: 48, recommendedProposal: true },
  PREMIUM: { monthlyLimit: 10, proposalsLimit: 3, targetDelayHours: 36, recommendedProposal: true, negotiatedProposal: true },
}
const NEEDS_SUBSCRIPTION_STATUSES = new Set(['pending', 'active', 'refused', 'suspended', 'cancelled', 'expired'])
const NEEDS_SUBSCRIPTION_PERIOD_MS = 30 * 86400000
const SAAS_PRICE = 445
const SAAS_PLAN_CODE = 'SAAS_445'

/** Normalise un code de plan (anciens noms inclus). Accents tolérés. */
function normalizeNeedsPlanCode(value) {
  const raw = String(value || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (raw === 'CONNECT') return 'ESSENTIEL'
  if (raw === 'PLUS') return 'AVANCE'
  if (raw === 'PRIORITE') return 'PREMIUM'
  return NEEDS_PLAN_CODES.includes(raw) ? raw : null
}

function needsPlanItem(code) {
  const normalized = normalizeNeedsPlanCode(code)
  if (!normalized) return null
  const limits = NEEDS_PLAN_LIMITS[normalized]
  return {
    code: normalized,
    name: NEEDS_PLAN_NAMES[normalized],
    price: NEEDS_PLAN_PRICES[normalized],
    currency: 'MAD',
    period: 'mois',
    monthlyLimit: limits.monthlyLimit,
    proposalsLimit: limits.proposalsLimit,
    targetDelayHours: limits.targetDelayHours,
    recommendedProposal: Boolean(limits.recommendedProposal),
    negotiatedProposal: Boolean(limits.negotiatedProposal),
    contentStatus: 'a_valider',
  }
}

function needsSubscriptionsForOrg(orgId) {
  return db.needsSubscriptions.filter((item) => item.orgId === orgId)
}

/** Abonnement Besoins actif d'une entreprise (jamais plus d'un). */
function activeNeedsSubscriptionForOrg(orgId) {
  const now = Date.now()
  return needsSubscriptionsForOrg(orgId)
    .filter((item) => item.status === 'active' && (!item.periodEnd || Date.parse(item.periodEnd) > now))
    .sort((a, b) => String(b.startDate || b.createdAt || '').localeCompare(String(a.startDate || a.createdAt || '')))[0] || null
}

function needsPeriodFor(subscription) {
  const start = subscription.periodStart || subscription.startDate || subscription.createdAt || new Date().toISOString()
  const end = subscription.periodEnd || new Date(Date.parse(start) + NEEDS_SUBSCRIPTION_PERIOD_MS).toISOString()
  return { periodStart: start, periodEnd: end }
}

/** Nombre de besoins déposés par l'entreprise sur la période en cours. */
function needsUsedInPeriod(orgId, subscription) {
  const { periodStart, periodEnd } = needsPeriodFor(subscription)
  const from = Date.parse(periodStart)
  const to = Date.parse(periodEnd)
  return db.needs.filter((need) => need.orgId === orgId && Date.parse(need.createdAt || need.submittedAt || 0) >= from && Date.parse(need.createdAt || need.submittedAt || 0) < to).length
}

/** Vue complète d'un abonnement Besoins (quota recalculé depuis la période). */
function needsSubscriptionSummary(subscription) {
  if (!subscription) return null
  const plan = needsPlanItem(subscription.planCode)
  const { periodStart, periodEnd } = needsPeriodFor(subscription)
  const used = needsUsedInPeriod(subscription.orgId, subscription)
  const limit = plan ? plan.monthlyLimit : 0
  return {
    ...subscription,
    planCode: plan?.code || subscription.planCode,
    planName: plan?.name || subscription.planName || subscription.planCode,
    price: plan?.price ?? subscription.price ?? null,
    monthlyLimit: limit,
    proposalsLimit: plan?.proposalsLimit ?? subscription.proposalsLimit ?? 0,
    targetDelayHours: plan?.targetDelayHours ?? subscription.targetDelayHours ?? null,
    recommendedProposal: plan?.recommendedProposal ?? false,
    negotiatedProposal: plan?.negotiatedProposal ?? false,
    usedThisMonth: used,
    remaining: Math.max(0, limit - used),
    periodStart,
    periodEnd,
    active: subscription.status === 'active',
  }
}

/** Propositions/devis d'un besoin (Phase 6) : la table v46_quotes est réutilisée. */
function needProposalsFor(needId) {
  return db.quotes
    .filter((quote) => quote.needId === needId && quote.kind === 'proposition')
    .sort((a, b) => Number(b.recommended === true) - Number(a.recommended === true) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function proposalSentToClient(proposal) {
  return Boolean(proposal?.sentAt) || ['envoyee', 'acceptee', 'refusee'].includes(proposal?.status)
}

function transmittedProposalsFor(needId) {
  return needProposalsFor(needId).filter(proposalSentToClient)
}

/** Prérequis à l'accès au module Besoins : compte actif, diagnostic publié, offre acceptée. */
function needsAccessPrerequisites(org) {
  if (!org || org.active === false) return { ok: false, code: 'ACCESS_DISABLED', error: 'compte entreprise désactivé' }
  if (!latestPublishedDiagnosticForOrg(org.id)) return { ok: false, code: 'DIAGNOSTIC_NOT_PUBLISHED', error: 'La restitution doit être publiée avant d’accéder aux besoins.' }
  if (!activeOfferForOrg(org.id)) return { ok: false, code: 'OFFER_REQUIRED', error: 'Une offre d’accompagnement doit être acceptée avant de souscrire à un abonnement Besoins.' }
  return { ok: true }
}

function needsSubscriptionCatalog() {
  return NEEDS_PLAN_CODES.map((code) => needsPlanItem(code))
}

/* Registrations : statuts du parcours + mapping de compatibilité ancien -> nouveau. */
const REGISTRATION_STATUSES = new Set(['demande_recue', 'en_attente_affectation', 'concierge_affecte', 'en_attente_activation', 'actif', 'refusee'])
function mapLegacyRegistrationStatus(status) {
  switch (status) {
    case 'en_attente': return 'demande_recue'
    case 'invitation_envoyee': return 'en_attente_activation'
    case 'validee_email_echec': return 'en_attente_activation'
    case 'active': return 'actif'
    default: return REGISTRATION_STATUSES.has(status) ? status : 'demande_recue'
  }
}

for (const org of db.orgs) { org.saas = { ...DEFAULT_SAAS, ...(org.saas || {}) } }
for (const org of db.orgs) { org.active ??= true; org.modules = { ...DEFAULT_MODULES, ...(org.modules || {}) }; org.slug ??= org.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || org.id }
for (const user of db.users) { user.active ??= true; user.permissions ??= []; user.passwordConfigured ??= Boolean(user.passwordHash) }
for (const reg of db.registrations) { reg.status = mapLegacyRegistrationStatus(reg.status); if (!Array.isArray(reg.events)) reg.events = []; reg.conciergeId ??= null; reg.appointmentStatus ??= 'demande' }
for (const offer of db.offers) offer.status = normalizeOfferStatus(offer.status) || 'draft'
for (const mission of db.missions) mission.status = normalizeMissionStatus(mission.status) || 'a_faire'
let repairedNeedWorkflow = false
for (const need of db.needs) {
  if (normalizeNeedStatus(need.status) === 'en_attente_client' && transmittedProposalsFor(need.id).length === 0) {
    need.status = 'en_recherche'
    need.updatedAt = new Date().toISOString()
    repairedNeedWorkflow = true
  }
}
if (repairedNeedWorkflow) saveDb(db)

const bootstrapEmail = (process.env.ALLNEEDS_ADMIN_EMAIL || '').trim().toLowerCase()
const bootstrapPassword = process.env.ALLNEEDS_ADMIN_PASSWORD || ''
if (!db.users.some((user) => user.role === 'admin') && bootstrapEmail && bootstrapPassword.length >= 12) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(bootstrapPassword, salt, 64)
  db.users.push({ id: `admin-${randomBytes(8).toString('hex')}`, email: bootstrapEmail, role: 'admin', orgIds: ['*'], name: process.env.ALLNEEDS_ADMIN_NAME || 'Administrateur ALLNEEDS', active: true, passwordHash: `scrypt$${salt}$${hash.toString('hex')}`, passwordConfigured: true, permissions: ['*'] })
  saveDb(db)
  console.log(`Administrateur initial créé: ${bootstrapEmail}. Retirez ALLNEEDS_ADMIN_PASSWORD du .env après ce premier démarrage.`)
}
/*
 * Compte de présentation commerciale (seed idempotent au démarrage).
 * Le mot de passe vient uniquement de l'environnement : il n'est jamais écrit en clair,
 * seule son empreinte scrypt est stockée. Un compte existant est mis à jour, jamais dupliqué.
 */
const salesEmail = (process.env.ALLNEEDS_SALES_EMAIL || 'sales_presentation@gmail.com').trim().toLowerCase()
const salesPassword = process.env.ALLNEEDS_SALES_PASSWORD || ''
if (salesPassword) {
  const existing = db.users.filter((user) => user.email?.toLowerCase() === salesEmail)
  if (salesPassword.length < 12 || salesPassword.length > 1024) console.warn('ALLNEEDS_SALES_PASSWORD doit contenir entre 12 et 1024 caractères : compte commercial non créé.')
  else if (existing.length > 1) console.warn(`Plusieurs comptes utilisent ${salesEmail} : corrigez la base avant de créer le compte commercial.`)
  else if (existing[0] && existing[0].role === 'admin') console.warn(`${salesEmail} est un compte administrateur : il n'est pas converti en compte commercial.`)
  else {
    let account = existing[0]
    let changed = false
    if (!account) { account = { id: `sales-${randomBytes(8).toString('hex')}`, email: salesEmail, name: process.env.ALLNEEDS_SALES_NAME || 'Présentation commerciale', passwordHash: null }; db.users.push(account); changed = true }
    let passwordMatches = false
    const [scheme, salt, stored] = String(account.passwordHash || '').split('$')
    if (scheme === 'scrypt' && salt && stored) {
      const candidate = await scrypt(salesPassword, salt, 64)
      const expected = Buffer.from(stored, 'hex')
      passwordMatches = candidate.length === expected.length && timingSafeEqual(candidate, expected)
    }
    if (!passwordMatches) {
      const newSalt = randomBytes(16).toString('hex')
      account.passwordHash = `scrypt$${newSalt}$${(await scrypt(salesPassword, newSalt, 64)).toString('hex')}`
      changed = true
    }
    const wanted = { role: 'sales', orgIds: [], sectors: [], permissions: [], active: true, passwordConfigured: true }
    for (const [key, value] of Object.entries(wanted)) if (JSON.stringify(account[key]) !== JSON.stringify(value)) { account[key] = value; changed = true }
    if (changed) { saveDb(db); console.log(`Compte de présentation commerciale prêt : ${salesEmail}.`) }
  }
}

if (!db.users.some((user) => user.role === 'admin')) console.warn('Aucun administrateur configuré. Définissez ALLNEEDS_ADMIN_EMAIL et ALLNEEDS_ADMIN_PASSWORD (12+ caractères) pour le premier démarrage.')

const json = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers })
  res.end(JSON.stringify(body))
}
const audit = (event, detail) => appendFileSync(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), event, ...detail }) + '\n', { mode: 0o600 })
const safeUser = ({ passwordHash: _passwordHash, ...user }) => user

async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('corps trop volumineux'), { status: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }) }
}

function signature(payload) {
  return createHmac('sha256', sessionSecret).update(payload).digest('base64url')
}

function issueSession(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString('base64url')
  return `${payload}.${signature(payload)}`
}

function sessionUser(req) {
  const cookie = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))
  const token = cookie?.slice(COOKIE_NAME.length + 1)
  if (!token) return null
  const [payload, supplied, extra] = token.split('.')
  if (!payload || !supplied || extra) return null
  const expected = signature(payload)
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const user = db.users.find((item) => item.id === data.sub && item.active !== false)
    return data.exp > Math.floor(Date.now() / 1000) ? user ?? null : null
  } catch { return null }
}

function cookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
}

function requireSameOrigin(req, res) {
  const origin = req.headers.origin
  if (origin && !isAllowedOrigin(origin)) {
    json(res, 403, { error: 'origine refusée' })
    return false
  }
  return true
}

function isAdmin(user) { return user?.role === 'admin' }
function isConcierge(user) { return user?.role === 'concierge' }
function isClient(user) { return CLIENT_ROLES.has(user?.role) }

function canAccessOrg(user, orgId) {
  if (!user || !orgId) return false
  if (isAdmin(user)) return true
  return Array.isArray(user.orgIds) && user.orgIds.includes(orgId)
}

function canManageOrg(user, orgId) { return Boolean(orgId) && (isAdmin(user) || (isConcierge(user) && canAccessOrg(user, orgId))) }
function canClientValidate(user, orgId) { return isClient(user) && canAccessOrg(user, orgId) }

function canReadDiagnostics(user) {
  return ['admin', 'concierge', 'commercial', 'dirigeant', 'manager'].includes(user?.role)
}

function canCreateDiagnostic(user, format) {
  if (['admin', 'concierge', 'dirigeant', 'manager'].includes(user?.role)) return true
  return user?.role === 'commercial' && user.scope === 'crm' && format === 'Express'
}

/**
 * Cycle de vie d'un diagnostic :
 *   soumis → en_analyse → pret_a_valider → restitue (publiée au client).
 * `analyse` (héritage v5.1) reste accepté et équivaut à `en_analyse`.
 */
const DIAGNOSTIC_STATUSES = new Set(['soumis', 'analyse', 'en_analyse', 'pret_a_valider', 'restitue'])
const DIAGNOSTIC_ACTIVE_STATUSES = ['soumis', 'analyse', 'en_analyse', 'pret_a_valider', 'restitue']

/* ------------------------------------------------------------------ */
/* Diagnostics : visibilité et vie privée de la restitution             */
/* ------------------------------------------------------------------ */

/**
 * Le client ne voit la restitution que si elle est EN MÊME TEMPS :
 *  - au statut `restitue` (la chaîne autorisée est soumis → analyse → restitue),
 *  - publiée explicitement (publishedAt posé par le concierge ou l'admin),
 *  - et non masquée (restitutionVisible ≠ false).
 * Jamais sur la présence de `synthesis` ni sur le seul statut `soumis`.
 */
function canClientViewRestitution(diagnostic) {
  if (!diagnostic) return false
  if (diagnostic.status !== 'restitue') return false
  if (diagnostic.restitutionVisible === false) return false
  return Boolean(diagnostic.publishedAt)
}

const ANALYSIS_STRINGS = new Set(['priorityLevel', 'internalNotes'])
const ANALYSIS_LISTS = ['priorities', 'recommendations', 'strengths', 'weaknesses', 'risks', 'opportunities', 'needsPrioritaires', 'actionPlan', 'nextSteps']

/**
 * Sérialise un diagnostic selon le rôle.
 * - Concierge & admin : l'enregistrement complet (notes internes comprises).
 * - Client (et tout rôle non opérationnel) : jamais `analysis` ni `questionNotes` ;
 *   `synthesis` et `notes` ne sont renvoyés que si la restitution est publiée.
 */
function serializeDiagnosticFor(user, diagnostic) {
  if (!diagnostic) return diagnostic
  if (OPERATIONS_ROLES.has(user.role)) return diagnostic
  const published = canClientViewRestitution(diagnostic)
  const copy = { ...diagnostic }
  delete copy.analysis
  delete copy.questionNotes
  delete copy.questionComments
  delete copy.publishedBy
  copy.synthesis = published ? (diagnostic.synthesis ?? null) : null
  copy.notes = published ? (diagnostic.notes ?? '') : ''
  copy.restitutionPublished = published
  copy.restitutionVisible = diagnostic.restitutionVisible !== false
  copy.publishedAt = published ? (diagnostic.publishedAt ?? null) : null
  return copy
}

/** Chapitres et champs de la restitution tels que le client les voit une fois publiée. */
function publicRestitutionPayload(diagnostic, orgName = '') {
  const analysis = diagnostic.analysis || {}
  return {
    id: diagnostic.id,
    orgId: diagnostic.orgId,
    orgName,
    sector: diagnostic.sector || null,
    format: diagnostic.format || 'Express',
    status: 'restitue',
    publishedAt: diagnostic.publishedAt || null,
    conciergeRequestedAt: diagnostic.conciergeRequestedAt || null,
    rendezVousAt: diagnostic.rendezVousAt || null,
    restoredAt: diagnostic.restoredAt || null,
    notes: diagnostic.notes || '',
    synthesis: diagnostic.synthesis || { confirmed: [], priorities: [], watch: [], opportunities: [], actions: [] },
    analysis: {
      priorities: analysis.priorities || [],
      priorityLevel: analysis.priorityLevel || '',
      recommendations: analysis.recommendations || [],
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      risks: analysis.risks || [],
      opportunities: analysis.opportunities || [],
      needsPrioritaires: analysis.needsPrioritaires || [],
      actionPlan: analysis.actionPlan || [],
      nextSteps: analysis.nextSteps || [],
    },
  }
}

/* ------------------------------------------------------------------ */
/* Documents : types, statuts, rôles                                   */
/* ------------------------------------------------------------------ */

const DOCUMENT_TYPES = new Set(['contrat', 'devis', 'facture', 'autorisation', 'livrable', 'compte_rendu', 'document_preparatoire', 'suivi', 'proposition', 'restitution', 'autre'])
const DOCUMENT_STATUSES = new Set(['demande', 'recu', 'valide'])
const CLIENT_ROLES = new Set(['dirigeant', 'manager', 'collaborateur'])

function sanitizeFilename(value) {
  return String(value || 'document').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(0, 160) || 'document'
}

/*
 * Fichiers déposés : seules les data URLs PDF/JPEG/PNG sont acceptées. Le type
 * est vérifié par signature binaire (jamais sur la seule extension/le MIME
 * déclaré), ce qui écarte HTML, SVG et exécutables. Plafond aligné sur la
 * limite de corps (MAX_BODY_BYTES = 1 Mo).
 */
const DOCUMENT_DATA_URL_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_DOCUMENT_DATA_URL = 900000
const INLINE_SAFE_MIME = /^(application\/pdf|image\/(jpeg|png|gif|webp)|text\/plain)(;|$)/i
const dataUrlError = (message) => Object.assign(new Error(message), { status: 400 })

function validateDocumentFileUrl(value) {
  const trimmed = String(value || '').trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 200000)
  const match = trimmed.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/)
  if (!match) throw dataUrlError('fichier invalide : seuls un PDF, JPG, JPEG ou PNG sont acceptés')
  const mime = match[1].trim().toLowerCase()
  if (!DOCUMENT_DATA_URL_MIME.has(mime)) throw dataUrlError(`type de fichier non autorisé (${mime || 'inconnu'}) : PDF, JPG, JPEG ou PNG uniquement`)
  if (trimmed.length > MAX_DOCUMENT_DATA_URL) throw Object.assign(new Error('fichier trop volumineux (environ 650 Ko maximum)'), { status: 413 })
  let payload
  try {
    payload = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8')
  } catch { throw dataUrlError('contenu de fichier illisible') }
  const s = payload.subarray(0, 8)
  const signatureOk = mime === 'application/pdf'
    ? s[0] === 0x25 && s[1] === 0x50 && s[2] === 0x44 && s[3] === 0x46
    : mime === 'image/jpeg'
      ? s[0] === 0xFF && s[1] === 0xD8 && s[2] === 0xFF
      : s[0] === 0x89 && s[1] === 0x50 && s[2] === 0x4E && s[3] === 0x47
  if (!signatureOk) throw dataUrlError('le contenu du fichier ne correspond pas au type déclaré')
  return trimmed
}

/** Un utilisateur peut-il voir un document donné ? (admin = global, concierge = affecté, client = son organisation) */
function documentVisibleTo(user, doc) {
  if (!user || !doc) return false
  if (!canAccessOrg(user, doc.orgId)) return false
  if (CLIENT_ROLES.has(user.role)) return doc.visibleToClient !== false
  return true
}

/* PHASE 6 — Besoins : statuts canoniques + compatibilité anciens statuts. */
const NEED_STATUSES_V46 = ['nouveau', 'en_analyse', 'en_recherche', 'propositions_disponibles', 'en_attente_client', 'valide', 'cloture', 'annule']
const NEED_LEGACY_STATUS_MAP = { recu: 'nouveau', analyse: 'en_analyse', recherche: 'en_recherche', propositions: 'propositions_disponibles', devis: 'propositions_disponibles', negociation: 'en_attente_client', signe: 'valide', clos: 'cloture' }
const NEED_STATUSES = new Set([...NEED_STATUSES_V46, ...Object.keys(NEED_LEGACY_STATUS_MAP)])
const NEED_CATEGORIES = new Set(['logiciel', 'creation', 'rh', 'logistique', 'energie', 'maintenance'])
const NEED_URGENCY = new Set(['faible', 'normale', 'haute'])
const NEED_FLOW = ['nouveau', 'en_analyse', 'en_recherche', 'propositions_disponibles', 'en_attente_client', 'valide', 'cloture']
const NEED_READ_ROLES = new Set(['admin', 'concierge', 'dirigeant', 'manager', 'collaborateur'])

/** Ramène un statut (ancien ou nouveau) vers le statut canonique V46, ou null. */
function normalizeNeedStatus(value) {
  const raw = String(value || '').trim()
  if (NEED_STATUSES_V46.includes(raw)) return raw
  return NEED_LEGACY_STATUS_MAP[raw] || null
}
const OPERATIONS_ROLES = new Set(['admin', 'concierge'])

/* ------------------------------------------------------------------ */
/* Présentation commerciale : rôle `sales` + permission déléguée        */
/* ------------------------------------------------------------------ */
// Rôle dédié aux comptes commerciaux : aucun accès aux données clients ni à l'administration.
const SALES_ROLE = 'sales'
// Permission qu'un administrateur peut accorder à un concierge (membre interne) sans changer son rôle.
const SALES_PERMISSION = 'sales_presentation'
const STAFF_INVITATION_KINDS = new Set(['concierge', 'sales', 'crm'])
// Seules ces routes restent ouvertes à un compte `sales` (en plus de /api/me et de la déconnexion).
const SALES_ALLOWED_API = [/^\/api\/sales\//]

function canAccessSalesPresentation(user) {
  if (!user || user.active === false) return false
  if (user.role === 'admin' || user.role === SALES_ROLE) return true
  return user.role === 'concierge' && Array.isArray(user.permissions) && user.permissions.includes(SALES_PERMISSION)
}

function allowedText(value, maximum, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw Object.assign(new Error(`${field} invalide`), { status: 400 })
  return value.trim()
}


function orgForUser(user) {
  if (!user || ['admin', 'concierge', 'prestataire', 'sales', 'agent'].includes(user.role)) return null
  return db.orgs.find((org) => Array.isArray(user.orgIds) && user.orgIds.includes(org.id)) || null
}

function accessFailure(user, moduleName) {
  const org = orgForUser(user)
  if (!org) return null
  if (org.active === false) return 'compte entreprise désactivé'
  if (moduleName && org.modules?.[moduleName] === false) return `module ${moduleName} désactivé`
  return null
}

function requireModuleAccess(user, res, cors, moduleName) {
  const failure = accessFailure(user, moduleName)
  if (!failure) return true
  json(res, 403, { error: failure, code: 'ACCESS_DISABLED', module: moduleName || null }, cors)
  return false
}

function hashInvitationToken(token) { return createHmac('sha256', sessionSecret).update(`invite:${token}`).digest('hex') }
function createInvitation({ orgId = null, email, name, role, permissions = [], createdBy, kind = 'team', metadata = {} }) {
  const normalizedEmail = email.toLowerCase()
  for (const item of db.invitations) if (item.email === normalizedEmail && item.orgId === orgId && item.kind === kind && !item.usedAt && !item.revokedAt) item.revokedAt = new Date().toISOString()
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const invitation = { id: `inv-${randomBytes(10).toString('hex')}`, orgId, email: normalizedEmail, name, role, permissions, kind, metadata, tokenHash: hashInvitationToken(token), createdBy, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + INVITATION_TTL_SECONDS * 1000).toISOString(), usedAt: null, revokedAt: null, lastEmailAt: null, lastEmailStatus: null }
  db.invitations.push(invitation); saveDb(db)
  return { invitation, token }
}

function smtpRead(socket) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const last = lines.at(-1) || ''
      if (/^\d{3} /.test(last)) { cleanup(); resolve({ code: Number(last.slice(0,3)), text: buffer }) }
    }
    const onError = (error) => { cleanup(); reject(error) }
    const onClose = () => { if (buffer && /^\d{3} /.test((buffer.split(/\r?\n/).filter(Boolean).at(-1)||''))) return; cleanup(); reject(new Error('connexion SMTP fermée')) }
    const cleanup = () => { socket.off('data', onData); socket.off('error', onError); socket.off('close', onClose) }
    socket.on('data', onData); socket.on('error', onError); socket.on('close', onClose)
  })
}

async function smtpCommand(socket, command, expected) {
  if (command !== null) socket.write(command + '\r\n')
  const response = await smtpRead(socket)
  const allowed = Array.isArray(expected) ? expected : [expected]
  if (!allowed.includes(response.code)) throw new Error(`SMTP ${response.code}: ${response.text.trim()}`)
  return response
}

function htmlEscape(value='') { return String(value).replace(/[&<>\"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch])) }
function invitationCopy(invitation) {
  if (invitation.kind === 'owner') return { subject: 'Activez votre compte ALLNEEDS', intro: 'Votre entreprise a été validée par ALLNEEDS.' }
  if (invitation.kind === 'concierge') return { subject: 'Votre accès Concierge ALLNEEDS', intro: 'Votre compte Concierge ALLNEEDS est prêt.' }
  if (invitation.kind === 'crm') return { subject: 'Votre accès au CRM ALLNEEDS', intro: 'Votre compte CRM ALLNEEDS est prêt.' }
  if (invitation.kind === 'sales') return { subject: 'Votre accès Présentation commerciale ALLNEEDS', intro: 'Votre accès à la présentation commerciale ALLNEEDS est prêt.' }
  return { subject: 'Invitation à rejoindre votre espace ALLNEEDS', intro: 'Vous avez été invité à rejoindre l’espace ALLNEEDS de votre entreprise.' }
}

async function sendSmtpMail({ to, subject, html }) {
  const host = process.env.EMAIL_HOST
  const port = Number(process.env.EMAIL_PORT || 587)
  const user = process.env.EMAIL_USER
  const pass = String(process.env.EMAIL_PASS || '').replace(/\s+/g, '')
  const from = process.env.EMAIL_FROM || user
  const fromName = process.env.EMAIL_FROM_NAME || 'ALLNEEDS'
  if (!host || !user || !pass || !from) throw new Error('SMTP non configuré')
  /* Neutralise toute injection d'en-tête SMTP (CRLF, chevrons) via l'adresse destinataire. */
  const recipient = String(to || '').replace(/[\r\n<>]/g, '').trim()
  if (!recipient || !recipient.includes('@')) throw new Error('destinataire e-mail invalide')

  let socket = net.createConnection({ host, port })
  socket.setTimeout(15000, () => socket.destroy(new Error('timeout SMTP')))
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject) })
  await smtpCommand(socket, null, 220)
  await smtpCommand(socket, 'EHLO allneeds.local', 250)
  if (port !== 465) {
    await smtpCommand(socket, 'STARTTLS', 220)
    socket = tls.connect({ socket, servername: host })
    await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject) })
    await smtpCommand(socket, 'EHLO allneeds.local', 250)
  }
  await smtpCommand(socket, 'AUTH LOGIN', 334)
  await smtpCommand(socket, Buffer.from(user).toString('base64'), 334)
  await smtpCommand(socket, Buffer.from(pass).toString('base64'), 235)
  await smtpCommand(socket, `MAIL FROM:<${from}>`, 250)
  await smtpCommand(socket, `RCPT TO:<${recipient}>`, [250,251])
  await smtpCommand(socket, 'DATA', 354)
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`
  const safeName = String(fromName).replace(/[\r\n\"]/g, '')
  const message = [
    `From: \"${safeName}\" <${from}>`, `To: <${recipient}>`, `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', html
  ].join('\r\n').replace(/(^|\r\n)\./g, '$1..') + '\r\n.\r\n'
  socket.write(message)
  const result = await smtpRead(socket)
  if (result.code !== 250) throw new Error(`SMTP ${result.code}: ${result.text.trim()}`)
  socket.write('QUIT\r\n'); socket.end()
}

async function sendInvitationEmail(invitation, token) {
  const baseUrl = process.env.ALLNEEDS_PUBLIC_URL || FRONTEND_ORIGIN
  const setupUrl = `${baseUrl.replace(/\/$/, '')}/creer-mot-de-passe?token=${encodeURIComponent(token)}`
  const { subject, intro } = invitationCopy(invitation)
  try {
    await sendSmtpMail({
      to: invitation.email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>ALLNEEDS</h2><p>Bonjour ${htmlEscape(invitation.name || '')},</p><p>${htmlEscape(intro)}</p><p>Créez maintenant votre mot de passe personnel :</p><p><a href="${setupUrl}" style="display:inline-block;padding:12px 18px;background:#087bfa;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Créer mon mot de passe</a></p><p style="color:#64748b;font-size:13px">Ce lien expire dans 48 heures et ne peut être utilisé qu’une seule fois.</p></div>`
    })
    invitation.lastEmailAt = new Date().toISOString(); invitation.lastEmailStatus = 'sent'; saveDb(db)
    return { sent: true, setupUrl }
  } catch (error) {
    invitation.lastEmailAt = new Date().toISOString(); invitation.lastEmailStatus = 'failed'; invitation.lastEmailError = error instanceof Error ? error.message : String(error); saveDb(db)
    console.error('EMAIL ERROR:', invitation.lastEmailError)
    return { sent: false, setupUrl, reason: 'email_echec', error: invitation.lastEmailError }
  }
}

/* ------------------------------------------------------------------ */
/* Notifications persistées (v46_notifications)                        */
/* ------------------------------------------------------------------ */
function makeNotification({ userId, orgId = null, type, title, message, meta = {} }) {
  return { id: `ntf-${randomBytes(10).toString('hex')}`, userId: userId || null, orgId: orgId || null, type, title, message, meta: meta || {}, readAt: null, createdAt: new Date().toISOString() }
}
function pushNotification(payload) { const notification = makeNotification(payload); db.notifications.push(notification); return notification }
function notifyAdmins({ type, title, message, meta = {} }) {
  return db.users.filter((user) => user.role === 'admin' && user.active !== false).map((admin) => pushNotification({ userId: admin.id, orgId: null, type, title, message, meta }))
}
/** Concierge affecté à une entreprise (via l'inscription activée), ou null. */
function conciergeForOrg(orgId) {
  if (!orgId) return null
  const reg = db.registrations.find((item) => item.orgId === orgId && item.conciergeId)
  if (!reg) return null
  return db.users.find((user) => user.id === reg.conciergeId && user.role === 'concierge' && user.active !== false) || null
}
/** Notifie le concierge affecté à l'org ; à défaut, les administrateurs. */
function notifyOrgConcierge(orgId, { type, title, message, meta = {} }) {
  const concierge = conciergeForOrg(orgId)
  if (concierge) return [pushNotification({ userId: concierge.id, orgId, type, title, message, meta })]
  return notifyAdmins({ type, title, message, meta })
}

/** Destinataires « client » d'une organisation (dirigeant / manager actifs). */
function clientRecipientsForOrg(orgId) {
  if (!orgId) return []
  return db.users.filter((u) => u.active !== false && CLIENT_ROLES.has(u.role) && Array.isArray(u.orgIds) && u.orgIds.includes(orgId))
}

/** Notification persistée aux clients quand la restitution est publiée. */
function notifyRestitutionPublished(diagnostic, orgName) {
  const label = orgName || 'votre établissement'
  return clientRecipientsForOrg(diagnostic.orgId).map((u) =>
    pushNotification({
      userId: u.id,
      orgId: diagnostic.orgId,
      type: 'diagnostic_publie',
      title: 'Votre restitution ALLNEEDS est disponible',
      message: `Le diagnostic de ${label} a été analysé. Votre restitution est maintenant disponible.`,
      meta: { diagnosticId: diagnostic.id, publishedAt: diagnostic.publishedAt || null, link: '/app/diagnostics' },
    }),
  )
}

function restitutionPublishedHtml(orgName) {
  const baseUrl = (process.env.ALLNEEDS_PUBLIC_URL || FRONTEND_ORIGIN).replace(/\/$/, '')
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>ALLNEEDS</h2><p>Bonjour,</p><p>La restitution du diagnostic de <strong>${htmlEscape(orgName || 'votre établissement')}</strong> est désormais disponible dans votre espace client.</p><p>Vous y retrouverez vos priorités, vos points forts, les points à améliorer, vos risques et opportunités, ainsi qu’un plan d’action.</p><p><a href="${baseUrl}/app/diagnostics" style="display:inline-block;padding:12px 18px;background:#087bfa;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Consulter ma restitution</a></p><p style="color:#64748b;font-size:13px">Cette restitution a été validée par votre concierge ALLNEEDS.</p></div>`
}

/** Email transactionnel aux clients après publication (échec non bloquant). */
async function sendRestitutionPublishedEmails(diagnostic, orgName) {
  const recipients = clientRecipientsForOrg(diagnostic.orgId).filter((u) => Boolean(u.email))
  for (const user of recipients) {
    try {
      await sendSmtpMail({ to: user.email, subject: 'Votre restitution ALLNEEDS est disponible', html: restitutionPublishedHtml(orgName) })
    } catch (error) {
      console.error('EMAIL ERROR (restitution published):', error instanceof Error ? error.message : String(error))
    }
  }
}

/* ------------------------------------------------------------------ */
/* PHASE 6 — Notifications & emails Abonnements Besoins                */
/* ------------------------------------------------------------------ */
function notifyNeedsSubscriptionActivated(subscription, org) {
  const summary = needsSubscriptionSummary(subscription)
  const label = summary?.planName || subscription.planCode
  const clientNotifs = clientRecipientsForOrg(org.id).map((u) => pushNotification({
    userId: u.id, orgId: org.id, type: 'needs_subscription_activated',
    title: 'Votre abonnement Besoins est actif',
    message: `Formule ${label} : ${summary.monthlyLimit} besoins/mois, jusqu’à ${summary.proposalsLimit} propositions.`,
    meta: { subscriptionId: subscription.id, planCode: summary.planCode, monthlyLimit: summary.monthlyLimit, proposalsLimit: summary.proposalsLimit, link: '/app/besoins' },
  }))
  const staffNotifs = notifyOrgConcierge(org.id, {
    type: 'needs_subscription_activated',
    title: 'Abonnement Besoins activé',
    message: `${org.name} a activé la formule ${label} (${summary.price} MAD/mois).`,
    meta: { subscriptionId: subscription.id, planCode: summary.planCode, orgId: org.id, price: summary.price },
  })
  return [...clientNotifs, ...staffNotifs]
}

function needsActivatedHtml(orgName, summary) {
  const baseUrl = (process.env.ALLNEEDS_PUBLIC_URL || FRONTEND_ORIGIN).replace(/\/$/, '')
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>ALLNEEDS</h2><p>Bonjour,</p><p>Votre abonnement Besoins <strong>${htmlEscape(summary.planName)}</strong> pour <strong>${htmlEscape(orgName || 'votre entreprise')}</strong> est actif.</p><p>Besoins par mois : ${summary.monthlyLimit} · Propositions par besoin : ${summary.proposalsLimit} · Délai cible : ${summary.targetDelayHours} h.</p><p><a href="${baseUrl}/app/besoins" style="display:inline-block;padding:12px 18px;background:#087bfa;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Déposer un besoin</a></p><p style="color:#64748b;font-size:13px">Le paiement en ligne sera connecté en production. L’activation ici est fonctionnelle, sans débit.</p></div>`
}

/** Email aux clients après activation (échec non bloquant). */
async function sendNeedsActivatedEmails(org, subscription) {
  const summary = needsSubscriptionSummary(subscription)
  if (!summary) return
  for (const user of clientRecipientsForOrg(org.id).filter((u) => Boolean(u.email))) {
    try { await sendSmtpMail({ to: user.email, subject: `Abonnement Besoins ${summary.planName} actif`, html: needsActivatedHtml(org.name, summary) }) }
    catch (error) { console.error('EMAIL ERROR (needs subscription):', error instanceof Error ? error.message : String(error)) }
  }
}

/* ------------------------------------------------------------------ */
/* Registrations : emails, événements, helpers de parcours            */
/* ------------------------------------------------------------------ */
function pushRegistrationEvent(reg, type, { byUserId = null, note = '' } = {}) {
  if (!Array.isArray(reg.events)) reg.events = []
  const event = { id: `evt-${randomBytes(8).toString('hex')}`, type, at: new Date().toISOString(), byUserId: byUserId || null, note: String(note || '').slice(0, 1000) }
  reg.events.push(event)
  return event
}

function registrationAckHtml(reg) {
  const sectorLabel = { sante: 'Santé', enseignement: 'Enseignement', tourisme: 'Tourisme' }[reg.sector] || reg.sector || ''
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>ALLNEEDS</h2><p>Bonjour ${htmlEscape(reg.name || '')},</p><p>Nous avons bien reçu votre demande pour <strong>${htmlEscape(reg.orgName || '')}</strong>.</p><ul><li>Secteur : ${htmlEscape(sectorLabel)}</li><li>Créneau demandé : ${htmlEscape(reg.appointmentDate || '—')} ${htmlEscape(reg.appointmentSlot || '')}</li><li>Contact : ${htmlEscape(reg.name || '')} · ${htmlEscape(reg.phone || '')}</li></ul><p>Un concierge ALLNEEDS va être affecté à votre dossier et prendra contact avec vous pour confirmer le créneau.</p><p><strong>Prochaine étape :</strong> dès l’affectation de votre concierge, vous recevrez un e-mail contenant un lien personnel pour créer votre mot de passe et activer votre compte.</p><p style="color:#64748b;font-size:13px">Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.</p></div>`
}

async function sendRegistrationAckEmail(reg) {
  try {
    await sendSmtpMail({ to: reg.email, subject: 'Votre demande ALLNEEDS a bien été reçue', html: registrationAckHtml(reg) })
    reg.ackEmailAt = new Date().toISOString(); reg.ackEmailStatus = 'sent'
    return { sent: true }
  } catch (error) {
    reg.ackEmailAt = new Date().toISOString(); reg.ackEmailStatus = 'failed'; reg.ackEmailError = error instanceof Error ? error.message : String(error)
    console.error('EMAIL ERROR (registration ack):', reg.ackEmailError)
    return { sent: false, reason: 'email_echec', error: reg.ackEmailError }
  }
}

function organizationSlug(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `client-${Date.now()}`
}

function ensureOrgForRegistration(reg) {
  let org = reg.orgId ? db.orgs.find((item) => item.id === reg.orgId) : null
  if (org) return org
  org = { id: `org-${randomBytes(8).toString('hex')}`, name: reg.orgName, sector: reg.sector, active: true, modules: { ...ORGANIZATION_DEFAULT_MODULES }, saas: { ...DEFAULT_SAAS }, slug: organizationSlug(reg.orgName), city: reg.city || '', contactName: reg.name || '', contactRole: reg.workspaceProfile || '', contactEmail: reg.email || '', contactPhone: reg.phone || '' }
  db.orgs.push(org)
  reg.orgId = org.id
  return org
}

const OWNER_PERMISSIONS = ['actions', 'missions', 'documents', 'messages', 'results', 'team']

async function issueOwnerInvitation(reg, org, createdBy) {
  const existing = db.users.find((user) => user.email?.toLowerCase() === reg.email)
  if (existing && existing.passwordConfigured && existing.orgIds?.includes(org.id)) return { alreadyActive: true, delivery: null }
  const { invitation, token } = createInvitation({ orgId: org.id, email: reg.email, name: reg.name, role: 'dirigeant', permissions: OWNER_PERMISSIONS, createdBy, kind: 'owner' })
  const delivery = await sendInvitationEmail(invitation, token)
  return { invitation, delivery }
}

function adminOnly(user, res, cors) { if (user?.role === 'admin') return true; json(res, 403, { error: 'administrateur requis' }, cors); return false }
function ownerOnly(user, res, cors) { if (user?.role === 'dirigeant') return true; json(res, 403, { error: 'dirigeant requis' }, cors); return false }
function normalizePermissions(value) { const allowed = new Set(['actions','missions','documents','messages','results','team']); return Array.isArray(value) ? [...new Set(value.filter((x) => allowed.has(x)))] : [] }

function canCreateNeed(user) { return OPERATIONS_ROLES.has(user?.role) || ['dirigeant', 'manager'].includes(user?.role) }
function canUpdateNeed(user) { return OPERATIONS_ROLES.has(user?.role) || ['dirigeant', 'manager'].includes(user?.role) }

function scopedNeeds(user) {
  return db.needs.filter((need) => canAccessOrg(user, need.orgId))
}

async function hashPassword(password) { const salt = randomBytes(16).toString('hex'); return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('hex')}` }
const crm = createCrm({ db, saveDb, json, readBody, audit, hashPassword, createInvitation, sendInvitationEmail, pushNotification })

const failures = new Map()
function loginThrottled(key) {
  const now = Date.now()
  const recent = (failures.get(key) ?? []).filter((time) => now - time < 15 * 60 * 1000)
  failures.set(key, recent)
  return recent.length >= 8
}
function markLoginFailure(key) {
  failures.set(key, [...(failures.get(key) ?? []), Date.now()])
}
function clearLoginFailures(key) { failures.delete(key) }

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const startedAt = Date.now()
  res.on('finish', () => console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now()-startedAt}ms`))
  try {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin
      if (!isAllowedOrigin(origin)) return json(res, 403, { error: 'origine refusée' })
      res.writeHead(204, {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '600',
        vary: 'Origin',
      })
      return res.end()
    }

    const cors = isAllowedOrigin(req.headers.origin) ? { 'access-control-allow-origin': req.headers.origin, 'access-control-allow-credentials': 'true', vary: 'Origin' } : {}
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true }, cors)

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!requireSameOrigin(req, res)) return
      const body = await readBody(req)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const key = `${req.socket.remoteAddress ?? 'unknown'}:${email}`
      if (loginThrottled(key)) return json(res, 429, { error: 'trop de tentatives, réessayez dans 15 minutes' }, cors)
      const user = db.users.find((item) => item.email?.toLowerCase() === email && item.active !== false)
      let valid = false
      if (user?.passwordHash && password.length <= 1024) {
        const [scheme, salt, stored] = user.passwordHash.split('$')
        if (scheme === 'scrypt' && salt && stored) {
          const candidate = await scrypt(password, salt, 64)
          const expected = Buffer.from(stored, 'hex')
          valid = candidate.length === expected.length && timingSafeEqual(candidate, expected)
        }
      }
      if (valid) { const failure = accessFailure(user); if (failure) return json(res, 403, { error: failure, code: 'ACCOUNT_DISABLED' }, cors) }
      if (!valid) {
        markLoginFailure(key)
        audit('auth.login.denied', { email: email.slice(0, 160), ip: req.socket.remoteAddress ?? 'unknown' })
        return json(res, 401, { error: 'adresse e-mail ou mot de passe incorrect' }, cors)
      }
      if (user.status === 'suspended' || user.status === 'inactive') { audit('auth.login.denied', { email: email.slice(0, 160), reason: user.status }); return json(res, 403, { error: 'compte désactivé', code: 'ACCOUNT_DISABLED' }, cors) }
      clearLoginFailures(key)
      user.lastLoginAt = new Date().toISOString(); saveDb(db)
      audit('auth.login.ok', { by: user.id })
      const org = orgForUser(user); return json(res, 200, { user: { ...safeUser(user), organization: org ? { id: org.id, name: org.name, slug: org.slug, sector: org.sector, active: org.active, modules: org.modules, saas: org.saas, city: org.city || '', kind: org.kind || '', size: org.size || '', contactName: org.contactName || '', contactRole: org.contactRole || '', contactEmail: org.contactEmail || '', contactPhone: org.contactPhone || '' } : null } }, { ...cors, 'set-cookie': cookie(issueSession(user), SESSION_TTL_SECONDS) })
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      if (!requireSameOrigin(req, res)) return
      const user = sessionUser(req)
      if (user) audit('auth.logout', { by: user.id })
      return json(res, 200, { ok: true }, { ...cors, 'set-cookie': cookie('', 0) })
    }

    if (req.method === 'POST' && url.pathname === '/api/registrations') {
      if (!requireSameOrigin(req, res)) return
      const body = await readBody(req)
      const email = allowedText(body.email, 200, 'e-mail').toLowerCase()
      if (!email.includes('@')) return json(res, 400, { error: 'e-mail invalide' }, cors)
      if (db.users.some((u) => u.email?.toLowerCase() === email) || db.registrations.some((r) => r.email === email && r.status !== 'refusee')) return json(res, 409, { error: 'une demande existe déjà pour cet e-mail' }, cors)
      const sector = allowedText(body.sector, 40, 'secteur')
      if (!['sante','enseignement','tourisme'].includes(sector)) return json(res, 400, { error: 'secteur invalide' }, cors)
      const appointmentDate = String(body.appointmentDate || '').slice(0,40)
      const appointmentSlot = String(body.appointmentSlot || '').slice(0,80)
      if (!appointmentDate || !appointmentSlot) return json(res, 400, { error: 'créneau (date et heure) requis' }, cors)
      const now = new Date().toISOString()
      const record = { id: `reg-${randomBytes(10).toString('hex')}`, orgName: allowedText(body.orgName, 180, 'établissement'), name: allowedText(body.name, 160, 'contact'), email, phone: String(body.phone || '').slice(0,60), sector, city: String(body.city || '').slice(0,120), workspaceProfile: String(body.workspaceProfile || '').slice(0,120), appointmentDate, appointmentSlot, appointmentStatus: 'demande', status: 'demande_recue', conciergeId: null, events: [{ id: `evt-${randomBytes(8).toString('hex')}`, type: 'inscription_recue', at: now, byUserId: null, note: '' }], createdAt: now, approvedAt: null, assignedAt: null, activatedAt: null, orgId: null, userId: null, ackEmailAt: null, ackEmailStatus: null }
      db.registrations.push(record)
      audit('registration.create', { id: record.id, email: record.email })
      notifyAdmins({ type: 'inscription_nouvelle', title: 'Nouvelle inscription à traiter', message: `${record.orgName} · ${record.name} · ${record.sector} · créneau ${appointmentDate} ${appointmentSlot}.`, meta: { registrationId: record.id } })
      const delivery = await sendRegistrationAckEmail(record)
      saveDb(db)
      return json(res, 201, { id: record.id, status: record.status, delivery }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/invitation') {
      const token = url.searchParams.get('token') || ''
      const inv = db.invitations.find((item) => item.tokenHash === hashInvitationToken(token) && !item.usedAt && !item.revokedAt)
      if (!inv || Date.parse(inv.expiresAt) <= Date.now()) return json(res, 404, { error: 'lien invalide ou expiré' }, cors)
      const org = db.orgs.find((o) => o.id === inv.orgId)
      return json(res, 200, { email: inv.email, name: inv.name, organization: STAFF_INVITATION_KINDS.has(inv.kind) ? 'ALLNEEDS' : (org?.name || ''), role: inv.role, kind: inv.kind, expiresAt: inv.expiresAt }, cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/setup-password') {
      if (!requireSameOrigin(req, res)) return
      const body = await readBody(req); const token = String(body.token || ''); const password = String(body.password || '')
      if (password.length < 12 || password.length > 1024) return json(res, 400, { error: 'le mot de passe doit contenir au moins 12 caractères' }, cors)
      const inv = db.invitations.find((item) => item.tokenHash === hashInvitationToken(token) && !item.usedAt && !item.revokedAt)
      if (!inv || Date.parse(inv.expiresAt) <= Date.now()) return json(res, 404, { error: 'lien invalide ou expiré' }, cors)
      const org = inv.orgId ? db.orgs.find((o) => o.id === inv.orgId) : null
      if (!STAFF_INVITATION_KINDS.has(inv.kind) && (!org || org.active === false)) return json(res, 403, { error: 'compte entreprise désactivé' }, cors)
      let user = db.users.find((u) => u.email?.toLowerCase() === inv.email)
      if (user && inv.orgId && Array.isArray(user.orgIds) && user.orgIds.length && !user.orgIds.includes(inv.orgId)) return json(res, 409, { error: 'cet e-mail appartient déjà à un autre compte' }, cors)
      const salt = randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64)
      if (!user) { user = { id: `usr-${randomBytes(10).toString('hex')}`, email: inv.email, role: inv.role, orgIds: inv.kind === 'concierge' ? (inv.metadata?.assignedOrgIds || []) : inv.kind === 'sales' || inv.kind === 'crm' ? [] : [inv.orgId], sectors: inv.metadata?.sectors || [], name: inv.name, active: true, passwordHash: null, passwordConfigured: false, permissions: inv.permissions }; db.users.push(user) }
      if (inv.kind === 'crm' && (user.status === 'suspended' || user.status === 'inactive')) return json(res, 403, { error: 'compte CRM désactivé' }, cors)
      user.passwordHash = `scrypt$${salt}$${hash.toString('hex')}`; user.passwordConfigured = true; if (inv.kind !== 'crm') { user.active = true; user.role = inv.role; user.permissions = inv.permissions }; if (inv.kind === 'concierge') { user.sectors = inv.metadata?.sectors || user.sectors || []; user.orgIds = inv.metadata?.assignedOrgIds || user.orgIds || [] } ; if (inv.kind === 'sales') user.orgIds = [] ; inv.usedAt = new Date().toISOString()
      if (inv.kind === 'owner' && inv.orgId) {
        const reg = db.registrations.find((r) => r.orgId === inv.orgId && r.email?.toLowerCase() === inv.email.toLowerCase())
        if (reg) { reg.status = 'actif'; reg.activatedAt = new Date().toISOString(); reg.userId = user.id; pushRegistrationEvent(reg, 'compte_active', { byUserId: user.id }) }
        pushNotification({ userId: user.id, orgId: inv.orgId, type: 'bienvenue', title: 'Bienvenue sur ALLNEEDS', message: 'Votre compte est actif. Vous pouvez désormais démarrer votre diagnostic depuis votre espace.' })
      }
      saveDb(db); audit('auth.password.setup', { by: user.id, org: inv.orgId, kind: inv.kind })
      return json(res, 200, { ok: true, user: safeUser(user) }, cors)
    }

    const publicOrgRoute = url.pathname.match(/^\/api\/organizations\/by-slug\/([^/]+)$/)
    if (publicOrgRoute && req.method === 'GET') {
      const slug = decodeURIComponent(publicOrgRoute[1]).toLowerCase()
      const org = db.orgs.find((item) => item.slug === slug)
      if (!org) return json(res, 404, { error: 'entreprise introuvable' }, cors)
      return json(res, 200, { id: org.id, name: org.name, sector: org.sector, slug: org.slug, active: org.active !== false }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      const user = sessionUser(req)
      if (!user) return json(res, 401, { error: 'non authentifié' }, cors)
      const org = orgForUser(user)
      // Session glissante : chaque visite repousse l'expiration, l'utilisateur actif reste connecté.
      return json(res, 200, { ...safeUser(user), organization: org ? { id: org.id, name: org.name, slug: org.slug, sector: org.sector, active: org.active, modules: org.modules, saas: org.saas, city: org.city || '', kind: org.kind || '', size: org.size || '', contactName: org.contactName || '', contactRole: org.contactRole || '', contactEmail: org.contactEmail || '', contactPhone: org.contactPhone || '' } : null }, { ...cors, 'set-cookie': cookie(issueSession(user), SESSION_TTL_SECONDS) })
    }

    /* ------------------------------------------------------------------ */
    /* PATCH /api/me/profile — modification des informations personnelles */
    /* ------------------------------------------------------------------ */
    if (req.method === 'PATCH' && url.pathname === '/api/me/profile') {
      const user = sessionUser(req)
      if (!user) return json(res, 401, { error: 'non authentifié' }, cors)
      if (!requireSameOrigin(req, res)) return
      // Compte commercial partagé : profil verrouillé.
      if (user.role === SALES_ROLE) return json(res, 403, { error: 'profil non modifiable pour un compte commercial' }, cors)
      const body = await readBody(req)
      const allowed = ['name', 'firstName', 'lastName', 'phone', 'jobTitle']
      const changes = {}
      for (const key of allowed) {
        if (key in body && body[key] !== undefined) {
          const value = String(body[key]).trim()
          if (key === 'phone' && value && !/^[+0-9\s\-()]{3,30}$/.test(value)) {
            return json(res, 400, { error: `champ ${key} invalide` }, cors)
          }
          if (value.length > 200) return json(res, 400, { error: `champ ${key} trop long` }, cors)
          changes[key] = value
        }
      }
      if (Object.keys(changes).length === 0) return json(res, 400, { error: 'aucun champ à modifier' }, cors)

      const target = db.users.find((item) => item.id === user.id)
      if (!target) return json(res, 404, { error: 'utilisateur introuvable' }, cors)
      Object.assign(target, changes)
      saveDb(db)
      audit('user.profile.update', { by: user.id, changes })
      return json(res, 200, { ok: true, user: safeUser(target) }, cors)
    }

    const user = sessionUser(req)
    if (!user) return json(res, 401, { error: 'non authentifié' }, cors)
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && url.pathname.startsWith('/api/') && !requireSameOrigin(req, res)) return
    // Un compte commercial n'accède qu'à la présentation : tout le reste est refusé côté serveur.
    if (user.role === SALES_ROLE && !SALES_ALLOWED_API.some((pattern) => pattern.test(url.pathname))) return json(res, 403, { error: 'accès réservé à la présentation commerciale' }, cors)
    // Un agent CRM n'accède qu'aux routes du CRM, filtrées par ses permissions et son périmètre.
    if (user.role === 'agent' && !url.pathname.startsWith('/api/crm/')) return json(res, 403, { error: 'accès réservé au CRM' }, cors)
    if (await crm.handle(req, res, url, user, cors)) return

    if (req.method === 'GET' && url.pathname === '/api/sales/presentation') {
      if (!canAccessSalesPresentation(user)) return json(res, 403, { error: 'présentation commerciale réservée aux administrateurs et aux commerciaux' }, cors)
      return json(res, 200, SALES_PRESENTATION, cors)
    }

    /* Gestion des accès commerciaux (administrateur uniquement). */
    if (req.method === 'GET' && url.pathname === '/api/admin/sales-access') {
      if (!adminOnly(user, res, cors)) return
      const salesView = (u) => ({ id: u.id, email: u.email, name: u.name || '', role: u.role, active: u.active !== false, passwordConfigured: u.passwordConfigured === true, salesAccess: canAccessSalesPresentation(u) })
      const accounts = db.users.filter((u) => u.role === SALES_ROLE).map(salesView)
      const concierges = db.users.filter((u) => u.role === 'concierge').map(salesView)
      const pending = db.invitations.filter((i) => i.kind === 'sales' && !i.usedAt && !i.revokedAt && Date.parse(i.expiresAt) > Date.now()).map(({ tokenHash: _t, ...i }) => i)
      return json(res, 200, { accounts, concierges, pending }, cors)
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/sales-access/invite') {
      if (!adminOnly(user, res, cors)) return
      const body = await readBody(req)
      const email = allowedText(body.email, 200, 'e-mail').toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'e-mail invalide' }, cors)
      if (db.users.some((u) => u.email?.toLowerCase() === email)) return json(res, 409, { error: 'cet e-mail possède déjà un compte' }, cors)
      for (const old of db.invitations) if (old.kind === 'sales' && old.email === email && !old.usedAt && !old.revokedAt) old.revokedAt = new Date().toISOString()
      const { invitation, token } = createInvitation({ email, name: allowedText(body.name, 160, 'nom'), role: SALES_ROLE, permissions: [], createdBy: user.id, kind: 'sales' })
      const delivery = await sendInvitationEmail(invitation, token)
      audit('sales.invite', { by: user.id, email })
      const { tokenHash: _t, ...publicInvitation } = invitation
      return json(res, 201, { invitation: publicInvitation, delivery }, cors)
    }
    const salesAccessRoute = url.pathname.match(/^\/api\/admin\/sales-access\/([^/]+)$/)
    if (salesAccessRoute && req.method === 'PATCH') {
      if (!adminOnly(user, res, cors)) return
      const member = db.users.find((u) => u.id === salesAccessRoute[1])
      if (!member) return json(res, 404, { error: 'utilisateur introuvable' }, cors)
      const body = await readBody(req)
      if (typeof body.enabled !== 'boolean') return json(res, 400, { error: 'champ enabled requis' }, cors)
      if (member.role === SALES_ROLE) member.active = body.enabled
      else if (member.role === 'concierge') {
        const others = (member.permissions || []).filter((p) => p !== SALES_PERMISSION)
        member.permissions = body.enabled ? [...others, SALES_PERMISSION] : others
      } else return json(res, 400, { error: 'seuls les comptes commerciaux et les concierges peuvent recevoir cet accès' }, cors)
      saveDb(db)
      audit('sales.access.update', { by: user.id, member: member.id, enabled: body.enabled })
      return json(res, 200, { id: member.id, active: member.active !== false, salesAccess: canAccessSalesPresentation(member) }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/notifications') {
      const rows = db.notifications.filter((n) => n.userId === user.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      return json(res, 200, rows, cors)
    }
    const notificationReadRoute = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)
    if (notificationReadRoute && req.method === 'POST') {
      const notification = db.notifications.find((n) => n.id === notificationReadRoute[1] && n.userId === user.id)
      if (!notification) return json(res, 404, { error: 'notification introuvable' }, cors)
      notification.readAt = new Date().toISOString(); saveDb(db)
      return json(res, 200, notification, cors)
    }
    if (req.method === 'POST' && url.pathname === '/api/notifications/read-all') {
      const now = new Date().toISOString(); let count = 0
      for (const notification of db.notifications) if (notification.userId === user.id && !notification.readAt) { notification.readAt = now; count++ }
      saveDb(db); return json(res, 200, { ok: true, count }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/me/diagnostic-status') {
      const requestedOrg = url.searchParams.get('orgId')
      let org = orgForUser(user)
      if (requestedOrg) {
        if (!canAccessOrg(user, requestedOrg)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
        org = db.orgs.find((o) => o.id === requestedOrg) || null
      }
      if (!org) return json(res, 200, { orgId: null, completed: false, status: null, diagnosticId: null, createdAt: null, restoredAt: null, publishedAt: null, restitutionPublished: false, hasRestitution: false, submittedAt: null, isSubmitted: false }, cors)
      const matches = db.diagnostics
        .filter((d) => d.orgId === org.id && DIAGNOSTIC_ACTIVE_STATUSES.includes(d.status))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      const primary = matches[0] || null
      const restitutionPublished = Boolean(primary && canClientViewRestitution(primary))
      const isSubmitted = Boolean(primary && ['soumis', 'analyse', 'en_analyse', 'pret_a_valider', 'restitue'].includes(primary.status || ''))
      return json(res, 200, {
        orgId: org.id,
        completed: Boolean(primary),
        status: primary?.status || null,
        diagnosticId: primary?.id || null,
        createdAt: primary?.createdAt || null,
        restoredAt: primary?.restoredAt || null,
        publishedAt: restitutionPublished ? (primary?.publishedAt || null) : null,
        restitutionPublished,
        hasRestitution: restitutionPublished,
        submittedAt: primary?.createdAt || null,
        isSubmitted,
      }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/concierge/orgs') {
      if (user.role !== 'concierge') return json(res,403,{error:'concierge requis'},cors)
      const allowedIds = Array.isArray(user.orgIds) ? user.orgIds : []
      const rows = db.orgs.filter((org)=>allowedIds.includes(org.id) && org.active!==false && (!Array.isArray(user.sectors)||!user.sectors.length||user.sectors.includes(org.sector))).map((org)=>{
        const diagnostic = db.diagnostics.filter((item)=>item.orgId===org.id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0] || null
        const owner = db.users.find((item)=>CLIENT_ROLES.has(item.role)&&item.orgIds?.includes(org.id))
        const offer = db.offers.filter((item)=>item.orgId===org.id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0] || null
        return { id:org.id,name:org.name,sector:org.sector,slug:org.slug,active:org.active!==false,modules:{...DEFAULT_MODULES,...(org.modules||{})},saas:{...DEFAULT_SAAS,...(org.saas||{})},city:org.city||'',contactName:org.contactName||owner?.name||'',contactRole:org.contactRole||'',contactEmail:org.contactEmail||owner?.email||'',contactPhone:org.contactPhone||'',diagnosticStatus:diagnostic?.status||null,restitutionPublished:Boolean(diagnostic&&canClientViewRestitution(diagnostic)),offerStatus:offer?.status||null,missionsCount:db.missions.filter((item)=>item.orgId===org.id).length,needsCount:db.needs.filter((item)=>item.orgId===org.id).length }
      })
      return json(res,200,rows,cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/concierge/orgs') {
      if (user.role !== 'concierge') return json(res,403,{error:'concierge requis'},cors)
      const body = await readBody(req)
      const name = allowedText(body.name,180,'nom de l’entreprise')
      const sector = String(body.sector || '')
      if (!['sante','enseignement','tourisme'].includes(sector)) return json(res,400,{error:'secteur invalide'},cors)
      if (Array.isArray(user.sectors) && user.sectors.length && !user.sectors.includes(sector)) return json(res,403,{error:'secteur hors de votre périmètre'},cors)
      const baseSlug = organizationSlug(name)
      const slug = db.orgs.some((item) => item.slug === baseSlug) ? `${baseSlug}-${randomBytes(3).toString('hex')}` : baseSlug
      const org = {
        id: `org-${randomBytes(8).toString('hex')}`,
        name,
        sector,
        active: true,
        modules: { ...ORGANIZATION_DEFAULT_MODULES },
        saas: { ...DEFAULT_SAAS },
        slug,
        city: String(body.city || '').trim().slice(0,120),
        kind: String(body.kind || '').trim().slice(0,120),
        size: String(body.size || '').trim().slice(0,120),
        contactName: String(body.contactName || '').trim().slice(0,160),
        contactRole: String(body.contactRole || '').trim().slice(0,120),
        contactEmail: String(body.contactEmail || '').trim().toLowerCase().slice(0,200),
        contactPhone: String(body.contactPhone || '').trim().slice(0,60),
        createdAt: new Date().toISOString(),
      }
      db.orgs.push(org)
      user.orgIds = [...new Set([...(user.orgIds || []), org.id])]
      saveDb(db)
      audit('concierge.org.create',{by:user.id,org:org.id,sector:org.sector})
      return json(res,201,org,cors)
    }

    const conciergeOrgDataRoute = url.pathname.match(/^\/api\/concierge\/orgs\/([^/]+)\/data$/)
    if (conciergeOrgDataRoute && req.method === 'GET') {
      if (user.role !== 'concierge') return json(res,403,{error:'concierge requis'},cors)
      const orgId=conciergeOrgDataRoute[1]
      if (!canAccessOrg(user,orgId)) return json(res,403,{error:'entreprise hors de votre périmètre'},cors)
      const org=db.orgs.find((o)=>o.id===orgId)
      if(!org||org.active===false)return json(res,404,{error:'entreprise introuvable ou inactive'},cors)
      const collections={}
      for(const name of ['needs','diagnostics','missions','offers','documents','messages','meetings','quotes','notifications']) collections[name]=(db[name]||[]).filter((item)=>item.orgId===orgId)
      const registration=db.registrations.filter((r)=>r.orgId===orgId).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0]||null
      return json(res,200,{org:{id:org.id,name:org.name,sector:org.sector,city:org.city||'',contactName:org.contactName||'',contactRole:org.contactRole||'',contactEmail:org.contactEmail||'',contactPhone:org.contactPhone||''},registration,collections},cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/concierge/registrations') {
      if (user.role !== 'concierge') return json(res,403,{error:'concierge requis'},cors)
      const rows=db.registrations.filter((reg)=>reg.orgId&&canAccessOrg(user,reg.orgId)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
      return json(res,200,rows,cors)
    }

    const conciergeRegistrationAction=url.pathname.match(/^\/api\/concierge\/registrations\/([^/]+)\/(call|validate-slot)$/)
    if (conciergeRegistrationAction && req.method === 'POST') {
      if (user.role !== 'concierge') return json(res,403,{error:'concierge requis'},cors)
      const reg=db.registrations.find((r)=>r.id===conciergeRegistrationAction[1]); if(!reg) return json(res,404,{error:'demande introuvable'},cors)
      if (!reg.orgId || !canAccessOrg(user,reg.orgId)) return json(res,403,{error:'entreprise hors de votre périmètre'},cors)
      const body=await readBody(req)
      const note=typeof body.note==='string'?body.note:''
      if (conciergeRegistrationAction[2]==='call') {
        pushRegistrationEvent(reg,'appel_effectue',{byUserId:user.id,note}); reg.callStatus='effectue'; reg.calledAt=new Date().toISOString()
      } else {
        pushRegistrationEvent(reg,'creneau_valide',{byUserId:user.id,note}); reg.appointmentStatus='valide'; reg.appointmentValidatedAt=new Date().toISOString()
        const owner=db.users.find((u)=>u.email?.toLowerCase()===reg.email&&u.orgIds?.includes(reg.orgId))
        if (owner) pushNotification({userId:owner.id,orgId:reg.orgId,type:'creneau_valide',title:'Votre créneau est confirmé',message:`Votre rendez-vous du ${reg.appointmentDate||''} ${reg.appointmentSlot||''} est confirmé par votre concierge.`})
      }
      saveDb(db); audit('registration.concierge.action',{by:user.id,id:reg.id,action:conciergeRegistrationAction[2]})
      return json(res,200,{registration:reg},cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/orgs') {
      if (!adminOnly(user, res, cors)) return
      const rows = db.orgs.map((org) => ({ ...org, modules: { ...DEFAULT_MODULES, ...(org.modules || {}) }, users: db.users.filter((u) => u.orgIds?.includes(org.id)).map(safeUser) }))
      return json(res, 200, rows, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/concierges') {
      if (!adminOnly(user,res,cors)) return
      const concierges = db.users.filter((u)=>u.role==='concierge').map(safeUser)
      const pending = db.invitations.filter((i)=>i.kind==='concierge'&&!i.usedAt&&!i.revokedAt&&Date.parse(i.expiresAt)>Date.now()).map(({tokenHash,...i})=>i)
      return json(res,200,{concierges,pending,orgs:db.orgs.map(({id,name,sector})=>({id,name,sector}))},cors)
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/concierges') {
      if (!adminOnly(user,res,cors)) return
      const body=await readBody(req); const email=allowedText(body.email,200,'e-mail').toLowerCase(); if(!email.includes('@'))return json(res,400,{error:'e-mail invalide'},cors)
      if(db.users.some((u)=>u.email?.toLowerCase()===email))return json(res,409,{error:'cet e-mail possède déjà un compte'},cors)
      const sectors=Array.isArray(body.sectors)?body.sectors.filter((x)=>['sante','enseignement','tourisme'].includes(x)):[]
      const assignedOrgIds=Array.isArray(body.assignedOrgIds)?body.assignedOrgIds.filter((id)=>db.orgs.some((o)=>o.id===id)):[]
      const {invitation,token}=createInvitation({email,name:allowedText(body.name,160,'nom'),role:'concierge',permissions:[],createdBy:user.id,kind:'concierge',metadata:{sectors,assignedOrgIds}})
      const delivery=await sendInvitationEmail(invitation,token); audit('concierge.invite',{by:user.id,email}); const {tokenHash,...publicInvitation}=invitation; return json(res,201,{invitation:publicInvitation,delivery},cors)
    }
    const conciergeUserRoute=url.pathname.match(/^\/api\/admin\/concierges\/([^/]+)$/)
    if(conciergeUserRoute&&req.method==='PATCH'){if(!adminOnly(user,res,cors))return;const member=db.users.find((u)=>u.id===conciergeUserRoute[1]&&u.role==='concierge');if(!member)return json(res,404,{error:'concierge introuvable'},cors);const body=await readBody(req);if(typeof body.active==='boolean')member.active=body.active;if(Array.isArray(body.sectors))member.sectors=body.sectors.filter((x)=>['sante','enseignement','tourisme'].includes(x));if(Array.isArray(body.orgIds))member.orgIds=body.orgIds.filter((id)=>db.orgs.some((o)=>o.id===id));saveDb(db);audit('concierge.update',{by:user.id,member:member.id});return json(res,200,safeUser(member),cors)}

    if (req.method === 'GET' && url.pathname === '/api/admin/registrations') {
      if (!adminOnly(user, res, cors)) return
      const rows = db.registrations.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((reg) => {
        const concierge = reg.conciergeId ? db.users.find((u) => u.id === reg.conciergeId) : null
        return { ...reg, concierge: concierge ? safeUser(concierge) : null }
      })
      return json(res, 200, rows, cors)
    }

    const approveRegistration = url.pathname.match(/^\/api\/admin\/registrations\/([^/]+)\/approve$/)
    if (approveRegistration && req.method === 'POST') {
      if (!adminOnly(user, res, cors)) return
      const reg = db.registrations.find((r) => r.id === approveRegistration[1]); if (!reg) return json(res, 404, { error: 'demande introuvable' }, cors)
      if (reg.status === 'actif') return json(res, 409, { error: 'demande déjà activée' }, cors)
      const org = ensureOrgForRegistration(reg)
      const existing = db.users.find((u) => u.email?.toLowerCase() === reg.email); if (existing && !existing.orgIds?.includes(org.id)) return json(res, 409, { error: 'e-mail déjà utilisé' }, cors)
      const { delivery } = await issueOwnerInvitation(reg, org, user.id)
      reg.approvedAt = new Date().toISOString()
      reg.status = 'en_attente_activation'
      pushRegistrationEvent(reg, 'activation_demandee', { byUserId: user.id })
      saveDb(db); audit('registration.approve', { by: user.id, id: reg.id, org: org.id, emailSent: delivery?.sent })
      return json(res, 200, { registration: reg, organization: org, delivery }, cors)
    }

    const resendRegistration = url.pathname.match(/^\/api\/admin\/registrations\/([^/]+)\/resend$/)
    if (resendRegistration && req.method === 'POST') {
      if (!adminOnly(user, res, cors)) return
      const reg = db.registrations.find((r) => r.id === resendRegistration[1]); if (!reg || !reg.orgId) return json(res, 404, { error: 'demande introuvable ou non validée' }, cors)
      const org = db.orgs.find((o) => o.id === reg.orgId)
      if (!org) return json(res, 404, { error: 'entreprise introuvable' }, cors)
      const { delivery } = await issueOwnerInvitation(reg, org, user.id)
      if (reg.status !== 'actif') reg.status = 'en_attente_activation'
      saveDb(db); audit('registration.resend', { by: user.id, id: reg.id, emailSent: delivery?.sent }); return json(res, 200, { delivery }, cors)
    }

    const assignRegistration = url.pathname.match(/^\/api\/admin\/registrations\/([^/]+)\/assign$/)
    if (assignRegistration && req.method === 'POST') {
      if (!adminOnly(user, res, cors)) return
      const reg = db.registrations.find((r) => r.id === assignRegistration[1]); if (!reg) return json(res, 404, { error: 'demande introuvable' }, cors)
      const body = await readBody(req)
      const concierge = db.users.find((u) => u.id === body.conciergeId && u.role === 'concierge' && u.active !== false)
      if (!concierge) return json(res, 400, { error: 'concierge invalide' }, cors)
      const org = ensureOrgForRegistration(reg)
      if (reg.conciergeId && reg.conciergeId !== concierge.id) {
        const previous = db.users.find((u) => u.id === reg.conciergeId)
        if (previous) previous.orgIds = (previous.orgIds || []).filter((id) => id !== org.id)
      }
      concierge.orgIds = [...new Set([...(concierge.orgIds || []), org.id])]
      reg.conciergeId = concierge.id
      reg.assignedAt = new Date().toISOString()
      pushRegistrationEvent(reg, 'concierge_affecte', { byUserId: user.id, note: typeof body.note === 'string' ? body.note : '' })
      let delivery = null
      const ownerUser = db.users.find((u) => u.email?.toLowerCase() === reg.email)
      if (ownerUser?.passwordConfigured && ownerUser.orgIds?.includes(org.id)) {
        reg.status = 'actif'
      } else {
        const result = await issueOwnerInvitation(reg, org, user.id)
        delivery = result.delivery || null
        reg.status = delivery?.sent ? 'en_attente_activation' : 'concierge_affecte'
      }
      pushNotification({ userId: concierge.id, orgId: org.id, type: 'nouvelle_entreprise', title: 'Nouvelle entreprise attribuée', message: `${org.name} — ${reg.name} (${reg.sector}). Créneau demandé : ${reg.appointmentDate || '—'} ${reg.appointmentSlot || ''}.` })
      saveDb(db); audit('registration.assign', { by: user.id, id: reg.id, org: org.id, concierge: concierge.id, emailSent: delivery?.sent })
      return json(res, 200, { registration: reg, organization: org, concierge: safeUser(concierge), delivery }, cors)
    }

    const orgAccessRoute = url.pathname.match(/^\/api\/admin\/orgs\/([^/]+)\/access$/)
    if (orgAccessRoute && req.method === 'GET') { if (!adminOnly(user,res,cors)) return; const org=db.orgs.find((o)=>o.id===orgAccessRoute[1]); if(!org)return json(res,404,{error:'entreprise introuvable'},cors); return json(res,200,{id:org.id,name:org.name,slug:org.slug,active:org.active!==false,plan:org.plan||null,modules:{...DEFAULT_MODULES,...org.modules},saas:{...DEFAULT_SAAS,...(org.saas||{})}},cors) }
    if (orgAccessRoute && req.method === 'PATCH') {
      if (!adminOnly(user,res,cors)) return; const org=db.orgs.find((o)=>o.id===orgAccessRoute[1]); if(!org)return json(res,404,{error:'entreprise introuvable'},cors); const body=await readBody(req)
      org.saas = { ...DEFAULT_SAAS, ...(org.saas || {}) }
      if (typeof body.active === 'boolean') org.active=body.active
      if (ACCESS_PLANS.has(body.plan)) org.plan=body.plan
      else if (body.plan === null) org.plan=null
      if (body.modules && typeof body.modules === 'object' && !Array.isArray(body.modules)) for (const key of Object.keys(DEFAULT_MODULES)) if (typeof body.modules[key] === 'boolean') org.modules[key]=body.modules[key]
      if (body.saas && typeof body.saas === 'object' && !Array.isArray(body.saas)) {
        if (typeof body.saas.subscriptionActive === 'boolean') org.saas.subscriptionActive=body.saas.subscriptionActive
        if (typeof body.saas.enabled === 'boolean') org.saas.enabled=body.saas.enabled
        if ('startDate' in body.saas) org.saas.startDate=typeof body.saas.startDate === 'string' && body.saas.startDate ? body.saas.startDate : null
        if ('endDate' in body.saas) org.saas.endDate=typeof body.saas.endDate === 'string' && body.saas.endDate ? body.saas.endDate : null
        if ('plan' in body.saas) org.saas.plan=typeof body.saas.plan === 'string' && body.saas.plan ? body.saas.plan : null
      }
      saveDb(db); audit('org.access.update',{by:user.id,org:org.id,active:org.active,plan:org.plan||null,modules:org.modules,saas:org.saas}); return json(res,200,{id:org.id,active:org.active,plan:org.plan||null,modules:org.modules,saas:org.saas},cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/team') {
      if (!['dirigeant','manager'].includes(user.role)) return json(res,403,{error:'accès équipe non autorisé'},cors); const org=orgForUser(user); if(!org)return json(res,404,{error:'entreprise introuvable'},cors); if(!requireModuleAccess(user,res,cors,'equipe')) return
      const members=db.users.filter((u)=>u.id!==user.id&&u.orgIds?.includes(org.id)&&['manager','collaborateur'].includes(u.role)).map(safeUser); const pending=db.invitations.filter((i)=>i.orgId===org.id&&!i.usedAt&&!i.revokedAt&&Date.parse(i.expiresAt)>Date.now()).map(({tokenHash,...i})=>i); return json(res,200,{members,pending},cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/team/invitations') {
      if (!ownerOnly(user,res,cors)) return; const org=orgForUser(user); if(!org||org.active===false)return json(res,403,{error:'entreprise désactivée'},cors); const body=await readBody(req); const email=allowedText(body.email,200,'e-mail').toLowerCase(); if(!email.includes('@'))return json(res,400,{error:'e-mail invalide'},cors)
      if(db.users.some((u)=>u.email?.toLowerCase()===email))return json(res,409,{error:'cet e-mail possède déjà un compte'},cors); const role=['manager','collaborateur'].includes(body.role)?body.role:'collaborateur'; const permissions=normalizePermissions(body.permissions); const {invitation,token}=createInvitation({orgId:org.id,email,name:allowedText(body.name,160,'nom'),role,permissions,createdBy:user.id,kind:'team'}); const delivery=await sendInvitationEmail(invitation,token); audit('team.invite',{by:user.id,org:org.id,email}); const {tokenHash,...publicInvitation}=invitation; return json(res,201,{invitation:publicInvitation,delivery},cors)
    }

    const teamInviteRoute=url.pathname.match(/^\/api\/team\/invitations\/([^/]+)$/)
    if(teamInviteRoute&&req.method==='POST'){if(!ownerOnly(user,res,cors))return;const org=orgForUser(user);const old=db.invitations.find((i)=>i.id===teamInviteRoute[1]&&i.orgId===org?.id&&i.kind==='team'&&!i.usedAt&&!i.revokedAt);if(!old)return json(res,404,{error:'invitation introuvable'},cors);old.revokedAt=new Date().toISOString();const {invitation,token}=createInvitation({orgId:old.orgId,email:old.email,name:old.name,role:old.role,permissions:old.permissions,createdBy:user.id,kind:'team',metadata:old.metadata||{}});const delivery=await sendInvitationEmail(invitation,token);audit('team.invite.resend',{by:user.id,org:org.id,email:old.email});return json(res,200,{delivery},cors)}
    if(teamInviteRoute&&req.method==='DELETE'){if(!ownerOnly(user,res,cors))return;const org=orgForUser(user);const inv=db.invitations.find((i)=>i.id===teamInviteRoute[1]&&i.orgId===org?.id&&i.kind==='team'&&!i.usedAt&&!i.revokedAt);if(!inv)return json(res,404,{error:'invitation introuvable'},cors);inv.revokedAt=new Date().toISOString();saveDb(db);audit('team.invite.revoke',{by:user.id,org:org.id,email:inv.email});return json(res,200,{ok:true},cors)}

    const teamUserRoute=url.pathname.match(/^\/api\/team\/([^/]+)$/)
    if(teamUserRoute&&req.method==='PATCH'){if(!ownerOnly(user,res,cors))return;const org=orgForUser(user);const member=db.users.find((u)=>u.id===teamUserRoute[1]&&u.orgIds?.includes(org?.id)&&['manager','collaborateur'].includes(u.role));if(!member)return json(res,404,{error:'membre introuvable'},cors);const body=await readBody(req);if(typeof body.active==='boolean')member.active=body.active;if(['manager','collaborateur'].includes(body.role))member.role=body.role;if(body.permissions)member.permissions=normalizePermissions(body.permissions);saveDb(db);audit('team.update',{by:user.id,org:org.id,member:member.id});return json(res,200,safeUser(member),cors)}
    if(teamUserRoute&&req.method==='DELETE'){if(!ownerOnly(user,res,cors))return;const org=orgForUser(user);const index=db.users.findIndex((u)=>u.id===teamUserRoute[1]&&u.orgIds?.includes(org?.id)&&['manager','collaborateur'].includes(u.role));if(index<0)return json(res,404,{error:'membre introuvable'},cors);const [removed]=db.users.splice(index,1);saveDb(db);audit('team.delete',{by:user.id,org:org.id,member:removed.id});return json(res,200,{ok:true},cors)}

    const adminOrgDataRoute = url.pathname.match(/^\/api\/admin\/orgs\/([^/]+)\/data$/)
    if (adminOrgDataRoute && req.method === 'GET') {
      if (!adminOnly(user,res,cors)) return
      const orgId=adminOrgDataRoute[1]; const org=db.orgs.find((o)=>o.id===orgId); if(!org)return json(res,404,{error:'entreprise introuvable'},cors)
      const collections={}
      for(const name of ['needs','diagnostics','missions','offers','documents','messages','meetings','quotes','notifications']) collections[name]=(db[name]||[]).filter((item)=>item.orgId===orgId)
      return json(res,200,{org:{id:org.id,name:org.name},collections},cors)
    }

    const adminOrgRoute = url.pathname.match(/^\/api\/admin\/orgs\/([^/]+)$/)
    if (adminOrgRoute && req.method === 'DELETE') {
      if (!adminOnly(user,res,cors)) return
      const orgId=adminOrgRoute[1]; const index=db.orgs.findIndex((o)=>o.id===orgId); if(index<0)return json(res,404,{error:'entreprise introuvable'},cors)
      db.orgs.splice(index,1)
      db.users=db.users.filter((u)=>!u.orgIds?.includes(orgId))
      db.invitations=db.invitations.filter((i)=>i.orgId!==orgId)
      db.registrations=db.registrations.filter((r)=>r.orgId!==orgId)
      for(const name of ['needs','diagnostics','missions','offers','documents','messages','meetings','quotes','notifications','consents']) db[name]=(db[name]||[]).filter((item)=>item.orgId!==orgId)
      saveDb(db); audit('admin.org.delete',{by:user.id,org:orgId}); return json(res,200,{ok:true},cors)
    }

    const adminDeleteRoute = url.pathname.match(/^\/api\/admin\/orgs\/([^/]+)\/data\/([^/]+)\/([^/]+)$/)
    if (adminDeleteRoute && req.method === 'DELETE') {
      if (!adminOnly(user,res,cors)) return
      const [,orgId,collection,id]=adminDeleteRoute
      const allowedCollections=new Set(['needs','diagnostics','missions','offers','documents','messages','meetings','quotes','notifications'])
      if(!allowedCollections.has(collection))return json(res,400,{error:'type de donnée non supprimable'},cors)
      const list=db[collection]; const index=Array.isArray(list)?list.findIndex((item)=>item.id===id&&item.orgId===orgId):-1
      if(index<0)return json(res,404,{error:'élément introuvable pour cette entreprise'},cors)
      list.splice(index,1); saveDb(db); audit('admin.client.data.delete',{by:user.id,org:orgId,collection,id}); return json(res,200,{ok:true},cors)
    }

    /* ------------------------------------------------------------------ */
    /* Documents : accès par rôle avec vérification organisation           */
    /* CLIENT  : documents de SON organisation (jamais une autre)          */
    /* CONCIERGE : documents des entreprises affectées                     */
    /* ADMIN   : documents de toutes les entreprises                       */
    /* ------------------------------------------------------------------ */

    const documentDownloadRoute = url.pathname.match(/^\/api\/documents\/([^/]+)\/download$/)
    if (documentDownloadRoute && req.method === 'GET') {
      const doc = db.documents.find((item) => item.id === documentDownloadRoute[1])
      if (!doc) return json(res, 404, { error: 'document introuvable' }, cors)
      if (!documentVisibleTo(user, doc)) return json(res, 403, { error: 'document hors de votre périmètre' }, cors)
      const inline = url.searchParams.get('inline') === '1'
      const filename = sanitizeFilename(doc.fileName || doc.title)
      const encoded = encodeURIComponent(filename).replace(/['()]/g, (ch) => (ch === "'" ? '%27' : ch === '(' ? '%28' : '%29'))
      // `inline` n'est autorisé que pour des types inoffensifs : jamais HTML/SVG/exécutable.
      const dispositionFor = (mime) => `${inline && INLINE_SAFE_MIME.test(mime) ? 'inline' : 'attachment'}; filename="${filename.replace(/[\\"]/g, '')}"; filename*=UTF-8''${encoded}`
      if (typeof doc.fileUrl === 'string' && /^data:/i.test(doc.fileUrl)) {
        const match = doc.fileUrl.match(/^data:([^;,]*)?(;base64)?,(.*)$/s)
        const mime = (match?.[1] || doc.mimeType || 'application/octet-stream').trim() || 'application/octet-stream'
        const payload = match?.[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match?.[3] || ''), 'utf8')
        res.writeHead(200, { 'content-type': mime, 'content-disposition': dispositionFor(mime), 'content-length': payload.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
        return res.end(payload)
      }
      if (typeof doc.fileUrl === 'string' && /^https?:/i.test(doc.fileUrl)) {
        res.writeHead(302, { location: doc.fileUrl, 'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/[\\"]/g, '')}"` })
        return res.end()
      }
      if (typeof doc.content === 'string' && doc.content) {
        const mime = (doc.mimeType || 'text/plain; charset=utf-8').trim() || 'text/plain; charset=utf-8'
        res.writeHead(200, { 'content-type': mime, 'content-disposition': dispositionFor(mime), 'content-length': Buffer.byteLength(doc.content), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
        return res.end(doc.content)
      }
      return json(res, 404, { error: 'contenu du document indisponible' }, cors)
    }

    const documentRoute = url.pathname.match(/^\/api\/documents(?:\/([^/]+))?$/)

    if (documentRoute && !documentRoute[1] && req.method === 'GET') {
      const requestedOrg = url.searchParams.get('orgId')
      let visible
      if (CLIENT_ROLES.has(user.role)) {
        const org = orgForUser(user)
        if (!org) return json(res, 200, [], cors)
        if (requestedOrg && requestedOrg !== org.id) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
        visible = db.documents.filter((doc) => doc.orgId === org.id && doc.visibleToClient !== false)
      } else if (user.role === 'admin') {
        if (requestedOrg) {
          if (!db.orgs.some((o) => o.id === requestedOrg)) return json(res, 404, { error: 'entreprise introuvable' }, cors)
          visible = db.documents.filter((doc) => doc.orgId === requestedOrg)
        } else {
          visible = db.documents
        }
      } else if (user.role === 'concierge') {
        if (requestedOrg) {
          if (!canAccessOrg(user, requestedOrg)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
          visible = db.documents.filter((doc) => doc.orgId === requestedOrg)
        } else {
          const allowed = new Set(Array.isArray(user.orgIds) ? user.orgIds : [])
          visible = db.documents.filter((doc) => allowed.has(doc.orgId))
        }
      } else {
        return json(res, 403, { error: 'rôle non autorisé à consulter les documents' }, cors)
      }
      const sorted = [...visible].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      const rows = sorted.map((doc) => ({
        id: doc.id, orgId: doc.orgId, title: doc.title, type: doc.type, category: doc.category, status: doc.status,
        visibleToClient: doc.visibleToClient, fileName: doc.fileName || null, fileUrl: doc.fileUrl || null,
        content: doc.content || null, mimeType: doc.mimeType || null, sizeLabel: doc.sizeLabel || null,
        notes: OPERATIONS_ROLES.has(user.role) ? (doc.notes || null) : null, origin: doc.origin || null, createdBy: doc.createdBy, createdByName: doc.createdByName || null,
        createdAt: doc.createdAt || null, updatedAt: doc.updatedAt || null,
        orgName: 'orgName' in doc ? doc.orgName : (db.orgs.find((o) => o.id === doc.orgId)?.name || ''),
      }))
      audit('document.read.list', { by: user.id, count: rows.length })
      return json(res, 200, rows, cors)
    }

    if (documentRoute && !documentRoute[1] && req.method === 'POST') {
      const isStaff = OPERATIONS_ROLES.has(user.role)
      const isClient = CLIENT_ROLES.has(user.role)
      if (!isStaff && !isClient) return json(res, 403, { error: 'réservé au personnel ALLNEEDS' }, cors)
      const body = await readBody(req)
      let orgId
      if (isClient) {
        // Sécurité : l'entreprise vient TOUJOURS du compte, jamais du corps de la requête.
        const clientOrg = orgForUser(user)
        if (!clientOrg) return json(res, 403, { error: 'entreprise introuvable' }, cors)
        if (body.orgId && body.orgId !== clientOrg.id) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
        orgId = clientOrg.id
      } else {
        orgId = allowedText(body.orgId, 120, 'entreprise')
        if (!canAccessOrg(user, orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      }
      if (!db.orgs.some((o) => o.id === orgId)) return json(res, 404, { error: 'entreprise introuvable' }, cors)
      const title = allowedText(body.title, 200, 'titre')
      const type = DOCUMENT_TYPES.has(body.type) ? body.type : 'autre'
      const category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) : ''
      // Dépôt client => « Déposé » (interne `recu`) et visible par le client ; le personnel garde la main.
      const status = isClient ? 'recu' : (DOCUMENT_STATUSES.has(body.status) ? body.status : 'valide')
      const visibleToClient = isClient ? true : (body.visibleToClient === undefined ? true : Boolean(body.visibleToClient))
      const fileUrl = typeof body.fileUrl === 'string' && body.fileUrl.trim() ? validateDocumentFileUrl(body.fileUrl) : ''
      let fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 200) : ''
      if (/^data:application\/pdf/i.test(fileUrl) && fileName && !/\.pdf$/i.test(fileName)) fileName = `${fileName}.pdf`
      const content = typeof body.content === 'string' && body.content.trim() ? body.content.slice(0, 200000) : ''
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().slice(0, 120) : ''
      const sizeLabel = typeof body.sizeLabel === 'string' ? body.sizeLabel.trim().slice(0, 60) : ''
      const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : ''
      const now = new Date().toISOString()
      const record = {
        id: `doc-${randomBytes(12).toString('hex')}`, orgId, title, type, category, status, visibleToClient,
        fileName: fileName || null, fileUrl: fileUrl || null, content: content || null, mimeType: mimeType || null,
        sizeLabel: sizeLabel || null, notes: notes || null, origin: isClient ? 'client' : 'staff',
        createdBy: user.id, createdByName: user.name, createdAt: now, updatedAt: now,
      }
      db.documents.unshift(record)
      saveDb(db)
      audit('document.create', { by: user.id, org: orgId, id: record.id, origin: record.origin })
      return json(res, 201, record, cors)
    }

    if (documentRoute?.[1] && req.method === 'GET') {
      const doc = db.documents.find((item) => item.id === documentRoute[1])
      if (!doc) return json(res, 404, { error: 'document introuvable' }, cors)
      if (!documentVisibleTo(user, doc)) return json(res, 403, { error: 'document hors de votre périmètre' }, cors)
      return json(res, 200, OPERATIONS_ROLES.has(user.role) ? doc : { ...doc, notes: null }, cors)
    }

    if (documentRoute?.[1] && req.method === 'PATCH') {
      if (!['admin', 'concierge'].includes(user.role)) return json(res, 403, { error: 'réservé au personnel ALLNEEDS' }, cors)
      const doc = db.documents.find((item) => item.id === documentRoute[1])
      if (!doc) return json(res, 404, { error: 'document introuvable' }, cors)
      if (!canAccessOrg(user, doc.orgId)) return json(res, 403, { error: 'document hors de votre périmètre' }, cors)
      const body = await readBody(req)
      if (body.title !== undefined) doc.title = allowedText(body.title, 200, 'titre')
      if (body.type !== undefined) doc.type = DOCUMENT_TYPES.has(body.type) ? body.type : doc.type
      if (body.category !== undefined) doc.category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) : doc.category
      if (body.status !== undefined) doc.status = DOCUMENT_STATUSES.has(body.status) ? body.status : doc.status
      if (body.visibleToClient !== undefined) doc.visibleToClient = Boolean(body.visibleToClient)
      if (body.fileName !== undefined) doc.fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 200) : null
      if (body.fileUrl !== undefined) doc.fileUrl = typeof body.fileUrl === 'string' && body.fileUrl.trim() ? validateDocumentFileUrl(body.fileUrl) : null
      if (body.content !== undefined) doc.content = typeof body.content === 'string' && body.content.trim() ? body.content.slice(0, 200000) : null
      if (body.mimeType !== undefined) doc.mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().slice(0, 120) : null
      if (body.sizeLabel !== undefined) doc.sizeLabel = typeof body.sizeLabel === 'string' ? body.sizeLabel.trim().slice(0, 60) : null
      if (body.notes !== undefined) doc.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) : null
      doc.updatedAt = new Date().toISOString()
      saveDb(db)
      audit('document.update', { by: user.id, org: doc.orgId, id: doc.id })
      return json(res, 200, doc, cors)
    }

    if (documentRoute?.[1] && req.method === 'DELETE') {
      const isStaff = OPERATIONS_ROLES.has(user.role)
      const isClient = CLIENT_ROLES.has(user.role)
      if (!isStaff && !isClient) return json(res, 403, { error: 'réservé au personnel ALLNEEDS' }, cors)
      const index = db.documents.findIndex((item) => item.id === documentRoute[1])
      if (index < 0) return json(res, 404, { error: 'document introuvable' }, cors)
      const doc = db.documents[index]
      if (!canAccessOrg(user, doc.orgId)) return json(res, 403, { error: 'document hors de votre périmètre' }, cors)
      // Un client ne peut supprimer que ses propres dépôts, jamais les pièces du personnel.
      if (isClient && !isStaff && doc.createdBy !== user.id) return json(res, 403, { error: 'seuls vos propres dépôts peuvent être supprimés' }, cors)
      db.documents.splice(index, 1)
      saveDb(db)
      audit('document.delete', { by: user.id, org: doc.orgId, id: doc.id })
      return json(res, 200, { ok: true }, cors)
    }

    /* Validation centralisée des demandes commerciales : admin global,
       concierge uniquement pour ses entreprises affectées. */
    if (req.method === 'GET' && url.pathname === '/api/staff/requests') {
      if (!isAdmin(user) && !isConcierge(user)) return json(res, 403, { error: 'personnel ALLNEEDS requis' }, cors)
      const requestedOrg = url.searchParams.get('orgId')
      if (requestedOrg && !canManageOrg(user, requestedOrg)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const visible = (orgId) => (!requestedOrg || orgId === requestedOrg) && canManageOrg(user, orgId)
      const requests = [
        ...db.offers.filter((item) => normalizeOfferStatus(item.status) === 'en_attente_validation' && visible(item.orgId)).map((item) => ({ type: 'offer', ...normalizedOfferRecord(item) })),
        ...db.needsSubscriptions.filter((item) => item.status === 'pending' && visible(item.orgId)).map((item) => ({ type: 'needs', ...needsSubscriptionSummary(item) })),
        ...db.saasSubscriptions.filter((item) => item.status === 'pending' && visible(item.orgId)).map((item) => ({ type: 'saas', ...item })),
      ].map((item) => ({ ...item, orgName: db.orgs.find((org) => org.id === item.orgId)?.name || '' }))
        .sort((a, b) => String(b.requestedAt || b.createdAt || '').localeCompare(String(a.requestedAt || a.createdAt || '')))
      return json(res, 200, { requests }, cors)
    }

    const staffRequestRoute = url.pathname.match(/^\/api\/staff\/requests\/(offer|needs|saas)\/([^/]+)$/)
    if (staffRequestRoute && req.method === 'PATCH') {
      if (!isAdmin(user) && !isConcierge(user)) return json(res, 403, { error: 'personnel ALLNEEDS requis' }, cors)
      const [, type, id] = staffRequestRoute
      const collection = type === 'offer' ? db.offers : type === 'needs' ? db.needsSubscriptions : db.saasSubscriptions
      const request = collection.find((item) => item.id === id)
      if (!request) return json(res, 404, { error: 'demande introuvable' }, cors)
      if (!canManageOrg(user, request.orgId) || !canAccessOrg(user, request.orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const pending = type === 'offer' ? normalizeOfferStatus(request.status) === 'en_attente_validation' : request.status === 'pending'
      if (!pending) return json(res, 409, { error: 'cette demande a déjà été traitée' }, cors)
      const body = await readBody(req)
      const decision = body.decision === 'approve' || body.decision === 'refuse' ? body.decision : null
      if (!decision) return json(res, 400, { error: 'decision doit être approve ou refuse' }, cors)
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''
      const now = new Date().toISOString()
      const org = db.orgs.find((item) => item.id === request.orgId)
      if (!org) return json(res, 404, { error: 'entreprise introuvable' }, cors)
      if (type === 'offer' && decision === 'approve' && activeOfferForOrg(request.orgId)) return json(res, 409, { error: 'une autre offre est déjà active pour cette entreprise', code: 'OFFER_ALREADY_ACCEPTED' }, cors)
      request.decidedAt = now; request.decidedBy = user.id; request.decidedByName = user.name || ''; request.decisionReason = reason || null; request.updatedAt = now
      let missions = []
      if (type === 'offer') {
        if (decision === 'approve') {
          request.status = 'actif'; request.acceptedAt = now; request.acceptedBy = request.requestedBy; request.approvedBy = user.id
          missions = ensureMissionsForOffer(request)
        } else request.status = 'refuse'
      } else if (type === 'needs') {
        if (decision === 'approve') {
          const previous = activeNeedsSubscriptionForOrg(request.orgId)
          if (request.requestType === 'change' && previous && previous.id !== request.id) {
            previous.status = 'cancelled'; previous.cancelledAt = now; previous.updatedAt = now
            const period = needsPeriodFor(previous); request.periodStart = period.periodStart; request.periodEnd = period.periodEnd
          } else {
            request.periodStart = now; request.periodEnd = new Date(Date.now() + NEEDS_SUBSCRIPTION_PERIOD_MS).toISOString()
          }
          request.status = 'active'; request.startDate = now; request.approvedAt = now
          org.modules = { ...(org.modules || {}), besoins: true }
          notifyNeedsSubscriptionActivated(request, org)
        } else request.status = 'refused'
      } else {
        if (decision === 'approve') {
          for (const other of db.saasSubscriptions) if (other.orgId === request.orgId && other.id !== request.id && other.status === 'active') { other.status = 'cancelled'; other.updatedAt = now }
          request.status = 'active'; request.startDate = now; request.approvedAt = now
          org.saas = { ...DEFAULT_SAAS, ...(org.saas || {}), subscriptionActive: true, enabled: true, startDate: now, endDate: null, plan: SAAS_PLAN_CODE }
        } else request.status = 'refused'
      }
      saveDb(db)
      if (type === 'needs' && decision === 'approve') await sendNeedsActivatedEmails(org, request)
      audit('staff.request.decision', { by: user.id, org: request.orgId, type, id: request.id, decision, reason: reason || null })
      return json(res, 200, { request: type === 'offer' ? normalizedOfferRecord(request) : type === 'needs' ? needsSubscriptionSummary(request) : request, missions }, cors)
    }

    /* SaaS 445 MAD/mois : la demande client ne confère aucun droit avant validation. */
    if (req.method === 'GET' && url.pathname === '/api/saas/subscription') {
      let orgId
      if (isClient(user)) orgId = orgForUser(user)?.id
      else if (isAdmin(user) || isConcierge(user)) orgId = url.searchParams.get('orgId')
      else return json(res, 403, { error: 'rôle non autorisé' }, cors)
      if (!orgId) return json(res, 404, { error: 'entreprise introuvable' }, cors)
      if (!canAccessOrg(user, orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const history = db.saasSubscriptions.filter((item) => item.orgId === orgId).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      const current = history.find((item) => item.status === 'active') || null
      const pending = history.find((item) => item.status === 'pending') || null
      return json(res, 200, { plan: { code: SAAS_PLAN_CODE, name: 'SaaS ALLNEEDS', price: SAAS_PRICE, currency: 'MAD', period: 'mois' }, current, pending, history }, cors)
    }

    if (req.method === 'POST' && (url.pathname === '/api/saas/subscription/request' || url.pathname === '/api/saas/subscription/activate')) {
      if (!isClient(user)) return json(res, 403, { error: 'seul un client peut demander l’abonnement SaaS' }, cors)
      const org = orgForUser(user)
      if (!org || org.active === false) return json(res, 403, { error: 'entreprise introuvable ou inactive' }, cors)
      if (db.saasSubscriptions.some((item) => item.orgId === org.id && item.status === 'active')) return json(res, 409, { error: 'L’abonnement SaaS est déjà actif.', code: 'SAAS_ALREADY_ACTIVE' }, cors)
      const pending = db.saasSubscriptions.find((item) => item.orgId === org.id && item.status === 'pending')
      if (pending) return json(res, 409, { error: 'Une demande SaaS est déjà en attente.', code: 'REQUEST_ALREADY_PENDING', request: pending }, cors)
      const now = new Date().toISOString()
      const record = { id: `ssub-${randomBytes(12).toString('hex')}`, orgId: org.id, organizationId: org.id, planCode: SAAS_PLAN_CODE, planName: 'SaaS ALLNEEDS', price: SAAS_PRICE, currency: 'MAD', period: 'mois', status: 'pending', requestedAt: now, requestedBy: user.id, requestedByName: user.name || '', decidedAt: null, decidedBy: null, decisionReason: null, createdAt: now, updatedAt: now }
      db.saasSubscriptions.push(record)
      notifyOrgConcierge(org.id, { type: 'saas_subscription_requested', title: 'Demande SaaS à valider', message: `${org.name} demande l’abonnement SaaS à ${SAAS_PRICE} MAD/mois.`, meta: { requestType: 'saas', requestId: record.id, orgId: org.id } })
      saveDb(db); audit('saas.subscription.request', { by: user.id, org: org.id, id: record.id, price: SAAS_PRICE })
      return json(res, 202, { subscription: record, pendingApproval: true }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/needs') {
      if (!requireModuleAccess(user, res, cors, 'besoins')) return
      if (!NEED_READ_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé à consulter les besoins' }, cors)
      if (CLIENT_ROLES.has(user.role)) {
        const org = orgForUser(user)
        if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
        const subscription = activeNeedsSubscriptionForOrg(org.id)
        if (!subscription) return json(res, 403, { error: 'Un abonnement Besoins actif est requis pour accéder à cette fonctionnalité.', code: 'NEEDS_SUBSCRIPTION_REQUIRED' }, cors)
      }
      const visible = scopedNeeds(user).sort((a, b) => String(b.submittedAt || b.createdAt || '').localeCompare(String(a.submittedAt || a.createdAt || '')))
      audit('need.read.list', { by: user.id, count: visible.length })
      return json(res, 200, visible, cors)
    }

    /* ---------------- PHASE 6 — Abonnements Besoins ---------------- */
    if (req.method === 'GET' && url.pathname === '/api/needs/subscription') {
      if (!CLIENT_ROLES.has(user.role) && !OPERATIONS_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      let orgId = null
      if (OPERATIONS_ROLES.has(user.role)) {
        orgId = url.searchParams.get('orgId')
        if (orgId && !canAccessOrg(user, orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      } else {
        const org = orgForUser(user)
        if (!org) return json(res, 404, { error: 'entreprise introuvable' }, cors)
        orgId = org.id
      }
      const org = orgId ? db.orgs.find((item) => item.id === orgId) : null
      const current = orgId ? activeNeedsSubscriptionForOrg(orgId) : null
      const history = orgId ? needsSubscriptionsForOrg(orgId).map((item) => needsSubscriptionSummary(item)) : []
      const pending = history.find((item) => item.status === 'pending') || null
      return json(res, 200, {
        catalog: needsSubscriptionCatalog(),
        current: current ? needsSubscriptionSummary(current) : null,
        pending,
        history,
        prerequisites: org ? needsAccessPrerequisites(org) : { ok: false, code: 'NO_ORG', error: 'entreprise introuvable' },
      }, cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/needs/subscription/activate') {
      if (!isClient(user)) return json(res, 403, { error: 'seul un client de l’entreprise peut demander un abonnement Besoins' }, cors)
      const org = orgForUser(user)
      if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
      const body = await readBody(req)
      const code = normalizeNeedsPlanCode(body.planCode)
      if (!code) return json(res, 400, { error: 'formule invalide' }, cors)
      const prereq = needsAccessPrerequisites(org)
      if (!prereq.ok) return json(res, 403, { error: prereq.error, code: prereq.code }, cors)
      const existing = activeNeedsSubscriptionForOrg(org.id)
      if (existing) return json(res, 409, { error: 'Un abonnement Besoins est déjà actif. Utilisez le changement de formule.', code: 'NEEDS_SUBSCRIPTION_ALREADY_ACTIVE', current: needsSubscriptionSummary(existing) }, cors)
      const pending = needsSubscriptionsForOrg(org.id).find((item) => item.status === 'pending')
      if (pending) return json(res, 409, { error: 'Une demande d’abonnement Besoins est déjà en attente.', code: 'REQUEST_ALREADY_PENDING', request: needsSubscriptionSummary(pending) }, cors)
      const now = new Date().toISOString()
      const plan = needsPlanItem(code)
      const record = {
        id: `nsub-${randomBytes(12).toString('hex')}`, orgId: org.id, organizationId: org.id,
        planCode: code, planName: plan.name, price: plan.price, status: 'pending', requestType: 'activation',
        monthlyLimit: plan.monthlyLimit, proposalsLimit: plan.proposalsLimit, targetDelayHours: plan.targetDelayHours,
        periodStart: now, periodEnd: new Date(Date.now() + NEEDS_SUBSCRIPTION_PERIOD_MS).toISOString(),
        startDate: now, endDate: null, usedThisMonth: 0,
        requestedAt: now, requestedBy: user.id, requestedByName: user.name || '', decidedAt: null, decidedBy: null, decisionReason: null,
        createdAt: now, updatedAt: now,
      }
      db.needsSubscriptions.push(record)
      notifyOrgConcierge(org.id, { type: 'needs_subscription_requested', title: 'Demande d’abonnement Besoins', message: `${org.name} demande la formule ${plan.name}.`, meta: { requestType: 'needs', requestId: record.id, orgId: org.id, planCode: code } })
      saveDb(db)
      audit('needs.subscription.request', { by: user.id, org: org.id, id: record.id, planCode: code, price: plan.price, requestType: 'activation' })
      return json(res, 202, { subscription: needsSubscriptionSummary(record), pendingApproval: true }, cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/needs/subscription/change') {
      if (!isClient(user)) return json(res, 403, { error: 'seul un client de l’entreprise peut changer d’abonnement Besoins' }, cors)
      const org = orgForUser(user)
      if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
      const body = await readBody(req)
      const code = normalizeNeedsPlanCode(body.planCode)
      if (!code) return json(res, 400, { error: 'formule invalide' }, cors)
      const current = activeNeedsSubscriptionForOrg(org.id)
      if (!current) return json(res, 409, { error: 'Aucun abonnement Besoins actif à modifier.', code: 'NEEDS_SUBSCRIPTION_REQUIRED' }, cors)
      if (normalizeNeedsPlanCode(current.planCode) === code) return json(res, 200, { subscription: needsSubscriptionSummary(current) }, cors)
      const pending = needsSubscriptionsForOrg(org.id).find((item) => item.status === 'pending')
      if (pending) return json(res, 409, { error: 'Une demande de changement est déjà en attente.', code: 'REQUEST_ALREADY_PENDING', request: needsSubscriptionSummary(pending) }, cors)
      const now = new Date().toISOString()
      /* Changement de formule en cours de période : on CONSERVE la fenêtre de
         période courante (periodStart/periodEnd) afin que les besoins déjà
         déposés pendant cette période continuent de compter dans usedThisMonth.
         Le nouveau palier ne remet donc jamais la consommation à zéro. */
      const currentPeriod = needsPeriodFor(current)
      const plan = needsPlanItem(code)
      const record = {
        id: `nsub-${randomBytes(12).toString('hex')}`, orgId: org.id, organizationId: org.id,
        planCode: code, planName: plan.name, price: plan.price, status: 'pending', requestType: 'change',
        monthlyLimit: plan.monthlyLimit, proposalsLimit: plan.proposalsLimit, targetDelayHours: plan.targetDelayHours,
        periodStart: currentPeriod.periodStart, periodEnd: currentPeriod.periodEnd,
        startDate: now, endDate: null, usedThisMonth: 0, previousSubscriptionId: current.id,
        requestedAt: now, requestedBy: user.id, requestedByName: user.name || '', decidedAt: null, decidedBy: null, decisionReason: null,
        createdAt: now, updatedAt: now,
      }
      db.needsSubscriptions.push(record)
      notifyOrgConcierge(org.id, { type: 'needs_subscription_change_requested', title: 'Changement d’abonnement Besoins', message: `${org.name} demande la formule ${plan.name}.`, meta: { requestType: 'needs', requestId: record.id, orgId: org.id, planCode: code, previousSubscriptionId: current.id } })
      saveDb(db)
      audit('needs.subscription.request', { by: user.id, org: org.id, from: current.planCode, to: code, id: record.id, requestType: 'change' })
      return json(res, 202, { subscription: needsSubscriptionSummary(record), current: needsSubscriptionSummary(current), pendingApproval: true }, cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/needs/subscription/cancel') {
      if (!CLIENT_ROLES.has(user.role)) return json(res, 403, { error: 'seul un client de l’entreprise peut résilier son abonnement Besoins' }, cors)
      const org = orgForUser(user)
      if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
      const current = activeNeedsSubscriptionForOrg(org.id)
      if (!current) return json(res, 404, { error: 'Aucun abonnement Besoins actif.', code: 'NEEDS_SUBSCRIPTION_REQUIRED' }, cors)
      const now = new Date().toISOString()
      current.status = 'cancelled'; current.cancelledAt = now; current.updatedAt = now
      saveDb(db)
      audit('needs.subscription.cancel', { by: user.id, org: org.id, id: current.id })
      return json(res, 200, { subscription: needsSubscriptionSummary(current) }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/needs/subscriptions') {
      if (!adminOnly(user, res, cors)) return
      const rows = db.needsSubscriptions.map((item) => ({ ...needsSubscriptionSummary(item), orgName: db.orgs.find((o) => o.id === item.orgId)?.name || '' }))
      return json(res, 200, { subscriptions: rows, catalog: needsSubscriptionCatalog() }, cors)
    }

    const adminNeedsSubRoute = url.pathname.match(/^\/api\/admin\/needs\/subscriptions\/([^/]+)$/)
    if (adminNeedsSubRoute && req.method === 'PATCH') {
      if (!adminOnly(user, res, cors)) return
      const subscription = db.needsSubscriptions.find((item) => item.id === adminNeedsSubRoute[1])
      if (!subscription) return json(res, 404, { error: 'abonnement introuvable' }, cors)
      if (!canManageOrg(user, subscription.orgId) || !canAccessOrg(user, subscription.orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const body = await readBody(req)
      const now = new Date().toISOString()
      if (body.status !== undefined) {
        if (!NEEDS_SUBSCRIPTION_STATUSES.has(body.status)) return json(res, 400, { error: 'statut d’abonnement invalide' }, cors)
        if (body.status === 'active' && subscription.status !== 'active') {
          for (const other of needsSubscriptionsForOrg(subscription.orgId)) if (other.id !== subscription.id && other.status === 'active') { other.status = 'cancelled'; other.cancelledAt = now; other.updatedAt = now }
          const org = db.orgs.find((o) => o.id === subscription.orgId)
          if (org) org.modules = { ...(org.modules || {}), besoins: true }
          subscription.decidedAt = now; subscription.decidedBy = user.id; subscription.decisionReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null
        }
        if (body.status === 'refused') { subscription.decidedAt = now; subscription.decidedBy = user.id; subscription.decisionReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null }
        subscription.status = body.status
        if (body.status === 'cancelled') subscription.cancelledAt = now
      }
      if (body.planCode !== undefined) {
        const code = normalizeNeedsPlanCode(body.planCode)
        if (!code) return json(res, 400, { error: 'formule invalide' }, cors)
        const plan = needsPlanItem(code)
        subscription.planCode = code; subscription.planName = plan.name; subscription.price = plan.price
        subscription.monthlyLimit = plan.monthlyLimit; subscription.proposalsLimit = plan.proposalsLimit; subscription.targetDelayHours = plan.targetDelayHours
      }
      subscription.updatedAt = now
      saveDb(db)
      audit('admin.needs.subscription.update', { by: user.id, org: subscription.orgId, id: subscription.id, status: subscription.status })
      return json(res, 200, needsSubscriptionSummary(subscription), cors)
    }

    /* ---------------- PHASE 6 — Propositions / devis ---------------- */
    const needProposalsRoute = url.pathname.match(/^\/api\/needs\/([^/]+)\/proposals$/)
    if (needProposalsRoute && req.method === 'GET') {
      if (!NEED_READ_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const need = db.needs.find((item) => item.id === needProposalsRoute[1])
      if (!need) return json(res, 404, { error: 'besoin introuvable' }, cors)
      if (!canAccessOrg(user, need.orgId)) return json(res, 403, { error: 'besoin hors de votre périmètre' }, cors)
      if (CLIENT_ROLES.has(user.role)) {
        const subscription = activeNeedsSubscriptionForOrg(need.orgId)
        if (!subscription) return json(res, 403, { error: 'Un abonnement Besoins actif est requis pour accéder à cette fonctionnalité.', code: 'NEEDS_SUBSCRIPTION_REQUIRED' }, cors)
      }
      const proposals = isClient(user) ? transmittedProposalsFor(need.id) : needProposalsFor(need.id)
      return json(res, 200, { needId: need.id, proposals }, cors)
    }

    if (needProposalsRoute && req.method === 'POST') {
      if (!OPERATIONS_ROLES.has(user.role)) return json(res, 403, { error: 'seul le concierge ou l’administrateur peut proposer un prestataire' }, cors)
      const need = db.needs.find((item) => item.id === needProposalsRoute[1])
      if (!need) return json(res, 404, { error: 'besoin introuvable' }, cors)
      if (!canAccessOrg(user, need.orgId)) return json(res, 403, { error: 'besoin hors de votre périmètre' }, cors)
      const subscription = activeNeedsSubscriptionForOrg(need.orgId)
      if (!subscription) return json(res, 403, { error: 'Un abonnement Besoins actif est requis pour accéder à cette fonctionnalité.', code: 'NEEDS_SUBSCRIPTION_REQUIRED' }, cors)
      const summary = needsSubscriptionSummary(subscription)
      const existing = needProposalsFor(need.id)
      if (existing.length >= summary.proposalsLimit) return json(res, 403, { error: 'La limite de propositions de cette formule est atteinte.', code: 'NEEDS_PROPOSALS_LIMIT_REACHED', limit: summary.proposalsLimit, used: existing.length }, cors)
      const body = await readBody(req)
      const providerName = allowedText(body.providerName, 180, 'prestataire')
      const title = allowedText(body.title, 180, 'intitulé')
      const description = allowedText(body.description, 4000, 'description')
      const deliveryDelay = typeof body.deliveryDelay === 'string' ? body.deliveryDelay.trim().slice(0, 120) || null : null
      const amount = body.amount == null || body.amount === '' ? null : Number(body.amount)
      if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000)) return json(res, 400, { error: 'montant invalide' }, cors)
      const wantsRecommended = body.recommended === true
      if (wantsRecommended && !summary.recommendedProposal) return json(res, 400, { error: 'Votre formule ne prévoit pas de proposition recommandée.', code: 'NEEDS_FEATURE_NOT_INCLUDED' }, cors)
      const wantsNegotiated = body.negotiated === true
      if (wantsNegotiated && !summary.negotiatedProposal) return json(res, 400, { error: 'Votre formule ne prévoit pas de proposition négociée.', code: 'NEEDS_FEATURE_NOT_INCLUDED' }, cors)
      const now = new Date().toISOString()
      const record = {
        id: `prp-${randomBytes(12).toString('hex')}`, kind: 'proposition', needId: need.id, orgId: need.orgId,
        providerName, title, description, deliveryDelay, amount,
        recommended: wantsRecommended, negotiated: wantsNegotiated,
        status: 'brouillon', sentAt: null, sentBy: null, createdBy: user.id, createdByName: user.name || '', createdAt: now, updatedAt: now,
      }
      db.quotes.push(record)
      need.candidateIds = [...new Set([...(Array.isArray(need.candidateIds) ? need.candidateIds : []), record.id])]
      need.updatedAt = now
      saveDb(db)
      audit('need.proposal.create', { by: user.id, org: need.orgId, needId: need.id, id: record.id })
      return json(res, 201, record, cors)
    }

    const proposalRoute = url.pathname.match(/^\/api\/proposals\/([^/]+)$/)
    if (proposalRoute && req.method === 'PATCH') {
      if (!OPERATIONS_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const proposal = db.quotes.find((item) => item.id === proposalRoute[1] && item.kind === 'proposition')
      if (!proposal) return json(res, 404, { error: 'proposition introuvable' }, cors)
      if (!canAccessOrg(user, proposal.orgId)) return json(res, 403, { error: 'proposition hors de votre périmètre' }, cors)
      const body = await readBody(req)
      const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
      if (body.title !== undefined) proposal.title = str(body.title, 180) || proposal.title
      if (body.description !== undefined) proposal.description = str(body.description, 4000)
      if (body.providerName !== undefined) proposal.providerName = str(body.providerName, 180) || proposal.providerName
      if (body.deliveryDelay !== undefined) proposal.deliveryDelay = str(body.deliveryDelay, 120) || null
      if (body.amount !== undefined) { const amount = body.amount === null || body.amount === '' ? null : Number(body.amount); if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return json(res, 400, { error: 'montant invalide' }, cors); proposal.amount = amount }
      if (body.status !== undefined) {
        if (!['brouillon', 'proposee', 'en_etude'].includes(body.status)) return json(res, 403, { error: 'la transmission et la décision client utilisent leurs actions dédiées' }, cors)
        if (proposalSentToClient(proposal)) return json(res, 409, { error: 'une proposition transmise ne peut plus repasser en brouillon' }, cors)
        proposal.status = body.status
      }
      if (body.recommended !== undefined) proposal.recommended = body.recommended === true
      if (body.negotiated !== undefined) proposal.negotiated = body.negotiated === true
      proposal.updatedAt = new Date().toISOString()
      saveDb(db)
      audit('proposal.update', { by: user.id, org: proposal.orgId, id: proposal.id })
      return json(res, 200, proposal, cors)
    }

    const proposalTransmitRoute = url.pathname.match(/^\/api\/proposals\/([^/]+)\/transmit$/)
    if (proposalTransmitRoute && req.method === 'POST') {
      if (!OPERATIONS_ROLES.has(user.role)) return json(res, 403, { error: 'seul le concierge ou l’administrateur peut transmettre une proposition' }, cors)
      const proposal = db.quotes.find((item) => item.id === proposalTransmitRoute[1] && item.kind === 'proposition')
      if (!proposal) return json(res, 404, { error: 'proposition introuvable' }, cors)
      if (!canManageOrg(user, proposal.orgId)) return json(res, 403, { error: 'proposition hors de votre périmètre' }, cors)
      if (proposalSentToClient(proposal)) return json(res, 409, { error: 'cette proposition a déjà été transmise' }, cors)
      const need = db.needs.find((item) => item.id === proposal.needId)
      if (!need) return json(res, 404, { error: 'besoin introuvable' }, cors)
      const now = new Date().toISOString()
      proposal.status = 'envoyee'; proposal.sentAt = now; proposal.sentBy = user.id; proposal.updatedAt = now
      need.status = 'en_attente_client'; need.updatedAt = now
      need.timeline = [...(Array.isArray(need.timeline) ? need.timeline : []), { at: now, label: `Proposition transmise au client : ${proposal.providerName}` }]
      for (const client of clientRecipientsForOrg(need.orgId)) pushNotification({
        userId: client.id, orgId: need.orgId, type: 'proposals_ready',
        title: 'Une proposition est disponible', message: `Besoin « ${need.title} » : une proposition vous attend.`,
        meta: { needId: need.id, proposalId: proposal.id, link: `/app/besoins/${need.id}` },
      })
      saveDb(db)
      audit('need.proposal.transmit', { by: user.id, org: proposal.orgId, needId: need.id, id: proposal.id })
      return json(res, 200, proposal, cors)
    }

    const proposalDecisionRoute = url.pathname.match(/^\/api\/proposals\/([^/]+)\/decision$/)
    if (proposalDecisionRoute && req.method === 'PATCH') {
      const proposal = db.quotes.find((item) => item.id === proposalDecisionRoute[1] && item.kind === 'proposition')
      if (!proposal) return json(res, 404, { error: 'proposition introuvable' }, cors)
      if (!canClientValidate(user, proposal.orgId)) return json(res, 403, { error: 'décision réservée au client de l’entreprise' }, cors)
      if (!proposalSentToClient(proposal) || proposal.status !== 'envoyee') return json(res, 409, { error: 'seule une proposition transmise peut faire l’objet d’une décision' }, cors)
      const body = await readBody(req)
      if (!['accept', 'refuse'].includes(body.decision)) return json(res, 400, { error: 'decision doit être accept ou refuse' }, cors)
      const now = new Date().toISOString()
      proposal.status = body.decision === 'accept' ? 'acceptee' : 'refusee'
      proposal.decidedAt = now; proposal.decidedBy = user.id; proposal.decisionReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null; proposal.updatedAt = now
      const need = db.needs.find((item) => item.id === proposal.needId)
      if (need && body.decision === 'accept') {
        need.status = 'valide'; need.updatedAt = now; need.selectedProposalId = proposal.id
        for (const sibling of needProposalsFor(need.id)) if (sibling.id !== proposal.id && sibling.status === 'envoyee') { sibling.status = 'refusee'; sibling.decidedAt = now; sibling.updatedAt = now }
      } else if (need && transmittedProposalsFor(need.id).every((item) => item.status === 'refusee')) {
        need.status = 'en_recherche'; need.updatedAt = now
      }
      saveDb(db); audit('proposal.client.decision', { by: user.id, org: proposal.orgId, id: proposal.id, decision: body.decision, reason: proposal.decisionReason })
      return json(res, 200, proposal, cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/needs') {
      if (!requireModuleAccess(user, res, cors, 'besoins')) return
      if (!canCreateNeed(user)) return json(res, 403, { error: 'votre rôle ne peut pas déposer un besoin' }, cors)
      const body = await readBody(req)
      const clientOrg = isClient(user) ? orgForUser(user) : null
      if (isClient(user) && body.orgId && body.orgId !== clientOrg?.id) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const orgId = isClient(user) ? clientOrg?.id : allowedText(body.orgId, 120, 'entreprise')
      if (!orgId) return json(res, 403, { error: 'entreprise introuvable' }, cors)
      if (!canAccessOrg(user, orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const org = db.orgs.find((item) => item.id === orgId)
      if (!org) return json(res, 404, { error: 'entreprise introuvable' }, cors)
      /* PHASE 6 — quota mensuel imposé par l'abonnement Besoins (clients). */
      let subscription = null
      if (CLIENT_ROLES.has(user.role)) {
        subscription = activeNeedsSubscriptionForOrg(orgId)
        if (!subscription) return json(res, 403, { error: 'Un abonnement Besoins actif est requis pour accéder à cette fonctionnalité.', code: 'NEEDS_SUBSCRIPTION_REQUIRED' }, cors)
        const summary = needsSubscriptionSummary(subscription)
        if (summary.usedThisMonth >= summary.monthlyLimit) return json(res, 403, { error: 'Vous avez atteint la limite mensuelle de votre abonnement.', code: 'NEEDS_LIMIT_REACHED', used: summary.usedThisMonth, limit: summary.monthlyLimit, remaining: 0, periodEnd: summary.periodEnd }, cors)
      }
      const category = allowedText(body.category, 40, 'catégorie')
      const urgency = body.urgency == null ? 'normale' : body.urgency
      if (!NEED_URGENCY.has(urgency)) return json(res, 400, { error: 'urgence invalide' }, cors)
      if (!NEED_CATEGORIES.has(category)) return json(res, 400, { error: 'catégorie inconnue' }, cors)
      const title = allowedText(body.title, 180, 'intitulé')
      const description = allowedText(body.description, 4000, 'description')
      const location = allowedText(body.location || 'À préciser', 160, 'ville')
      const budgetMax = body.budgetMax == null || body.budgetMax === '' ? null : Number(body.budgetMax)
      if (budgetMax !== null && (!Number.isFinite(budgetMax) || budgetMax < 0 || budgetMax > 1_000_000_000)) return json(res, 400, { error: 'budget invalide' }, cors)
      const deadline = body.deadline ? allowedText(body.deadline, 40, 'échéance') : null
      if (deadline && Number.isNaN(Date.parse(deadline))) return json(res, 400, { error: 'échéance invalide' }, cors)
      const volume = body.volume == null || body.volume === '' ? null : allowedText(String(body.volume), 120, 'volume')
      const now = new Date().toISOString()
      const record = {
        id: `need-${randomBytes(12).toString('hex')}`, orgId, title, category,
        categoryLabel: allowedText(body.categoryLabel || category, 180, 'nom de catégorie'),
        status: 'nouveau', urgency, budgetMax, volume, submittedAt: now, deadline, description, location,
        subscriptionId: subscription ? subscription.id : null, createdBy: user.id, createdAt: now, updatedAt: now,
        candidateIds: [], quoteIds: [], assignedTo: user.role === 'concierge' ? user.name : 'À attribuer',
        timeline: [{ at: now, label: 'Besoin déposé par le client' }],
      }
      db.needs.unshift(record)
      saveDb(db)
      notifyOrgConcierge(orgId, {
        type: 'besoin_created',
        title: 'Nouveau besoin client',
        message: `${org.name} a déposé un besoin « ${title} ».`,
        meta: { needId: record.id, orgId, title, category, urgency, link: `/concierge/entreprises/${orgId}` },
      })
      audit('need.create', { by: user.id, org: orgId, id: record.id })
      return json(res, 201, record, cors)
    }

    const needRoute = url.pathname.match(/^\/api\/needs\/([^/]+)$/)
    if (needRoute && req.method === 'PATCH') {
      const need = db.needs.find((item) => item.id === needRoute[1])
      if (!need) return json(res, 404, { error: 'besoin introuvable' }, cors)
      if (!canAccessOrg(user, need.orgId)) return json(res, 403, { error: 'besoin hors de votre périmètre' }, cors)
      const body = await readBody(req)
      const targetStatus = normalizeNeedStatus(body.status)
      if (!targetStatus || !NEED_STATUSES.has(body.status)) return json(res, 400, { error: 'étape invalide' }, cors)
      const currentStatus = normalizeNeedStatus(need.status) || need.status
      const isClientDecision = ['dirigeant', 'manager', 'collaborateur'].includes(user.role) && ['valide', 'cloture'].includes(targetStatus)
      if (!canUpdateNeed(user) && !isClientDecision) return json(res, 403, { error: 'votre rôle ne peut pas modifier cette étape' }, cors)
      if (isClientDecision && targetStatus === 'valide' && currentStatus !== 'en_attente_client' && currentStatus !== 'propositions_disponibles') return json(res, 409, { error: 'la validation est possible après réception des propositions' }, cors)
      if (OPERATIONS_ROLES.has(user.role)) {
        if (['valide'].includes(targetStatus)) return json(res, 403, { error: 'la validation métier appartient exclusivement au client' }, cors)
        if (targetStatus === 'en_attente_client' && transmittedProposalsFor(need.id).length === 0) return json(res, 409, { error: 'transmettez au moins une proposition avant de solliciter le client', code: 'PROPOSAL_NOT_TRANSMITTED' }, cors)
        const currentIndex = NEED_FLOW.indexOf(currentStatus)
        const targetIndex = NEED_FLOW.indexOf(targetStatus)
        const allowedStep = targetIndex >= 0 && targetIndex <= currentIndex + 1 || targetStatus === 'cloture' || targetStatus === 'annule'
        if (!allowedStep) return json(res, 409, { error: 'faites avancer le dossier étape par étape' }, cors)
      }
      if (['dirigeant', 'manager', 'collaborateur'].includes(user.role) && !['valide', 'cloture'].includes(targetStatus)) return json(res, 403, { error: 'le client peut uniquement valider ou clôturer sa demande' }, cors)
      const now = new Date().toISOString()
      need.status = targetStatus
      need.updatedAt = now
      need.timeline = [...(Array.isArray(need.timeline) ? need.timeline : []), { at: now, label: allowedText(body.label || `Étape mise à jour : ${targetStatus}`, 240, 'historique') }]
      saveDb(db)
      for (const client of clientRecipientsForOrg(need.orgId)) pushNotification({
        userId: client.id, orgId: need.orgId, type: 'need_status_changed',
        title: 'Votre besoin a été mis à jour', message: `Besoin « ${need.title} » : nouvelle étape enregistrée.`,
        meta: { needId: need.id, status: targetStatus, link: `/app/besoins/${need.id}` },
      })
      audit('need.status.update', { by: user.id, org: need.orgId, id: need.id, status: targetStatus })
      return json(res, 200, need, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/diagnostics') {
      if (!requireModuleAccess(user, res, cors, 'diagnostic')) return
      if (!canReadDiagnostics(user)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const visible = db.diagnostics
        .filter((diagnostic) => canAccessOrg(user, diagnostic.orgId))
        .map((diagnostic) => serializeDiagnosticFor(user, diagnostic))
      audit('diagnostic.read.list', { by: user.id, count: visible.length })
      return json(res, 200, visible, cors)
    }

    const diagnosticRoute = url.pathname.match(/^\/api\/diagnostics(?:\/([^/]+))?(\/consent)?$/)

    /* Restitution : pour un client, uniquement si la restitution est validée et publiée. */
    const restitutionRoute = url.pathname.match(/^\/api\/diagnostics\/([^/]+)\/restitution$/)
    if (restitutionRoute && req.method === 'GET') {
      if (!requireModuleAccess(user, res, cors, 'diagnostic')) return
      if (!canReadDiagnostics(user)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const diagnostic = db.diagnostics.find((item) => item.id === restitutionRoute[1])
      if (!diagnostic) return json(res, 404, { error: 'introuvable' }, cors)
      if (!canAccessOrg(user, diagnostic.orgId)) return json(res, 403, { error: 'interdit' }, cors)
      if (OPERATIONS_ROLES.has(user.role)) {
        const org = db.orgs.find((item) => item.id === diagnostic.orgId)
        audit('diagnostic.read.restitution', { by: user.id, id: diagnostic.id, scope: 'equipe' })
        return json(res, 200, { ...serializeDiagnosticFor(user, diagnostic), orgName: org?.name || '' }, cors)
      }
      if (!canClientViewRestitution(diagnostic)) return json(res, 403, { error: 'Restitution en cours de préparation.' }, cors)
      const org = db.orgs.find((item) => item.id === diagnostic.orgId)
      audit('diagnostic.read.restitution', { by: user.id, id: diagnostic.id, scope: 'client' })
      return json(res, 200, publicRestitutionPayload(diagnostic, org?.name || ''), cors)
    }
    if (diagnosticRoute && diagnosticRoute[1] === undefined && req.method === 'POST') {
      if (!requireModuleAccess(user, res, cors, 'diagnostic')) return
      const body = await readBody(req)
      const clientOrg = isClient(user) ? orgForUser(user) : null
      if (isClient(user) && body.orgId && body.orgId !== clientOrg?.id) return json(res, 403, { error: 'organisation hors périmètre' }, cors)
      const orgId = isClient(user) ? clientOrg?.id : body.orgId
      if (!orgId || !['Express', 'Complet'].includes(body.format)) return json(res, 400, { error: 'orgId ou format invalide' }, cors)
      if (!canAccessOrg(user, orgId)) return json(res, 403, { error: 'organisation hors périmètre' }, cors)
      if (!canCreateDiagnostic(user, body.format)) return json(res, 403, { error: 'rôle non autorisé à créer ce diagnostic' }, cors)
      const org = db.orgs.find((item) => item.id === orgId)
      if (!org) return json(res, 404, { error: 'organisation introuvable' }, cors)
      if (body.sector && body.sector !== org.sector) return json(res, 400, { error: 'secteur différent de celui de l’organisation' }, cors)
      const now = new Date().toISOString()
      const record = { id: `diag-${randomBytes(12).toString('hex')}`, orgId, format: body.format, sector: org.sector, answers: body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {}, status: 'soumis', conciergeRequest: null, conciergeRequestedAt: null, notes: '', questionNotes: {}, questionComments: {}, synthesis: null, analysis: null, publishedAt: null, publishedBy: null, restitutionVisible: true, rendezVousAt: null, restoredAt: null, consent: null, createdBy: user.id, createdAt: now, updatedAt: now }
      db.diagnostics.push(record)
      if (['dirigeant', 'manager'].includes(user.role)) {
        notifyOrgConcierge(orgId, {
          type: 'diagnostic_soumis',
          title: 'Diagnostic transmis par un client',
          message: `${org.name} · ${user.name}${record.sector ? ' · ' + record.sector : ''} · transmis le ${now.slice(0, 10)}.`,
          meta: { orgId, diagnosticId: record.id, orgName: org.name, clientName: user.name, sector: record.sector || null, submittedAt: now },
        })
      }
      saveDb(db)
      audit('diagnostic.create', { by: user.id, org: orgId, id: record.id })
      return json(res, 201, serializeDiagnosticFor(user, record), cors)
    }

    if (diagnosticRoute?.[1] && !diagnosticRoute[2] && req.method === 'GET') {
      if (!canReadDiagnostics(user)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const diagnostic = db.diagnostics.find((item) => item.id === diagnosticRoute[1])
      if (!diagnostic) return json(res, 404, { error: 'introuvable' }, cors)
      if (!canAccessOrg(user, diagnostic.orgId)) return json(res, 403, { error: 'interdit' }, cors)
      audit('diagnostic.read.one', { by: user.id, id: diagnostic.id })
      return json(res, 200, serializeDiagnosticFor(user, diagnostic), cors)
    }

    if (diagnosticRoute?.[1] && !diagnosticRoute[2] && req.method === 'PATCH') {
      if (!requireModuleAccess(user, res, cors, 'diagnostic')) return
      if (!canReadDiagnostics(user)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const diagnostic = db.diagnostics.find((item) => item.id === diagnosticRoute[1])
      if (!diagnostic) return json(res, 404, { error: 'introuvable' }, cors)
      if (!canAccessOrg(user, diagnostic.orgId)) return json(res, 403, { error: 'interdit' }, cors)
      const body = await readBody(req)
      const isStaff = OPERATIONS_ROLES.has(user.role)
      const isClient = ['dirigeant', 'manager'].includes(user.role)
      if (!isStaff && !isClient) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const now = new Date().toISOString()
      const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

      if (isClient && !isStaff) {
        if (body.restoreAck === true) {
          if (diagnostic.restoredAt) return json(res, 409, { error: 'restitution déjà prise en compte' })
          if (!canClientViewRestitution(diagnostic)) return json(res, 409, { error: 'la restitution n’est pas encore publiée' })
          diagnostic.restoredAt = now
          diagnostic.status = 'restitue'
          diagnostic.updatedAt = now
          saveDb(db)
          audit('diagnostic.restore.ack', { by: user.id, org: diagnostic.orgId, id: diagnostic.id })
          return json(res, 200, serializeDiagnosticFor(user, diagnostic), cors)
        }
        const source = body.conciergeRequest && typeof body.conciergeRequest === 'object' && !Array.isArray(body.conciergeRequest) ? body.conciergeRequest : null
        if (!source) return json(res, 400, { error: 'demande concierge manquante' }, cors)
        if (diagnostic.conciergeRequestedAt) return json(res, 409, { error: 'demande déjà enregistrée' }, cors)
        const request = {
          company: str(source.company, 160),
          contact: str(source.contact, 160),
          phone: str(source.phone, 60),
          email: str(source.email, 200),
          sector: str(source.sector, 60),
          city: str(source.city, 120),
          availability: str(source.availability, 80),
          objective: str(source.objective, 1500),
          priority: str(source.priority, 1500),
          comment: str(source.comment, 2000),
          submittedAt: str(source.submittedAt, 40) || now,
        }
        if (!request.company || !request.contact || !request.objective || !request.priority) return json(res, 400, { error: 'champs obligatoires manquants' }, cors)
        diagnostic.conciergeRequest = request
        diagnostic.conciergeRequestedAt = now
        diagnostic.status = diagnostic.status === 'restitue' ? 'restitue' : 'soumis'
        diagnostic.updatedAt = now
        saveDb(db)
        audit('diagnostic.concierge.request', { by: user.id, org: diagnostic.orgId, id: diagnostic.id })
        return json(res, 200, serializeDiagnosticFor(user, diagnostic), cors)
      }

      const notes = body.notes !== undefined ? str(body.notes, 6000) : undefined
      const questionNotes = body.questionNotes !== undefined ? body.questionNotes : undefined
      const questionComments = body.questionComments !== undefined ? body.questionComments : undefined
      const synthesis = body.synthesis !== undefined ? body.synthesis : undefined
      const status = body.status !== undefined ? body.status : undefined
      const rendezVousAt = body.rendezVousAt !== undefined ? body.rendezVousAt : undefined
      const restoredAt = body.restoredAt !== undefined ? body.restoredAt : undefined

      if (notes !== undefined) diagnostic.notes = notes
      const sanitizeQuestionMap = (value, label) => {
        if (value !== null && typeof value !== 'object') return { error: `${label} invalide` }
        const clean = {}
        if (value) for (const [key, item] of Object.entries(value)) clean[String(key).slice(0, 40)] = str(item, 2000)
        return { clean }
      }
      if (questionNotes !== undefined) {
        const result = sanitizeQuestionMap(questionNotes, 'questionNotes')
        if (result.error) return json(res, 400, { error: result.error }, cors)
        diagnostic.questionNotes = result.clean
      }
      if (questionComments !== undefined) {
        const result = sanitizeQuestionMap(questionComments, 'questionComments')
        if (result.error) return json(res, 400, { error: result.error }, cors)
        diagnostic.questionComments = result.clean
      }
      if (synthesis !== undefined) {
        if (synthesis !== null && typeof synthesis !== 'object') return json(res, 400, { error: 'synthèse invalide' }, cors)
        const chapters = ['confirmed', 'priorities', 'watch', 'opportunities', 'actions']
        const clean = {}
        if (synthesis) for (const chapter of chapters) clean[chapter] = Array.isArray(synthesis[chapter]) ? synthesis[chapter].slice(0, 12).map((item) => str(item, 400)) : []
        diagnostic.synthesis = clean
      }
      if (body.analysis !== undefined) {
        if (body.analysis !== null && typeof body.analysis !== 'object') return json(res, 400, { error: 'analyse invalide' }, cors)
        const current = diagnostic.analysis && typeof diagnostic.analysis === 'object' ? { ...diagnostic.analysis } : {}
        const clean = { ...current }
        if (body.analysis) {
          for (const key of ANALYSIS_STRINGS) {
            if (typeof body.analysis[key] === 'string') clean[key] = str(body.analysis[key], key === 'internalNotes' ? 6000 : 200)
          }
          for (const key of ANALYSIS_LISTS) {
            if (Array.isArray(body.analysis[key])) clean[key] = body.analysis[key].slice(0, 12).map((item) => str(item, 400))
          }
        }
        diagnostic.analysis = clean
      }
      if (status !== undefined) {
        if (!DIAGNOSTIC_STATUSES.has(status)) return json(res, 400, { error: 'statut invalide' }, cors)
        diagnostic.status = status
      }
      if (rendezVousAt !== undefined) diagnostic.rendezVousAt = rendezVousAt === null || rendezVousAt === '' ? null : str(rendezVousAt, 40)
      if (restoredAt !== undefined) diagnostic.restoredAt = restoredAt === null || restoredAt === '' ? null : str(restoredAt, 40)
      if (body.restitutionVisible !== undefined) {
        if (typeof body.restitutionVisible !== 'boolean') return json(res, 400, { error: 'restitutionVisible invalide' }, cors)
        diagnostic.restitutionVisible = body.restitutionVisible
      }
      let justPublished = false
      if (body.publishRestitution === true) {
        const analysis = diagnostic.analysis || {}
        const list = (key) => (Array.isArray(analysis[key]) ? analysis[key].filter((item) => typeof item === 'string' && item.trim().length > 0) : [])
        const strengths = list('strengths')
        const weaknesses = list('weaknesses')
        const priorities = list('priorities')
        const opportunities = list('opportunities')
        const risks = list('risks')
        const actionPlan = list('actionPlan')
        const hasComment = (diagnostic.notes || '').trim().length > 0
        const missing = []
        if (strengths.length < 3) missing.push('au moins 3 points forts')
        if (weaknesses.length < 3) missing.push('au moins 3 points à améliorer')
        if (priorities.length < 3) missing.push('au moins 3 priorités retenues')
        if (!opportunities.length) missing.push('au moins 1 opportunité')
        if (!risks.length) missing.push('au moins 1 risque / menace')
        if (!actionPlan.length) missing.push('au moins 1 étape de plan d’action')
        if (!hasComment) missing.push('le commentaire de restitution pour le client')
        if (missing.length) {
          return json(res, 400, { error: `Restitution incomplète : ${missing.join(', ')} ${missing.length > 1 ? 'sont requis' : 'est requis'} avant la publication.` }, cors)
        }
        diagnostic.status = 'restitue'
        diagnostic.publishedAt = diagnostic.publishedAt || now
        diagnostic.publishedBy = user.id
        diagnostic.restitutionVisible = true
        justPublished = true
      }
      diagnostic.updatedAt = now
      if (justPublished) {
        const org = db.orgs.find((o) => o.id === diagnostic.orgId)
        notifyRestitutionPublished(diagnostic, org?.name || '')
      }
      saveDb(db)
      if (justPublished) {
        const org = db.orgs.find((o) => o.id === diagnostic.orgId)
        await sendRestitutionPublishedEmails(diagnostic, org?.name || '')
      }
      audit('diagnostic.update', { by: user.id, org: diagnostic.orgId, id: diagnostic.id, status: diagnostic.status || '', published: justPublished })
      return json(res, 200, serializeDiagnosticFor(user, diagnostic), cors)
    }

    if (diagnosticRoute?.[1] && diagnosticRoute[2] && req.method === 'POST') {
      if (user.role !== 'dirigeant') return json(res, 403, { error: 'seul le dirigeant de l’entreprise peut enregistrer ce consentement' }, cors)
      const diagnostic = db.diagnostics.find((item) => item.id === diagnosticRoute[1])
      if (!diagnostic) return json(res, 404, { error: 'introuvable' }, cors)
      if (!canAccessOrg(user, diagnostic.orgId)) return json(res, 403, { error: 'interdit' }, cors)
      const body = await readBody(req)
      if (typeof body.version !== 'string' || !body.version.trim() || body.version.length > 100) return json(res, 400, { error: 'version requise' }, cors)
      const entry = { acceptedAt: new Date().toISOString(), version: body.version.trim(), by: user.name, recordedAt: new Date().toISOString(), byUserId: user.id }
      diagnostic.consents = diagnostic.consents || []
      diagnostic.consents.push(entry)
      db.consents.push({ id: `consent-${randomBytes(10).toString('hex')}`, diagnosticId: diagnostic.id, orgId: diagnostic.orgId, ...entry })
      saveDb(db)
      audit('consent.record', { by: user.id, diagnosticId: diagnostic.id, version: entry.version })
      return json(res, 201, { ok: true, consent: entry }, cors)
    }

    /* ------------------------------------------------------------------ */
    /* PHASE 5 — Offres d'accompagnement & missions                        */
    /* Catalogue + acceptation côté client, gestion concierge/admin.       */
    /* Les missions ne sont accessibles qu'après acceptation d'une offre   */
    /* (code OFFER_REQUIRED), indépendamment des modules et du SaaS.       */
    /* ------------------------------------------------------------------ */

    if (req.method === 'GET' && url.pathname === '/api/offers') {
      const isStaff = OPERATIONS_ROLES.has(user.role)
      if (!CLIENT_ROLES.has(user.role) && !isStaff) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      let orgId = null
      if (isStaff) {
        orgId = url.searchParams.get('orgId')
        if (orgId && !canAccessOrg(user, orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      } else {
        const org = orgForUser(user)
        if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
        if (org.active === false) return json(res, 403, { error: 'compte entreprise désactivé', code: 'ACCESS_DISABLED' }, cors)
        orgId = org.id
      }
      const catalog = OFFER_CODES.map((code) => offerCatalogItem(code))
      const diagnostic = orgId ? latestPublishedDiagnosticForOrg(orgId) : null
      if (!isStaff && !diagnostic) {
        return json(res, 200, { locked: true, reason: 'DIAGNOSTIC_NOT_PUBLISHED', offers: [], current: null, recommendedOfferCode: null, recommendedOfferSource: null, diagnosticId: null }, cors)
      }
      return json(res, 200, {
        locked: false,
        offers: catalog,
        current: orgId ? normalizedOfferRecord(activeOfferForOrg(orgId)) : null,
        pending: orgId ? db.offers.filter((offer) => offer.orgId === orgId && normalizeOfferStatus(offer.status) === 'en_attente_validation').map(normalizedOfferRecord) : [],
        recommendedOfferCode: diagnostic ? recommendOfferCode(diagnostic) : null,
        recommendedOfferSource: diagnostic ? recommendOfferSource(diagnostic) : null,
        diagnosticId: diagnostic ? diagnostic.id : null,
      }, cors)
    }

    if (req.method === 'POST' && url.pathname === '/api/offers/accept') {
      if (!isClient(user)) return json(res, 403, { error: 'seul un client de l’entreprise peut sélectionner une offre' }, cors)
      const org = orgForUser(user)
      if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
      if (org.active === false) return json(res, 403, { error: 'compte entreprise désactivé', code: 'ACCESS_DISABLED' }, cors)
      const body = await readBody(req)
      const code = normalizeOfferCode(body.offerCode)
      if (!code) return json(res, 400, { error: 'offre invalide' }, cors)
      const diagnostic = latestPublishedDiagnosticForOrg(org.id)
      if (!diagnostic) return json(res, 403, { error: 'La restitution doit être publiée avant de choisir une offre.', code: 'OFFERS_LOCKED' }, cors)
      const existing = activeOfferForOrg(org.id)
      if (existing) return json(res, 409, { error: `Une offre (${existing.offerName || existing.offerCode}) est déjà acceptée pour votre entreprise.`, code: 'OFFER_ALREADY_ACCEPTED', current: existing }, cors)
      const pending = db.offers.find((offer) => offer.orgId === org.id && normalizeOfferStatus(offer.status) === 'en_attente_validation')
      if (pending) return json(res, 409, { error: 'Une sélection d’offre est déjà en attente de validation.', code: 'REQUEST_ALREADY_PENDING', request: normalizedOfferRecord(pending) }, cors)
      const item = offerCatalogItem(code)
      const now = new Date().toISOString()
      const concierge = conciergeForOrg(org.id)
      const record = {
        id: `off-${randomBytes(12).toString('hex')}`,
        orgId: org.id,
        organizationId: org.id,
        diagnosticId: diagnostic.id,
        offerCode: code,
        offerName: item.name,
        price: item.price,
        status: 'en_attente_validation',
        requestedAt: now,
        requestedBy: user.id,
        requestedByName: user.name || '',
        decidedAt: null,
        decidedBy: null,
        decisionReason: null,
        acceptedByConciergeId: concierge?.id || null,
        createdAt: now,
        updatedAt: now,
      }
      db.offers.push(record)
      notifyOrgConcierge(org.id, {
        type: 'offre_validation_demandee',
        title: 'Offre à valider',
        message: `${org.name} a sélectionné l’offre ${item.name} (${new Intl.NumberFormat('fr-FR').format(item.price)} MAD).`,
        meta: { requestType: 'offer', requestId: record.id, offerId: record.id, offerCode: code, orgId: org.id, price: item.price, diagnosticId: diagnostic.id },
      })
      saveDb(db)
      audit('offer.request', { by: user.id, org: org.id, id: record.id, code, price: item.price })
      return json(res, 202, { offer: record, missions: [], pendingApproval: true }, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/offers/current') {
      if (!CLIENT_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const org = orgForUser(user)
      if (!org) return json(res, 200, { current: null }, cors)
      return json(res, 200, { current: normalizedOfferRecord(activeOfferForOrg(org.id)) }, cors)
    }

    const missionValidationRoute = url.pathname.match(/^\/api\/missions\/([^/]+)\/validation$/)
    if (missionValidationRoute && req.method === 'PATCH') {
      const mission = db.missions.find((item) => item.id === missionValidationRoute[1])
      if (!mission) return json(res, 404, { error: 'mission introuvable' }, cors)
      if (!canClientValidate(user, mission.orgId)) return json(res, 403, { error: 'validation réservée au client de l’entreprise' }, cors)
      if (!missionAllowedByAcceptedOffer(mission)) return json(res, 403, { error: 'mission hors de l’offre active' }, cors)
      if (normalizeMissionStatus(mission.status) !== 'a_valider_client') return json(res, 409, { error: 'la mission n’est pas en attente de validation client' }, cors)
      const body = await readBody(req)
      if (!['validate', 'correction'].includes(body.action)) return json(res, 400, { error: 'action doit être validate ou correction' }, cors)
      const feedback = typeof body.feedback === 'string' ? body.feedback.trim().slice(0, 2000) : ''
      if (body.action === 'correction' && !feedback) return json(res, 400, { error: 'le motif de correction est requis' }, cors)
      const now = new Date().toISOString()
      mission.status = body.action === 'validate' ? 'validee_client' : 'en_cours'
      mission.clientFeedback = feedback || null
      mission.clientValidatedAt = body.action === 'validate' ? now : null
      mission.clientValidatedBy = body.action === 'validate' ? user.id : null
      mission.correctionRequestedAt = body.action === 'correction' ? now : null
      mission.correctionRequestedBy = body.action === 'correction' ? user.id : null
      mission.updatedAt = now
      saveDb(db); audit('mission.client.validation', { by: user.id, org: mission.orgId, id: mission.id, action: body.action, feedback: feedback || null })
      return json(res, 200, mission, cors)
    }

    const missionRoute = url.pathname.match(/^\/api\/missions\/([^/]+)$/)

    if (req.method === 'GET' && url.pathname === '/api/missions') {
      if (!CLIENT_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      const org = orgForUser(user)
      if (!org) return json(res, 403, { error: 'entreprise introuvable' }, cors)
      if (org.active === false) return json(res, 403, { error: 'compte entreprise désactivé', code: 'ACCESS_DISABLED' }, cors)
      const offer = activeOfferForOrg(org.id)
      if (!offer) return json(res, 403, { error: 'Une offre d’accompagnement doit être acceptée avant d’accéder aux missions.', code: 'OFFER_REQUIRED' }, cors)
      const countBefore = db.missions.length
      const missions = missionsForAcceptedOffer(offer)
      if (db.missions.length !== countBefore) saveDb(db)
      audit('mission.read.list', { by: user.id, org: org.id, count: missions.length, scope: 'client' })
      return json(res, 200, { offer: normalizedOfferRecord(offer), missions }, cors)
    }

    if (missionRoute && req.method === 'GET') {
      const mission = db.missions.find((item) => item.id === missionRoute[1])
      if (!mission) return json(res, 404, { error: 'mission introuvable' }, cors)
      if (CLIENT_ROLES.has(user.role)) {
        const org = orgForUser(user)
        if (!org || mission.orgId !== org.id) return json(res, 403, { error: 'mission hors de votre périmètre' }, cors)
        if (!activeOfferForOrg(org.id)) return json(res, 403, { error: 'Une offre d’accompagnement doit être acceptée avant d’accéder aux missions.', code: 'OFFER_REQUIRED' }, cors)
        if (!missionAllowedByAcceptedOffer(mission)) return json(res, 403, { error: 'Cet axe n’est pas inclus dans votre offre acceptée.', code: 'AXIS_NOT_INCLUDED' }, cors)
        const countBefore = db.missions.length
        const axis = missionsForAcceptedOffer(activeOfferForOrg(org.id)).find((item) => item.id === mission.id) || mission
        if (db.missions.length !== countBefore) saveDb(db)
        return json(res, 200, axis, cors)
      }
      if (OPERATIONS_ROLES.has(user.role)) {
        if (!canManageOrg(user, mission.orgId)) return json(res, 403, { error: 'mission hors de votre périmètre' }, cors)
        if (!missionAllowedByAcceptedOffer(mission)) return json(res, 403, { error: 'axe hors de l’offre acceptée', code: 'AXIS_NOT_INCLUDED' }, cors)
        const org = db.orgs.find((o) => o.id === mission.orgId)
        const offer = activeOfferForOrg(mission.orgId)
        const countBefore = db.missions.length
        const axis = missionsForAcceptedOffer(offer).find((item) => item.id === mission.id) || mission
        if (db.missions.length !== countBefore) saveDb(db)
        return json(res, 200, { ...axis, orgName: org?.name || '' }, cors)
      }
      return json(res, 403, { error: 'rôle non autorisé' }, cors)
    }

    if (missionRoute && req.method === 'PATCH') {
      const mission = db.missions.find((item) => item.id === missionRoute[1])
      if (!mission) return json(res, 404, { error: 'mission introuvable' }, cors)
      const body = await readBody(req)
      const now = new Date().toISOString()
      const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
      if (CLIENT_ROLES.has(user.role)) {
        const org = orgForUser(user)
        if (!org || mission.orgId !== org.id) return json(res, 403, { error: 'mission hors de votre périmètre' }, cors)
        if (!activeOfferForOrg(org.id)) return json(res, 403, { error: 'Une offre d’accompagnement doit être acceptée avant d’accéder aux missions.', code: 'OFFER_REQUIRED' }, cors)
        if (!missionAllowedByAcceptedOffer(mission)) return json(res, 403, { error: 'Cet axe n’est pas inclus dans votre offre acceptée.', code: 'AXIS_NOT_INCLUDED' }, cors)
        if (body.clientFeedback !== undefined) mission.clientFeedback = str(body.clientFeedback, 2000) || null
        if (body.instructionsResponse !== undefined) mission.instructionsResponse = str(body.instructionsResponse, 4000) || null
        mission.updatedAt = now
        saveDb(db)
        audit('mission.update', { by: user.id, org: mission.orgId, id: mission.id, scope: 'client' })
        return json(res, 200, mission, cors)
      }
      if (!OPERATIONS_ROLES.has(user.role)) return json(res, 403, { error: 'rôle non autorisé' }, cors)
      if (!canManageOrg(user, mission.orgId)) return json(res, 403, { error: 'mission hors de votre périmètre' }, cors)
      if (!missionAllowedByAcceptedOffer(mission)) return json(res, 403, { error: 'axe hors de l’offre acceptée', code: 'AXIS_NOT_INCLUDED' }, cors)
      if (body.title !== undefined) mission.title = str(body.title, 200) || mission.title
      if (body.description !== undefined) mission.description = str(body.description, 2000)
      if (body.instructions !== undefined) mission.instructions = str(body.instructions, 4000)
      if (body.priority !== undefined && ['faible', 'normale', 'haute'].includes(body.priority)) mission.priority = body.priority
      if (body.dueDate !== undefined) mission.dueDate = body.dueDate ? str(body.dueDate, 40) : null
      if (body.assignedConciergeId !== undefined) mission.assignedConciergeId = body.assignedConciergeId || null
      if (Array.isArray(body.deliverables)) mission.deliverables = body.deliverables.slice(0, 50).map((item) => str(item, 240)).filter(Boolean)
      if (body.status !== undefined) {
        const targetStatus = normalizeMissionStatus(body.status)
        if (!STAFF_MISSION_STATUSES.has(targetStatus)) return json(res, 403, { error: 'la validation client ne peut pas être effectuée par le personnel' }, cors)
        if (targetStatus === 'terminee' && normalizeMissionStatus(mission.status) !== 'validee_client') return json(res, 409, { error: 'la mission doit d’abord être validée par le client' }, cors)
        mission.status = targetStatus
        mission.completedAt = targetStatus === 'terminee' ? (mission.completedAt || now) : null
      }
      mission.updatedAt = now
      saveDb(db)
      audit('mission.update', { by: user.id, org: mission.orgId, id: mission.id, scope: user.role })
      return json(res, 200, mission, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/concierge/missions') {
      if (user.role !== 'concierge') return json(res, 403, { error: 'concierge requis' }, cors)
      const allowed = new Set(Array.isArray(user.orgIds) ? user.orgIds : [])
      const countBefore = db.missions.length
      const rows = db.orgs.filter((org) => allowed.has(org.id)).flatMap((org) => {
        const offer = activeOfferForOrg(org.id)
        return offer ? missionsForAcceptedOffer(offer).map((mission) => ({ ...mission, orgName: org.name || '' })) : []
      })
      if (db.missions.length !== countBefore) saveDb(db)
      return json(res, 200, rows, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/missions') {
      if (!adminOnly(user, res, cors)) return
      const countBefore = db.missions.length
      const rows = db.orgs.flatMap((org) => {
        const offer = activeOfferForOrg(org.id)
        return offer ? missionsForAcceptedOffer(offer).map((mission) => ({ ...mission, orgName: org.name || '' })) : []
      })
      if (db.missions.length !== countBefore) saveDb(db)
      return json(res, 200, rows, cors)
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/offers') {
      if (!adminOnly(user, res, cors)) return
      const rows = db.offers.map((offer) => ({ ...normalizedOfferRecord(offer), orgName: db.orgs.find((o) => o.id === offer.orgId)?.name || '' }))
      return json(res, 200, { offers: rows, catalog: OFFER_CODES.map((code) => offerCatalogItem(code)) }, cors)
    }

    const adminOfferRoute = url.pathname.match(/^\/api\/admin\/offers\/([^/]+)$/)
    if (adminOfferRoute && req.method === 'PATCH') {
      if (!adminOnly(user, res, cors)) return
      const offer = db.offers.find((item) => item.id === adminOfferRoute[1])
      if (!offer) return json(res, 404, { error: 'offre introuvable' }, cors)
      if (!canManageOrg(user, offer.orgId) || !canAccessOrg(user, offer.orgId)) return json(res, 403, { error: 'entreprise hors de votre périmètre' }, cors)
      const body = await readBody(req)
      if (body.status !== undefined) {
        const targetStatus = normalizeOfferStatus(body.status)
        if (!OFFER_STATUSES.has(targetStatus)) return json(res, 400, { error: 'statut d’offre invalide' }, cors)
        if (targetStatus === 'actif' && normalizeOfferStatus(offer.status) !== 'actif' && activeOfferForOrg(offer.orgId)) return json(res, 409, { error: 'une autre offre est déjà active pour cette entreprise', code: 'OFFER_ALREADY_ACCEPTED' }, cors)
        offer.status = targetStatus
        if (targetStatus === 'actif') {
          offer.acceptedAt = offer.acceptedAt || new Date().toISOString()
          ensureMissionsForOffer(offer)
        }
        if (['actif', 'refuse'].includes(targetStatus)) { offer.decidedAt = new Date().toISOString(); offer.decidedBy = user.id; offer.decisionReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null }
      }
      offer.updatedAt = new Date().toISOString()
      saveDb(db)
      audit('admin.offer.update', { by: user.id, org: offer.orgId, id: offer.id, status: offer.status })
      return json(res, 200, normalizedOfferRecord(offer), cors)
    }

    return json(res, 404, { error: 'route inconnue' }, cors)
  } catch (error) {
    const status = error.status || 500
    if (status === 500) audit('server.error', { path: url.pathname, message: String(error.message || error).slice(0, 240) })
    return json(res, status, { error: status === 500 ? 'erreur serveur' : error.message })
  }
})

const port = Number(process.env.PORT || 8787)
server.listen(port, () => console.log(`ALLNEEDS backend sur http://127.0.0.1:${port}`))
export default server

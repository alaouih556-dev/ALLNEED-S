import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const dir = mkdtempSync(join(tmpdir(), 'allneeds-phase5-missions-'))
const origin = 'http://127.0.0.1:5176'
const port = 8803
const base = `http://127.0.0.1:${port}`

async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${hash.toString('hex')}`
}

const adminPassword = 'AdminPassword!2026'
const ownerPassword = 'OwnerPassword!2026'
const ownerBPassword = 'OwnerBPassword!2026'
const conciergePassword = 'ConciergePassword!2026'
const outsiderPassword = 'OutsiderPassword!2026'
const legacyPassword = 'LegacyPassword!2026'
const orgA = 'org-a-phase5'
const orgB = 'org-b-phase5'
const orgLegacy = 'org-legacy-phase5'
const orgPro = 'org-pro-phase5'
const orgPerformance = 'org-performance-phase5'

const modules = { diagnostic: true, besoins: false, missions: false, rendezVous: false, documents: false, messages: false, devis: false, prestataires: false, abonnement: false, notifications: false, equipe: false, results: false }
const orgRow = (id, name) => ({ id, name, sector: 'sante', active: true, modules: { ...modules }, saas: { subscriptionActive: false, enabled: false, startDate: null, endDate: null, plan: null }, slug: id })

const db = {
  users: [
    { id: 'admin', email: 'admin@test.ma', role: 'admin', orgIds: ['*'], name: 'Admin', active: true, passwordConfigured: true, passwordHash: await passwordHash(adminPassword), permissions: [] },
    { id: 'ownerA', email: 'ownerA@test.ma', role: 'dirigeant', orgIds: [orgA], name: 'Dirigeant A', active: true, passwordConfigured: true, passwordHash: await passwordHash(ownerPassword), permissions: [] },
    { id: 'ownerB', email: 'ownerB@test.ma', role: 'dirigeant', orgIds: [orgB], name: 'Dirigeant B', active: true, passwordConfigured: true, passwordHash: await passwordHash(ownerBPassword), permissions: [] },
    { id: 'conciergeA', email: 'conciergeA@test.ma', role: 'concierge', orgIds: [orgA], name: 'Concierge A', active: true, passwordConfigured: true, passwordHash: await passwordHash(conciergePassword), permissions: [] },
    { id: 'conciergeB', email: 'conciergeB@test.ma', role: 'concierge', orgIds: [orgB], name: 'Concierge B', active: true, passwordConfigured: true, passwordHash: await passwordHash(outsiderPassword), permissions: [] },
    { id: 'ownerLegacy', email: 'legacy@test.ma', role: 'dirigeant', orgIds: [orgLegacy], name: 'Dirigeant Legacy', active: true, passwordConfigured: true, passwordHash: await passwordHash(legacyPassword), permissions: [] },
  ],
  orgs: [orgRow(orgA, 'Clinique A'), orgRow(orgB, 'Clinique B'), orgRow(orgLegacy, 'Clinique Legacy'), orgRow(orgPro, 'Clinique Pro'), orgRow(orgPerformance, 'Clinique Performance')],
  diagnostics: [],
  needs: [],
  consents: [],
  registrations: [
    { id: 'reg-a', orgId: orgA, status: 'actif', conciergeId: 'conciergeA', events: [], appointmentStatus: 'valide' },
    { id: 'reg-b', orgId: orgB, status: 'actif', conciergeId: 'conciergeB', events: [], appointmentStatus: 'valide' },
  ],
  invitations: [],
  notifications: [],
  offers: [
    { id: 'off-legacy', orgId: orgLegacy, organizationId: orgLegacy, diagnosticId: null, offerCode: 'STARTER', offerName: 'STARTER', price: 3445, status: 'acceptee', acceptedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'off-pro', orgId: orgPro, organizationId: orgPro, diagnosticId: null, offerCode: 'PRO', offerName: 'PRO', price: 6445, status: 'acceptee', acceptedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'off-performance', orgId: orgPerformance, organizationId: orgPerformance, diagnosticId: null, offerCode: 'PERFORMANCE', offerName: 'PERFORMANCE', price: 10945, status: 'acceptee', acceptedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  missions: [
    { id: 'legacy-action', orgId: orgLegacy, offerRecordId: 'off-legacy', offerCode: 'STARTER', title: 'Ancienne action conservée', description: 'Action créée avant les axes métier.', status: 'a_faire', priority: 'normale', dueDate: null, assignedConciergeId: null, instructions: '', deliverables: [], documents: [], clientFeedback: null, order: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedAt: null },
    { id: 'legacy-rh-out-of-plan', orgId: orgLegacy, offerRecordId: 'off-legacy', offerCode: 'STARTER', axisKey: 'rh', title: 'RH & organisation', description: 'Axe hors plan injecté pour vérifier le filtrage.', status: 'a_faire', priority: 'normale', dueDate: null, assignedConciergeId: null, instructions: '', deliverables: [], documents: [], clientFeedback: null, order: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedAt: null },
  ],
}

writeFileSync(join(dir, 'db.json'), JSON.stringify(db, null, 2))

const child = spawn(process.execPath, ['backend/server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), ALLNEEDS_DATA_DIR: dir, ALLNEEDS_FRONTEND_ORIGIN: origin, ALLNEEDS_PUBLIC_URL: origin, ALLNEEDS_SESSION_SECRET: '0123456789abcdefghijklmnopqrstuvwxyz-TEST-secret' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let stderr = ''
child.stderr.on('data', (d) => { stderr += d })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function wait() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return } catch {}
    await sleep(100)
  }
  throw new Error(`backend indisponible: ${stderr}`)
}
function assert(x, msg) { if (!x) throw new Error(msg) }
async function req(path, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { Origin: origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = {}
  try { data = await r.json() } catch {}
  return { r, data, cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email, password) {
  const x = await req('/api/auth/login', { method: 'POST', body: { email, password } })
  assert(x.r.status === 200, `login ${email}`)
  return x.cookie
}

const complete = {
  priorityLevel: 'Importante',
  internalNotes: 'Interne.',
  strengths: ['Fort 1', 'Fort 2', 'Fort 3'],
  weaknesses: ['Faible 1', 'Faible 2', 'Faible 3'],
  priorities: ['Priorité 1', 'Priorité 2', 'Priorité 3'],
  opportunities: ['Opportunité 1'],
  risks: ['Risque 1'],
  actionPlan: ['Étape 1'],
  recommendations: ['Reco 1'],
}

async function publishAndAccept(ownerCookie, conciergeCookie, orgId) {
  let x = await req('/api/diagnostics', { method: 'POST', cookie: ownerCookie, body: { orgId, format: 'Complet', sector: 'sante', answers: { '11': { score: 4, comment: 'Bien' } } } })
  assert(x.r.status === 201, `prep: soumission ${orgId}`)
  const id = x.data.id
  x = await req(`/api/diagnostics/${id}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'en_analyse' } })
  assert(x.r.status === 200, `prep: en_analyse ${orgId}`)
  x = await req(`/api/diagnostics/${id}`, { method: 'PATCH', cookie: conciergeCookie, body: { notes: 'Restitution.', analysis: complete, publishRestitution: true } })
  assert(x.r.status === 200, `prep: publication ${orgId}`)
  x = await req('/api/offers/accept', { method: 'POST', cookie: ownerCookie, body: { offerCode: 'BASIQUE' } })
  assert(x.r.status === 202, `prep: demande offre ${orgId}`)
  x = await req(`/api/staff/requests/offer/${x.data.offer.id}`, { method: 'PATCH', cookie: conciergeCookie, body: { decision: 'approve' } })
  assert(x.r.status === 200, `prep: approbation offre ${orgId}`)
}

try {
  await wait()
  const adminCookie = await login('admin@test.ma', adminPassword)
  const ownerACookie = await login('ownerA@test.ma', ownerPassword)
  const ownerBCookie = await login('ownerB@test.ma', ownerBPassword)
  const conciergeACookie = await login('conciergeA@test.ma', conciergePassword)
  const conciergeBCookie = await login('conciergeB@test.ma', outsiderPassword)
  const legacyCookie = await login('legacy@test.ma', legacyPassword)

  // Mapping backend unique du catalogue : 2 axes BASIQUE, 4 PRO, 5 PERFORMANCE.
  let x = await req(`/api/offers?orgId=${orgA}`, { cookie: adminCookie })
  assert(x.r.status === 200, 'catalogue offres accessible à l’admin')
  const catalogCounts = Object.fromEntries(x.data.offers.map((offer) => [offer.code, offer.missions.length]))
  assert(catalogCounts.BASIQUE === 2 && catalogCounts.PRO === 4 && catalogCounts.PERFORMANCE === 5, 'mapping des axes 2/4/5')
  const catalogAxes = Object.fromEntries(x.data.offers.map((offer) => [offer.code, offer.missions.map((mission) => mission.key).join('|')]))
  assert(catalogAxes.BASIQUE === 'commercial|marketing', 'mapping BASIQUE: commercial + marketing')
  assert(catalogAxes.PRO === 'commercial|marketing|rh|juridique', 'mapping PRO: commercial + marketing + rh + juridique')
  assert(catalogAxes.PERFORMANCE === 'commercial|marketing|rh|juridique|financement', 'mapping PERFORMANCE: les cinq axes métier')
  const expectedTitles = [
    'Commercial & force de vente',
    'Visibilité, marketing & communication',
    'RH & organisation',
    'Réduction des charges & juridique',
    'Accompagnement & programmes de financement',
  ]
  assert(x.data.offers.find((offer) => offer.code === 'PERFORMANCE').missions.map((mission) => mission.title).join('|') === expectedTitles.join('|'), 'intitulés métier exacts des axes')

  // Compatibilité STARTER et sécurité URL : les données historiques restent des actions, l’axe RH est exclu.
  x = await req('/api/missions', { cookie: legacyCookie })
  assert(x.r.status === 200 && x.data.offer.offerCode === 'BASIQUE', 'STARTER normalisé en BASIQUE')
  assert(x.data.missions.length === 2 && x.data.missions.every((mission) => ['commercial', 'marketing'].includes(mission.axisKey)), 'STARTER limité aux axes BASIQUE')
  assert(x.data.missions.some((mission) => mission.actions?.some((action) => action.id === 'legacy-action')), 'action historique conservée et rattachée')
  x = await req('/api/missions/legacy-rh-out-of-plan', { cookie: legacyCookie })
  assert(x.r.status === 403 && x.data.code === 'AXIS_NOT_INCLUDED', 'URL directe vers un axe hors plan refusée')

  // Accès missions refusé AVANT acceptation (indépendant du module `missions`, ici désactivé).
  x = await req('/api/missions', { cookie: ownerACookie })
  assert(x.r.status === 403 && x.data.code === 'OFFER_REQUIRED', 'OFFER_REQUIRED: missions bloquées sans offre acceptée')

  await publishAndAccept(ownerACookie, conciergeACookie, orgA)

  // Liste des missions client, triées, offerte rattachée.
  x = await req('/api/missions', { cookie: ownerACookie })
  assert(x.r.status === 200 && x.data.offer && x.data.offer.offerCode === 'BASIQUE', 'client: offre active')
  const list = x.data.missions
  assert(list.length === 2, 'client BASIQUE: exactement deux axes')
  assert(list.map((mission) => mission.title).join('|') === 'Commercial & force de vente|Visibilité, marketing & communication', 'client BASIQUE: axes métier attendus')
  const missionId = list[0].id

  // Pas de duplication (relecture + ré-acceptation admin idempotente).
  x = await req('/api/missions', { cookie: ownerACookie })
  assert(x.data.missions.length === list.length, 'G: relecture sans duplication')
  x = await req('/api/admin/offers', { cookie: adminCookie })
  assert(x.r.status === 200 && x.data.offers.length === 4, 'admin: offres enregistrées')
  const offerId = x.data.offers.find((offer) => offer.orgId === orgA).id
  x = await req(`/api/admin/offers/${offerId}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'acceptee' } })
  assert(x.r.status === 200, 'admin: PATCH acceptee idempotent')
  x = await req('/api/missions', { cookie: ownerACookie })
  assert(x.data.missions.length === list.length, 'G: ré-acceptation ne duplique pas')

  // Client : lit le détail, met à jour sa réponse, ne peut PAS changer le statut.
  x = await req(`/api/missions/${missionId}`, { cookie: ownerACookie })
  assert(x.r.status === 200 && x.data.id === missionId, 'client: détail mission')
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: ownerACookie, body: { instructionsResponse: 'Éléments transmis', clientFeedback: 'Retour client', status: 'termine' } })
  assert(x.r.status === 200 && x.data.instructionsResponse === 'Éléments transmis' && x.data.clientFeedback === 'Retour client', 'client: réponse enregistrée')
  assert(x.data.status === 'a_faire' && x.data.completedAt === null, 'client: statut non modifiable')

  // Isolation entreprise : un autre client n'accède pas à la mission.
  x = await req(`/api/missions/${missionId}`, { cookie: ownerBCookie })
  assert(x.r.status === 403, 'H: client d’une autre entreprise refusé')
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: ownerBCookie, body: { clientFeedback: 'x' } })
  assert(x.r.status === 403, 'H: PATCH d’une autre entreprise refusé')

  // Concierge NON affecté : aucune mission dans son portefeuille, aucun accès.
  x = await req('/api/account-manager/missions', { cookie: conciergeBCookie })
  assert(x.r.status === 200 && !x.data.some((m) => m.id === missionId), 'I: concierge non affecté ne voit pas la mission')
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: conciergeBCookie, body: { status: 'en_cours' } })
  assert(x.r.status === 403, 'I: concierge non affecté ne peut pas modifier')

  // Concierge affecté : voit la mission + transitions de statut (a_faire -> en_cours -> a_valider_client).
  x = await req('/api/account-manager/missions', { cookie: conciergeACookie })
  assert(x.r.status === 200 && x.data.some((m) => m.id === missionId && m.orgName === 'Clinique A'), 'J: concierge affecté voit la mission')
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: conciergeACookie, body: { status: 'en_cours', priority: 'haute', instructions: 'Cadrer le périmètre.' } })
  assert(x.r.status === 200 && x.data.status === 'en_cours' && x.data.priority === 'haute' && x.data.instructions === 'Cadrer le périmètre.', 'J: en_cours + champs opérationnels')
  // Statut legacy 'en_attente_client' est normalisé en 'a_valider_client'.
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: conciergeACookie, body: { status: 'en_attente_client' } })
  assert(x.r.status === 200 && x.data.status === 'a_valider_client', 'J: en_attente_client normalisé en a_valider_client')
  // Le personnel NE PEUT PAS passer à validee_client (réservé au client).
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: conciergeACookie, body: { status: 'validee_client' } })
  assert(x.r.status === 403, 'J: personnel ne peut pas valider à la place du client')
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: conciergeACookie, body: { status: 'invalide' } })
  assert(x.r.status === 403, 'J: statut invalide refusé')
  // Le personnel peut passer à terminee uniquement depuis validee_client (ici refusé car pas encore validée).
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: conciergeACookie, body: { status: 'termine' } })
  assert(x.r.status === 409, 'J: termine refusé avant validation client (normalisé terminee, prérequis non rempli)')

  // Admin : vue globale + modification (statuts opérationnels uniquement).
  x = await req('/api/admin/missions', { cookie: adminCookie })
  assert(x.r.status === 200 && x.data.some((m) => m.id === missionId && m.orgName === 'Clinique A'), 'K: admin voit toutes les missions')
  assert(x.data.filter((mission) => mission.orgId === orgPro).length === 4, 'K: offre PRO limitée à quatre axes')
  assert(x.data.filter((mission) => mission.orgId === orgPerformance).length === 5, 'K: offre PERFORMANCE limitée à cinq axes')
  assert(x.data.filter((mission) => mission.orgId === orgPro).map((mission) => mission.axisKey).join('|') === catalogAxes.PRO, 'K: admin voit uniquement les axes PRO autorisés')
  assert(x.data.filter((mission) => mission.orgId === orgPerformance).map((mission) => mission.axisKey).join('|') === catalogAxes.PERFORMANCE, 'K: admin voit uniquement les axes PERFORMANCE autorisés')
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'en_cours' } })
  assert(x.r.status === 200 && x.data.status === 'en_cours' && x.data.completedAt === null, 'K: admin modifie et complète le statut')
  // L'admin ne peut pas non plus forcer validee_client.
  x = await req(`/api/missions/${missionId}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'validee_client' } })
  assert(x.r.status === 403, 'K: admin ne peut pas forcer validee_client')

  console.log('OK phase 5 missions: mapping axes 2/4/5 · STARTER/BASIQUE · URL hors plan · données legacy · OFFER_REQUIRED · client détail/réponse · pas de duplication · isolation · portefeuille concierge · transitions staff · staff ne peut pas valider · admin ne peut pas forcer validee_client')
} finally {
  child.kill('SIGTERM')
  rmSync(dir, { recursive: true, force: true })
}

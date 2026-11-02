import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const dir = mkdtempSync(join(tmpdir(), 'allneeds-phase6-besoins-'))
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
const conciergePassword = 'ConciergePassword!2026'
const orgId = 'org-phase6'
const orgId2 = 'org-phase6-bis'

const modules = { diagnostic: true, besoins: false, missions: false, rendezVous: false, documents: false, messages: false, devis: false, prestataires: false, abonnement: false, notifications: false, equipe: false, results: false }

const owner2Password = 'Owner2Password!2026'
const concierge2Password = 'Concierge2Password!2026'

const db = {
  users: [
    { id: 'admin', email: 'admin@test.ma', role: 'admin', orgIds: ['*'], name: 'Admin', active: true, passwordConfigured: true, passwordHash: await passwordHash(adminPassword), permissions: [] },
    { id: 'owner', email: 'owner@test.ma', role: 'dirigeant', orgIds: [orgId], name: 'Dirigeant', active: true, passwordConfigured: true, passwordHash: await passwordHash(ownerPassword), permissions: [] },
    { id: 'concierge', email: 'concierge@test.ma', role: 'concierge', orgIds: [orgId], name: 'Concierge', active: true, passwordConfigured: true, passwordHash: await passwordHash(conciergePassword), permissions: [] },
    { id: 'owner2', email: 'owner2@test.ma', role: 'dirigeant', orgIds: [orgId2], name: 'Dirigeant 2', active: true, passwordConfigured: true, passwordHash: await passwordHash(owner2Password), permissions: [] },
    { id: 'concierge2', email: 'concierge2@test.ma', role: 'concierge', orgIds: [orgId2], name: 'Concierge 2', active: true, passwordConfigured: true, passwordHash: await passwordHash(concierge2Password), permissions: [] },
  ],
  orgs: [
    { id: orgId, name: 'Clinique Phase6', sector: 'sante', active: true, modules: { ...modules }, saas: { subscriptionActive: false, enabled: false, startDate: null, endDate: null, plan: null }, slug: 'clinique-phase6' },
    { id: orgId2, name: 'Cabinet Phase6 Bis', sector: 'sante', active: true, modules: { ...modules }, saas: { subscriptionActive: false, enabled: false, startDate: null, endDate: null, plan: null }, slug: 'cabinet-phase6-bis' },
  ],
  diagnostics: [],
  needs: [],
  consents: [],
  registrations: [
    { id: 'reg-phase6', orgId, status: 'actif', conciergeId: 'concierge', events: [], appointmentStatus: 'valide' },
    { id: 'reg-phase6-bis', orgId2, status: 'actif', conciergeId: 'concierge2', events: [], appointmentStatus: 'valide' },
  ],
  invitations: [],
  notifications: [],
  offers: [],
  missions: [],
  quotes: [],
  needsSubscriptions: [],
  documents: [],
}

writeFileSync(join(dir, 'db.json'), JSON.stringify(db, null, 2))
const dbPath = join(dir, 'db.json')

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
  priorityLevel: 'Importante', internalNotes: 'Note interne.',
  strengths: ['Fort 1', 'Fort 2', 'Fort 3'], weaknesses: ['Faible 1', 'Faible 2', 'Faible 3'],
  priorities: ['Priorité 1', 'Priorité 2', 'Priorité 3'], opportunities: ['Opportunité 1'],
  risks: ['Risque 1'], actionPlan: ['Étape 1'], recommendations: ['Reco 1'],
}

async function publishAndOffer(orgOwnerCookie, publisherCookie, org, offerCode) {
  let x = await req('/api/diagnostics', { method: 'POST', cookie: orgOwnerCookie, body: { orgId: org, format: 'Complet', sector: 'sante', answers: { '11': { score: 4, comment: 'Bien' } } } })
  assert(x.r.status === 201, `prep: soumission diagnostic ${org}`)
  const diagId = x.data.id
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: publisherCookie, body: { status: 'en_analyse' } })
  assert(x.r.status === 200, `prep: en_analyse ${org}`)
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: publisherCookie, body: { notes: 'Restitution.', analysis: complete, publishRestitution: true } })
  assert(x.r.status === 200 && x.data.status === 'restitue', `prep: publication ${org}`)

  // Le client demande l'offre : crée une demande en_attente_validation (pas d'activation directe).
  x = await req('/api/offers/accept', { method: 'POST', cookie: orgOwnerCookie, body: { offerCode } })
  assert(x.r.status === 202, `prep: demande offre ${org}`)
  assert(x.data.offer.status === 'en_attente_validation', `prep: statut en_attente_validation ${org}`)
  assert(x.data.pendingApproval === true, `prep: pendingApproval ${org}`)
  const offerId = x.data.offer.id

  // Le staff affecté approuve la demande : l'offre passe à actif.
  x = await req(`/api/staff/requests/offer/${offerId}`, { method: 'PATCH', cookie: publisherCookie, body: { decision: 'approve' } })
  assert(x.r.status === 200, `prep: approbation offre ${org}`)
  assert(x.data.request.status === 'actif', `prep: offre actif ${org}`)
  return diagId
}

try {
  await wait()
  const adminCookie = await login('admin@test.ma', adminPassword)
  const ownerCookie = await login('owner@test.ma', ownerPassword)
  const conciergeCookie = await login('concierge@test.ma', conciergePassword)
  const owner2Cookie = await login('owner2@test.ma', owner2Password)
  const concierge2Cookie = await login('concierge2@test.ma', concierge2Password)
  assert(adminCookie && ownerCookie && conciergeCookie && owner2Cookie && concierge2Cookie, 'cookies')

  // Préparation ORG 1 : diagnostic publié + offre activée.
  await publishAndOffer(ownerCookie, conciergeCookie, orgId, 'BASIQUE')

  // Préparation ORG 2 : diagnostic publié + offre activée.
  await publishAndOffer(owner2Cookie, concierge2Cookie, orgId2, 'PRO')

  // A. Sans abonnement : prérequis OK (offre active), module besoins=false, aucun abonnement.
  let x = await req('/api/needs/subscription', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.current === null && x.data.prerequisites.ok === true, 'A: prérequis OK (offre active)')
  assert(Array.isArray(x.data.catalog) && x.data.catalog.length === 3, 'A: catalogue 3 formules')
  x = await req('/api/needs', { cookie: ownerCookie })
  assert(x.r.status === 403 && x.data.code === 'ACCESS_DISABLED', 'A: module besoins désactivé avant abonnement')

  // B. Client demande ESSENTIEL => pending (pas d'activation directe).
  x = await req('/api/needs/subscription/activate', { method: 'POST', cookie: ownerCookie, body: { planCode: 'ESSENTIEL' } })
  assert(x.r.status === 202, 'B: demande ESSENTIEL')
  assert(x.data.subscription.status === 'pending' && x.data.pendingApproval === true, 'B: statut pending, pas d\'activation directe')
  const subId = x.data.subscription.id

  // C. Quotas non actifs avant approbation staff.
  x = await req('/api/needs', { cookie: ownerCookie })
  assert(x.r.status === 403 && x.data.code === 'ACCESS_DISABLED', 'C: module besoins encore désactivé (pas de quotas)')

  // D. Concierge affecté valide => active, module besoins réactivé, quotas disponibles.
  x = await req(`/api/staff/requests/needs/${subId}`, { method: 'PATCH', cookie: conciergeCookie, body: { decision: 'approve' } })
  assert(x.r.status === 200, 'D: concierge valide l\'abonnement')
  assert(x.data.request.status === 'active', 'D: abonnement passé à active')
  x = await req('/api/me', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.organization.modules.besoins === true, 'D: module besoins réactivé côté organisation')
  x = await req('/api/needs/subscription', { cookie: ownerCookie })
  assert(x.data.current && x.data.current.status === 'active' && x.data.current.monthlyLimit === 2, 'D: quotas ESSENTIEL disponibles (2/mois)')
  assert(x.data.current.price === 149 && x.data.current.planCode === 'ESSENTIEL', 'D: paramètres ESSENTIEL officiels')

  // E. Une seconde demande d'activation est bloquée tant qu'un abonnement est actif.
  x = await req('/api/needs/subscription/activate', { method: 'POST', cookie: ownerCookie, body: { planCode: 'PREMIUM' } })
  assert(x.r.status === 409 && x.data.code === 'NEEDS_SUBSCRIPTION_ALREADY_ACTIVE', 'E: une seule souscription active')

  // F. Quota ESSENTIEL : 2 besoins puis refus.
  async function createNeed(cookie, title) {
    return req('/api/needs', { method: 'POST', cookie, body: { orgId, title, category: 'logiciel', description: 'Description du besoin test.', location: 'Casablanca', budgetMax: 20000, urgency: 'normale' } })
  }
  x = await createNeed(ownerCookie, 'Besoin 1')
  assert(x.r.status === 201 && x.data.status === 'nouveau', 'F: 1er besoin créé')
  const needId = x.data.id
  x = await createNeed(ownerCookie, 'Besoin 2')
  assert(x.r.status === 201, 'F: 2e besoin créé')
  x = await createNeed(ownerCookie, 'Besoin 3')
  assert(x.r.status === 403 && x.data.code === 'NEEDS_LIMIT_REACHED' && x.data.limit === 2, 'F: 3e besoin refusé (limite atteinte)')

  // G. Une proposition reste invisible et le besoin reste opérationnel avant transmission explicite.
  x = await req(`/api/needs/${needId}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'en_analyse' } })
  assert(x.r.status === 200, 'G: besoin pris en analyse')
  x = await req(`/api/needs/${needId}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'en_recherche' } })
  assert(x.r.status === 200 && x.data.status === 'en_recherche', 'G: besoin en recherche')
  x = await req(`/api/needs/${needId}/proposals`, { method: 'POST', cookie: conciergeCookie, body: { providerName: 'Prestataire Test', title: 'Proposition test', description: 'Détails de la prestation.', deliveryDelay: '3 semaines', amount: 12000 } })
  assert(x.r.status === 201 && x.data.status === 'brouillon' && !x.data.sentAt && x.data.deliveryDelay === '3 semaines', 'G: création en brouillon')
  const proposalId = x.data.id
  x = await req(`/api/needs/${needId}/proposals`, { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.proposals.length === 0, 'G: brouillon invisible au client')
  x = await req(`/api/needs/${needId}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'en_attente_client' } })
  assert(x.r.status === 409 && x.data.code === 'PROPOSAL_NOT_TRANSMITTED', 'G: attente client interdite sans transmission')

  // H. La transmission rend la proposition visible et place le besoin en attente du client.
  x = await req(`/api/proposals/${proposalId}/transmit`, { method: 'POST', cookie: conciergeCookie, body: {} })
  assert(x.r.status === 200 && x.data.status === 'envoyee' && x.data.sentAt, 'H: proposition transmise')
  x = await req(`/api/needs/${needId}/proposals`, { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.proposals.length === 1 && x.data.proposals[0].status === 'envoyee', 'H: proposition visible au client')
  x = await req('/api/needs', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.find((need) => need.id === needId)?.status === 'en_attente_client', 'H: besoin en attente du client après transmission')

  // I. Le staff ne peut pas décider; le client accepte via l'action dédiée.
  x = await req(`/api/proposals/${proposalId}/decision`, { method: 'PATCH', cookie: conciergeCookie, body: { decision: 'accept' } })
  assert(x.r.status === 403, 'I: concierge ne peut pas accepter la proposition')
  x = await req(`/api/proposals/${proposalId}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'acceptee' } })
  assert(x.r.status === 403, 'I: statut accepté interdit au concierge')
  x = await req(`/api/proposals/${proposalId}/decision`, { method: 'PATCH', cookie: ownerCookie, body: { decision: 'accept' } })
  assert(x.r.status === 200 && x.data.status === 'acceptee', 'I: client accepte la proposition transmise')
  x = await req('/api/needs', { cookie: ownerCookie })
  assert(x.data.find((need) => need.id === needId)?.status === 'valide', 'I: besoin validé après décision client')

  // J. Persistance : une souscription active, besoins et proposition persistés.
  const persisted = JSON.parse(readFileSync(dbPath, 'utf8'))
  assert((persisted.needsSubscriptions || []).filter((s) => s.orgId === orgId && s.status === 'active').length === 1, 'J: une souscription active persistée')
  assert((persisted.needs || []).length === 2, 'J: deux besoins persistés')
  assert((persisted.quotes || []).some((proposal) => proposal.id === proposalId && proposal.status === 'acceptee' && proposal.sentAt), 'J: proposition transmise et acceptée persistée')

  // K. Admin global : suspension de l'abonnement.
  x = await req('/api/admin/needs/subscriptions', { cookie: adminCookie })
  assert(x.r.status === 200 && x.data.subscriptions.length >= 1, 'H: admin voit les abonnements')
  const activeSub = x.data.subscriptions.find((s) => s.orgId === orgId && s.status === 'active')
  assert(activeSub, 'H: abonnement actif visible')
  x = await req(`/api/admin/needs/subscriptions/${activeSub.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'suspended' } })
  assert(x.r.status === 200 && x.data.status === 'suspended', 'H: admin suspend l\'abonnement')
  x = await req('/api/needs/subscription', { cookie: ownerCookie })
  assert(x.data.current === null, 'H: abonnement suspendu rendu inactif')

  console.log('OK phase 6 besoins: prérequis · activation validée · quotas · brouillon invisible · transmission explicite · décision client exclusive · persistance · suspension')
} finally {
  child.kill('SIGTERM')
  rmSync(dir, { recursive: true, force: true })
}

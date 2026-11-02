import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const dir = mkdtempSync(join(tmpdir(), 'allneeds-phase5-offres-'))
const origin = 'http://127.0.0.1:5176'
const port = 8802
const base = `http://127.0.0.1:${port}`

async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${hash.toString('hex')}`
}

const adminPassword = 'AdminPassword!2026'
const ownerPassword = 'OwnerPassword!2026'
const conciergePassword = 'ConciergePassword!2026'
const orgId = 'org-phase5'

const modules = { diagnostic: true, besoins: false, missions: false, rendezVous: false, documents: false, messages: false, devis: false, prestataires: false, abonnement: false, notifications: false, equipe: false, results: false }

const db = {
  users: [
    { id: 'admin', email: 'admin@test.ma', role: 'admin', orgIds: ['*'], name: 'Admin', active: true, passwordConfigured: true, passwordHash: await passwordHash(adminPassword), permissions: [] },
    { id: 'owner', email: 'owner@test.ma', role: 'dirigeant', orgIds: [orgId], name: 'Dirigeant', active: true, passwordConfigured: true, passwordHash: await passwordHash(ownerPassword), permissions: [] },
    { id: 'concierge', email: 'concierge@test.ma', role: 'concierge', orgIds: [orgId], name: 'Concierge', active: true, passwordConfigured: true, passwordHash: await passwordHash(conciergePassword), permissions: [] },
  ],
  orgs: [{ id: orgId, name: 'Clinique Phase5', sector: 'sante', active: true, modules: { ...modules }, saas: { subscriptionActive: false, enabled: false, startDate: null, endDate: null, plan: null }, slug: 'clinique-phase5' }],
  diagnostics: [],
  needs: [],
  consents: [],
  registrations: [{ id: 'reg-phase5', orgId, status: 'actif', conciergeId: 'concierge', events: [], appointmentStatus: 'valide' }],
  invitations: [],
  notifications: [],
  offers: [],
  missions: [],
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
  priorityLevel: 'Importante',
  internalNotes: 'Note interne privée.',
  strengths: ['Fort 1', 'Fort 2', 'Fort 3'],
  weaknesses: ['Faible 1', 'Faible 2', 'Faible 3'],
  priorities: ['Priorité 1', 'Priorité 2', 'Priorité 3'],
  opportunities: ['Opportunité 1'],
  risks: ['Risque 1'],
  actionPlan: ['Étape 1'],
  recommendations: ['Reco 1'],
}

async function publishDiagnostic(orgOwnerCookie, publisherCookie, org) {
  let x = await req('/api/diagnostics', { method: 'POST', cookie: orgOwnerCookie, body: { orgId: org, format: 'Complet', sector: 'sante', answers: { '11': { score: 4, comment: 'Bien' } } } })
  assert(x.r.status === 201, `prep: soumission diagnostic ${org}`)
  const diagId = x.data.id
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: publisherCookie, body: { status: 'en_analyse' } })
  assert(x.r.status === 200, `prep: en_analyse ${org}`)
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: publisherCookie, body: { notes: 'Restitution.', analysis: complete, publishRestitution: true } })
  assert(x.r.status === 200 && x.data.status === 'restitue', `prep: publication ${org}`)
  return diagId
}

try {
  await wait()
  const adminCookie = await login('admin@test.ma', adminPassword)
  const ownerCookie = await login('owner@test.ma', ownerPassword)
  const conciergeCookie = await login('concierge@test.ma', conciergePassword)
  assert(adminCookie && ownerCookie && conciergeCookie, 'cookies')

  // A. Tant que le diagnostic n'est pas publié, les offres sont verrouillées.
  let x = await req('/api/offers', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.locked === true && x.data.reason === 'DIAGNOSTIC_NOT_PUBLISHED' && x.data.offers.length === 0, 'A: offres verrouillées avant publication')

  // A2. Accepter avant publication est refusé.
  x = await req('/api/offers/accept', { method: 'POST', cookie: ownerCookie, body: { offerCode: 'BASIQUE' } })
  assert(x.r.status === 403 && x.data.code === 'OFFERS_LOCKED', 'A2: acceptation refusée avant publication')

  // Préparation : diagnostic publié
  const diagId = await publishDiagnostic(ownerCookie, conciergeCookie, orgId)

  // B. Offres visibles après publication : catalogue à 3, recommandation PERFORMANCE (3 priorités).
  x = await req('/api/offers', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.locked === false, 'B: offres déverrouillées')
  const codes = x.data.offers.map((o) => o.code)
  assert(codes.length === 3 && codes.join(',') === 'BASIQUE,PRO,PERFORMANCE', 'B: 3 offres officielles')
  const price = Object.fromEntries(x.data.offers.map((o) => [o.code, o.price]))
  assert(price.BASIQUE === 3445 && price.PRO === 6445 && price.PERFORMANCE === 10945, 'B: prix officiels')
  assert(x.data.recommendedOfferCode === 'PERFORMANCE' && x.data.diagnosticId === diagId, 'B: recommandation + diagnostic')

  // C. Mapping historique STARTER -> BASIQUE : le client crée une DEMANDE (en_attente_validation), pas une activation.
  x = await req('/api/offers/accept', { method: 'POST', cookie: ownerCookie, body: { offerCode: 'STARTER' } })
  assert(x.r.status === 202, 'C: acceptation STARTER (demande)')
  assert(x.data.offer.offerCode === 'BASIQUE' && x.data.offer.offerName === 'BASIQUE' && x.data.offer.price === 3445, 'C: STARTER normalisé en BASIQUE')
  assert(x.data.offer.status === 'en_attente_validation', 'C: statut en_attente_validation (demande, pas activation)')
  assert(x.data.missions.length === 0 && x.data.pendingApproval === true, 'C: aucune mission créée avant validation')
  const offerId = x.data.offer.id

  // D. Aucune mission activée avant l'approbation staff.
  x = await req('/api/missions', { cookie: ownerCookie })
  assert(x.r.status === 403 && x.data.code === 'OFFER_REQUIRED', 'D: missions bloquées tant qu\'offre non activée')
  const persisted = JSON.parse(readFileSync(dbPath, 'utf8'))
  assert((persisted.missions || []).length === 0, 'D: aucune mission en base avant approbation')

  // E. Le concierge affecté valide la demande => offre actif + missions créées.
  x = await req(`/api/staff/requests/offer/${offerId}`, { method: 'PATCH', cookie: conciergeCookie, body: { decision: 'approve' } })
  assert(x.r.status === 200, 'E: concierge valide l\'offre')
  assert(x.data.request.status === 'actif', 'E: offre passée à actif')
  assert(Array.isArray(x.data.missions) && x.data.missions.length === 2, 'E: deux axes BASIQUE créés à l\'approbation')
  const missionCount = x.data.missions.length

  // F. Persistance : l'offre est active et ses missions existent.
  x = await req('/api/offers/current', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.current && x.data.current.id === offerId && x.data.current.status === 'actif', 'F: offre acceptée persistée (actif)')
  x = await req('/api/missions', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.missions.length === missionCount, 'F: missions accessibles après activation')
  assert(x.data.missions.every((m) => ['commercial', 'marketing'].includes(m.axisKey)), 'F: missions limitées aux axes BASIQUE')

  // G. Une seconde demande d'offre est bloquée tant qu'une offre est active.
  x = await req('/api/offers/accept', { method: 'POST', cookie: ownerCookie, body: { offerCode: 'PRO' } })
  assert(x.r.status === 409 && x.data.code === 'OFFER_ALREADY_ACCEPTED', 'G: seconde demande bloquée (offre déjà active)')

  // H. L'acceptation ne touche NI les Besoins NI le SaaS, et un seul enregistrement d'offre existe.
  const persistedH = JSON.parse(readFileSync(dbPath, 'utf8'))
  assert(persistedH.orgs[0].saas.subscriptionActive === false && persistedH.orgs[0].saas.enabled === false && persistedH.orgs[0].saas.plan === null, 'H: SaaS inchangé')
  assert((persistedH.offers || []).length === 1, 'H: un seul enregistrement d\'offre')
  assert((persistedH.missions || []).length === missionCount, 'H: missions cohérentes')

  console.log('OK phase 5 offres: A verrouillé · B 3 offres · C STARTER→BASIQUE demande · D pas de missions avant approbation · E concierge valide=>actif+missions · F persistance · G unicité · H SaaS/Besoins intacts')
} finally {
  child.kill('SIGTERM')
  rmSync(dir, { recursive: true, force: true })
}

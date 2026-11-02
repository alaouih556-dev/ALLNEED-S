import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const dir = mkdtempSync(join(tmpdir(), 'allneeds-phase4-'))
const origin = 'http://127.0.0.1:5176'
const port = 8801
const base = `http://127.0.0.1:${port}`

async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${hash.toString('hex')}`
}

const adminPassword = 'AdminPassword!2026'
const ownerPassword = 'OwnerPassword!2026'
const conciergePassword = 'ConciergePassword!2026'
const outsiderPassword = 'OutsiderPassword!2026'
const orgId = 'org-phase4'

const modules = { diagnostic: true, besoins: false, missions: false, rendezVous: false, documents: false, messages: false, devis: false, prestataires: false, abonnement: false, notifications: false, equipe: false, results: false }

const db = {
  users: [
    { id: 'admin', email: 'admin@test.ma', role: 'admin', orgIds: ['*'], name: 'Admin', active: true, passwordConfigured: true, passwordHash: await passwordHash(adminPassword), permissions: [] },
    { id: 'owner', email: 'owner@test.ma', role: 'dirigeant', orgIds: [orgId], name: 'Dirigeant', active: true, passwordConfigured: true, passwordHash: await passwordHash(ownerPassword), permissions: [] },
    { id: 'concierge', email: 'concierge@test.ma', role: 'concierge', orgIds: [orgId], name: 'Concierge', active: true, passwordConfigured: true, passwordHash: await passwordHash(conciergePassword), permissions: [] },
    { id: 'outsider', email: 'outsider@test.ma', role: 'concierge', orgIds: ['other-org'], name: 'Autre concierge', active: true, passwordConfigured: true, passwordHash: await passwordHash(outsiderPassword), permissions: [] },
  ],
  orgs: [{ id: orgId, name: 'Clinique Test', sector: 'sante', active: true, modules: { ...modules }, saas: { subscriptionActive: false, enabled: false, startDate: null, endDate: null, plan: null }, slug: 'clinique-test' }],
  diagnostics: [],
  needs: [],
  consents: [],
  registrations: [],
  invitations: [],
  notifications: [],
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
  internalNotes: 'Note interne confidentielle — ne jamais transmettre.',
  strengths: ['Point fort 1', 'Point fort 2', 'Point fort 3'],
  weaknesses: ['Amélioration 1', 'Amélioration 2', 'Amélioration 3'],
  priorities: ['Priorité 1', 'Priorité 2', 'Priorité 3'],
  opportunities: ['Opportunité 1'],
  risks: ['Risque 1'],
  actionPlan: ['Étape 1'],
  recommendations: ['Recommandation 1'],
}

try {
  await wait()
  const adminCookie = await login('admin@test.ma', adminPassword)
  const ownerCookie = await login('owner@test.ma', ownerPassword)
  const conciergeCookie = await login('concierge@test.ma', conciergePassword)
  const outsiderCookie = await login('outsider@test.ma', outsiderPassword)
  assert(adminCookie && ownerCookie && conciergeCookie && outsiderCookie, 'cookies')

  // Le client soumet son diagnostic (statut soumis)
  let x = await req('/api/diagnostics', { method: 'POST', cookie: ownerCookie, body: { orgId, format: 'Complet', sector: 'sante', answers: { '11': { score: 4, comment: 'Bien' }, '12': { score: 2, comment: 'À revoir' } } } })
  assert(x.r.status === 201 && x.data.status === 'soumis', 'A0: soumission client')
  const diagId = x.data.id

  // A. Le concierge affecté voit le diagnostic
  x = await req('/api/diagnostics', { cookie: conciergeCookie })
  assert(x.r.status === 200 && x.data.some((d) => d.id === diagId), 'A: concierge voit le diagnostic')

  // B. Le concierge lit les réponses, écrit notes internes + commentaires, change de statut
  x = await req(`/api/diagnostics/${diagId}`, { cookie: conciergeCookie })
  assert(x.r.status === 200 && x.data.answers['11'].score === 4, 'B: concierge lit les réponses')
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'en_analyse', questionNotes: { '11': 'note interne question' }, questionComments: { '11': 'commentaire concierge privé' } } })
  assert(x.r.status === 200 && x.data.status === 'en_analyse', 'B: statut en_analyse accepté')
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: conciergeCookie, body: { status: 'pret_a_valider' } })
  assert(x.r.status === 200 && x.data.status === 'pret_a_valider', 'B: statut pret_a_valider accepté')

  // C. Le client ne voit JAMAIS les champs privés
  x = await req(`/api/diagnostics/${diagId}`, { cookie: ownerCookie })
  assert(x.r.status === 200, 'C: client lit son diagnostic')
  assert(x.data.analysis === undefined, 'C: analysis absent côté client')
  assert(x.data.questionNotes === undefined, 'C: questionNotes absent côté client')
  assert(x.data.questionComments === undefined, 'C: questionComments absent côté client')
  assert(x.data.publishedBy === undefined, 'C: publishedBy absent côté client')
  assert((x.data.notes || '') === '' && x.data.synthesis === null, 'C: notes/synthesis vides avant publication')

  // F. Le client ne peut PAS lire la restitution avant publication
  x = await req(`/api/diagnostics/${diagId}/restitution`, { cookie: ownerCookie })
  assert(x.r.status === 403 && /en cours de préparation/i.test(x.data.error || ''), 'F: restitution 403 avant publication')

  // D. Publication refusée tant que la restitution est incomplète
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: conciergeCookie, body: { notes: 'Commentaire client', analysis: { strengths: ['Un seul'] }, publishRestitution: true } })
  assert(x.r.status === 400 && /incomplète/i.test(x.data.error || ''), 'D: publication incomplète refusée')

  // E. Publication complète
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: conciergeCookie, body: { notes: 'Voici votre restitution.', analysis: complete, publishRestitution: true, restitutionVisible: true } })
  assert(x.r.status === 200, 'E: publication complète')
  assert(x.data.status === 'restitue' && x.data.publishedAt && x.data.publishedBy === 'concierge' && x.data.restitutionVisible === true, 'E: champs de publication posés')

  // E2. Notification créée pour le client
  x = await req('/api/notifications', { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.some((n) => n.type === 'diagnostic_publie'), 'E2: notification diagnostic_publie')

  // G. Le client lit la restitution publiée, sans fuite interne
  x = await req(`/api/diagnostics/${diagId}/restitution`, { cookie: ownerCookie })
  assert(x.r.status === 200, 'G: restitution lisible après publication')
  assert(x.data.analysis.strengths.length === 3 && x.data.notes === 'Voici votre restitution.', 'G: contenu restitution')
  assert(x.data.analysis.internalNotes === undefined, 'G: internalNotes jamais exposé')

  // H. Le concierge masque la restitution : le client perd l’accès
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: conciergeCookie, body: { restitutionVisible: false } })
  assert(x.r.status === 200, 'H: masquage')
  x = await req(`/api/diagnostics/${diagId}/restitution`, { cookie: ownerCookie })
  assert(x.r.status === 403, 'H: client 403 après masquage')
  x = await req('/api/me/diagnostic-status?orgId=' + orgId, { cookie: ownerCookie })
  assert(x.r.status === 200 && x.data.restitutionPublished === false, 'H: statut restitution masquée')

  // I. Le concierge republie : l’accès client est restauré
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: conciergeCookie, body: { analysis: complete, notes: 'Voici votre restitution.', publishRestitution: true } })
  assert(x.r.status === 200 && x.data.restitutionVisible === true, 'I: republication')
  x = await req(`/api/diagnostics/${diagId}/restitution`, { cookie: ownerCookie })
  assert(x.r.status === 200, 'I: accès client restauré')

  // J. Un concierge non affecté n’a aucun accès
  x = await req(`/api/diagnostics/${diagId}`, { cookie: outsiderCookie })
  assert(x.r.status === 403, 'J: concierge non affecté 403')
  x = await req(`/api/diagnostics/${diagId}`, { method: 'PATCH', cookie: outsiderCookie, body: { restitutionVisible: false } })
  assert(x.r.status === 403, 'J: PATCH concierge non affecté 403')

  console.log('OK phase 4: A soumission→concierge · B lecture+statuts · C privé · D publication refusée · E publication+notif · F/G restitution · H masquage · I republication · J périmètre')
} finally {
  child.kill('SIGTERM')
  rmSync(dir, { recursive: true, force: true })
}

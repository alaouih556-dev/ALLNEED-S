import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { createApp } from './app.mjs'
import { hashPassword, verifyPassword } from './auth.mjs'
import { DEMO_PASSWORD, seedDemo } from './seed.mjs'
import { createStore } from './store.mjs'
import { auditScope, can } from './policy.mjs'

const SESSION_COOKIE = 'allneeds_session'
let store
let dataDir
let server
let base

async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  return {
    status: res.status,
    json,
    cookies,
    session: cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.split(';')[0] ?? null,
  }
}

async function login(email, password = DEMO_PASSWORD) {
  const res = await call('/api/auth/login', { method: 'POST', body: { email, password } })
  assert.equal(res.status, 200, `connexion ${email}`)
  return res.session
}

function answers(overrides = {}) {
  const map = {}
  for (let i = 1; i <= 40; i += 1) {
    map[`q${i}`] = { score: 4, comment: 'Réponse de test suffisamment détaillée.' }
  }
  return { ...map, ...overrides }
}

const consent = () => ({
  by: 'Amina Bennani',
  acceptedAt: new Date().toISOString(),
  version: 'v5.1',
})

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'allneeds-api-'))
  store = createStore(dataDir)
  seedDemo(store, { force: true })
  const handler = createApp({ store, allowedOrigins: [] })
  server = createServer((req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Erreur interne' } }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  rmSync(dataDir, { recursive: true, force: true })
})

test('mots de passe hachés avec scrypt, jamais stockés en clair', () => {
  const stored = hashPassword('mot-de-passe-de-test')
  assert.ok(stored.startsWith('scrypt$'))
  assert.notEqual(stored, 'mot-de-passe-de-test')
  assert.equal(verifyPassword('mot-de-passe-de-test', stored), true)
  assert.equal(verifyPassword('mauvais-mot-de-passe', stored), false)
  assert.equal(verifyPassword('mot-de-passe-de-test', 'sha1$caca'), false)
  assert.throws(() => hashPassword('court'), /trop court/)
  assert.equal(verifyPassword(DEMO_PASSWORD, store.get().users[0].passwordHash), true)
})

test('connexion, session HttpOnly et /api/auth/me', async () => {
  const anon = await call('/api/auth/me')
  assert.equal(anon.status, 401)

  const bad = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'nada@allneeds.ma', password: 'mauvais' },
  })
  assert.equal(bad.status, 401)
  assert.equal(bad.session, null)

  const ok = await login('nada@allneeds.ma')
  assert.ok(ok, 'cookie de session retourné')
  assert.match(ok, /HttpOnly/)

  const me = await call('/api/auth/me', { cookie: ok })
  assert.equal(me.status, 200)
  assert.equal(me.json.user.role, 'admin')

  const raw = store.get().sessions.map((s) => s.tokenHash)
  const token = ok.split(';')[0].split('=').slice(1).join('=')
  assert.ok(token.length >= 32)
  assert.ok(!raw.includes(token), 'jeton stocké haché, jamais en clair')
})

test('déconnexion = révocation immédiate de la session', async () => {
  const cookie = await login('a.bennani@al-amal.ma')
  assert.equal((await call('/api/auth/me', { cookie })).status, 200)

  const out = await call('/api/auth/logout', { method: 'POST', cookie })
  assert.equal(out.status, 200)

  const afterLogout = await call('/api/auth/me', { cookie })
  assert.equal(afterLogout.status, 401, 'session révoquée')
  assert.equal((await call('/api/auth/me')).status, 401)
})

test('limite de débit sur les tentatives de connexion', async () => {
  let last = null
  for (let i = 0; i < 11; i += 1) {
    last = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'rate@limit.test', password: 'n-importe-quoi' },
    })
    if (last.status === 429) break
  }
  assert.equal(last.status, 429)
})

test('isolation multi-tenant : un client ne voit que sa société', async () => {
  const cookie = await login('a.bennani@al-amal.ma')

  const list = await call('/api/companies', { cookie })
  assert.equal(list.status, 200)
  assert.deepEqual(list.json.companies.map((c) => c.id), ['org-amal'])

  const foreign = await call('/api/companies/org-nour', { cookie })
  assert.equal(foreign.status, 404, 'entreprise étrangère masquée, pas seulement interdite')

  const foreignDiag = await call('/api/companies/org-nour/diagnostics', { cookie })
  assert.equal(foreignDiag.status, 404)
})

test('portefeuille concierge et périmètre expert', async () => {
  const concierge = await login('concierge.sante@allneeds.ma')
  const owned = await call('/api/companies', { cookie: concierge })
  assert.deepEqual(owned.json.companies.map((c) => c.id).sort(), ['org-amal', 'org-nour'])
  assert.equal((await call('/api/companies/org-riad', { cookie: concierge })).status, 404)

  const expert = await login('expert.sante@allneeds.ma')
  const expertList = await call('/api/companies', { cookie: expert })
  assert.deepEqual(expertList.json.companies.map((c) => c.id), ['org-nour'])
  assert.equal((await call('/api/companies/org-amal', { cookie: expert })).status, 404)
})

test('rôle admin : portefeuille complet et journal d’audit', async () => {
  const cookie = await login('nada@allneeds.ma')
  const list = await call('/api/companies', { cookie })
  assert.deepEqual(list.json.companies.map((c) => c.id).sort(), ['org-amal', 'org-nour', 'org-riad'])

  const audit = await call('/api/audit', { cookie })
  assert.equal(audit.status, 200)
  assert.ok(audit.json.audit.length > 0)

  const client = await login('direction@clinique-nour.ma')
  assert.equal((await call('/api/audit', { cookie: client })).status, 403, 'le journal reste réservé à l’administration')
})

test('consentement et commentaires validés côté serveur', async () => {
  const cookie = await login('direction@clinique-nour.ma')

  const ok = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: { format: 'Complet', consent: consent(), answers: answers() },
  })
  assert.equal(ok.status, 201)
  assert.equal(ok.json.diagnostic.status, 'termine')

  const noConsent = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: { format: 'Complet', answers: answers() },
  })
  assert.equal(noConsent.status, 422)
  assert.equal(noConsent.json.error.code, 'consent_required')

  const noComment = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: {
      format: 'Complet',
      consent: consent(),
      answers: answers({ q7: { score: 4, comment: '' } }),
    },
  })
  assert.equal(noComment.status, 422)
  assert.equal(noComment.json.error.code, 'comment_required')
  assert.deepEqual(noComment.json.error.details, ['q7'])

  const badFormat = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: { format: 'Express', consent: consent(), answers: answers() },
  })
  assert.equal(badFormat.status, 422)
  assert.equal(badFormat.json.error.code, 'invalid_format')

  const badScore = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: { format: 'Complet', consent: consent(), answers: answers({ q1: { score: 9, comment: 'x' } }) },
  })
  assert.equal(badScore.status, 422)
  assert.equal(badScore.json.error.code, 'invalid_score')
})

test('un client ne peut pas écrire chez un autre locataire', async () => {
  const cookie = await login('a.bennani@al-amal.ma')
  const res = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: { format: 'Complet', consent: consent(), answers: answers() },
  })
  assert.equal(res.status, 404)

  const anon = await call('/api/companies', { method: 'GET' })
  assert.equal(anon.status, 401, 'aucune route de données sans session')
})

test('routes inconnues et corps invalides', async () => {
  assert.equal((await call('/api/inconnu')).status, 404)
  const cookie = await login('nada@allneeds.ma')
  const res = await fetch(`${base}/api/companies`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: 'pas-du-json',
  })
  assert.equal(res.status, 404, 'POST /api/companies non implémenté')
  assert.equal((await call('/api/auth/me', { cookie: `${SESSION_COOKIE}=jeton-invalide` })).status, 401)
})

test('matrice de permissions : sous-rôles client et rôles ALLNEEDS', () => {
  assert.equal(can('client', 'diagnostic:write:own'), true)
  assert.equal(can({ role: 'client', clientRole: 'manager' }, 'diagnostic:write:own'), false)
  assert.equal(can({ role: 'client', clientRole: 'collaborateur' }, 'decision:write'), false)
  assert.equal(can({ role: 'client', clientRole: 'collaborateur' }, 'mission:read:assigned'), true)

  assert.equal(can('admin', 'audit:read'), true)
  assert.equal(can('admin', 'user:manage'), true)
  assert.equal(can('concierge', 'member:invite'), false)
  assert.equal(can('concierge', 'audit:read'), false)
  assert.equal(can('commercial', 'audit:read'), false)
  assert.equal(can('commercial', 'org:read:all'), false)
  assert.equal(can('commercial', 'crm:write'), true)
  assert.equal(can('expert', 'diagnostic:read:assigned'), false)
  assert.equal(can('unknown-role', 'crm:read'), false)

  assert.equal(auditScope('admin'), 'all')
  assert.equal(auditScope('concierge'), 'assigned')
  assert.equal(auditScope('commercial'), null)
  assert.equal(auditScope('client'), null)
})

test('commercial : CRM seulement, aucun accès opérationnel ni audit', async () => {
  const cookie = await login('commercial@allneeds.ma')

  assert.equal((await call('/api/companies', { cookie })).status, 403)
  assert.equal((await call('/api/companies/org-nour', { cookie })).status, 404)
  assert.equal((await call('/api/companies/org-nour/members', { cookie })).status, 404)
  assert.equal((await call('/api/audit', { cookie })).status, 403)
  assert.equal((await call('/api/registrations', { cookie })).status, 403)

  const diag = await call('/api/companies/org-nour/diagnostics', {
    method: 'POST',
    cookie,
    body: { format: 'Complet', consent: consent(), answers: answers() },
  })
  assert.equal(diag.status, 404, 'pas de diagnostic écrit hors périmètre')
})

test('membres d’une entreprise : portée locataire puis habilitation', async () => {
  const dirigeant = await login('direction@clinique-nour.ma')

  const own = await call('/api/companies/org-nour/members', { cookie: dirigeant })
  assert.equal(own.status, 200)
  assert.ok(own.json.members.some((m) => m.id === 'mgr-nour'), 'membres internes visibles')
  assert.ok(own.json.support.some((m) => m.id === 'conc-001'), 'concierges attribués visibles')
  assert.ok(own.json.support.every((m) => m.id !== 'admin-nada'), 'les comptes non attribués sont absents')

  const foreign = await call('/api/companies/org-amal/members', { cookie: dirigeant })
  assert.equal(foreign.status, 404, 'entreprise étrangère masquée avant toute lecture')

  const collaborateur = await login('accueil@clinique-nour.ma')
  const limited = await call('/api/companies/org-nour/members', { cookie: collaborateur })
  assert.equal(limited.status, 403, 'un collaborateur ne liste pas les comptes')

  const concierge = await login('concierge.sante@allneeds.ma')
  assert.equal((await call('/api/companies/org-nour/members', { cookie: concierge })).status, 200)
  assert.equal((await call('/api/companies/org-riad/members', { cookie: concierge })).status, 404)
})

test('gestion des comptes : activation, validation du rôle, auto-protection', async () => {
  const cookie = await login('nada@allneeds.ma')
  const target = () => store.get().users.find((u) => u.id === 'col-nour')

  const off = await call('/api/users/col-nour', { method: 'PATCH', cookie, body: { active: false } })
  assert.equal(off.status, 200)
  assert.equal(target().active, false)
  assert.equal(store.get().sessions.filter((s) => s.userId === 'col-nour').length, 0, 'désactivation = révocation des sessions')

  const on = await call('/api/users/col-nour', { method: 'PATCH', cookie, body: { active: true } })
  assert.equal(on.status, 200)
  assert.equal(target().active, true)

  assert.equal((await call('/api/users/col-nour', { method: 'PATCH', cookie, body: { role: 'superuser' } })).status, 422)
  assert.equal((await call('/api/users/col-nour', { method: 'PATCH', cookie, body: { clientRole: 'patron' } })).status, 422)
  assert.equal((await call('/api/users/col-nour', { method: 'PATCH', cookie, body: {} })).status, 422)
  assert.equal((await call('/api/users/admin-nada', { method: 'PATCH', cookie, body: { active: false } })).status, 403, 'auto-protection')

  const client = await login('a.bennani@al-amal.ma')
  assert.equal((await call('/api/users/col-nour', { method: 'PATCH', cookie: client, body: { active: false } })).status, 403)
})

test('invitations : création par l’admin, acceptation et contrôle d’accès', async () => {
  const anon = await call('/api/invitations')
  assert.equal(anon.status, 401)

  const client = await login('a.bennani@al-amal.ma')
  assert.equal((await call('/api/invitations', { cookie: client })).status, 403, 'un client n’invite pas')

  const admin = await login('nada@allneeds.ma')
  const created = await call('/api/invitations', {
    method: 'POST',
    cookie: admin,
    body: { email: 'nouvelle@al-amal.ma', name: 'Nouvelle Membre', role: 'client', clientRole: 'manager', orgId: 'org-amal' },
  })
  assert.equal(created.status, 201)
  assert.equal(created.json.invitation.orgId, 'org-amal')
  assert.equal(created.json.invitation.clientRole, 'manager')
  assert.ok(created.json.invitation.token, 'jeton retourné une seule fois à l’émetteur')

  const invalidRole = await call('/api/invitations', {
    method: 'POST',
    cookie: admin,
    body: { email: 'autre@test.ma', role: 'super-admin' },
  })
  assert.equal(invalidRole.status, 422)

  const accepted = await call(`/api/invitations/${created.json.invitation.token}/accept`, {
    method: 'POST',
    body: { name: 'Nouvelle Membre', password: 'MotDePasse-2024!' },
  })
  assert.equal(accepted.status, 201)
  assert.equal(accepted.json.user.role, 'client')
  assert.equal(accepted.json.user.orgId, 'org-amal')

  const replay = await call(`/api/invitations/${created.json.invitation.token}/accept`, {
    method: 'POST',
    body: { name: 'Nouvelle Membre', password: 'MotDePasse-2024!' },
  })
  assert.equal(replay.status, 404, 'jeton réutilisable impossible')

  const session = await login('nouvelle@al-amal.ma', 'MotDePasse-2024!')
  const me = await call('/api/auth/me', { cookie: session })
  assert.equal(me.json.user.clientRole, 'manager')
  assert.deepEqual(me.json.user.assignedOrgIds, [])
})

test('journal d’audit scopé : le concierge ne voit que son portefeuille', async () => {
  const cookie = await login('concierge.sante@allneeds.ma')
  const res = await call('/api/audit', { cookie })
  assert.equal(res.status, 200)
  assert.ok(res.json.audit.length > 0, 'des événements du portefeuille existent')

  const allowed = new Set(['org-amal', 'org-nour'])
  for (const entry of res.json.audit) {
    assert.ok(entry.orgId && allowed.has(entry.orgId), `entrée hors périmètre : ${entry.orgId}`)
  }
})

test('déconnexion globale : toutes les sessions révoquées', async () => {
  const first = await login('direction@clinique-nour.ma')
  const second = await login('direction@clinique-nour.ma')
  assert.equal((await call('/api/auth/me', { cookie: first })).status, 200)
  assert.equal((await call('/api/auth/me', { cookie: second })).status, 200)

  const out = await call('/api/auth/logout-all', { method: 'POST', cookie: second })
  assert.equal(out.status, 200)
  assert.equal((await call('/api/auth/me', { cookie: first })).status, 401)
  assert.equal((await call('/api/auth/me', { cookie: second })).status, 401)
})

test('changement de mot de passe : vérification et révocation', async () => {
  const cookie = await login('salma@riad-lumen.ma')
  const other = await login('salma@riad-lumen.ma')
  const findUser = () => store.get().users.find((u) => u.id === 'usr-salma')

  const wrong = await call('/api/auth/password', {
    method: 'POST',
    cookie,
    body: { currentPassword: 'mauvais-mot-de-passe', newPassword: 'MotDePasse-2024!' },
  })
  assert.equal(wrong.status, 401)

  const weak = await call('/api/auth/password', {
    method: 'POST',
    cookie,
    body: { currentPassword: DEMO_PASSWORD, newPassword: 'court' },
  })
  assert.equal(weak.status, 422)

  const ok = await call('/api/auth/password', {
    method: 'POST',
    cookie,
    body: { currentPassword: DEMO_PASSWORD, newPassword: 'MotDePasse-2024!' },
  })
  assert.equal(ok.status, 200)
  assert.equal(verifyPassword('MotDePasse-2024!', findUser().passwordHash), true)
  assert.equal((await call('/api/auth/me', { cookie })).status, 200, 'session courante conservée')
  assert.equal((await call('/api/auth/me', { cookie: other })).status, 401, 'autres sessions révoquées')

  const restore = await call('/api/auth/password', {
    method: 'POST',
    cookie,
    body: { currentPassword: 'MotDePasse-2024!', newPassword: DEMO_PASSWORD },
  })
  assert.equal(restore.status, 200)
  assert.equal(verifyPassword(DEMO_PASSWORD, findUser().passwordHash), true)
})

test('demande de création de compte : enregistrée côté serveur, sans session délivrée', async () => {
  const anon = await call('/api/registrations', {
    method: 'POST',
    body: {
      org: 'École du Test',
      kind: 'École privée',
      sector: 'enseignement',
      workspaceProfile: 'ecole',
      situation: 'creation',
      city: 'Casablanca',
      size: '12 salariés',
      name: 'Testeur Lanternier',
      role: 'Directeur',
      email: 'demande-creation@test.ma',
      phone: '+212 600000000',
      accept: true,
    },
  })
  assert.equal(anon.status, 201)
  assert.match(anon.json.reference, /^reg-/)
  assert.equal(anon.cookies.length, 0, 'aucune session n’est délivrée à l’inscription')
  assert.equal(store.get().users.some((u) => u.email === 'demande-creation@test.ma'), false, 'aucun compte créé automatiquement')

  const stored = store.get().registrations.find((r) => r.email === 'demande-creation@test.ma')
  assert.equal(stored.status, 'pending')
  assert.equal(stored.situation, 'creation')

  const duplicate = await call('/api/registrations', {
    method: 'POST',
    body: { org: 'École du Test', name: 'Testeur', email: 'demande-creation@test.ma', accept: true },
  })
  assert.equal(duplicate.status, 409)

  const existingAccount = await call('/api/registrations', {
    method: 'POST',
    body: { org: 'École Al Amal', name: 'Amina', email: 'a.bennani@al-amal.ma', accept: true },
  })
  assert.equal(existingAccount.status, 409)

  const noConsent = await call('/api/registrations', {
    method: 'POST',
    body: { org: 'École Sans Accord', name: 'Testeur', email: 'sans-accord@test.ma' },
  })
  assert.equal(noConsent.status, 422)
  assert.deepEqual(noConsent.json.error.details, ['accept'])

  const admin = await login('nada@allneeds.ma')
  const list = await call('/api/registrations', { cookie: admin })
  assert.equal(list.status, 200)
  assert.ok(list.json.registrations.some((r) => r.email === 'demande-creation@test.ma'))

  const audit = await call('/api/audit', { cookie: admin })
  assert.ok(audit.json.audit.some((entry) => entry.action === 'registration.received'), 'réception tracée')
})

test('santé du service : environnement exposé, aucune donnée sensible', async () => {
  const res = await call('/api/health')
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.service, 'allneeds-api')
  assert.equal(res.json.environment, 'demo')
  assert.equal(JSON.stringify(res.json).includes('password'), false)
  assert.equal(JSON.stringify(res.json).includes('token'), false)
})

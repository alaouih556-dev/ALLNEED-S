// Comptes & accès : réservé au PDG, changements de rôle sûrs, accès réellement appliqués par le serveur.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { scryptSync } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const port = 9010 + Math.floor(Math.random() * 20)
const origin = `http://127.0.0.1:${port}`
const dir = mkdtempSync(join(tmpdir(), 'allneeds-accounts-'))
const password = 'Accounts-test-123!'
const passwordHash = `scrypt$abcd$${scryptSync(password, 'abcd', 64).toString('hex')}`
const pos = (level, departmentId, teamId = null, strategyManager = false) => ({ level, departmentId, teamId, strategyManager })
const account = (id, role, extra = {}) => ({ id, email: `${id}@x.test`, name: id, role, orgIds: role === 'admin' ? ['*'] : [], sectors: [], active: true, passwordHash, passwordConfigured: true, permissions: [], ...extra })
writeFileSync(join(dir, 'db.json'), JSON.stringify({
  orgs: [{ id: 'c1', name: 'Client Un', slug: 'c1', sector: 'sante', active: true, modules: { diagnostic: true, documents: false } }, { id: 'c2', name: 'Client Deux', slug: 'c2', sector: 'sante', active: true, modules: {} }],
  users: [
    account('pdg', 'admin'), account('pdg2', 'admin'),
    account('dev', 'staff', { orgPosition: pos('member', 'marketing', 'dev-ai') }),
    account('lead', 'staff', { orgPosition: pos('team_manager', 'marketing', 'dev-ai') }),
    account('head', 'staff', { orgPosition: pos('department_manager', 'commercial') }),
    account('agent', 'agent', { crm: { databaseIds: [], campaignIds: [], zoneIds: [] } }),
    account('am', 'concierge', { orgIds: ['c1'] }),
    account('owner', 'dirigeant', { orgIds: ['c1'], permissions: ['documents'] }),
    account('sales', 'sales'),
  ],
}))
const env = { ...process.env, PORT: String(port), ALLNEEDS_DATA_DIR: dir, ALLNEEDS_FRONTEND_ORIGIN: origin, ALLNEEDS_PUBLIC_URL: origin, ALLNEEDS_SESSION_SECRET: '0123456789abcdefghijklmnopqrstuvwxyz-ACC' }
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV', 'VERCEL', 'EMAIL_HOST']) delete env[key]
const start = async () => {
  const child = spawn(process.execPath, ['backend/server.mjs'], { env, stdio: ['ignore', 'ignore', 'inherit'] })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${origin}/api/health`)).ok) return child } catch {} await new Promise((d) => setTimeout(d, 100)) }
  child.kill(); throw new Error('backend non démarré')
}
const sessions = new Map()
const call = async (who, method, path, body) => {
  const headers = { origin, cookie: sessions.get(who) ?? '' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json().catch(() => ({})) }
}
const expect = async (status, who, method, path, body) => {
  const r = await call(who, method, path, body)
  assert.equal(r.status, status, `${who} ${method} ${path} → ${r.status} ${JSON.stringify(r.data).slice(0, 130)}`)
  return r.data
}
const login = async (id, expected = 200) => {
  const r = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email: `${id}@x.test`, password }) })
  assert.equal(r.status, expected, `connexion ${id}`)
  if (r.status === 200) sessions.set(id, r.headers.get('set-cookie').split(';')[0])
}
const patch = (id, body, status = 200, who = 'pdg') => expect(status, who, 'PATCH', `/api/org/accounts/${id}`, body)

let child = await start()
try {
  for (const id of ['pdg', 'pdg2', 'dev', 'lead', 'head', 'agent', 'am', 'owner', 'sales']) await login(id)

  const list = await expect(200, 'pdg', 'GET', '/api/org/accounts')
  assert.equal(list.accounts.length, 9)
  assert.ok(list.accounts.every((a) => !('passwordHash' in a)), 'aucune empreinte exposée')
  assert.ok(!JSON.stringify(list).includes('scrypt$'), 'aucun secret exposé')
  for (const who of ['dev', 'lead', 'head', 'agent', 'am', 'owner']) {
    await expect(403, who, 'GET', '/api/org/accounts')
    await expect(403, who, 'PATCH', '/api/org/accounts/dev', { role: 'admin' })
  }
  await expect(403, 'sales', 'GET', '/api/org/accounts')

  // Protections
  await patch('pdg', { role: 'staff' }, 400)
  await patch('pdg', { active: false }, 400)
  await patch('dev', { role: 'inconnu' }, 400)
  await patch('dev', { orgPermissions: ['settings.manage'] }, 400)
  await patch('agent', { crmPermissions: ['users.manage'] }, 400)
  await patch('dev', { role: 'dirigeant' }, 400)
  await patch('dev', { role: 'staff', position: pos('member', 'commercial', 'teleprospection') }, 400)
  assert.equal((await expect(200, 'pdg', 'GET', '/api/org/accounts')).accounts.find((a) => a.id === 'dev').role, 'staff', 'une demande refusée ne change rien')
  await patch('pdg2', { active: false })
  await login('pdg2', 401)
  await patch('pdg2', { active: true })
  await login('pdg2')
  await patch('pdg2', { role: 'staff', position: pos('member', 'marketing', 'design') })
  await patch('pdg2', { role: 'admin' })
  await login('pdg2')

  // Droits internes par personne
  assert.ok((await expect(200, 'dev', 'GET', '/api/org/me')).permissions.includes('tasks.view'))
  await patch('dev', { orgPermissions: ['team.view'] })
  await expect(403, 'dev', 'GET', '/api/org/tasks')
  await patch('dev', { orgPermissions: ['team.view', 'tasks.view', 'members.view'] })
  assert.ok((await expect(200, 'dev', 'GET', '/api/org/teams/dev-ai')).memberList.length > 0)
  await expect(403, 'dev', 'GET', '/api/org/teams/design')
  await patch('lead', { orgPermissions: ['team.view', 'tasks.view'] })
  await expect(403, 'lead', 'POST', '/api/org/tasks', { title: 'x', departmentId: 'marketing', teamId: 'dev-ai' })
  await patch('lead', { orgPermissions: null })
  await expect(201, 'lead', 'POST', '/api/org/tasks', { title: 'x', departmentId: 'marketing', teamId: 'dev-ai' })

  // CRM par personne
  await expect(200, 'agent', 'GET', '/api/crm/contacts')
  await patch('agent', { crmPermissions: ['dashboard.view'] })
  await expect(403, 'agent', 'GET', '/api/crm/contacts')
  await patch('agent', { crmPermissions: null })
  await expect(200, 'agent', 'GET', '/api/crm/contacts')

  // Sales Presentation
  await expect(403, 'dev', 'GET', '/api/sales/presentation')
  await patch('dev', { salesPresentation: true })
  await expect(200, 'dev', 'GET', '/api/sales/presentation')
  await patch('dev', { salesPresentation: false })
  await expect(403, 'dev', 'GET', '/api/sales/presentation')
  await patch('am', { salesPresentation: true })
  await expect(200, 'am', 'GET', '/api/sales/presentation')

  // Modules d'une entreprise
  await patch('owner', { companyModules: { documents: true, inconnu: true } }, 400)
  await patch('owner', { companyModules: { documents: true } })
  assert.equal((await expect(200, 'owner', 'GET', '/api/me')).organization.modules.documents, true)

  // Changements de rôle, appliqués sans nouvelle connexion
  await patch('dev', { role: 'concierge' })
  let me = await expect(200, 'dev', 'GET', '/api/me')
  assert.equal(me.role, 'concierge'); assert.equal(me.orgPosition.teamId, 'account-manager')
  await expect(200, 'dev', 'GET', '/api/account-manager/orgs')
  await patch('dev', { role: 'agent' })
  await expect(200, 'dev', 'GET', '/api/crm/me')
  await expect(403, 'dev', 'GET', '/api/account-manager/orgs')
  await patch('dev', { role: 'dirigeant', organizationId: 'c2' })
  me = await expect(200, 'dev', 'GET', '/api/me')
  assert.equal(me.organization.id, 'c2'); assert.equal(me.orgPosition, null)
  await expect(403, 'dev', 'GET', '/api/org/me')
  await patch('dev', { role: 'staff', position: pos('team_manager', 'marketing', 'strategies', true) })
  assert.equal((await expect(200, 'dev', 'GET', '/api/org/me')).position.strategyManager, true)
  await patch('dev', { role: 'admin' })
  await expect(200, 'dev', 'GET', '/api/org/accounts')
  await patch('dev', { role: 'staff', position: pos('member', 'marketing', 'dev-ai') })
  await expect(403, 'dev', 'GET', '/api/org/accounts')
  await expect(403, 'dev', 'GET', '/api/admin/orgs')

  // Persistance
  await patch('agent', { crmPermissions: ['dashboard.view'] })
  await new Promise((done) => { child.once('exit', done); child.kill() })
  child = await start()
  await login('agent')
  await expect(403, 'agent', 'GET', '/api/crm/contacts')
  console.log('OK comptes: PDG uniquement · protections · rôles · droits par personne · CRM · Sales · modules · persistance')
} finally {
  child.kill()
}

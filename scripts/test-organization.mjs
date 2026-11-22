// Organisation interne : hiérarchie, périmètres, tâches, stratégies, invitations et accès CRM.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { scryptSync } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const port = 8970 + Math.floor(Math.random() * 20)
const origin = `http://127.0.0.1:${port}`
const dir = mkdtempSync(join(tmpdir(), 'allneeds-org-'))
const password = 'Organisation-test-123!'
const passwordHash = `scrypt$abcd$${scryptSync(password, 'abcd', 64).toString('hex')}`
const account = (id, role, orgPosition, extra = {}) => ({ id, email: `${id}@x.test`, name: id, role, orgIds: role === 'admin' ? ['*'] : [], sectors: [], active: true, passwordHash, passwordConfigured: true, permissions: [], ...(orgPosition ? { orgPosition } : {}), ...extra })
const pos = (level, departmentId, teamId = null, strategyManager = false) => ({ level, departmentId, teamId, strategyManager })

writeFileSync(join(dir, 'db.json'), JSON.stringify({
  orgs: [{ id: 'client1', name: 'Client', slug: 'client', sector: 'sante', active: true, modules: {} }],
  users: [
    account('pdg', 'admin'),
    account('mkt-head', 'staff', pos('department_manager', 'marketing')),
    account('com-head', 'staff', pos('department_manager', 'commercial')),
    account('dev-lead', 'staff', pos('team_manager', 'marketing', 'dev-ai')),
    account('dev-one', 'staff', pos('member', 'marketing', 'dev-ai')),
    account('design-one', 'staff', pos('member', 'marketing', 'design')),
    account('strategist', 'staff', pos('member', 'marketing', 'strategies', true)),
    account('am-legacy', 'concierge', null, { orgIds: ['client1'] }),
    account('agent-legacy', 'agent', null, { crm: { databaseIds: [], campaignIds: [], zoneIds: [] } }),
    account('owner', 'dirigeant', null, { orgIds: ['client1'] }),
  ],
}))

const env = { ...process.env, PORT: String(port), ALLNEEDS_DATA_DIR: dir, ALLNEEDS_FRONTEND_ORIGIN: origin, ALLNEEDS_PUBLIC_URL: origin, ALLNEEDS_SESSION_SECRET: '0123456789abcdefghijklmnopqrstuvwxyz-ORG', EMAIL_HOST: '', EMAIL_USER: '', EMAIL_PASS: '', EMAIL_FROM: '' }
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV', 'VERCEL']) delete env[key]

async function start() {
  const child = spawn(process.execPath, ['backend/server.mjs'], { env, stdio: ['ignore', 'ignore', 'inherit'] })
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${origin}/api/health`)).ok) return child } catch { /* démarrage */ }
    await new Promise((done) => setTimeout(done, 100))
  }
  child.kill()
  throw new Error('backend non démarré')
}
const stop = (child) => new Promise((done) => { child.once('exit', done); child.kill() })

const sessions = new Map()
async function call(who, method, path, body) {
  const headers = { origin }
  if (who) headers.cookie = sessions.get(who)
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  return { status: response.status, data }
}
async function login(id, secret = password) {
  const response = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email: `${id}@x.test`, password: secret }) })
  assert.equal(response.status, 200, `connexion ${id}`)
  sessions.set(id, response.headers.get('set-cookie').split(';')[0])
}
const expect = async (status, who, method, path, body) => {
  const result = await call(who, method, path, body)
  assert.equal(result.status, status, `${who} ${method} ${path} → ${result.status} ${JSON.stringify(result.data).slice(0, 120)}`)
  return result.data
}

let child = await start()
try {
  for (const id of ['pdg', 'mkt-head', 'com-head', 'dev-lead', 'dev-one', 'design-one', 'strategist', 'am-legacy', 'agent-legacy', 'owner']) await login(id)

  // La réponse de connexion porte les mêmes droits que /api/me : l'accès CRM marche sans recharger la page.
  for (const [id, access] of [['pdg', true], ['com-head', true], ['agent-legacy', true], ['dev-one', false], ['owner', false]]) {
    const response = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email: `${id}@x.test`, password }) })
    const { user } = await response.json()
    assert.equal(user.crmAccess, access, `crmAccess à la connexion : ${id}`)
    assert.equal('passwordHash' in user, false)
  }
  assert.equal((await (await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email: 'com-head@x.test', password }) })).json()).user.orgPosition.departmentId, 'commercial')

  // Positions et comptes historiques
  assert.equal((await expect(200, 'pdg', 'GET', '/api/org/me')).position.level, 'pdg')
  const am = await expect(200, 'am-legacy', 'GET', '/api/org/me')
  assert.deepEqual([am.position.departmentId, am.position.teamId], ['commercial', 'account-manager'])
  assert.equal((await expect(200, 'agent-legacy', 'GET', '/api/org/me')).position.teamId, 'teleprospection')
  await expect(403, 'owner', 'GET', '/api/org/me')
  await expect(401, null, 'GET', '/api/org/me')

  // Périmètres
  assert.equal((await expect(200, 'pdg', 'GET', '/api/org/overview')).departments.length, 2)
  await expect(403, 'mkt-head', 'GET', '/api/org/overview')
  await expect(200, 'mkt-head', 'GET', '/api/org/departments/marketing')
  await expect(403, 'mkt-head', 'GET', '/api/org/departments/commercial')
  await expect(403, 'dev-lead', 'GET', '/api/org/departments/marketing')
  await expect(200, 'dev-one', 'GET', '/api/org/teams/dev-ai')
  await expect(403, 'dev-one', 'GET', '/api/org/teams/design')
  assert.equal((await expect(200, 'dev-one', 'GET', '/api/org/teams/dev-ai')).memberList.length, 0, 'un membre ne liste pas l’équipe par défaut')
  await expect(403, 'dev-one', 'GET', '/api/org/members')
  const seen = await expect(200, 'dev-lead', 'GET', '/api/org/members')
  assert.ok(seen.members.every((m) => m.teamId === 'dev-ai'))

  // Cloisonnement des anciens espaces
  await expect(403, 'dev-one', 'GET', '/api/admin/orgs')
  await expect(403, 'dev-one', 'GET', '/api/crm/me')
  await expect(403, 'mkt-head', 'GET', '/api/crm/me')
  await expect(403, 'agent-legacy', 'GET', '/api/admin/orgs')

  // Tâches
  await expect(403, 'dev-one', 'POST', '/api/org/tasks', { title: 'x', departmentId: 'marketing', teamId: 'dev-ai' })
  await expect(403, 'dev-lead', 'POST', '/api/org/tasks', { title: 'x', departmentId: 'marketing', teamId: 'design' })
  await expect(400, 'dev-lead', 'POST', '/api/org/tasks', { title: 'x', departmentId: 'marketing', teamId: 'dev-ai', assigneeId: 'design-one' })
  const task = await expect(201, 'dev-lead', 'POST', '/api/org/tasks', { title: 'Automatiser', departmentId: 'marketing', teamId: 'dev-ai', assigneeId: 'dev-one', dueDate: '2020-01-01' })
  assert.equal(task.overdue, true)
  assert.equal((await expect(200, 'dev-one', 'GET', '/api/org/tasks?mine=1')).tasks.length, 1)
  assert.equal((await expect(200, 'design-one', 'GET', '/api/org/tasks')).tasks.length, 0)
  await expect(404, 'design-one', 'PATCH', `/api/org/tasks/${task.id}`, { status: 'done' })
  await expect(403, 'dev-one', 'PATCH', `/api/org/tasks/${task.id}`, { title: 'changé' })
  await expect(403, 'dev-one', 'DELETE', `/api/org/tasks/${task.id}`)
  assert.equal((await expect(200, 'dev-one', 'PATCH', `/api/org/tasks/${task.id}`, { status: 'done' })).status, 'done')
  assert.ok((await expect(200, 'dev-one', 'GET', '/api/notifications')).some((n) => n.type === 'org.task.assigned'))

  // Stratégies
  await expect(403, 'mkt-head', 'POST', '/api/org/strategies', { title: 'x' })
  await expect(403, 'dev-one', 'POST', '/api/org/strategies', { title: 'x' })
  const strategy = await expect(201, 'strategist', 'POST', '/api/org/strategies', { title: 'Lancement Santé', objectives: [{ title: 'Leads', target: 100, current: 25, unit: 'leads' }] })
  assert.equal(strategy.objectiveProgress, 25)
  const planned = await expect(201, 'strategist', 'POST', '/api/org/tasks', { title: 'Visuels', departmentId: 'marketing', teamId: 'design', assigneeId: 'design-one', strategyId: strategy.id, objectiveId: strategy.objectives[0].id })
  assert.equal(planned.strategyTitle, 'Lancement Santé')
  await expect(200, 'design-one', 'GET', `/api/org/strategies/${strategy.id}`)
  await expect(404, 'dev-one', 'GET', `/api/org/strategies/${strategy.id}`)
  await expect(404, 'com-head', 'GET', `/api/org/strategies/${strategy.id}`)
  await expect(403, 'design-one', 'PATCH', `/api/org/strategies/${strategy.id}`, { title: 'x' })
  await expect(200, 'strategist', 'PATCH', `/api/org/strategies/${strategy.id}`, { status: 'active' })
  await expect(200, 'pdg', 'PATCH', `/api/org/strategies/${strategy.id}`, { summary: 'Validée' })

  // Membres et invitation
  await expect(403, 'dev-lead', 'POST', '/api/org/members', { email: 'a@x.test', name: 'A', departmentId: 'marketing', teamId: 'dev-ai', level: 'member' })
  await expect(403, 'mkt-head', 'POST', '/api/org/members', { email: 'a@x.test', name: 'A', departmentId: 'commercial', teamId: 'account-manager', level: 'member' })
  await expect(403, 'mkt-head', 'POST', '/api/org/members', { email: 'a@x.test', name: 'A', departmentId: 'marketing', level: 'department_manager' })
  await expect(403, 'mkt-head', 'PATCH', '/api/org/members/dev-one', { departmentId: 'marketing', teamId: 'design', level: 'member', strategyManager: true })
  await expect(403, 'mkt-head', 'PATCH', '/api/org/members/com-head', { departmentId: 'marketing', teamId: 'design', level: 'member' })
  await expect(404, 'pdg', 'PATCH', '/api/org/members/owner', { departmentId: 'marketing', teamId: 'design', level: 'member' })
  const invited = await expect(201, 'com-head', 'POST', '/api/org/members', { email: 'new-am@x.test', name: 'Nouveau', departmentId: 'commercial', teamId: 'account-manager', level: 'member' })
  const token = new URL(invited.delivery.setupUrl).searchParams.get('token')
  assert.ok(token, 'lien de configuration disponible')
  await expect(200, null, 'POST', '/api/auth/setup-password', { token, password })
  await login('new-am')
  const created = await expect(200, 'new-am', 'GET', '/api/me')
  assert.equal(created.role, 'concierge')
  assert.equal(created.orgPosition.teamId, 'account-manager')
  assert.equal('passwordHash' in created, false)

  // Accès CRM selon la hiérarchie : jamais d'élévation vers le PDG
  assert.equal((await expect(200, 'com-head', 'GET', '/api/crm/me')).isAdmin, true)
  await expect(403, 'com-head', 'POST', '/api/crm/users', { name: 'Evil', email: 'evil@x.test', role: 'admin', password: 'Evil-password-123!' })
  await expect(403, 'com-head', 'PATCH', '/api/crm/users/pdg', { name: 'x' })
  await expect(403, 'com-head', 'POST', '/api/crm/users/pdg/reset', {})
  await expect(403, 'com-head', 'PATCH', '/api/crm/users/agent-legacy', { role: 'admin' })
  await expect(403, 'com-head', 'GET', '/api/admin/orgs')

  // Permissions configurables
  await expect(403, 'mkt-head', 'GET', '/api/org/settings')
  const settings = await expect(200, 'pdg', 'GET', '/api/org/settings')
  await expect(400, 'pdg', 'PATCH', '/api/org/settings', { levelPermissions: { member: ['settings.manage'] } })
  await expect(200, 'pdg', 'PATCH', '/api/org/settings', { levelPermissions: { member: [...settings.levelPermissions.member, 'members.view'] } })
  assert.ok((await expect(200, 'dev-one', 'GET', '/api/org/teams/dev-ai')).memberList.length > 0)

  // Persistance
  await stop(child)
  child = await start()
  for (const id of ['pdg', 'strategist']) await login(id)
  assert.equal((await expect(200, 'strategist', 'GET', '/api/org/strategies')).strategies.length, 1)
  assert.equal((await expect(200, 'pdg', 'GET', '/api/org/overview')).tasks.total, 2)
  console.log('OK organisation: hiérarchie · périmètres · tâches · stratégies · invitations · CRM sans élévation · permissions · persistance')
} finally {
  child.kill()
}

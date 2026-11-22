/*
 * Présentation commerciale : rôle `sales`, seed idempotent et contrôle d'accès serveur.
 * Démarre le backend sur une base temporaire (aucune donnée réelle n'est touchée).
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const dir = mkdtempSync(join(tmpdir(), 'allneeds-sales-'))
const origin = 'http://127.0.0.1:5176'
const port = 8798
const base = `http://127.0.0.1:${port}`
const SALES_EMAIL = 'sales_presentation@gmail.com'
// Mots de passe de test générés à chaque exécution : jamais de secret réel dans le dépôt.
const salesPassword = `Test-${randomBytes(12).toString('hex')}`
const salesPassword2 = `Test-${randomBytes(12).toString('hex')}`
const pw = { admin: 'AdminPassword!2026', concierge: 'ConciergePassword!2026', owner: 'OwnerPassword!2026' }

async function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('hex')}` }
const db = {
  users: [
    { id: 'admin', email: 'admin@test.ma', role: 'admin', orgIds: ['*'], name: 'Admin', active: true, passwordConfigured: true, passwordHash: await passwordHash(pw.admin), permissions: ['*'] },
    { id: 'conc', email: 'concierge@test.ma', role: 'concierge', orgIds: [], sectors: ['sante'], name: 'Concierge', active: true, passwordConfigured: true, passwordHash: await passwordHash(pw.concierge), permissions: [] },
    { id: 'owner', email: 'owner@test.ma', role: 'dirigeant', orgIds: ['org1'], name: 'Owner', active: true, passwordConfigured: true, passwordHash: await passwordHash(pw.owner), permissions: [] },
  ],
  orgs: [{ id: 'org1', name: 'Cabinet Test', slug: 'cabinet-test', sector: 'sante', active: true, modules: {} }],
  diagnostics: [], needs: [], consents: [], registrations: [], invitations: [],
}
writeFileSync(join(dir, 'db.json'), JSON.stringify(db, null, 2))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let child = null
let stdout = ''
async function start(extraEnv) {
  stdout = ''
  child = spawn(process.execPath, ['backend/server.mjs'], { cwd: process.cwd(), env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ALLNEEDS_SALES_PASSWORD: '', ALLNEEDS_SALES_EMAIL: '', PORT: String(port), ALLNEEDS_DATA_DIR: dir, ALLNEEDS_FRONTEND_ORIGIN: origin, ALLNEEDS_PUBLIC_URL: origin, ALLNEEDS_SESSION_SECRET: '0123456789abcdefghijklmnopqrstuvwxyz-TEST-secret', EMAIL_HOST: '', ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d) => (stdout += d))
  child.stderr.on('data', (d) => (stdout += d))
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await sleep(100) }
  throw new Error(`backend indisponible: ${stdout}`)
}
async function stop() { if (!child) return; const c = child; child = null; c.kill(); await new Promise((r) => c.once('exit', r)) }
function assert(ok, msg) { if (!ok) throw new Error(`ÉCHEC — ${msg}`); console.log(`OK — ${msg}`) }
async function req(path, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(base + path, { method, headers: { Origin: origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data, cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
const login = (email, password) => req('/api/auth/login', { method: 'POST', body: { email, password } })
const readDb = () => JSON.parse(readFileSync(join(dir, 'db.json'), 'utf8'))
const salesUsers = () => readDb().users.filter((u) => u.email === SALES_EMAIL)

try {
  /* 1. Seed : création, idempotence, mise à jour du mot de passe */
  await start({ ALLNEEDS_SALES_PASSWORD: salesPassword })
  assert(salesUsers().length === 1, 'seed : compte de présentation créé')
  const created = salesUsers()[0]
  assert(created.role === 'sales' && created.orgIds.length === 0 && created.permissions.length === 0, 'seed : rôle sales, aucune entreprise, aucune permission')
  assert(created.passwordHash.startsWith('scrypt$') && !readFileSync(join(dir, 'db.json'), 'utf8').includes(salesPassword), 'seed : mot de passe haché (scrypt), jamais en clair')
  assert(!stdout.includes(salesPassword), 'seed : mot de passe absent des journaux')
  await stop()

  await start({ ALLNEEDS_SALES_PASSWORD: salesPassword })
  assert(salesUsers().length === 1 && salesUsers()[0].id === created.id && salesUsers()[0].passwordHash === created.passwordHash, 'seed : relance sans doublon ni réécriture')
  await stop()

  await start({ ALLNEEDS_SALES_PASSWORD: salesPassword2 })
  assert(salesUsers().length === 1 && salesUsers()[0].id === created.id, 'seed : changement de mot de passe sans doublon')
  assert((await login(SALES_EMAIL, salesPassword)).status === 401, 'seed : ancien mot de passe refusé')

  /* 2. Connexion du compte commercial */
  let x = await login(SALES_EMAIL, salesPassword2)
  assert(x.status === 200 && x.data.user.role === 'sales', 'le compte commercial se connecte')
  assert(!('passwordHash' in x.data.user), 'aucune empreinte de mot de passe dans la réponse')
  const sales = x.cookie

  /* 3. Ce que le compte commercial peut et ne peut pas faire */
  x = await req('/api/sales/presentation', { cookie: sales })
  assert(x.status === 200 && Array.isArray(x.data.sections) && x.data.sections.length === 8, 'commercial : présentation accessible (8 sections)')
  for (const path of ['/api/admin/orgs', '/api/admin/registrations', '/api/admin/sales-access', '/api/needs', '/api/diagnostics', '/api/notifications', '/api/admin/account-managers', '/api/staff/requests']) {
    x = await req(path, { cookie: sales })
    assert(x.status === 403, `commercial : ${path} refusé (403)`)
  }
  x = await req('/api/admin/sales-access/conc', { method: 'PATCH', cookie: sales, body: { enabled: true } })
  assert(x.status === 403, 'commercial : ne peut pas accorder d’accès')
  x = await req('/api/me/profile', { method: 'PATCH', cookie: sales, body: { name: 'Pirate' } })
  assert(x.status === 403, 'commercial : profil partagé verrouillé')
  x = await req('/api/me', { cookie: sales })
  assert(x.status === 200 && x.data.role === 'sales' && x.data.organization === null, 'commercial : /api/me sans entreprise rattachée')

  /* 4. Administrateur */
  const admin = (await login('admin@test.ma', pw.admin)).cookie
  x = await req('/api/sales/presentation', { cookie: admin })
  assert(x.status === 200, 'admin : présentation accessible')
  x = await req('/api/admin/sales-access', { cookie: admin })
  assert(x.status === 200 && x.data.accounts.length === 1 && x.data.accounts[0].email === SALES_EMAIL && !('passwordHash' in x.data.accounts[0]), 'admin : liste des comptes commerciaux (sans empreinte)')
  x = await req('/api/admin/orgs', { cookie: admin })
  assert(x.status === 200, 'admin : accès existants inchangés')

  /* 5. Autres rôles refusés, sauf permission accordée */
  const anon = await req('/api/sales/presentation')
  assert(anon.status === 401, 'anonyme : 401')
  const owner = (await login('owner@test.ma', pw.owner)).cookie
  assert((await req('/api/sales/presentation', { cookie: owner })).status === 403, 'client (dirigeant) : 403')
  assert((await req('/api/admin/sales-access/owner', { method: 'PATCH', cookie: admin, body: { enabled: true } })).status === 400, 'un client ne peut pas recevoir l’accès commercial')
  const conc = (await login('concierge@test.ma', pw.concierge)).cookie
  assert((await req('/api/sales/presentation', { cookie: conc })).status === 403, 'concierge sans permission : 403')
  x = await req('/api/admin/sales-access/conc', { method: 'PATCH', cookie: admin, body: { enabled: true } })
  assert(x.status === 200 && x.data.salesAccess === true, 'admin : accès accordé au concierge')
  assert((await req('/api/sales/presentation', { cookie: conc })).status === 200, 'concierge autorisé : 200')
  assert((await req('/api/account-manager/orgs', { cookie: conc })).status === 200, 'concierge autorisé : son espace reste accessible')
  await req('/api/admin/sales-access/conc', { method: 'PATCH', cookie: admin, body: { enabled: false } })
  assert((await req('/api/sales/presentation', { cookie: conc })).status === 403, 'admin : accès retiré au concierge')

  /* 6. Désactivation du compte commercial */
  await req(`/api/admin/sales-access/${created.id}`, { method: 'PATCH', cookie: admin, body: { enabled: false } })
  assert((await req('/api/sales/presentation', { cookie: sales })).status === 401, 'compte désactivé : session coupée')
  assert((await login(SALES_EMAIL, salesPassword2)).status === 401, 'compte désactivé : connexion refusée')
  await req(`/api/admin/sales-access/${created.id}`, { method: 'PATCH', cookie: admin, body: { enabled: true } })
  assert((await login(SALES_EMAIL, salesPassword2)).status === 200, 'compte réactivé : connexion possible')

  /* 7. Invitation d'un nouveau commercial */
  x = await req('/api/admin/sales-access/invite', { method: 'POST', cookie: admin, body: { name: 'Vendeur Test', email: 'vendeur@test.ma' } })
  assert(x.status === 201 && x.data.delivery?.setupUrl, 'admin : invitation commerciale créée')
  const token = new URL(x.data.delivery.setupUrl).searchParams.get('token')
  assert((await req(`/api/auth/invitation?token=${token}`)).data.organization === 'ALLNEEDS', 'invitation : rattachée à ALLNEEDS')
  assert((await req('/api/auth/setup-password', { method: 'POST', body: { token, password: 'VendeurPassword!2026' } })).status === 200, 'invitation : mot de passe créé')
  x = await login('vendeur@test.ma', 'VendeurPassword!2026')
  assert(x.status === 200 && x.data.user.role === 'sales', 'invitation : nouveau compte sales opérationnel')
  assert((await req('/api/admin/orgs', { cookie: x.cookie })).status === 403, 'invitation : nouveau compte sans accès admin')
  assert((await req('/api/admin/sales-access/invite', { method: 'POST', cookie: admin, body: { name: 'X', email: SALES_EMAIL } })).status === 409, 'invitation : pas de doublon d’e-mail')
  await stop()

  /* 8. Le seed ne rétrograde jamais un administrateur */
  await start({ ALLNEEDS_SALES_EMAIL: 'admin@test.ma', ALLNEEDS_SALES_PASSWORD: salesPassword })
  const adminRow = readDb().users.filter((u) => u.email === 'admin@test.ma')
  assert(adminRow.length === 1 && adminRow[0].role === 'admin', 'seed : un compte administrateur n’est pas converti')
  assert((await login('admin@test.ma', pw.admin)).status === 200, 'seed : mot de passe administrateur inchangé')

  console.log('\nOK — présentation commerciale : rôle, seed et contrôle d’accès validés.')
} finally {
  await stop()
  rmSync(dir, { recursive: true, force: true })
}

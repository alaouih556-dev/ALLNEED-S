/*
 * Remise à zéro de la base ALLNEEDS (Supabase + copie locale backend/data/db.json).
 *
 * 1. Sauvegarde toutes les tables et db.json dans ~/allneeds-backups/<date>/ (hors dépôt).
 * 2. Vide toutes les tables v46_*.
 * 3. Crée uniquement les comptes administrateurs demandés (mot de passe haché scrypt).
 *
 * Arrêtez le backend AVANT de lancer ce script, sinon il réécrira les anciennes données.
 * Usage :
 *   RESET_ADMINS="a@x.com,b@y.com" RESET_ADMIN_PASSWORD='…' node scripts/reset-database.mjs --yes
 * Le mot de passe n'est jamais écrit dans le dépôt ni affiché.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const scrypt = promisify(scryptCb)
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DB_PATH = `${ROOT}backend/data/db.json`

if (!process.argv.includes('--yes')) {
  console.error('Ajoutez --yes pour confirmer : toutes les données seront supprimées (une sauvegarde est faite avant).')
  process.exit(1)
}
const env = Object.fromEntries(
  readFileSync(`${ROOT}.env`, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const ADMINS = (process.env.RESET_ADMINS || '').split(',').map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
const PASSWORD = process.env.RESET_ADMIN_PASSWORD || ''
if (!ADMINS.length) throw new Error('RESET_ADMINS manquant')
if (PASSWORD.length < 12) throw new Error('RESET_ADMIN_PASSWORD doit contenir au moins 12 caractères')

const SUPABASE_URL = (env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
const remote = Boolean(SUPABASE_URL && KEY)
async function req(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...(opts.headers || {}) } })
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`)
  return r
}
const COLLECTIONS = ['v46_registrations', 'v46_diagnostics', 'v46_needs', 'v46_diagnostic_consents', 'v46_missions', 'v46_offers', 'v46_documents', 'v46_messages', 'v46_appointments', 'v46_quotes', 'v46_notifications', 'v46_needs_subscriptions', 'v46_saas_subscriptions', 'v46_conversations']
const ORDER = [...COLLECTIONS, 'v46_concierge_organizations', 'v46_invitations', 'v46_users', 'v46_organizations']

/* 1. Sauvegarde */
const dir = `${process.env.HOME}/allneeds-backups/${new Date().toISOString().replace(/[:.]/g, '-')}`
mkdirSync(dir, { recursive: true, mode: 0o700 })
if (existsSync(DB_PATH)) writeFileSync(`${dir}/db.json`, readFileSync(DB_PATH), { mode: 0o600 })
const dump = {}
if (remote) {
  for (const t of ORDER) {
    try { dump[t] = await (await req(`${t}?select=*`)).json() } catch (e) { if (/PGRST205|does not exist/.test(e.message)) { dump[t] = null; continue } throw e }
  }
  writeFileSync(`${dir}/supabase.json`, JSON.stringify(dump, null, 1), { mode: 0o600 })
}
console.log(`Sauvegarde : ${dir}`)
console.log('  ' + (Object.entries(dump).filter(([, v]) => v?.length).map(([k, v]) => `${k}=${v.length}`).join(' ') || 'base distante vide'))

/* 2. Vidage */
if (remote) for (const t of ORDER) if (dump[t]) await req(`${t}?id=not.is.null`, { method: 'DELETE' })

/* 3. Administrateurs */
async function hash(p) { const salt = randomBytes(16).toString('hex'); return `scrypt$${salt}$${(await scrypt(p, salt, 64)).toString('hex')}` }
const users = []
for (const email of ADMINS) users.push({ id: `admin-${randomBytes(8).toString('hex')}`, email, role: 'admin', orgIds: ['*'], sectors: [], name: 'Administrateur ALLNEEDS', active: true, passwordHash: await hash(PASSWORD), passwordConfigured: true, permissions: ['*'] })
if (remote) {
  await req('v46_users', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(users.map((u) => ({ id: u.id, organization_id: null, email: u.email, name: u.name, role: 'admin', active: true, password_hash: u.passwordHash, password_configured: true, permissions: ['*'], sectors: [], metadata: {} }))) })
}
const fresh = { users, orgs: [], diagnostics: [], needs: [], consents: [], registrations: [], invitations: [], missions: [], offers: [], documents: [], messages: [], meetings: [], quotes: [], notifications: [], needsSubscriptions: [], saasSubscriptions: [], conversations: [] }
writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2), { mode: 0o600 })

/* 4. Vérification */
if (remote) {
  for (const t of ORDER) if (dump[t]) { const n = (await (await req(`${t}?select=id`)).json()).length; if (t !== 'v46_users' && n) console.warn(`Reste ${n} ligne(s) dans ${t}`) }
  const now = await (await req('v46_users?select=email,role')).json()
  console.log('Comptes Supabase :', now.map((u) => `${u.role}:${u.email}`).join(' | '))
}
console.log('Base remise à zéro. Redémarrez le backend : npm run dev:all')

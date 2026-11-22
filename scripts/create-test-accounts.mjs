/*
 * Crée un compte de test par rôle via le backend EN COURS D'EXÉCUTION (mêmes parcours que l'interface :
 * comptes CRM, invitations concierge/commercial, inscription client → affectation → mot de passe,
 * invitations d'équipe). Les données vont donc dans la base active (Supabase + copie locale).
 *
 * Mots de passe générés aléatoirement, écrits uniquement dans test-accounts.local.md (ignoré par git),
 * jamais affichés dans le terminal. Ré-exécutable : un compte déjà existant est conservé tel quel.
 *
 * Usage (backend démarré) :
 *   ADMIN_EMAIL='…' ADMIN_PASSWORD='…' node scripts/create-test-accounts.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const env = existsSync(`${ROOT}.env`) ? Object.fromEntries(readFileSync(`${ROOT}.env`, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })) : {}
const API = (process.env.API_URL || `http://127.0.0.1:${env.PORT || 8787}`).replace(/\/$/, '')
const ORIGIN = (env.ALLNEEDS_FRONTEND_ORIGIN || 'http://localhost:5173').split(',')[0].trim()
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const DOMAIN = process.env.TEST_DOMAIN || 'allneeds.test'
const OUT = process.env.TEST_ACCOUNTS_FILE || `${ROOT}test-accounts.local.md`
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('Définissez ADMIN_EMAIL et ADMIN_PASSWORD (un compte administrateur existant).'); process.exit(1) }

// Sans caractères ambigus (l, I, 1, O, 0, _, -) pour pouvoir les recopier sans erreur.
const SAFE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const newPassword = () => `Test-${[...randomBytes(14)].map((b) => SAFE[b % SAFE.length]).join('')}!`
async function call(path, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(API + path, { method, headers: { Origin: ORIGIN, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data, cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email, password) {
  const r = await call('/api/auth/login', { method: 'POST', body: { email, password } })
  if (r.status !== 200) throw new Error(`connexion impossible pour ${email} (${r.status}) : ${r.data.error || ''}`)
  return r.cookie
}
async function setPassword(setupUrl, password) {
  const token = new URL(setupUrl).searchParams.get('token')
  const r = await call('/api/auth/setup-password', { method: 'POST', body: { token, password } })
  if (r.status !== 200) throw new Error(`création du mot de passe impossible (${r.status}) : ${r.data.error || ''}`)
  return r.data.user
}

try { await fetch(`${API}/api/health`) } catch { console.error(`Backend injoignable sur ${API} : démarrez-le (npm run dev:all) puis relancez.`); process.exit(1) }
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
const results = []
const done = (role, label, email, password, space, note = '') => { results.push({ role, label, email, password, space, note }); console.log(`✓ ${label.padEnd(26)} ${email}${note ? `  (${note})` : ''}`) }
const exists = (role, label, email, space) => { results.push({ role, label, email, password: '(inchangé : compte déjà existant)', space, note: 'déjà existant' }); console.log(`= ${label.padEnd(26)} ${email}  (déjà existant, conservé)`) }
const fail = (label, e) => { results.push({ role: '', label, email: '', password: '', space: '', note: `ÉCHEC : ${e.message}` }); console.log(`✗ ${label} : ${e.message}`) }

/* 1. Comptes CRM (mot de passe direct) : administrateur, agent, rôle CRM */
for (const [role, label, space] of [['admin', 'Administrateur', '/admin et /crm'], ['agent', 'Agent CRM', '/crm'], ['crm', 'CRM (+ Sales Presentation)', '/crm et /sales-presentation']]) {
  const email = `test.${role}@${DOMAIN}`, password = newPassword()
  try {
    const r = await call('/api/crm/users', { method: 'POST', cookie: admin, body: { name: `Test ${label}`, email, role, password } })
    if (r.status === 409) exists(role, label, email, space)
    else if (r.status !== 201) throw new Error(r.data.error || `erreur ${r.status}`)
    else done(role, label, email, password, space)
  } catch (e) { fail(label, e) }
}

/* 2. Concierge (invitation puis mot de passe) */
let conciergeId = null
{
  const email = `test.concierge@${DOMAIN}`, password = newPassword()
  try {
    const r = await call('/api/admin/account-managers', { method: 'POST', cookie: admin, body: { name: 'Test Concierge', email, sectors: ['sante'], assignedOrgIds: [] } })
    if (r.status === 409) { exists('concierge', 'Concierge', email, '/account-manager'); conciergeId = (await call('/api/admin/account-managers', { cookie: admin })).data.concierges?.find((c) => c.email === email)?.id }
    else if (r.status !== 201) throw new Error(r.data.error || `erreur ${r.status}`)
    else { conciergeId = (await setPassword(r.data.delivery.setupUrl, password)).id; done('concierge', 'Concierge', email, password, '/account-manager') }
  } catch (e) { fail('Concierge', e) }
}

/* 3. Commercial « sales » (présentation commerciale uniquement) */
{
  const email = `test.sales@${DOMAIN}`, password = newPassword()
  try {
    const r = await call('/api/admin/sales-access/invite', { method: 'POST', cookie: admin, body: { name: 'Test Commercial', email } })
    if (r.status === 409) exists('sales', 'Commercial (sales)', email, '/sales-presentation')
    else if (r.status !== 201) throw new Error(r.data.error || `erreur ${r.status}`)
    else { await setPassword(r.data.delivery.setupUrl, password); done('sales', 'Commercial (sales)', email, password, '/sales-presentation') }
  } catch (e) { fail('Commercial (sales)', e) }
}

/* 4. Dirigeant : inscription publique → affectation au concierge → mot de passe */
let ownerCookie = null
{
  const email = `test.dirigeant@${DOMAIN}`, password = newPassword()
  try {
    if (!conciergeId) throw new Error('aucun concierge disponible pour l’affectation')
    const reg = await call('/api/registrations', { method: 'POST', body: { orgName: 'Cabinet Test ALLNEEDS', name: 'Test Dirigeant', email, sector: 'sante', city: 'Rabat', workspaceProfile: 'Cabinet', appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), appointmentSlot: '10:00', consent: true } })
    if (reg.status === 409) { exists('dirigeant', 'Dirigeant (client)', email, '/app') }
    else if (reg.status !== 201) throw new Error(reg.data.error || `erreur ${reg.status}`)
    else {
      const assigned = await call(`/api/admin/registrations/${reg.data.id}/assign`, { method: 'POST', cookie: admin, body: { conciergeId } })
      if (assigned.status !== 200 || !assigned.data.delivery?.setupUrl) throw new Error(assigned.data.error || 'invitation du dirigeant non générée')
      await setPassword(assigned.data.delivery.setupUrl, password)
      ownerCookie = await login(email, password)
      done('dirigeant', 'Dirigeant (client)', email, password, '/app', 'entreprise « Cabinet Test ALLNEEDS », suivie par le concierge de test')
    }
  } catch (e) { fail('Dirigeant (client)', e) }
}

/* 5. Manager et collaborateur : invités par le dirigeant */
for (const [role, label] of [['manager', 'Manager (client)'], ['collaborateur', 'Collaborateur (client)']]) {
  const email = `test.${role}@${DOMAIN}`, password = newPassword()
  try {
    if (!ownerCookie) throw new Error('dirigeant de test indisponible (déjà existant ou en échec) : invitez ce compte depuis l’espace du dirigeant')
    const r = await call('/api/team/invitations', { method: 'POST', cookie: ownerCookie, body: { name: `Test ${label.split(' ')[0]}`, email, role, permissions: ['actions', 'missions', 'documents', 'messages', 'results'] } })
    if (r.status === 409) { exists(role, label, email, '/app'); continue }
    if (r.status !== 201 && r.status !== 200) throw new Error(r.data.error || `erreur ${r.status}`)
    await setPassword(r.data.delivery.setupUrl, password)
    done(role, label, email, password, '/app')
  } catch (e) { fail(label, e) }
}

/* 6. Fichier local (ignoré par git) */
const lines = [
  '# Comptes de test ALLNEEDS',
  '',
  `Créés le ${new Date().toLocaleString('fr-FR')} via ${API}. Fichier local, ignoré par git : ne pas le partager.`,
  '',
  '| Rôle | Compte | E-mail | Mot de passe | Espace | Remarque |',
  '|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.role} | ${r.label} | ${r.email} | \`${r.password}\` | ${r.space} | ${r.note} |`),
  '',
  'Le rôle `prestataire` (espace expert) n’a pas de parcours de création dans l’application : il n’est pas créé ici.',
  'Les adresses en `@allneeds.test` ne reçoivent pas d’e-mail : les mots de passe ont été définis directement.',
  '',
]
const previous = existsSync(OUT) ? `\n\n---\n\n${readFileSync(OUT, 'utf8')}` : ''
writeFileSync(OUT, lines.join('\n') + previous, { mode: 0o600 })
console.log(`\nIdentifiants enregistrés dans ${OUT} (ignoré par git).`)

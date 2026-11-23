/*
 * CRM : rôles, permissions, périmètre agent, import, appels, rendez-vous, campagnes, zones,
 * statistiques, rapports, notifications, réglages et journal. Base temporaire, aucune donnée réelle.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const dir = mkdtempSync(join(tmpdir(), 'allneeds-crm-'))
const origin = 'http://127.0.0.1:5177'
const port = 8799
const base = `http://127.0.0.1:${port}`
const pw = { admin: 'AdminPassword!2026', owner: 'OwnerPassword!2026' }
const agentPw = `Agent-${randomBytes(8).toString('hex')}`
const agent2Pw = `Agent-${randomBytes(8).toString('hex')}`

async function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('hex')}` }
writeFileSync(join(dir, 'db.json'), JSON.stringify({
  users: [
    { id: 'admin', email: 'admin@test.ma', role: 'admin', orgIds: ['*'], name: 'Admin', active: true, passwordConfigured: true, passwordHash: await passwordHash(pw.admin), permissions: ['*'] },
    { id: 'owner', email: 'owner@test.ma', role: 'dirigeant', orgIds: ['org1'], name: 'Owner', active: true, passwordConfigured: true, passwordHash: await passwordHash(pw.owner), permissions: [] },
  ],
  orgs: [{ id: 'org1', name: 'Cabinet Test', slug: 'cabinet-test', sector: 'sante', active: true, modules: {} }],
}))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let child = null
let logs = ''
async function start() {
  child = spawn(process.execPath, ['backend/server.mjs'], { cwd: process.cwd(), env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ALLNEEDS_SALES_PASSWORD: '', ALLNEEDS_ADMIN_PASSWORD: '', EMAIL_HOST: '', PORT: String(port), ALLNEEDS_DATA_DIR: dir, ALLNEEDS_FRONTEND_ORIGIN: origin, CORS_ORIGINS: '', ALLNEEDS_PUBLIC_URL: origin, ALLNEEDS_SESSION_SECRET: '0123456789abcdefghijklmnopqrstuvwxyz-CRM-secret' }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d) => (logs += d)); child.stderr.on('data', (d) => (logs += d))
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await sleep(100) }
  throw new Error(`backend indisponible: ${logs}`)
}
async function stop() { if (!child) return; const c = child; child = null; c.kill(); await new Promise((r) => c.once('exit', r)) }
let passed = 0
function assert(ok, msg) { if (!ok) throw new Error(`ÉCHEC — ${msg}`); passed++; console.log(`OK — ${msg}`) }
async function req(path, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(base + path, { method, headers: { Origin: origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data, cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
const login = async (email, password) => (await req('/api/auth/login', { method: 'POST', body: { email, password } }))
const today = new Date().toISOString().slice(0, 10)

try {
  await start()
  const admin = (await login('admin@test.ma', pw.admin)).cookie
  assert(admin, 'admin connecté')

  /* --- Session & accès --- */
  let x = await req('/api/crm/me', { cookie: admin })
  assert(x.status === 200 && x.data.isAdmin && x.data.permissions.includes('users.manage'), 'admin : toutes les permissions CRM')
  const owner = (await login('owner@test.ma', pw.owner)).cookie
  assert((await req('/api/crm/me', { cookie: owner })).status === 403, 'client (dirigeant) : CRM refusé')
  assert((await req('/api/crm/me')).status === 401, 'anonyme : CRM refusé')

  /* --- Bases, campagnes, zones --- */
  x = await req('/api/crm/campaigns', { method: 'POST', cookie: admin, body: { name: 'Prospection Rabat', type: 'Prospection', status: 'active', startDate: today, goals: { appointments: 4 } } })
  assert(x.status === 201, 'campagne créée'); const campaign = x.data
  x = await req('/api/crm/databases', { method: 'POST', cookie: admin, body: { name: 'Cabinets Rabat', source: 'Fichier salon', status: 'draft', campaignId: campaign.id } })
  assert(x.status === 201 && x.data.campaignName === 'Prospection Rabat', 'base créée et liée à la campagne'); const dbA = x.data
  x = await req('/api/crm/databases', { method: 'POST', cookie: admin, body: { name: 'Cabinets Casablanca' } })
  const dbB = x.data
  assert((await req('/api/crm/databases', { method: 'POST', cookie: admin, body: { name: 'cabinets rabat' } })).status === 409, 'base : nom en double refusé')
  x = await req('/api/crm/zones', { method: 'POST', cookie: admin, body: { name: 'Rabat centre', color: '#2563eb', cities: ['Rabat'], shape: { type: 'circle', lat: 34.0209, lng: -6.8416, radiusKm: 15 } } })
  assert(x.status === 201, 'zone créée'); const zone = x.data
  assert((await req('/api/crm/zones', { method: 'POST', cookie: admin, body: { name: 'Vide' } })).status === 400, 'zone sans forme ni ville refusée')

  /* --- Comptes --- */
  x = await req('/api/crm/users', { method: 'POST', cookie: admin, body: { name: 'Agent Un', email: 'agent1@test.ma', role: 'agent', password: agentPw, databaseIds: [dbA.id], campaignIds: [campaign.id], zoneIds: [zone.id] } })
  assert(x.status === 201 && x.data.user.role === 'agent' && !('passwordHash' in x.data.user) && !JSON.stringify(x.data).includes('scrypt'), 'agent créé (sans empreinte dans la réponse)'); const agent1 = x.data.user
  x = await req('/api/crm/users', { method: 'POST', cookie: admin, body: { name: 'Agent Deux', email: 'agent2@test.ma', role: 'agent', password: agent2Pw, databaseIds: [dbB.id] } })
  const agent2 = x.data.user
  assert((await req('/api/crm/users', { method: 'POST', cookie: admin, body: { name: 'X', email: 'AGENT1@test.ma', role: 'agent', password: agentPw } })).status === 409, 'e-mail en double refusé')
  assert((await req('/api/crm/users', { method: 'POST', cookie: admin, body: { name: 'X', email: 'short@test.ma', role: 'agent', password: 'court' } })).status === 400, 'mot de passe trop court refusé')
  x = await req('/api/crm/users', { method: 'POST', cookie: admin, body: { name: 'Invité', email: 'invite@test.ma', role: 'agent' } })
  assert(x.status === 201 && x.data.user.passwordConfigured === false && x.data.delivery?.setupUrl, 'compte par invitation sécurisée (lien de création)')
  const dbFile = readFileSync(join(dir, 'db.json'), 'utf8')
  assert(!dbFile.includes(agentPw) && !logs.includes(agentPw), 'mot de passe jamais stocké ni journalisé en clair')

  const a1 = (await login('agent1@test.ma', agentPw)).cookie
  const a2 = (await login('agent2@test.ma', agent2Pw)).cookie
  assert(a1 && a2, 'agents connectés')
  x = await req('/api/crm/me', { cookie: a1 })
  assert(x.status === 200 && !x.data.isAdmin && !x.data.permissions.includes('users.manage'), 'agent : permissions restreintes')
  for (const path of ['/api/crm/users', '/api/crm/settings', '/api/crm/activity', '/api/crm/agents', '/api/admin/orgs', '/api/needs']) assert((await req(path, { cookie: a1 })).status === 403, `agent : ${path} refusé`)
  assert((await req('/api/crm/users', { method: 'POST', cookie: a1, body: { name: 'Pirate', email: 'p@test.ma', role: 'admin', password: 'PiratePassword!2026' } })).status === 403, 'agent : création de compte admin refusée')
  assert((await req(`/api/crm/users/${agent2.id}`, { method: 'PATCH', cookie: a1, body: { databaseIds: [dbA.id] } })).status === 403, 'agent : modification des affectations refusée')
  assert((await req('/api/crm/databases', { method: 'POST', cookie: a1, body: { name: 'Pirate' } })).status === 403, 'agent : création de base refusée')

  /* --- Import --- */
  const rows = [
    { firstName: 'Salma', lastName: 'Benali', phone: '0612345678', email: 'salma@cab.ma', city: 'Rabat', lat: 34.02, lng: -6.83, tags: 'dentiste' },
    { firstName: 'Youssef', lastName: 'Idrissi', phone: '+212 6 22 33 44 55', city: 'Rabat' },
    { firstName: 'Sans', lastName: 'Contact' },
    { firstName: 'Salma', lastName: 'Doublon', phone: '06 12 34 56 78' },
    { fullName: 'Clinique Nour', phone: '0537000000', city: 'Casablanca', lat: 33.57, lng: -7.59 },
  ]
  x = await req('/api/crm/imports/check', { method: 'POST', cookie: admin, body: { databaseId: dbA.id, rows } })
  assert(x.status === 200 && x.data.results[2].errors.length === 1, 'import : ligne invalide détectée avant import')
  x = await req('/api/crm/imports', { method: 'POST', cookie: admin, body: { databaseId: dbA.id, fileName: 'cabinets.csv', total: rows.length, duplicateStrategy: 'skip' } })
  assert(x.status === 201, 'import : tâche créée'); const job = x.data
  x = await req(`/api/crm/imports/${job.id}/rows`, { method: 'POST', cookie: admin, body: { rows, offset: 0 } })
  assert(x.data.inserted === 3 && x.data.invalid === 1 && x.data.skipped === 1, 'import : 3 ajoutés, 1 invalide, 1 doublon ignoré')
  x = await req(`/api/crm/imports/${job.id}/complete`, { method: 'POST', cookie: admin })
  assert(x.status === 200 && x.data.status === 'completed', 'import : terminé avec résumé')
  x = await req(`/api/crm/databases/${dbA.id}`, { cookie: admin })
  assert(x.data.status === 'active' && x.data.totalContacts === 3 && x.data.history.length >= 2, 'base : passée active, historique tracé')
  assert((await req('/api/crm/imports', { method: 'POST', cookie: a1, body: { databaseId: dbA.id, total: 1 } })).status === 403, 'agent : import refusé')

  /* --- Contacts & périmètre --- */
  x = await req('/api/crm/contacts?pageSize=50', { cookie: admin })
  const all = x.data.rows
  const salma = all.find((c) => c.firstName === 'Salma'), youssef = all.find((c) => c.firstName === 'Youssef'), nour = all.find((c) => c.fullName === 'Clinique Nour')
  x = await req('/api/crm/contacts', { method: 'POST', cookie: admin, body: { databaseId: dbB.id, fullName: 'Contact Casa', phone: '0522111111', city: 'Casablanca' } })
  assert(x.status === 201, 'contact créé manuellement'); const casa = x.data
  assert((await req('/api/crm/contacts', { method: 'POST', cookie: admin, body: { databaseId: dbB.id, fullName: 'Copie', phone: '0522 11 11 11' } })).status === 409, 'contact : doublon signalé')
  x = await req('/api/crm/contacts?pageSize=50', { cookie: a1 })
  assert(x.data.total === 4 && x.data.rows.some((c) => c.id === casa.id), 'agent 1 : voit tous les contacts partagés')
  assert((await req(`/api/crm/contacts/${casa.id}`, { cookie: a1 })).status === 200, 'agent 1 : fiche d’une autre base consultable')
  assert((await req(`/api/crm/contacts/${casa.id}`, { method: 'PATCH', cookie: a1, body: { notes: 'Note partagée', agentId: agent1.id, databaseId: dbA.id } })).status === 200, 'agent 1 : fiche d’une autre base modifiable')
  x = await req(`/api/crm/contacts/${casa.id}`, { cookie: admin })
  assert(x.data.contact.notes === 'Note partagée' && x.data.contact.databaseId === dbB.id && !x.data.contact.agentId, 'contact partagé : modifié sans changer sa base ni son agent')
  assert((await req(`/api/crm/contacts/${casa.id}/notes`, { method: 'POST', cookie: a1, body: { text: 'Note équipe' } })).status === 201, 'agent 1 : note ajoutée sur une autre base')
  assert((await req('/api/crm/contacts/bulk', { method: 'POST', cookie: a1, body: { ids: [casa.id], action: 'tags', tags: ['partage'] } })).status === 200, 'agent 1 : action groupée possible sur un contact partagé')
  assert((await req('/api/crm/contacts/bulk', { method: 'POST', cookie: a1, body: { ids: [casa.id], action: 'archive' } })).status === 403, 'agent 1 : archivage groupé refusé')
  assert((await req(`/api/crm/contacts/${casa.id}?hard=1`, { method: 'DELETE', cookie: a1 })).status === 403, 'agent 1 : suppression de contact refusée')
  assert(!(await req('/api/crm/contacts/export', { cookie: a1 })).data.rows.some((c) => c.id === casa.id), 'agent 1 : export limité à son périmètre')
  x = await req('/api/crm/contacts/bulk', { method: 'POST', cookie: admin, body: { ids: [youssef.id], action: 'assign', agentId: agent2.id } })
  assert(x.data.updated === 1, 'assignation d’un contact à l’agent 2')
  assert((await req(`/api/crm/contacts/${youssef.id}`, { cookie: a1 })).status === 200, 'agent 1 : contact d’un autre agent consultable')
  assert((await req('/api/crm/contacts/bulk', { method: 'POST', cookie: a1, body: { ids: [salma.id], action: 'assign', agentId: agent1.id } })).status === 403, 'agent : réassignation refusée')
  x = await req(`/api/crm/contacts/${salma.id}`, { method: 'PATCH', cookie: a1, body: { notes: 'Préfère le matin', agentId: agent2.id, databaseId: dbB.id } })
  assert(x.status === 200 && x.data.notes === 'Préfère le matin' && x.data.databaseId === dbA.id && !x.data.agentId, 'agent : modifie la fiche mais pas l’affectation ni la base')
  assert((await req(`/api/crm/contacts/${salma.id}/notes`, { method: 'POST', cookie: a1, body: { text: 'Rappeler après 10h' } })).status === 201, 'agent : note ajoutée')
  x = await req('/api/crm/contacts/bulk', { method: 'POST', cookie: admin, body: { ids: [salma.id, nour.id], action: 'tags', tags: 'prioritaire' } })
  assert(x.data.updated === 2, 'tags ajoutés en masse')

  /* --- Appels --- */
  x = await req('/api/crm/calls', { method: 'POST', cookie: a1, body: { contactId: salma.id, status: 'no_answer', notes: 'Messagerie' } })
  assert(x.status === 201, 'agent : appel enregistré')
  const cb = new Date(Date.now() + 5 * 60000).toISOString()
  x = await req('/api/crm/calls', { method: 'POST', cookie: a1, body: { contactId: salma.id, status: 'callback_requested', notes: 'Rappeler', callbackAt: cb, durationSec: 95 } })
  assert(x.status === 201, 'agent : rappel programmé')
  x = await req(`/api/crm/contacts/${salma.id}`, { cookie: a1 })
  assert(x.data.contact.status === 'callback_requested' && x.data.contact.nextCallbackAt === cb && x.data.calls.length === 2 && x.data.timeline.length >= 3, 'contact : statut, rappel, historique et chronologie à jour')
  assert((await req('/api/crm/calls', { method: 'POST', cookie: a1, body: { contactId: 'inconnu', status: 'answered' } })).status === 404, 'agent : appel sur contact inconnu refusé')
  assert((await req('/api/crm/calls', { method: 'POST', cookie: a1, body: { contactId: salma.id, status: 'teleporte' } })).status === 400, 'appel : statut invalide refusé')

  /* --- Rendez-vous --- */
  x = await req('/api/crm/appointments', { method: 'POST', cookie: a1, body: { contactId: salma.id, date: today, start: '10:00', type: 'Diagnostic' } })
  assert(x.status === 201 && x.data.end === '11:00' && x.data.lat === 34.02, 'agent : RDV créé (fin calculée, coordonnées du contact reprises)')
  const rdv = x.data
  assert((await req('/api/crm/appointments', { method: 'POST', cookie: a1, body: { contactId: salma.id, date: today, start: '12:00', end: '11:00' } })).status === 400, 'RDV : fin avant début refusée')
  x = await req(`/api/crm/appointments/${rdv.id}`, { method: 'PATCH', cookie: admin, body: { status: 'confirmed' } })
  assert(x.data.status === 'confirmed', 'admin : RDV confirmé')
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  x = await req(`/api/crm/appointments/${rdv.id}`, { method: 'PATCH', cookie: a1, body: { date: tomorrow, start: '14:00', end: '15:00' } })
  assert(x.data.status === 'rescheduled' && x.data.history.length === 3, 'RDV déplacé → statut « reporté » et historique')
  assert((await req(`/api/crm/appointments/${rdv.id}`, { method: 'PATCH', cookie: a2, body: { status: 'cancelled' } })).status === 403, 'agent 2 : RDV d’un autre agent non modifiable')
  x = await req(`/api/crm/appointments?from=${today}&to=${tomorrow}&all=1`, { cookie: a1 })
  assert(x.data.rows.length === 1, 'RDV listés sur une période (calendrier)')

  /* --- Notifications --- */
  x = await req('/api/crm/notifications', { cookie: admin })
  assert(x.data.rows.some((n) => n.type === 'crm.appointment.created') && x.data.rows.some((n) => n.type === 'crm.import.completed'), 'admin : notifications nouveau RDV et import')
  x = await req('/api/crm/notifications', { cookie: a1 })
  assert(x.data.rows.some((n) => n.type === 'crm.appointment.confirmed') && x.data.rows.some((n) => n.type === 'crm.database.assigned'), 'agent : notifications confirmation et base assignée')
  assert((await req('/api/crm/notifications/read-all', { method: 'POST', cookie: a1 })).status === 200 && (await req('/api/crm/notifications?unread=1', { cookie: a1 })).data.total === 0, 'tout marquer comme lu')

  /* --- Statistiques, rapports, carte --- */
  x = await req(`/api/crm/stats?from=${today}&to=${today}&today=${today}`, { cookie: admin })
  const k = x.data.kpis
  assert(x.status === 200 && k.totalContacts === 4 && k.totalCalls === 2 && k.callsToday === 2 && k.contactsReached === 1 && k.appointmentsBooked === 1 && k.activeAgents === 3, 'tableau de bord : KPI calculés sur les données réelles')
  x = await req(`/api/crm/stats?from=${today}&to=${today}&agentId=${agent2.id}`, { cookie: admin })
  assert(x.data.kpis.totalCalls === 0, 'tableau de bord : filtre par agent')
  x = await req(`/api/crm/stats?from=${today}&to=${today}`, { cookie: a1 })
  assert(x.data.kpis.totalContacts === 2 && x.data.perAgent.length === 1 && x.data.topAgents.length === 0, 'agent : statistiques limitées à son périmètre')
  for (const type of ['calls', 'contacts', 'appointments', 'agents', 'databases', 'campaigns', 'zones', 'conversion', 'callbacks']) {
    x = await req(`/api/crm/reports?type=${type}&from=${today}&to=${today}&compare=1`, { cookie: admin })
    assert(x.status === 200 && Array.isArray(x.data.rows) && x.data.previous, `rapport ${type} (avec comparaison)`)
  }
  x = await req('/api/crm/map', { cookie: admin })
  assert(x.data.contacts.length === 2 && x.data.missing.contacts === 2 && x.data.zones.length === 1, 'carte : uniquement les contacts géolocalisés, les autres comptés à part')
  x = await req(`/api/crm/map?zoneId=${zone.id}`, { cookie: admin })
  assert(x.data.contacts.length === 1, 'carte : filtre par zone')
  assert((await req('/api/crm/geocode', { method: 'POST', cookie: admin, body: { contactIds: [casa.id] } })).status === 400, 'géocodage désactivé par défaut (aucun envoi externe)')
  x = await req(`/api/crm/contacts/${casa.id}/location`, { method: 'POST', cookie: admin, body: { lat: 33.58, lng: -7.6 } })
  assert(x.data.lat === 33.58 && x.data.locationSource === 'manual', 'localisation manuelle d’un contact')

  /* --- Agents & campagnes --- */
  x = await req('/api/crm/agents', { cookie: admin })
  assert(x.data.rows.find((a) => a.id === agent1.id).callsMade === 2, 'agents : performance par agent')
  assert((await req(`/api/crm/agents/${agent1.id}`, { cookie: a1 })).status === 200 && (await req(`/api/crm/agents/${agent2.id}`, { cookie: a1 })).status === 403, 'agent : voit sa fiche, pas celle d’un autre')
  x = await req(`/api/crm/campaigns/${campaign.id}`, { cookie: admin })
  assert(x.data.metrics.appointments === 1 && x.data.metrics.progress === 25 && x.data.agentIds.includes(agent1.id), 'campagne : métriques et progression vers l’objectif')
  assert((await req('/api/crm/campaigns', { cookie: a2 })).data.total === 0, 'agent 2 : aucune campagne assignée')

  /* --- Réglages, permissions, journal --- */
  x = await req('/api/crm/settings', { method: 'PATCH', cookie: admin, body: { section: 'permissions', values: { agent: ['dashboard.view', 'contacts.view', 'calls.create', 'notifications.view'] } } })
  assert(x.status === 200, 'réglages : permissions des agents modifiées')
  assert((await req('/api/crm/appointments', { method: 'POST', cookie: a1, body: { contactId: salma.id, date: today, start: '16:00' } })).status === 403, 'agent : permission retirée appliquée côté serveur')
  await req('/api/crm/settings', { method: 'PATCH', cookie: admin, body: { section: 'permissions', values: { agent: ['dashboard.view', 'contacts.view', 'contacts.edit', 'calls.create', 'appointments.view', 'appointments.create', 'appointments.edit', 'map.view', 'campaigns.view', 'reports.view', 'notifications.view'] } } })
  assert((await req('/api/crm/settings', { method: 'PATCH', cookie: a1, body: { section: 'general', values: { crmName: 'Pirate' } } })).status === 403, 'agent : réglages refusés')
  x = await req('/api/crm/activity?pageSize=200', { cookie: admin })
  const actions = new Set(x.data.rows.map((a) => a.action))
  for (const a of ['user.created', 'database.created', 'database.imported', 'contact.created', 'contact.assigned', 'call.recorded', 'appointment.created', 'appointment.updated', 'campaign.created', 'zone.created', 'settings.changed']) assert(actions.has(a), `journal : ${a}`)

  /* --- Rôle « CRM » : droits d'agent + présentation commerciale --- */
  const crmPw = `Crm-${randomBytes(8).toString('hex')}`
  x = await req('/api/crm/users', { method: 'POST', cookie: admin, body: { name: 'Compte CRM', email: 'crm@test.ma', role: 'crm', password: crmPw, databaseIds: [dbA.id] } })
  assert(x.status === 201 && x.data.user.role === 'crm' && x.data.user.roleLabel === 'CRM', 'rôle CRM : compte créé')
  const crmUser = (await login('crm@test.ma', crmPw)).cookie
  x = await req('/api/crm/me', { cookie: crmUser })
  assert(x.status === 200 && !x.data.isAdmin && x.data.permissions.includes('contacts.view') && !x.data.permissions.includes('users.manage'), 'rôle CRM : droits d’agent dans le CRM')
  assert((await req('/api/crm/contacts?pageSize=50', { cookie: crmUser })).data.total >= 1, 'rôle CRM : voit les contacts de sa base')
  assert((await req('/api/sales/presentation', { cookie: crmUser })).status === 200, 'rôle CRM : présentation commerciale accessible')
  for (const path of ['/api/crm/users', '/api/crm/settings', '/api/admin/orgs', '/api/needs', '/api/admin/sales-access']) assert((await req(path, { cookie: crmUser })).status === 403, `rôle CRM : ${path} refusé`)
  assert((await req('/api/crm/agents', { cookie: admin })).data.rows.some((a) => a.email === 'crm@test.ma'), 'rôle CRM : suivi dans la performance des agents')

  /* --- Rôle « CRM » : création de base et import limités à son périmètre --- */
  const crmMe = (await req('/api/crm/me', { cookie: crmUser })).data.user
  x = await req('/api/crm/databases', { method: 'POST', cookie: crmUser, body: { name: 'Base CRM Excel', source: 'Excel', status: 'active', campaignId: campaign.id, agentIds: [agent1.id] } })
  assert(x.status === 201 && x.data.status === 'draft' && !x.data.campaignId && x.data.agentIds.length === 1 && x.data.agentIds[0] === crmMe.id, 'rôle CRM : crée une base qui lui revient, sans campagne ni autre agent')
  const crmBase = x.data
  x = await req(`/api/crm/databases/${crmBase.id}`, { cookie: a1 })
  assert(x.status === 200 && !x.data.canImport && !x.data.canDelete, 'base partagée : visible des autres agents, sans import ni suppression')
  assert((await req(`/api/crm/databases/${crmBase.id}`, { method: 'PATCH', cookie: crmUser, body: { name: 'Renommée' } })).status === 403, 'rôle CRM : modification de base refusée')
  assert((await req(`/api/crm/databases/${dbA.id}?hard=1`, { method: 'DELETE', cookie: crmUser })).status === 403, 'rôle CRM : suppression d’une base créée par un autre refusée')
  assert((await req(`/api/crm/databases/${crmBase.id}`, { method: 'DELETE', cookie: crmUser })).status === 403, 'rôle CRM : archivage refusé')
  x = await req('/api/crm/imports', { method: 'POST', cookie: crmUser, body: { databaseId: dbB.id, total: 1 } })
  assert(x.status === 201, 'rôle CRM : import possible dans une base partagée')
  await req(`/api/crm/imports/${x.data.id}/fail`, { method: 'POST', cookie: crmUser, body: { error: 'test' } })
  assert((await req('/api/crm/lookups', { cookie: a1 })).data.databases.some((d) => d.id === dbB.id), 'agent : toutes les bases actives proposées')
  assert((await req('/api/crm/contacts', { method: 'POST', cookie: a1, body: { databaseId: dbB.id, fullName: 'Sans droit', phone: '0699887733' } })).status === 403, 'agent sans permission : ajout de contact refusé')
  await req(`/api/crm/users/${agent1.id}`, { method: 'PATCH', cookie: admin, body: { permissions: ['contacts.view', 'contacts.create'] } })
  x = await req('/api/crm/contacts', { method: 'POST', cookie: a1, body: { databaseId: dbB.id, fullName: 'Ajout agent', phone: '0699887744' } })
  await req(`/api/crm/users/${agent1.id}`, { method: 'PATCH', cookie: admin, body: { permissions: null } })
  assert(x.status === 201 && x.data.databaseId === dbB.id, 'agent : ajoute un contact dans une base partagée')
  assert((await req(`/api/crm/contacts/${x.data.id}?hard=1`, { method: 'DELETE', cookie: admin })).status === 200, 'admin : retire le contact de test')
  assert((await req('/api/crm/imports/check', { method: 'POST', cookie: crmUser, body: { databaseId: dbB.id, rows: [{ fullName: 'X', phone: '0699887766' }] } })).status === 200, 'rôle CRM : vérification possible sur une base partagée')
  x = await req('/api/crm/imports/check', { method: 'POST', cookie: crmUser, body: { databaseId: crmBase.id, rows: [{ fullName: 'Écrasé', phone: '0522111111' }] } })
  assert(x.status === 200 && x.data.results[0].duplicateOf && x.data.results[0].duplicateOf.name === 'Contact Casa', 'rôle CRM : doublon de la base partagée signalé')
  x = await req('/api/crm/imports', { method: 'POST', cookie: crmUser, body: { databaseId: crmBase.id, fileName: 'contacts.xlsx', total: 2, duplicateStrategy: 'update' } })
  assert(x.status === 201, 'rôle CRM : import lancé dans sa base'); const crmJob = x.data
  x = await req(`/api/crm/imports/${crmJob.id}/rows`, { method: 'POST', cookie: crmUser, body: { rows: [{ fullName: 'Écrasé', phone: '0522111111' }, { fullName: 'Nouveau CRM', phone: '0699887766' }], offset: 0 } })
  assert(x.status === 200 && x.data.inserted === 1 && x.data.updated === 0 && x.data.skipped === 1, 'rôle CRM : doublon hors périmètre ignoré, nouveau contact ajouté')
  assert((await req(`/api/crm/imports/${crmJob.id}/complete`, { method: 'POST', cookie: crmUser })).data.status === 'completed', 'rôle CRM : import terminé')
  x = await req('/api/crm/contacts?pageSize=100', { cookie: admin })
  assert(x.data.rows.some((c) => c.fullName === 'Contact Casa') && !x.data.rows.some((c) => c.fullName === 'Écrasé'), 'rôle CRM : contact d’une autre base intact')
  assert((await req(`/api/crm/databases/${crmBase.id}`, { cookie: crmUser })).data.status === 'active', 'rôle CRM : base active après import')
  x = await req('/api/crm/imports', { method: 'POST', cookie: crmUser, body: { databaseId: crmBase.id, total: 1, duplicateStrategy: 'create' } })
  assert(x.status === 201 && x.data.duplicateStrategy === 'skip', 'rôle CRM : création forcée de doublons refusée')
  await req(`/api/crm/imports/${x.data.id}/fail`, { method: 'POST', cookie: crmUser, body: { error: 'test' } })
  assert(!(await req('/api/crm/me', { cookie: a1 })).data.permissions.includes('imports.run'), 'agent : toujours sans droit d’import')

  x = await req('/api/crm/databases', { method: 'POST', cookie: crmUser, body: { name: 'Base CRM à supprimer' } })
  const crmTemp = x.data
  assert(x.data.canDelete === true, 'rôle CRM : peut supprimer sa propre base')
  x = await req('/api/crm/contacts', { method: 'POST', cookie: crmUser, body: { databaseId: crmTemp.id, fullName: 'Contact temporaire', phone: '0699887755' } })
  const tempContact = x.data
  await req(`/api/crm/contacts/${tempContact.id}`, { method: 'PATCH', cookie: admin, body: { agentId: agent1.id } })
  assert((await req(`/api/crm/databases/${crmTemp.id}?hard=1`, { method: 'DELETE', cookie: a1 })).status === 403, 'agent : suppression d’une base non assignée refusée')
  assert((await req(`/api/crm/databases/${crmTemp.id}?hard=1`, { method: 'DELETE', cookie: crmUser })).status === 409, 'rôle CRM : suppression refusée si un autre agent suit un contact')
  await req(`/api/crm/contacts/${tempContact.id}`, { method: 'PATCH', cookie: admin, body: { agentId: crmMe.id } })
  x = await req(`/api/crm/databases/${crmTemp.id}?hard=1`, { method: 'DELETE', cookie: crmUser })
  assert(x.status === 200 && x.data.deleted, 'rôle CRM : supprime sa base')
  assert((await req(`/api/crm/databases/${crmTemp.id}`, { cookie: admin })).status === 404 && (await req(`/api/crm/contacts/${tempContact.id}`, { cookie: admin })).status === 404, 'rôle CRM : base et contacts supprimés')

  x = await req(`/api/crm/contacts/${casa.id}`, { method: 'PATCH', cookie: admin, body: { agentId: crmMe.id } })
  assert(x.status === 200 && x.data.agentId === crmMe.id, 'admin : assigne un contact à un membre du CRM')
  assert((await req('/api/crm/notifications?pageSize=50', { cookie: crmUser })).data.rows.some((n) => n.type === 'crm.contacts.assigned'), 'membre du CRM : notifié de l’assignation')
  assert((await req(`/api/crm/contacts/${casa.id}`, { method: 'PATCH', cookie: a1, body: { agentId: agent1.id } })).data.agentId === crmMe.id, 'agent : ne peut pas changer l’assignation')
  assert((await req(`/api/crm/contacts/${casa.id}`, { method: 'PATCH', cookie: admin, body: { agentId: 'owner' } })).status === 400, 'assignation : compte hors CRM refusé')
  x = await req(`/api/crm/contacts/${casa.id}`, { method: 'PATCH', cookie: admin, body: { agentId: null } })
  assert(x.status === 200 && !x.data.agentId, 'admin : retire l’assignation')
  await req(`/api/crm/contacts/${casa.id}/location`, { method: 'POST', cookie: admin, body: { lat: null, lng: null } })
  x = await req('/api/crm/appointments', { method: 'POST', cookie: admin, body: { contactId: casa.id, date: today, start: '11:00' } })
  assert(x.status === 201 && x.data.lat === null, 'carte : rendez-vous sans position réelle reste sans position')
  const mapRdv = x.data
  x = await req('/api/crm/map', { cookie: crmUser })
  assert(x.data.unlocated.some((a) => a.id === mapRdv.id) && !x.data.appointments.some((a) => a.id === mapRdv.id), 'carte : rendez-vous d’un autre utilisateur listé à placer')
  assert((await req(`/api/crm/contacts/${casa.id}/location`, { method: 'POST', cookie: crmUser, body: { lat: 33.5731, lng: -7.5898 } })).status === 200, 'carte : position enregistrée par un autre membre du CRM')
  x = await req('/api/crm/map', { cookie: crmUser })
  const placedRdv = x.data.appointments.find((a) => a.id === mapRdv.id)
  assert(placedRdv?.lat === 33.5731 && placedRdv?.lng === -7.5898 && !x.data.unlocated.some((a) => a.id === mapRdv.id), 'carte : rendez-vous affiché à la position réelle du contact')
  assert((await req(`/api/crm/appointments/${mapRdv.id}`, { cookie: crmUser })).data.lat === 33.5731, 'rendez-vous : position du contact reprise')
  x = await req('/api/crm/calls', { method: 'POST', cookie: crmUser, body: { contactId: casa.id, status: 'no_answer', notes: 'Appel équipe' } })
  assert(x.status < 300, 'rôle CRM : appel enregistré sur un contact partagé')

  /* --- Désactivation --- */
  await req(`/api/crm/users/${agent2.id}`, { method: 'PATCH', cookie: admin, body: { status: 'suspended' } })
  assert((await req('/api/crm/me', { cookie: a2 })).status === 401, 'compte suspendu : session coupée')
  assert((await login('agent2@test.ma', agent2Pw)).status === 401, 'compte suspendu : connexion refusée')
  assert((await req(`/api/crm/contacts/${casa.id}`, { method: 'PATCH', cookie: admin, body: { agentId: agent2.id } })).status === 400, 'assignation : compte suspendu refusé')
  assert((await req(`/api/crm/users/${agent1.id}`, { method: 'DELETE', cookie: admin })).status === 409, 'suppression refusée si historique (désactivation proposée)')
  assert((await req('/api/crm/users/admin', { method: 'PATCH', cookie: admin, body: { status: 'inactive' } })).status === 400, 'admin : ne peut pas se désactiver lui-même')
  assert((await req(`/api/crm/databases/${dbA.id}?hard=1`, { method: 'DELETE', cookie: admin })).status === 409, 'base avec historique : suppression définitive refusée')
  assert((await req(`/api/crm/databases/${dbA.id}`, { method: 'DELETE', cookie: admin })).data.archived, 'base archivée')

  /* --- Persistance --- */
  await stop(); await start()
  const admin2 = (await login('admin@test.ma', pw.admin)).cookie
  x = await req('/api/crm/contacts?archived=0&pageSize=50', { cookie: admin2 })
  assert(x.data.total === 5, 'données CRM persistées après redémarrage')

  console.log(`\nOK — CRM : ${passed} vérifications.`)
} finally {
  await stop()
  rmSync(dir, { recursive: true, force: true })
}

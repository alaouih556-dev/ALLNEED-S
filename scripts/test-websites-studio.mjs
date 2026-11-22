// Parcours complet sur une base temporaire. Magnific est remplacé par un faux serveur local :
// ce test valide notre intégration, il ne prouve pas que l'API réelle répond.
import { spawn } from 'node:child_process'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = 9061, FAKE = 9062, origin = 'http://127.0.0.1:9063', base = `http://127.0.0.1:${API}`
const password = randomBytes(18).toString('base64url')
const salt = randomBytes(8).toString('hex')
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
const pos = (level, departmentId, teamId = null) => ({ level, departmentId, teamId, strategyManager: false })
const account = (id, role, extra = {}) => ({ id, email: `${id}@x.test`, name: id, role, orgIds: role === 'admin' ? ['*'] : [], sectors: [], active: true, passwordHash, passwordConfigured: true, permissions: [], ...extra })
const dir = mkdtempSync(join(tmpdir(), 'allneeds-projects-'))
writeFileSync(join(dir, 'db.json'), JSON.stringify({
  orgs: [{ id: 'a', name: 'Org A', slug: 'a', sector: 'sante', active: true, modules: {} }, { id: 'b', name: 'Org B', slug: 'b', sector: 'sante', active: true, modules: {} }],
  users: [
    account('admin', 'admin'), account('dev', 'staff', { orgPosition: pos('member', 'marketing', 'dev-ai') }), account('dev2', 'staff', { orgPosition: pos('member', 'marketing', 'dev-ai') }),
    account('design', 'staff', { orgPosition: pos('member', 'marketing', 'design') }), account('am', 'concierge', { orgIds: ['a'] }), account('sales', 'sales'),
    account('ownerA', 'dirigeant', { orgIds: ['a'] }), account('collabA', 'collaborateur', { orgIds: ['a'] }), account('ownerB', 'dirigeant', { orgIds: ['b'] }),
  ],
}))

/* Faux Magnific, conforme à la forme documentée. */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const runs = new Map()
let runCalls = 0
const fake = createServer(async (req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.headers['x-magnific-api-key'] !== 'fake-test-key') return send(401, {})
  if (req.method === 'GET' && /^\/v1\/ai\/flows\/[A-Za-z0-9]+$/.test(req.url)) return send(200, { data: { sqid: req.url.split('/').pop(), name: 'Flow', tool_metadata: { total_cost: 5 }, inputs: [{ id: 'n1', api_key: 'photo', type: 'creation', label: 'Photo', required: true, config: { mediaType: 'image' } }, { id: 'n2', api_key: 'prompt', type: 'text', label: 'Prompt', required: true }] } })
  if (req.method === 'POST' && req.url.endsWith('/run')) { runCalls++; const id = `run${runCalls}`; runs.set(id, 0); return send(202, { status: 'running', workflow_run_identifier: id }) }
  const run = req.url.match(/\/runs\/([^/]+)$/)
  if (run) {
    if (!runs.has(run[1])) return send(404, {})
    const seen = runs.get(run[1]); runs.set(run[1], seen + 1)
    return send(200, { data: { run_id: run[1], status: seen ? 'completed' : 'running', app_id: 'xUPRjfWKMO', result: seen ? { images: [{ id: 'i1', url: 'https://127.0.0.1/blocked.png', width: 10, height: 10 }] } : null } })
  }
  send(404, {})
})
await new Promise((resolve) => fake.listen(FAKE, '127.0.0.1', resolve))

const env = { ...process.env, PORT: String(API), ALLNEEDS_DATA_DIR: dir, ALLNEEDS_FRONTEND_ORIGIN: origin, ALLNEEDS_PUBLIC_URL: origin, ALLNEEDS_SESSION_SECRET: randomBytes(32).toString('hex'), MAGNIFIC_API_KEY: 'fake-test-key', MAGNIFIC_API_BASE: `http://127.0.0.1:${FAKE}` }
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV', 'VERCEL', 'EMAIL_HOST', 'ALLNEEDS_ADMIN_PASSWORD', 'ALLNEEDS_SALES_PASSWORD']) delete env[key]
const backend = spawn(process.execPath, ['backend/server.mjs'], { env, stdio: 'ignore' })
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise((done) => setTimeout(done, 100)) }

let passed = 0, failed = 0
const check = (label, ok) => { if (ok) passed++; else { failed++; console.log(`FAIL ${label}`) } }
const cookies = {}
async function call(who, method, path, body, raw) {
  const headers = { origin, cookie: cookies[who] || '' }
  if (body !== undefined && !raw) headers['content-type'] = 'application/json'
  const response = await fetch(base + path, { method, headers, redirect: 'manual', body: raw ? body : body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  let data = text
  try { data = JSON.parse(text) } catch {}
  return { status: response.status, data, text }
}
for (const id of ['admin', 'dev', 'dev2', 'design', 'am', 'sales', 'ownerA', 'collabA', 'ownerB']) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: `${id}@x.test`, password }) })
  cookies[id] = response.headers.get('set-cookie').split(';')[0]
  check(`login ${id}`, response.ok)
}
const brief = { company: 'Clinique Test', sector: 'sante', description: 'Une description', sections: ['home', 'contact'], languages: ['fr'], style: 'modern' }
const unread = async (who, type) => (await call(who, 'GET', '/api/notifications')).data.filter((item) => item.type === type).length

try {
  /* Accès */
  check('sales blocked from websites', (await call('sales', 'GET', '/api/websites')).status === 403)
  check('sales blocked from studio', (await call('sales', 'GET', '/api/studio/workflows')).status === 403)
  check('non-dev staff blocked from websites', (await call('design', 'GET', '/api/websites')).status === 403)
  check('developer blocked from studio', (await call('dev', 'GET', '/api/studio/workflows')).status === 403)

  /* Fichiers */
  check('fake image refused', (await call('ownerA', 'POST', '/api/websites/files?orgId=a&kind=logo&name=x.png', Buffer.from('<svg onload=alert(1)></svg>'), true)).status === 400)
  check('upload to other org refused', (await call('ownerA', 'POST', '/api/websites/files?orgId=b&kind=logo&name=x.png', PNG, true)).status === 403)
  check('oversized file refused', (await call('ownerA', 'POST', '/api/websites/files?orgId=a&kind=logo&name=x.png', Buffer.concat([PNG, Buffer.alloc(4.2 * 1024 * 1024)]), true)).status === 413)
  const logo = await call('ownerA', 'POST', '/api/websites/files?orgId=a&kind=logo&name=logo.png', PNG, true)
  check('valid upload', logo.status === 201)
  check('pending file hidden from other client', (await call('ownerB', 'GET', logo.data.url)).status === 404)

  /* Soumission */
  check('other org refused', (await call('ownerA', 'POST', '/api/websites', { orgId: 'b', submissionKey: 'x1', brief })).status === 403)
  check('missing company refused', (await call('ownerA', 'POST', '/api/websites', { orgId: 'a', submissionKey: 'x2', brief: { ...brief, company: '' } })).status === 400)
  check('javascript link refused', (await call('ownerA', 'POST', '/api/websites', { orgId: 'a', submissionKey: 'x3', brief: { ...brief, inspirationUrls: ['javascript:alert(1)'] } })).status === 400)
  const created = await call('ownerA', 'POST', '/api/websites', { orgId: 'a', submissionKey: 'k1', brief, fileIds: [logo.data.id] })
  check('request created', created.status === 201 && created.data.status === 'new')
  const id = created.data.id
  check('double submit is deduplicated', (await call('ownerA', 'POST', '/api/websites', { orgId: 'a', submissionKey: 'k1', brief })).data.id === id && (await call('admin', 'GET', '/api/websites')).data.length === 1)
  check('client notified', await unread('ownerA', 'website.submitted') === 1)
  check('admin notified', await unread('admin', 'website.new') === 1)

  /* Isolation */
  check('other org cannot read', (await call('ownerB', 'GET', `/api/websites/${id}`)).status === 404)
  check('other org list empty', (await call('ownerB', 'GET', '/api/websites')).data.length === 0)
  check('other org cannot read asset', (await call('ownerB', 'GET', logo.data.url)).status === 404)
  check('same-org collaborator cannot read other member request', (await call('collabA', 'GET', `/api/websites/${id}`)).status === 404)
  check('assigned commercial can read', (await call('am', 'GET', `/api/websites/${id}`)).status === 200)
  check('unassigned developer cannot read', (await call('dev', 'GET', `/api/websites/${id}`)).status === 404)

  /* Attribution et droits */
  check('client cannot assign', (await call('ownerA', 'POST', `/api/websites/${id}/assign`, { developerId: 'dev' })).status === 403)
  check('client cannot change status', (await call('ownerA', 'POST', `/api/websites/${id}/status`, { status: 'delivered' })).status === 403)
  check('non-developer cannot be assigned', (await call('admin', 'POST', `/api/websites/${id}/assign`, { developerId: 'design' })).status === 400)
  const assigned = await call('admin', 'POST', `/api/websites/${id}/assign`, { developerId: 'dev' })
  check('admin assigns', assigned.data.status === 'assigned')
  check('developer notified', await unread('dev', 'website.assigned') === 1)
  check('other developer still blocked', (await call('dev2', 'GET', `/api/websites/${id}`)).status === 404)
  check('developer cannot publish', (await call('dev', 'POST', `/api/websites/${id}/publish`, {})).status === 403)
  check('developer cannot reassign', (await call('dev', 'POST', `/api/websites/${id}/assign`, { developerId: 'dev2' })).status === 403)
  check('developer cannot jump to delivered', (await call('dev', 'POST', `/api/websites/${id}/status`, { status: 'delivered' })).status === 409)
  check('developer starts', (await call('dev', 'POST', `/api/websites/${id}/status`, { status: 'in_progress' })).data.status === 'in_progress')
  check('client told creation started', await unread('ownerA', 'website.started') === 1)

  /* Notes internes */
  await call('dev', 'POST', `/api/websites/${id}/notes`, { text: 'SECRET-INTERNAL-NOTE' })
  const clientView = await call('ownerA', 'GET', `/api/websites/${id}`)
  check('internal note hidden from client', !clientView.text.includes('SECRET-INTERNAL-NOTE') && clientView.data.notes === undefined)
  check('developer identity hidden from client', clientView.data.developerId === undefined && clientView.data.developerName === null)

  /* Livraison */
  for (const bad of ['javascript:alert(1)', 'http://example.com', 'https://localhost/x', 'https://169.254.169.254/', 'https://u:p@example.com']) check(`unsafe url refused: ${bad}`, (await call('dev', 'POST', `/api/websites/${id}/submit`, { previewUrl: bad })).status === 400)
  const submitted = await call('dev', 'POST', `/api/websites/${id}/submit`, { previewUrl: 'https://preview.invalid/site' })
  check('submitted for review', submitted.data.status === 'ready_for_review')
  check('admin told to review', await unread('admin', 'website.review') === 1)
  const before = await call('ownerA', 'GET', `/api/websites/${id}`)
  check('unapproved preview hidden from client', !before.text.includes('preview.invalid'))
  check('client not told ready before approval', await unread('ownerA', 'website.ready') === 0)
  const published = await call('admin', 'POST', `/api/websites/${id}/publish`, {})
  check('admin publishes', published.data.status === 'delivered')
  const after = await call('ownerA', 'GET', `/api/websites/${id}`)
  check('client sees delivered link', after.data.websiteUrl === 'https://preview.invalid/site')
  check('unreachable site is not embedded', after.data.embeddable === false)
  check('client told ready', await unread('ownerA', 'website.ready') === 1)

  /* Modification */
  check('other client cannot request revision', (await call('ownerB', 'POST', `/api/websites/${id}/revisions`, { message: 'x' })).status === 404)
  check('revision requested', (await call('ownerA', 'POST', `/api/websites/${id}/revisions`, { message: 'Changer le logo' })).data.status === 'revision_requested')
  check('admin told of revision', await unread('admin', 'website.revision') === 1)
  check('developer restarts revision', (await call('dev', 'POST', `/api/websites/${id}/status`, { status: 'in_progress' })).data.status === 'in_progress')
  check('client told revision update', await unread('ownerA', 'website.revision_update') === 1)

  /* Imports */
  await call('admin', 'POST', '/api/websites/imports', { records: [{ sourceId: 's1', name: 'Ancien site', url: 'https://old.invalid/' }] })
  check('import hidden until reviewed', (await call('ownerA', 'GET', '/api/websites/imports')).data.length === 0)
  const imported = (await call('admin', 'GET', '/api/websites/imports')).data[0]
  await call('admin', 'PATCH', `/api/websites/imports/${imported.id}`, { orgId: 'a' })
  check('import visible to assigned org', (await call('ownerA', 'GET', '/api/websites/imports')).data.length === 1)
  check('import hidden from other org', (await call('ownerB', 'GET', '/api/websites/imports')).data.length === 0)
  check('import not duplicated', (await call('admin', 'POST', '/api/websites/imports', { records: [{ sourceId: 's1', name: 'Ancien site', url: 'https://old.invalid/' }] })).data.skipped === 1)

  /* Studio, contre le faux serveur */
  const flows = await call('ownerA', 'GET', '/api/studio/workflows')
  check('workflows listed', flows.data.workflows.length === 4 && flows.data.workflows.every((flow) => flow.state === 'available'))
  check('credit cost hidden from client', !('cost' in flows.data.workflows[0]))
  check('api key never returned', !flows.text.includes('fake-test-key'))
  const photo = await call('ownerA', 'POST', '/api/studio/uploads?name=p.png', PNG, true)
  check('studio upload', photo.status === 201)
  check('other user photo refused', (await call('ownerB', 'POST', '/api/studio/generations', { submissionKey: 'g0', workflowKey: 'photo-image', inputs: { photo: photo.data.id, prompt: 'x' } })).status === 400)
  check('unknown input refused', (await call('ownerA', 'POST', '/api/studio/generations', { submissionKey: 'g1', workflowKey: 'photo-image', inputs: { photo: photo.data.id, prompt: 'x', hack: 1 } })).status === 400)
  check('missing input refused', (await call('ownerA', 'POST', '/api/studio/generations', { submissionKey: 'g2', workflowKey: 'photo-image', inputs: { photo: photo.data.id } })).status === 400)
  const generation = await call('ownerA', 'POST', '/api/studio/generations', { submissionKey: 'g3', workflowKey: 'photo-image', inputs: { photo: photo.data.id, prompt: 'Un visuel' } })
  check('generation running', generation.status === 201 && generation.data.status === 'running')
  check('duplicate generation not re-run', (await call('ownerA', 'POST', '/api/studio/generations', { submissionKey: 'g3', workflowKey: 'photo-image', inputs: { photo: photo.data.id, prompt: 'Un visuel' } })).status === 200 && runCalls === 1)
  check('cooldown enforced', (await call('ownerA', 'POST', '/api/studio/generations', { submissionKey: 'g4', workflowKey: 'photo-image', inputs: { photo: photo.data.id, prompt: 'Un visuel' } })).status === 429 && runCalls === 1)
  check('other org cannot read generation', (await call('ownerB', 'GET', `/api/studio/generations/${generation.data.id}`)).status === 404)
  check('commercial of org can read', (await call('am', 'GET', `/api/studio/generations/${generation.data.id}`)).status === 200)
  await call('ownerA', 'GET', `/api/studio/generations/${generation.data.id}`)
  await new Promise((done) => setTimeout(done, 3200))
  await call('ownerA', 'GET', `/api/studio/generations/${generation.data.id}`)
  await new Promise((done) => setTimeout(done, 3200))
  const finished = await call('ownerA', 'GET', `/api/studio/generations/${generation.data.id}`)
  check('generation completes', finished.data.status === 'completed' && finished.data.assets.length === 1)
  check('private-address output not copied', finished.data.assets[0]?.temporary === true)
  check('run id hidden from client', finished.data.runId === undefined)
  const forbiddenImport = await call('ownerA', 'POST', '/api/studio/imports', { runId: 'run1' })
  check('client cannot import', forbiddenImport.status === 403)
  runs.set('runX', 1)
  const importedRun = await call('admin', 'POST', '/api/studio/imports', { runId: 'runX' })
  check('run imported as pending', importedRun.status === 201 && importedRun.data.reviewStatus === 'pending')
  check('pending import hidden from client', !(await call('ownerA', 'GET', '/api/studio/generations')).data.some((item) => item.id === importedRun.data.id))
  check('import owner must belong to org', (await call('admin', 'PATCH', `/api/studio/imports/${importedRun.data.id}`, { orgId: 'a', ownerId: 'ownerB' })).status === 400)
  await call('admin', 'PATCH', `/api/studio/imports/${importedRun.data.id}`, { orgId: 'a', ownerId: 'ownerA' })
  check('assigned import visible', (await call('ownerA', 'GET', '/api/studio/generations')).data.some((item) => item.id === importedRun.data.id))
} finally {
  console.log(`${passed} passed, ${failed} failed`)
  backend.kill()
  fake.close()
  rmSync(dir, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)

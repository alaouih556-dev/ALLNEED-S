import { createHash, randomBytes } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { cleanFileName, newStoragePath, readRawBody, sniffImage } from './storage.mjs'
import { isPrivateIp, safeDeliveryUrl } from './websites.mjs'

/* Studio IA : exécution des workflows Magnific côté serveur. La clé API ne quitte jamais ce module. */
export const STUDIO_FLOWS = [
  { key: 'photo-image', flowId: 'xUPRjfWKMO', name: 'Photo + prompt → image', description: 'Transformez une photo à partir d’une instruction écrite.' },
  { key: 'product-ads', flowId: 'U4RnwnyikX', name: 'Produit → 3 visuels publicitaires', description: 'Créez trois visuels publicitaires à partir d’une photo produit.' },
  { key: 'photo-3d-ad', flowId: 'y3z0PW9xJI', name: 'Photo → modèle 3D + visuel publicitaire', description: 'Passez d’une photo à un rendu 3D et à un visuel publicitaire.' },
  { key: 'photo-3d-360', flowId: 'xSEKjfWKMO', name: 'Photo → 3D + 360°', description: 'Générez une présentation 3D et 360° à partir d’une photo.' },
]
const API_TIMEOUT_MS = 20_000
const DEFINITION_TTL_MS = 10 * 60_000
const SYNC_INTERVAL_MS = 3_000
const SUBMIT_COOLDOWN_MS = 5_000
const STALE_SUBMIT_MS = 2 * 60_000
const STALE_RUN_MS = 6 * 3_600_000
const OUTPUT_LIFETIME_MS = 12 * 3_600_000
const MAX_ACTIVE_PER_USER = 3
const MAX_PENDING_UPLOADS = 20
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024
const COPY_BUDGET_MS = 25_000
const OUTPUT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'])
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }
const ACTIVE = new Set(['submitting', 'running'])

const httpError = (status, message, code) => Object.assign(new Error(message), { status, code })
const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}-${randomBytes(10).toString('hex')}`

function normalizeInput(input) {
  const id = input?.api_key || input?.key || input?.id
  if (!id) return null
  const rawOptions = input.config?.options ?? input.options
  const options = Array.isArray(rawOptions) ? rawOptions.map((option) => (typeof option === 'object' && option ? { value: String(option.value ?? option.id ?? option.label), label: String(option.label ?? option.value ?? option.id) } : { value: String(option), label: String(option) })) : []
  return { id: String(id), label: String(input.label || id), type: String(input.type || 'text'), required: input.required === true, default: input.default ?? null, mediaType: input.config?.mediaType || null, multiline: input.presentation?.mode === 'textarea', options }
}

/** Refus de l'API : le run n'a pas démarré. */
function refusalMessage(status) {
  if (status === 401 || status === 403) return 'accès à l’API Magnific refusé : vérifiez la clé et le plan'
  if (status === 402) return 'crédits Magnific insuffisants'
  if (status === 404) return 'workflow introuvable sur ce compte Magnific'
  if (status === 400 || status === 422) return 'Magnific a refusé ces paramètres'
  if (status === 429) return 'limite de requêtes Magnific atteinte, réessayez dans un instant'
  return 'service Magnific indisponible'
}

export function createMagnific({ db, saveDb, json, readBody, audit, access, storage, persistNow }) {
  const apiKey = () => (process.env.MAGNIFIC_API_KEY || '').trim()
  const apiBase = () => (process.env.MAGNIFIC_API_BASE || 'https://api.magnific.com').replace(/\/$/, '')
  const definitions = new Map()

  async function api(path, init = {}) {
    const response = await fetch(`${apiBase()}${path}`, { ...init, headers: { 'x-magnific-api-key': apiKey(), accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) }, signal: AbortSignal.timeout(API_TIMEOUT_MS) })
    const data = await response.json().catch(() => null)
    return { status: response.status, ok: response.ok, data }
  }

  async function definition(flow) {
    const cached = definitions.get(flow.flowId)
    if (cached && Date.now() - cached.at < DEFINITION_TTL_MS) return cached.value
    let value
    try {
      const response = await api(`/v1/ai/flows/${flow.flowId}`)
      if (response.ok && response.data?.data) {
        const inputs = (response.data.data.inputs || []).map(normalizeInput).filter(Boolean)
        const unsupported = inputs.some((input) => input.required && input.type === 'creation' && input.mediaType && input.mediaType !== 'image')
        value = { state: unsupported ? 'unsupported' : 'available', name: response.data.data.name || flow.name, inputs, cost: response.data.data.tool_metadata?.total_cost ?? null }
      } else {
        console.warn(`Magnific: définition ${flow.flowId} refusée (${response.status})`)
        value = { state: 'unavailable', reason: refusalMessage(response.status), inputs: [] }
      }
    } catch {
      return { state: 'unavailable', reason: 'service Magnific injoignable', inputs: [] }
    }
    definitions.set(flow.flowId, { at: value.state === 'available' ? Date.now() : Date.now() - DEFINITION_TTL_MS + 30_000, value })
    return value
  }

  /* ---------- Visibilité ---------- */
  function canSee(user, generation) {
    if (access.isAdmin(user)) return true
    if (generation.reviewStatus === 'pending') return false
    if (generation.ownerId === user.id) return true
    return access.isCommercial(user) && Boolean(generation.orgId) && access.canManageOrg(user, generation.orgId)
  }
  const findGeneration = (id, user) => {
    const generation = db.magnificGenerations.find((item) => item.id === id)
    if (!generation || !canSee(user, generation)) throw httpError(404, 'génération introuvable')
    return generation
  }
  const nameOf = (id) => { const item = db.users.find((row) => row.id === id); return item ? item.name || item.email : null }
  const orgName = (id) => db.orgs.find((org) => org.id === id)?.name || null
  const assetUsable = (asset) => Boolean(asset.storagePath) || (asset.sourceUrl && Date.parse(asset.expiresAt) > Date.now())

  function generationOut(generation, user) {
    return {
      id: generation.id, workflowKey: generation.workflowKey, workflowName: generation.workflowName, status: generation.status, error: generation.error || null,
      prompt: generation.prompt || '', orgId: generation.orgId || null, organizationName: orgName(generation.orgId), ownerName: nameOf(generation.ownerId), source: generation.source, reviewStatus: generation.reviewStatus,
      createdAt: generation.createdAt, completedAt: generation.completedAt || null,
      assets: (generation.assets || []).map((asset) => ({ id: asset.id, type: asset.type, width: asset.width ?? null, height: asset.height ?? null, duration: asset.duration ?? null, available: assetUsable(asset), temporary: !asset.storagePath, expiresAt: asset.storagePath ? null : asset.expiresAt, url: `/api/studio/generations/${generation.id}/assets/${asset.id}`, downloadUrl: `/api/studio/generations/${generation.id}/assets/${asset.id}?download=1` })),
      ...(access.isAdmin(user) ? { runId: generation.runId || null, cost: generation.cost ?? null } : {}),
    }
  }

  /* ---------- Sorties ---------- */
  async function assertPublicUrl(link) {
    const safe = safeDeliveryUrl(link)
    const addresses = await lookup(new URL(safe).hostname.replace(/^\[|\]$/g, ''), { all: true })
    if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) throw httpError(400, 'adresse de sortie non autorisée')
    return safe
  }
  async function fetchOutput(link) {
    let target = await assertPublicUrl(link)
    for (let hop = 0; hop < 4; hop++) {
      const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(COPY_BUDGET_MS) })
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        target = await assertPublicUrl(new URL(response.headers.get('location'), target).href)
        continue
      }
      if (!response.ok) throw new Error(`sortie ${response.status}`)
      if (Number(response.headers.get('content-length') || 0) > MAX_OUTPUT_BYTES) throw new Error('sortie trop volumineuse')
      const content = Buffer.from(await response.arrayBuffer())
      if (content.length > MAX_OUTPUT_BYTES) throw new Error('sortie trop volumineuse')
      return { content, declared: String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() }
    }
    throw new Error('trop de redirections')
  }
  /** Les liens Magnific expirent après 12 h : on copie chaque sortie dans le stockage privé. */
  async function copyAssets(generation) {
    const startedAt = Date.now()
    for (const asset of generation.assets || []) {
      if (asset.storagePath || !assetUsable(asset) || Date.now() - startedAt > COPY_BUDGET_MS) continue
      try {
        const { content, declared } = await fetchOutput(asset.sourceUrl)
        const sniffed = asset.type === 'image' ? sniffImage(content) : null
        const mime = sniffed?.mime || (asset.type !== 'image' && declared.startsWith(`${asset.type}/`) ? declared : null)
        if (!mime || !OUTPUT_MIMES.has(mime)) throw new Error('format de sortie non pris en charge')
        const storagePath = newStoragePath(`studio/${generation.orgId || 'internal'}`, EXTENSIONS[mime])
        await storage.put(storagePath, content, mime)
        Object.assign(asset, { storagePath, mime, size: content.length, name: `${generation.id}-${asset.id}.${EXTENSIONS[mime]}`, sourceUrl: null })
      } catch (error) {
        console.warn(`Magnific: copie de sortie différée (${generation.id}): ${error.message}`)
      }
    }
  }
  function outputsFrom(result) {
    const expiresAt = new Date(Date.now() + OUTPUT_LIFETIME_MS).toISOString()
    const groups = [['image', result?.images], ['video', result?.videos], ['audio', result?.audios]]
    return groups.flatMap(([type, items]) => (Array.isArray(items) ? items : []).filter((item) => typeof item?.url === 'string').map((item) => ({ id: newId('out'), type, sourceUrl: item.url, width: item.width ?? null, height: item.height ?? null, duration: item.duration ?? null, expiresAt })))
  }

  function applyRun(generation, run) {
    const status = String(run?.status || '').toLowerCase()
    if (status === 'pending' || status === 'running') { generation.status = 'running'; return }
    if (status === 'completed' || status === 'completed_with_errors') {
      generation.assets = outputsFrom(run.result)
      generation.status = generation.assets.length ? status : 'failed'
      generation.error = !generation.assets.length ? 'Magnific n’a renvoyé aucun fichier exploitable' : status === 'completed_with_errors' ? 'certaines étapes du workflow ont échoué' : null
      generation.completedAt = run.completed_at || nowIso()
      return
    }
    if (status === 'failed' || status === 'cancelled') {
      generation.status = status
      generation.error = status === 'cancelled' ? 'exécution annulée' : 'la génération a échoué côté Magnific'
      generation.completedAt = run.completed_at || nowIso()
    }
  }

  /** Met à jour une génération en cours. Une erreur réseau ne change jamais le statut. */
  async function sync(generation) {
    const now = Date.now()
    if (generation.status === 'submitting' && now - Date.parse(generation.updatedAt) > STALE_SUBMIT_MS) {
      generation.status = 'interrupted'
      generation.error = 'envoi interrompu : vérifiez vos crédits Magnific avant de relancer'
      generation.updatedAt = nowIso()
      saveDb(db)
      return
    }
    const needsCopy = (generation.assets || []).some((asset) => !asset.storagePath && assetUsable(asset))
    if ((generation.status !== 'running' && !needsCopy) || now - Date.parse(generation.lastSyncAt || 0) < SYNC_INTERVAL_MS) return
    generation.lastSyncAt = nowIso()
    if (generation.status === 'running' && generation.runId && apiKey()) {
      try {
        const response = await api(`/v1/ai/flows/runs/${encodeURIComponent(generation.runId)}`)
        if (response.ok && response.data?.data) applyRun(generation, response.data.data)
        else if (response.status === 404) { generation.status = 'interrupted'; generation.error = 'exécution introuvable chez Magnific' }
      } catch (error) {
        console.warn(`Magnific: suivi différé (${generation.id}): ${error.name}`)
      }
      if (generation.status === 'running' && now - Date.parse(generation.createdAt) > STALE_RUN_MS) { generation.status = 'interrupted'; generation.error = 'aucun résultat reçu dans le délai attendu' }
    }
    await copyAssets(generation)
    generation.updatedAt = nowIso()
    saveDb(db)
  }

  /* ---------- Soumission ---------- */
  async function prepareInputs(fields, values, user) {
    const clean = {}
    const summary = {}
    const fileIds = []
    if (values !== undefined && (typeof values !== 'object' || values === null || Array.isArray(values))) throw httpError(400, 'paramètres invalides')
    const given = values || {}
    const known = new Set(fields.map((field) => field.id))
    if (Object.keys(given).some((key) => !known.has(key))) throw httpError(400, 'paramètre inconnu')
    for (const field of fields) {
      const raw = given[field.id]
      const empty = raw === undefined || raw === null || raw === ''
      if (empty) {
        if (field.required && (field.default === null || field.default === undefined || field.default === '')) throw httpError(400, `${field.label} requis`)
        continue
      }
      if (field.type === 'creation') {
        if (field.mediaType && field.mediaType !== 'image') throw httpError(422, `${field.label} : format non pris en charge`)
        const file = db.managedFiles.find((item) => item.id === raw && item.scope === 'studio' && item.ownerId === user.id)
        if (!file) throw httpError(400, `${field.label} : image invalide`)
        clean[field.id] = storage.remote ? await storage.signedUrl(file.storagePath, { expiresIn: 3600 }) : storage.readLocal(file.storagePath).toString('base64')
        fileIds.push(file.id)
        summary[field.id] = { fileId: file.id }
      } else if (field.type === 'number') {
        const number = Number(raw)
        if (!Number.isFinite(number)) throw httpError(400, `${field.label} : nombre invalide`)
        clean[field.id] = number
        summary[field.id] = number
      } else if (field.type === 'select') {
        const value = String(raw)
        if (value.length > 300 || (field.options.length && !field.options.some((option) => option.value === value))) throw httpError(400, `${field.label} : choix invalide`)
        clean[field.id] = value
        summary[field.id] = value
      } else {
        if (typeof raw !== 'string' || raw.length > 4000) throw httpError(400, `${field.label} invalide`)
        clean[field.id] = raw.trim()
        summary[field.id] = raw.trim()
      }
    }
    return { clean, summary, fileIds }
  }

  async function submit(body, user) {
    const key = typeof body.submissionKey === 'string' ? body.submissionKey.trim() : ''
    if (!key || key.length > 80) throw httpError(400, 'clé de soumission requise')
    const id = `gen-${createHash('sha256').update(`${user.id}:${key}`).digest('hex').slice(0, 20)}`
    const existing = db.magnificGenerations.find((item) => item.id === id)
    if (existing) return { status: 200, generation: existing }
    if (!apiKey()) throw httpError(503, 'Studio IA non configuré', 'NOT_CONFIGURED')
    const flow = STUDIO_FLOWS.find((item) => item.key === body.workflowKey)
    if (!flow) throw httpError(400, 'workflow inconnu')
    const mine = db.magnificGenerations.filter((item) => item.ownerId === user.id)
    if (mine.filter((item) => ACTIVE.has(item.status)).length >= MAX_ACTIVE_PER_USER) throw httpError(429, `${MAX_ACTIVE_PER_USER} générations sont déjà en cours, attendez qu’une se termine`)
    if (mine.some((item) => Date.now() - Date.parse(item.createdAt) < SUBMIT_COOLDOWN_MS)) throw httpError(429, 'patientez quelques secondes avant de relancer')
    let orgId = null
    if (access.isClient(user)) orgId = access.managedOrgIds(user)[0] || null
    else if (body.orgId) {
      if (!access.canManageOrg(user, body.orgId)) throw httpError(403, 'entreprise hors de votre périmètre')
      orgId = body.orgId
    }
    const spec = await definition(flow)
    if (spec.state !== 'available') throw httpError(503, spec.reason || 'workflow indisponible', 'UNAVAILABLE')
    const { clean, summary, fileIds } = await prepareInputs(spec.inputs, body.inputs, user)
    const promptField = spec.inputs.find((field) => field.type === 'text')
    const now = nowIso()
    const generation = { id, orgId, ownerId: user.id, workflowKey: flow.key, workflowName: flow.name, flowId: flow.flowId, status: 'submitting', source: 'app', reviewStatus: 'approved', runId: null, cost: spec.cost, prompt: promptField ? String(summary[promptField.id] || '') : '', inputs: summary, inputFileIds: fileIds, assets: [], error: null, createdAt: now, updatedAt: now, completedAt: null, lastSyncAt: null }
    db.magnificGenerations.push(generation)
    saveDb(db)
    // Enregistré avant l'appel : si la fonction s'arrête ici, la génération n'est pas perdue ni relancée.
    await persistNow()
    try {
      const response = await api(`/v1/ai/flows/${flow.flowId}/run`, { method: 'POST', body: JSON.stringify({ inputs: clean }) })
      const runId = response.data?.workflow_run_identifier || response.data?.data?.workflow_run_identifier
      if (response.ok && runId) {
        generation.runId = String(runId)
        generation.status = 'running'
      } else if (response.status >= 500 || response.ok) {
        generation.status = 'interrupted'
        generation.error = 'réponse Magnific incomplète : vérifiez vos crédits avant de relancer'
      } else {
        generation.status = 'failed'
        generation.error = refusalMessage(response.status)
        if ([401, 403, 404].includes(response.status)) definitions.delete(flow.flowId)
      }
    } catch {
      // Le run a pu démarrer : aucune relance automatique, pour ne pas consommer deux fois les crédits.
      generation.status = 'interrupted'
      generation.error = 'connexion à Magnific interrompue : vérifiez vos crédits avant de relancer'
    }
    generation.updatedAt = nowIso()
    saveDb(db)
    audit('studio.generation.created', { by: user.id, generation: id, org: orgId, workflow: flow.key, status: generation.status })
    return { status: 201, generation }
  }

  async function workflows(user) {
    const configured = Boolean(apiKey())
    const list = await Promise.all(STUDIO_FLOWS.map(async (flow) => {
      const base = { key: flow.key, name: flow.name, description: flow.description }
      if (!configured) return { ...base, state: 'not_configured', inputs: [] }
      const spec = await definition(flow)
      return { ...base, state: spec.state, reason: spec.reason || null, inputs: spec.inputs.map(({ default: value, ...field }) => ({ ...field, defaultValue: value })), ...(access.isAdmin(user) ? { cost: spec.cost ?? null } : {}) }
    }))
    const membersOf = (id) => db.users.filter((item) => item.active !== false && access.isClient(item) && (item.orgIds || []).includes(id)).map((item) => ({ id: item.id, name: item.name || item.email }))
    const organizations = access.isClient(user) ? [] : access.managedOrgIds(user).map((id) => ({ id, name: orgName(id), ...(access.isAdmin(user) ? { users: membersOf(id) } : {}) })).filter((org) => org.name)
    return { configured, workflows: list, organizations, canImport: access.isAdmin(user) }
  }

  async function handle(req, res, url, user, cors) {
    if (!/^\/api\/studio(\/|$)/.test(url.pathname)) return false
    const path = url.pathname.slice('/api/studio'.length)
    const M = req.method
    const send = (code, body) => { json(res, code, body, cors); return true }
    if (!access.canUseStudio(user)) return send(403, { error: 'accès non autorisé' })
    let m

    if (path === '/workflows' && M === 'GET') return send(200, await workflows(user))

    if (path === '/uploads' && M === 'POST') {
      const pending = db.managedFiles.filter((item) => item.scope === 'studio' && item.ownerId === user.id && !db.magnificGenerations.some((row) => (row.inputFileIds || []).includes(item.id)))
      if (pending.length >= MAX_PENDING_UPLOADS) throw httpError(429, 'trop d’images en attente, retirez-en quelques-unes')
      const content = await readRawBody(req)
      const type = sniffImage(content)
      if (!type) throw httpError(400, 'image invalide : JPG, PNG ou WebP uniquement')
      const storagePath = newStoragePath(`studio-inputs/${user.id}`, type.ext)
      await storage.put(storagePath, content, type.mime)
      const file = { id: newId('fil'), scope: 'studio', orgId: null, ownerId: user.id, name: cleanFileName(url.searchParams.get('name')), mime: type.mime, size: content.length, storagePath, createdAt: nowIso() }
      db.managedFiles.push(file)
      saveDb(db)
      return send(201, { id: file.id, name: file.name, mime: file.mime, size: file.size, url: `/api/studio/uploads/${file.id}` })
    }
    if ((m = path.match(/^\/uploads\/([^/]+)$/))) {
      const file = db.managedFiles.find((item) => item.id === m[1] && item.scope === 'studio')
      if (!file || (file.ownerId !== user.id && !access.isAdmin(user))) throw httpError(404, 'fichier introuvable')
      if (M === 'GET') { await storage.serve(res, cors, file); return true }
      if (M === 'DELETE') {
        if (file.ownerId !== user.id || db.magnificGenerations.some((row) => (row.inputFileIds || []).includes(file.id))) throw httpError(409, 'image déjà utilisée')
        await storage.remove(file.storagePath)
        db.managedFiles = db.managedFiles.filter((item) => item.id !== file.id)
        saveDb(db)
        return send(200, { ok: true })
      }
    }

    if (path === '/generations' && M === 'GET') {
      const list = db.magnificGenerations.filter((item) => canSee(user, item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
      return send(200, list.map((item) => generationOut(item, user)))
    }
    if (path === '/generations' && M === 'POST') {
      const result = await submit(await readBody(req), user)
      return send(result.status, generationOut(result.generation, user))
    }
    if ((m = path.match(/^\/generations\/([^/]+)$/)) && M === 'GET') {
      const generation = findGeneration(m[1], user)
      await sync(generation)
      return send(200, generationOut(generation, user))
    }
    if ((m = path.match(/^\/generations\/([^/]+)\/assets\/([^/]+)$/)) && M === 'GET') {
      const generation = findGeneration(m[1], user)
      const asset = (generation.assets || []).find((item) => item.id === m[2])
      if (!asset) throw httpError(404, 'fichier introuvable')
      if (asset.storagePath) { await storage.serve(res, cors, asset, { download: url.searchParams.get('download') === '1' }); return true }
      if (!assetUsable(asset)) throw httpError(410, 'ce fichier a expiré')
      res.writeHead(302, { ...cors, location: safeDeliveryUrl(asset.sourceUrl), 'cache-control': 'private, no-store' })
      res.end()
      return true
    }

    /* ---------- Import : invisible des clients tant qu'il n'est pas revu et affecté ---------- */
    if (path === '/imports' && M === 'POST') {
      if (!access.isAdmin(user)) throw httpError(403, 'réservé à l’administration')
      if (!apiKey()) throw httpError(503, 'Studio IA non configuré', 'NOT_CONFIGURED')
      const { runId } = await readBody(req)
      if (typeof runId !== 'string' || !/^[A-Za-z0-9_-]{4,120}$/.test(runId)) throw httpError(400, 'identifiant d’exécution invalide')
      if (db.magnificGenerations.some((item) => item.runId === runId)) throw httpError(409, 'exécution déjà importée')
      let response
      try { response = await api(`/v1/ai/flows/runs/${encodeURIComponent(runId)}`) } catch { throw httpError(503, 'service Magnific injoignable') }
      if (!response.ok || !response.data?.data) throw httpError(response.status === 404 ? 404 : 503, response.status === 404 ? 'exécution introuvable' : refusalMessage(response.status))
      const run = response.data.data
      const flow = STUDIO_FLOWS.find((item) => item.flowId === run.app_id)
      const now = nowIso()
      const generation = { id: newId('gen'), orgId: null, ownerId: null, workflowKey: flow?.key || null, workflowName: flow?.name || 'Import Magnific', flowId: run.app_id || null, status: 'running', source: 'import', reviewStatus: 'pending', runId, prompt: '', inputs: {}, inputFileIds: [], assets: [], error: null, createdAt: run.started_at || now, updatedAt: now, completedAt: null, lastSyncAt: now, importedBy: user.id }
      applyRun(generation, run)
      await copyAssets(generation)
      db.magnificGenerations.push(generation)
      saveDb(db)
      audit('studio.import', { by: user.id, generation: generation.id })
      return send(201, generationOut(generation, user))
    }
    if ((m = path.match(/^\/imports\/([^/]+)$/)) && M === 'PATCH') {
      if (!access.isAdmin(user)) throw httpError(403, 'réservé à l’administration')
      const generation = db.magnificGenerations.find((item) => item.id === m[1] && item.source === 'import')
      if (!generation) throw httpError(404, 'import introuvable')
      const body = await readBody(req)
      const org = db.orgs.find((item) => item.id === body.orgId)
      const owner = db.users.find((item) => item.id === body.ownerId && (item.orgIds || []).includes(body.orgId))
      if (!org || !owner) throw httpError(400, 'entreprise et utilisateur de cette entreprise requis')
      Object.assign(generation, { orgId: org.id, ownerId: owner.id, reviewStatus: 'approved', reviewedBy: user.id, reviewedAt: nowIso(), updatedAt: nowIso() })
      saveDb(db)
      audit('studio.import.assigned', { by: user.id, generation: generation.id, org: org.id, owner: owner.id })
      return send(200, generationOut(generation, user))
    }
    return send(404, { error: 'route inconnue' })
  }

  return { handle }
}

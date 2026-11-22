import { createHash, randomBytes } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { resolveSector } from './sectors.mjs'
import { cleanFileName, newStoragePath, readRawBody, sniffImage } from './storage.mjs'

export const WEBSITE_STATUSES = ['new', 'pending_review', 'assigned', 'in_progress', 'ready_for_review', 'delivered', 'revision_requested', 'cancelled']
const ADMIN_TRANSITIONS = {
  new: ['pending_review', 'assigned', 'cancelled'],
  pending_review: ['new', 'assigned', 'cancelled'],
  assigned: ['pending_review', 'in_progress', 'cancelled'],
  in_progress: ['assigned', 'cancelled'],
  ready_for_review: ['in_progress', 'cancelled'],
  delivered: ['revision_requested'],
  revision_requested: ['assigned', 'in_progress', 'cancelled'],
  cancelled: ['pending_review'],
}
const DEVELOPER_TRANSITIONS = { assigned: ['in_progress'], revision_requested: ['in_progress'] }
const STATUS_LABELS = { new: 'Nouvelle', pending_review: 'En cours d’examen', assigned: 'Assignée', in_progress: 'En cours', ready_for_review: 'Prête pour validation', delivered: 'Livrée', revision_requested: 'Modification demandée', cancelled: 'Annulée' }
const FILE_KINDS = new Set(['logo', 'business', 'product'])
const STYLES = ['modern', 'luxury', 'minimalist', 'corporate', 'creative', 'other']
const SECTIONS = ['home', 'about', 'services', 'products', 'gallery', 'testimonials', 'contact', 'faq', 'custom']
const LANGUAGES = ['fr', 'ar', 'en', 'multilingual']
const MAX_FILES = 30

const httpError = (status, message) => Object.assign(new Error(message), { status })
const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}-${randomBytes(10).toString('hex')}`

function text(value, max, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `${field} requis`)
    return ''
  }
  if (typeof value !== 'string') throw httpError(400, `${field} invalide`)
  const clean = value.trim()
  if (required && !clean) throw httpError(400, `${field} requis`)
  if (clean.length > max) throw httpError(400, `${field} trop long (${max} caractères maximum)`)
  return clean
}

/** Adresse http(s) sans identifiants : écarte javascript:, data:, file: et autres schémas dangereux. */
export function safeWebUrl(value, { httpsOnly = false } = {}) {
  let url
  try { url = new URL(String(value).trim()) } catch { return null }
  if (!(httpsOnly ? ['https:'] : ['http:', 'https:']).includes(url.protocol) || url.username || url.password || !url.hostname) return null
  return url.href.length <= 2000 ? url.href : null
}
const isPrivateHost = (host) => {
  const name = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local') || name.endsWith('.internal')) return true
  return isIP(name) ? isPrivateIp(name) : false
}
export function isPrivateIp(ip) {
  const value = ip.toLowerCase()
  if (value.includes(':')) {
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    return value === '::1' || value === '::' || /^f[cd]/.test(value) || /^fe[89ab]/.test(value)
  }
  const [a, b] = value.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}
/** URL de livraison : https public uniquement. */
export function safeDeliveryUrl(value) {
  const url = safeWebUrl(value, { httpsOnly: true })
  if (!url) throw httpError(400, 'adresse invalide : utilisez un lien https://')
  if (isPrivateHost(new URL(url).hostname)) throw httpError(400, 'adresse invalide : le site doit être accessible publiquement')
  return url
}
function urlList(value, field, max = 10) {
  if (value === undefined || value === null || value === '') return []
  if (!Array.isArray(value) || value.length > max) throw httpError(400, `${field} invalides`)
  return value.map((item) => String(item).trim()).filter(Boolean).map((item) => {
    const url = safeWebUrl(/^[a-z][a-z0-9+.-]*:/i.test(item) ? item : `https://${item}`)
    if (!url) throw httpError(400, `${field} : lien invalide`)
    return url
  })
}
const pickList = (value, allowed, field) => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.some((item) => !allowed.includes(item))) throw httpError(400, `${field} invalides`)
  return [...new Set(value)]
}

/** L'en-tête du site autorise-t-il son affichage dans ALLNEEDS ? */
export function framingAllowed(headers, appOrigin) {
  const csp = headers.get('content-security-policy') || ''
  const directive = csp.split(';').map((part) => part.trim()).find((part) => /^frame-ancestors\s/i.test(part))
  if (directive) {
    const sources = directive.split(/\s+/).slice(1).map((source) => source.replace(/\/$/, '').toLowerCase())
    if (sources.includes("'none'")) return false
    const origin = appOrigin.replace(/\/$/, '').toLowerCase()
    const host = new URL(origin).hostname
    return sources.some((source) => source === '*' || source === origin || (source.startsWith('https://*.') && host.endsWith(source.slice('https://*'.length))))
  }
  return !headers.get('x-frame-options')
}

async function detectEmbeddable(url, appOrigin) {
  try {
    const { hostname } = new URL(url)
    const addresses = await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true })
    if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) return false
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) })
    if (response.status >= 300) return false
    return framingAllowed(response.headers, appOrigin)
  } catch {
    return false
  }
}

function cleanBrief(input) {
  const b = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const sector = resolveSector(b.sector)
  if (!sector) throw httpError(400, 'secteur requis')
  const email = text(b.email, 200, 'e-mail')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'e-mail invalide')
  const existingUrl = text(b.existingUrl, 500, 'site existant')
  const [cleanExisting] = urlList(existingUrl ? [existingUrl] : [], 'site existant')
  const style = STYLES.includes(b.style) ? b.style : 'modern'
  const sections = pickList(b.sections, SECTIONS, 'sections')
  if (!sections.length) throw httpError(400, 'choisissez au moins une section')
  const languages = pickList(b.languages, LANGUAGES, 'langues')
  if (!languages.length) throw httpError(400, 'choisissez au moins une langue')
  return {
    company: text(b.company, 180, 'nom de l’entreprise', true),
    sector: sector.key,
    sectorSlug: sector.slug,
    description: text(b.description, 3000, 'description', true),
    contactName: text(b.contactName, 160, 'contact'), phone: text(b.phone, 40, 'téléphone'), email,
    address: text(b.address, 300, 'adresse'), city: text(b.city, 120, 'ville'), country: text(b.country, 120, 'pays'),
    socialLinks: urlList(b.socialLinks, 'réseaux sociaux'),
    existingUrl: cleanExisting || '',
    colors: text(b.colors, 300, 'couleurs'), style, styleOther: style === 'other' ? text(b.styleOther, 200, 'style') : '',
    inspirationUrls: urlList(b.inspirationUrls, 'sites d’inspiration'), designNotes: text(b.designNotes, 3000, 'instructions de design'),
    sections, customSections: sections.includes('custom') ? text(b.customSections, 1000, 'sections personnalisées') : '',
    introduction: text(b.introduction, 3000, 'présentation'), servicesDescription: text(b.servicesDescription, 4000, 'services'), productInfo: text(b.productInfo, 4000, 'produits'),
    languages, whatsapp: b.whatsapp === true, contactForm: b.contactForm === true, googleMaps: b.googleMaps === true, extraFeatures: text(b.extraFeatures, 2000, 'fonctionnalités'),
    objective: text(b.objective, 1000, 'objectif'), audience: text(b.audience, 1000, 'public cible'), marketingMessage: text(b.marketingMessage, 1000, 'message'),
    competitors: text(b.competitors, 2000, 'concurrents'), comments: text(b.comments, 3000, 'commentaires'),
  }
}

export function createWebsites({ db, saveDb, json, readBody, audit, access, storage, pushNotification, notifyAdmins, appOrigin }) {
  const userById = (id) => db.users.find((user) => user.id === id)
  const orgById = (id) => db.orgs.find((org) => org.id === id)
  const developers = () => db.users.filter(access.isDeveloper)
  const orgOptions = (user) => access.managedOrgIds(user).map(orgById).filter(Boolean).map((org) => ({ id: org.id, name: org.name, sector: org.sector, city: org.city || '', contactName: org.contactName || '', contactEmail: org.contactEmail || '', contactPhone: org.contactPhone || '' }))

  function canSee(user, request) {
    if (access.isAdmin(user)) return true
    if (access.isDeveloper(user)) return request.developerId === user.id
    if (!access.canManageOrg(user, request.orgId)) return false
    return user.role !== 'collaborateur' || request.createdBy === user.id
  }
  const isTeamView = (user, request) => access.isAdmin(user) || (access.isDeveloper(user) && request.developerId === user.id)
  const find = (id, user) => {
    const request = db.websiteRequests.find((item) => item.id === id)
    // Même réponse qu'une demande inexistante : on ne révèle pas ce qui existe chez un autre client.
    if (!request || !canSee(user, request)) throw httpError(404, 'demande introuvable')
    return request
  }

  function record(request, user, type, detail = {}, visibility = 'all') {
    db.websiteEvents.push({ id: newId('wev'), requestId: request.id, orgId: request.orgId, type, actorId: user?.id || null, actorRole: user?.role || null, visibility, detail, createdAt: nowIso() })
    request.updatedAt = nowIso()
  }
  function setStatus(request, next, user, detail = {}) {
    const from = request.status
    if (from === next) return
    request.status = next
    record(request, user, 'status', { from, to: next, ...detail })
  }
  const clientRecipients = (request) => {
    const ids = new Set(db.users.filter((item) => item.role === 'dirigeant' && item.active !== false && (item.orgIds || []).includes(request.orgId)).map((item) => item.id))
    if (request.createdBy) ids.add(request.createdBy)
    if (request.commercialId) ids.add(request.commercialId)
    return [...ids]
  }
  const notifyClient = (request, type, title, message) => { for (const userId of clientRecipients(request)) pushNotification({ userId, orgId: request.orgId, type, title, message, meta: { requestId: request.id, reference: request.reference } }) }
  const notifyDeveloper = (request, type, title, message) => { if (request.developerId) pushNotification({ userId: request.developerId, orgId: request.orgId, type, title, message, meta: { requestId: request.id, reference: request.reference } }) }
  const adminNotice = (request, type, title, message) => notifyAdmins({ type, title, message, meta: { requestId: request.id, reference: request.reference } })

  const fileOut = (file) => ({ id: file.id, kind: file.kind, name: file.name, mime: file.mime, size: file.size, url: `/api/websites/files/${file.id}`, downloadUrl: `/api/websites/files/${file.id}?download=1` })
  const nameOf = (id) => { const item = userById(id); return item ? (item.name || item.email) : null }

  function requestOut(request, user, { detail = false } = {}) {
    const team = isTeamView(user, request)
    const delivery = db.websiteDeliveries.filter((item) => item.requestId === request.id).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
    const out = {
      id: request.id, reference: request.reference, orgId: request.orgId, organizationName: orgById(request.orgId)?.name || request.brief.company,
      company: request.brief.company, sector: request.brief.sector, sectorSlug: request.brief.sectorSlug, status: request.status, statusLabel: STATUS_LABELS[request.status],
      clientName: nameOf(request.clientId) || orgById(request.orgId)?.contactName || null, commercialName: nameOf(request.commercialId), developerName: team || !access.isClient(user) ? nameOf(request.developerId) : null,
      createdAt: request.createdAt, updatedAt: request.updatedAt, deliveredAt: delivery?.publishedAt || null,
      websiteUrl: delivery?.url || null, embeddable: delivery?.embeddable === true,
      canRevise: request.status === 'delivered' && !access.isDeveloper(user),
    }
    if (team) Object.assign(out, { developerId: request.developerId || null, previewUrl: request.previewUrl || null, progress: request.progress ?? 0 })
    if (!detail) return out
    const events = db.websiteEvents.filter((item) => item.requestId === request.id && (team || item.visibility === 'all')).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const files = db.managedFiles.filter((item) => item.scope === 'website' && item.requestId === request.id)
    return {
      ...out,
      brief: request.brief,
      files: files.map(fileOut),
      events: events.map((item) => ({ id: item.id, type: item.type, createdAt: item.createdAt, actorName: team ? nameOf(item.actorId) : null, from: item.detail.from || null, to: item.detail.to || null, message: item.detail.message || null })),
      deliveries: db.websiteDeliveries.filter((item) => item.requestId === request.id).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(({ id, url, embeddable, publishedAt, version }) => ({ id, url, embeddable, publishedAt, version })),
      revisions: db.websiteRevisions.filter((item) => item.requestId === request.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => ({ id: item.id, message: item.message, createdAt: item.createdAt, authorName: team ? nameOf(item.createdBy) : null })),
      notes: team ? db.websiteNotes.filter((item) => item.requestId === request.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => ({ id: item.id, text: item.text, authorName: nameOf(item.authorId), createdAt: item.createdAt })) : undefined,
      allowedStatuses: access.isAdmin(user) ? ADMIN_TRANSITIONS[request.status] : access.isDeveloper(user) ? DEVELOPER_TRANSITIONS[request.status] || [] : [],
    }
  }

  async function uploadFile(req, url, user) {
    const orgId = url.searchParams.get('orgId')
    const kind = url.searchParams.get('kind')
    if (!access.canManageOrg(user, orgId)) throw httpError(403, 'entreprise hors de votre périmètre')
    if (!FILE_KINDS.has(kind)) throw httpError(400, 'type de fichier invalide')
    const pendingFiles = db.managedFiles.filter((item) => item.scope === 'website' && !item.requestId && item.ownerId === user.id)
    if (pendingFiles.length >= MAX_FILES) throw httpError(429, 'trop de fichiers en attente')
    const content = await readRawBody(req)
    const type = sniffImage(content)
    if (!type) throw httpError(400, 'image invalide : JPG, PNG ou WebP uniquement')
    const storagePath = newStoragePath(`websites/${orgId}`, type.ext)
    await storage.put(storagePath, content, type.mime)
    const file = { id: newId('fil'), scope: 'website', orgId, ownerId: user.id, requestId: null, kind, name: cleanFileName(url.searchParams.get('name')), mime: type.mime, size: content.length, storagePath, createdAt: nowIso() }
    db.managedFiles.push(file)
    saveDb(db)
    return fileOut(file)
  }

  function createRequest(body, user) {
    const key = text(body.submissionKey, 80, 'clé de soumission', true)
    const id = `web-${createHash('sha256').update(`${user.id}:${key}`).digest('hex').slice(0, 20)}`
    const existing = db.websiteRequests.find((item) => item.id === id)
    if (existing) return { status: 200, request: existing }
    const orgId = text(body.orgId, 80, 'entreprise', true)
    if (!access.canManageOrg(user, orgId)) throw httpError(403, 'entreprise hors de votre périmètre')
    const brief = cleanBrief(body.brief)
    const fileIds = Array.isArray(body.fileIds) ? [...new Set(body.fileIds)] : []
    if (fileIds.length > MAX_FILES) throw httpError(400, 'trop de fichiers')
    const files = fileIds.map((fileId) => db.managedFiles.find((item) => item.id === fileId && item.scope === 'website' && !item.requestId && item.ownerId === user.id && item.orgId === orgId))
    if (files.some((file) => !file)) throw httpError(400, 'fichier invalide')
    const now = nowIso()
    const client = access.isClient(user) ? user : db.users.find((item) => item.role === 'dirigeant' && (item.orgIds || []).includes(orgId))
    const commercial = user.role === 'concierge' ? user : db.users.find((item) => item.role === 'concierge' && item.active !== false && (item.orgIds || []).includes(orgId))
    const request = { id, reference: `WEB-${now.slice(0, 10).replace(/-/g, '')}-${id.slice(4, 10).toUpperCase()}`, orgId, createdBy: user.id, clientId: client?.id || null, commercialId: commercial?.id || null, developerId: null, status: 'new', progress: 0, previewUrl: null, brief, createdAt: now, updatedAt: now }
    db.websiteRequests.push(request)
    for (const file of files) file.requestId = id
    record(request, user, 'created', { to: 'new' })
    notifyClient(request, 'website.submitted', 'Votre demande de site est bien reçue', `${brief.company} · ${request.reference}. Notre équipe prépare votre aperçu.`)
    adminNotice(request, 'website.new', 'Nouvelle demande de site web', `${brief.company} · ${request.reference}`)
    saveDb(db)
    audit('website.request.created', { by: user.id, request: id, org: orgId })
    return { status: 201, request }
  }

  async function handle(req, res, url, user, cors) {
    if (!url.pathname.startsWith('/api/websites')) return false
    const path = url.pathname.slice('/api/websites'.length)
    const M = req.method
    const send = (code, body) => { json(res, code, body, cors); return true }
    const allowed = access.isAdmin(user) || access.isDeveloper(user) || access.canRequestWebsite(user)
    if (!allowed) return send(403, { error: 'accès non autorisé' })
    const requireAdmin = () => { if (!access.isAdmin(user)) throw httpError(403, 'réservé à l’administration') }
    let m

    if (path === '/meta' && M === 'GET') {
      return send(200, { organizations: orgOptions(user), developers: access.isAdmin(user) ? developers().map((item) => ({ id: item.id, name: item.name || item.email })) : [], statuses: WEBSITE_STATUSES.map((id) => ({ id, label: STATUS_LABELS[id] })) })
    }

    /* ---------- Fichiers ---------- */
    if (path === '/files' && M === 'POST') {
      if (!access.canRequestWebsite(user)) throw httpError(403, 'accès non autorisé')
      return send(201, await uploadFile(req, url, user))
    }
    if ((m = path.match(/^\/files\/([^/]+)$/))) {
      const file = db.managedFiles.find((item) => item.id === m[1] && item.scope === 'website')
      if (!file) throw httpError(404, 'fichier introuvable')
      if (M === 'GET') {
        const request = file.requestId ? db.websiteRequests.find((item) => item.id === file.requestId) : null
        if (request ? !canSee(user, request) : file.ownerId !== user.id) throw httpError(404, 'fichier introuvable')
        await storage.serve(res, cors, file, { download: url.searchParams.get('download') === '1' })
        return true
      }
      if (M === 'DELETE') {
        if (file.ownerId !== user.id || file.requestId) throw httpError(404, 'fichier introuvable')
        await storage.remove(file.storagePath)
        db.managedFiles = db.managedFiles.filter((item) => item.id !== file.id)
        saveDb(db)
        return send(200, { ok: true })
      }
    }

    /* ---------- Sites déjà réalisés : file de revue avant toute visibilité ---------- */
    if (path === '/imports' && M === 'GET') {
      if (!access.isAdmin(user)) {
        const list = db.websiteImports.filter((item) => item.reviewStatus === 'approved' && access.canManageOrg(user, item.orgId) && !access.isDeveloper(user))
        return send(200, list.map(({ id, name, url: link, deliveredAt, orgId }) => ({ id, name, url: link, deliveredAt, organizationName: orgById(orgId)?.name || '' })))
      }
      return send(200, db.websiteImports.map((item) => ({ ...item, organizationName: orgById(item.orgId)?.name || '' })))
    }
    if (path === '/imports' && M === 'POST') {
      requireAdmin()
      const payload = await readBody(req)
      const records = Array.isArray(payload.records) ? payload.records : null
      if (!records || !records.length || records.length > 500) throw httpError(400, 'envoyez entre 1 et 500 sites')
      let created = 0
      let skipped = 0
      for (const item of records) {
        const sourceId = text(item?.sourceId, 160, 'identifiant source', true)
        if (db.websiteImports.some((row) => row.sourceId === sourceId)) { skipped++; continue }
        const link = safeDeliveryUrl(item.url)
        const deliveredAt = item.deliveredAt && Number.isFinite(Date.parse(item.deliveredAt)) ? new Date(item.deliveredAt).toISOString() : null
        db.websiteImports.push({ id: newId('wim'), sourceId, name: text(item.name, 180, 'nom', true), url: link, deliveredAt, orgId: null, reviewStatus: 'pending', importedBy: user.id, createdAt: nowIso() })
        created++
      }
      saveDb(db)
      audit('website.import', { by: user.id, created, skipped })
      return send(201, { created, skipped })
    }
    if ((m = path.match(/^\/imports\/([^/]+)$/)) && M === 'PATCH') {
      requireAdmin()
      const row = db.websiteImports.find((item) => item.id === m[1])
      if (!row) throw httpError(404, 'site introuvable')
      const body = await readBody(req)
      if (!orgById(body.orgId)) throw httpError(400, 'entreprise requise')
      row.orgId = body.orgId
      row.reviewStatus = 'approved'
      row.reviewedBy = user.id
      row.reviewedAt = nowIso()
      saveDb(db)
      audit('website.import.assigned', { by: user.id, import: row.id, org: row.orgId })
      return send(200, row)
    }

    /* ---------- Demandes ---------- */
    if (path === '' && M === 'GET') {
      const list = db.websiteRequests.filter((item) => canSee(user, item)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return send(200, list.map((item) => requestOut(item, user)))
    }
    if (path === '' && M === 'POST') {
      if (!access.canRequestWebsite(user)) throw httpError(403, 'accès non autorisé')
      const result = createRequest(await readBody(req), user)
      return send(result.status, requestOut(result.request, user))
    }
    if (!(m = path.match(/^\/([^/]+)(?:\/([a-z-]+))?$/))) return send(404, { error: 'route inconnue' })
    const request = find(m[1], user)
    const action = m[2]
    if (!action && M === 'GET') return send(200, requestOut(request, user, { detail: true }))
    if (M !== 'POST' || !action) return send(404, { error: 'route inconnue' })
    const body = await readBody(req)
    const isAssignedDeveloper = access.isDeveloper(user) && request.developerId === user.id
    const requireTeam = () => { if (!access.isAdmin(user) && !isAssignedDeveloper) throw httpError(403, 'action non autorisée') }
    const done = () => { saveDb(db); return send(200, requestOut(request, user, { detail: true })) }

    if (action === 'assign') {
      requireAdmin()
      if (['delivered', 'cancelled'].includes(request.status)) throw httpError(409, 'demande clôturée')
      const developer = db.users.find((item) => item.id === body.developerId && access.isDeveloper(item))
      if (!developer) throw httpError(400, 'développeur invalide')
      if (request.developerId !== developer.id) {
        request.developerId = developer.id
        record(request, user, 'assigned', { developerId: developer.id }, 'team')
        notifyDeveloper(request, 'website.assigned', 'Nouveau site à réaliser', `${request.brief.company} · ${request.reference}`)
      }
      if (['new', 'pending_review'].includes(request.status)) setStatus(request, 'assigned', user)
      audit('website.request.assigned', { by: user.id, request: request.id, developer: developer.id })
      return done()
    }
    if (action === 'status') {
      requireTeam()
      const next = body.status
      const transitions = access.isAdmin(user) ? ADMIN_TRANSITIONS : DEVELOPER_TRANSITIONS
      if (!WEBSITE_STATUSES.includes(next) || !(transitions[request.status] || []).includes(next)) throw httpError(409, 'changement de statut non autorisé')
      if (['assigned', 'in_progress'].includes(next) && !request.developerId) throw httpError(409, 'assignez d’abord un développeur')
      const firstStart = next === 'in_progress' && !db.websiteEvents.some((item) => item.requestId === request.id && item.type === 'status' && item.detail.to === 'in_progress')
      const afterRevision = next === 'in_progress' && request.status === 'revision_requested'
      setStatus(request, next, user)
      if (firstStart) notifyClient(request, 'website.started', 'La création de votre site a commencé', `${request.brief.company} · ${request.reference}`)
      if (afterRevision) notifyClient(request, 'website.revision_update', 'Votre modification est en cours', `${request.brief.company} · ${request.reference}`)
      if (access.isAdmin(user) && next !== 'cancelled') notifyDeveloper(request, 'website.updated', 'Demande mise à jour', `${request.reference} · ${STATUS_LABELS[next]}`)
      if (next === 'cancelled') { notifyClient(request, 'website.cancelled', 'Demande de site annulée', request.reference); notifyDeveloper(request, 'website.updated', 'Demande annulée', request.reference) }
      audit('website.request.status', { by: user.id, request: request.id, status: next })
      return done()
    }
    if (action === 'notes') {
      requireTeam()
      db.websiteNotes.push({ id: newId('wnt'), requestId: request.id, orgId: request.orgId, authorId: user.id, text: text(body.text, 4000, 'note', true), createdAt: nowIso() })
      request.updatedAt = nowIso()
      audit('website.request.note', { by: user.id, request: request.id })
      return done()
    }
    if (action === 'progress') {
      requireTeam()
      if (request.status !== 'in_progress') throw httpError(409, 'la demande doit être en cours')
      const value = Number(body.progress)
      if (!Number.isInteger(value) || value < 0 || value > 100) throw httpError(400, 'progression invalide')
      request.progress = value
      record(request, user, 'progress', { progress: value }, 'team')
      return done()
    }
    if (action === 'submit') {
      requireTeam()
      if (request.status !== 'in_progress') throw httpError(409, 'la demande doit être en cours')
      request.previewUrl = safeDeliveryUrl(body.previewUrl)
      request.progress = 100
      setStatus(request, 'ready_for_review', user, {})
      if (body.note) db.websiteNotes.push({ id: newId('wnt'), requestId: request.id, orgId: request.orgId, authorId: user.id, text: text(body.note, 4000, 'note'), createdAt: nowIso() })
      adminNotice(request, 'website.review', 'Site à valider', `${request.brief.company} · ${request.reference}`)
      audit('website.request.submitted', { by: user.id, request: request.id })
      return done()
    }
    if (action === 'return') {
      requireAdmin()
      if (request.status !== 'ready_for_review') throw httpError(409, 'aucun aperçu à renvoyer')
      const message = text(body.message, 3000, 'motif', true)
      db.websiteNotes.push({ id: newId('wnt'), requestId: request.id, orgId: request.orgId, authorId: user.id, text: `Renvoi au développeur : ${message}`, createdAt: nowIso() })
      setStatus(request, 'in_progress', user)
      notifyDeveloper(request, 'website.updated', 'Corrections demandées', `${request.reference} : ${message.slice(0, 160)}`)
      audit('website.request.returned', { by: user.id, request: request.id })
      return done()
    }
    if (action === 'publish') {
      requireAdmin()
      if (request.status !== 'ready_for_review' || !request.previewUrl) throw httpError(409, 'le site doit être prêt pour validation')
      const link = safeDeliveryUrl(request.previewUrl)
      const version = db.websiteDeliveries.filter((item) => item.requestId === request.id).length + 1
      const embeddable = await detectEmbeddable(link, appOrigin)
      db.websiteDeliveries.push({ id: newId('wdl'), requestId: request.id, orgId: request.orgId, url: link, embeddable, version, publishedBy: user.id, publishedAt: nowIso() })
      setStatus(request, 'delivered', user)
      notifyClient(request, 'website.ready', 'Votre aperçu de site est prêt !', 'Votre aperçu personnalisé est maintenant disponible.')
      audit('website.request.published', { by: user.id, request: request.id, version })
      return done()
    }
    if (action === 'revisions') {
      if (access.isDeveloper(user)) throw httpError(403, 'action non autorisée')
      if (request.status !== 'delivered') throw httpError(409, 'une modification se demande après la livraison')
      const message = text(body.message, 3000, 'modification', true)
      db.websiteRevisions.push({ id: newId('wrv'), requestId: request.id, orgId: request.orgId, message, createdBy: user.id, createdAt: nowIso() })
      setStatus(request, 'revision_requested', user, { message })
      adminNotice(request, 'website.revision', 'Modification demandée', `${request.brief.company} · ${request.reference}`)
      notifyDeveloper(request, 'website.updated', 'Modification demandée', `${request.reference} : ${message.slice(0, 160)}`)
      return done()
    }
    return send(404, { error: 'route inconnue' })
  }

  return { handle }
}

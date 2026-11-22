import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

/* Stockage privé : Supabase Storage en ligne, disque local en développement. Jamais d'URL publique. */
export const STORAGE_BUCKET = process.env.ALLNEEDS_STORAGE_BUCKET || 'allneeds-private'
/** Limite d'une requête Vercel (4,5 Mo) moins la marge. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const httpError = (status, message) => Object.assign(new Error(message), { status })

/** Type réel du fichier, lu dans ses premiers octets (jamais l'extension ni le type déclaré). */
export function sniffImage(buffer) {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' }
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

export async function readRawBody(req, limit = MAX_UPLOAD_BYTES) {
  const declared = Number(req.headers['content-length'] || 0)
  if (declared > limit) throw httpError(413, 'fichier trop volumineux (4 Mo maximum)')
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw httpError(413, 'fichier trop volumineux (4 Mo maximum)')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export const cleanFileName = (value) => String(value || 'fichier').normalize('NFKC').replace(/[\\/\u0000-\u001f"<>|:*?]+/g, '-').replace(/^\.+/, '').trim().slice(0, 120) || 'fichier'
export const newStoragePath = (prefix, ext) => `${prefix}/${new Date().toISOString().slice(0, 7)}/${randomBytes(16).toString('hex')}.${ext}`

export function createStorage({ supabaseUrl, serviceKey, localRoot }) {
  const remote = Boolean(supabaseUrl && serviceKey)
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
  const objectUrl = (path) => `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
  const localPath = (path) => {
    const base = join(localRoot, 'uploads')
    const target = normalize(join(base, path))
    if (!target.startsWith(base)) throw httpError(400, 'chemin invalide')
    return target
  }
  const unavailable = (status) => httpError(503, status === 404 ? 'stockage privé non configuré : exécutez la migration Studio et sites web' : 'stockage indisponible, réessayez')

  async function put(path, body, mime) {
    if (!remote) {
      const target = localPath(path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, Buffer.from(body), { mode: 0o600 })
      return
    }
    const response = await fetch(objectUrl(path), { method: 'POST', headers: { ...headers, 'content-type': mime, 'x-upsert': 'true' }, body })
    if (!response.ok) throw unavailable(response.status)
  }

  async function signedUrl(path, { expiresIn = 300, download } = {}) {
    if (!remote) return null
    const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${STORAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn }) })
    if (!response.ok) throw unavailable(response.status)
    const data = await response.json()
    const url = `${supabaseUrl}/storage/v1${String(data.signedURL || data.signedUrl)}`
    return download ? `${url}&download=${encodeURIComponent(download)}` : url
  }

  const readLocal = (path) => {
    const target = localPath(path)
    if (!existsSync(target)) throw httpError(404, 'fichier introuvable')
    return readFileSync(target)
  }

  async function remove(path) {
    if (!remote) { rmSync(localPath(path), { force: true }); return }
    await fetch(objectUrl(path), { method: 'DELETE', headers }).catch(() => undefined)
  }

  /** Sert un fichier déjà autorisé par l'appelant : lien signé de 5 minutes, ou lecture locale. */
  async function serve(res, cors, file, { download = false } = {}) {
    if (remote) {
      const location = await signedUrl(file.storagePath, { download: download ? file.name : undefined })
      res.writeHead(302, { ...cors, location, 'cache-control': 'private, no-store' })
      return res.end()
    }
    const content = readLocal(file.storagePath)
    res.writeHead(200, { ...cors, 'content-type': file.mime, 'content-length': content.length, 'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.name)}"`, 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' })
    return res.end(content)
  }

  return { remote, put, signedUrl, readLocal, remove, serve }
}

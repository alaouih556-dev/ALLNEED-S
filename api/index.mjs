import { handleServerless } from '../backend/server.mjs'

/** Point d'entrée Vercel : `vercel.json` y envoie toutes les routes /api/* avec leur chemin dans `__path`. */
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.searchParams.get('__path')
  if (path !== null) {
    url.searchParams.delete('__path')
    req.url = `/api/${path.split('/').map(encodeURIComponent).join('/')}${url.search}`
  }
  return handleServerless(req, res)
}

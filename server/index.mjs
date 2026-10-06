import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { createApp } from './app.mjs'
import { createStore } from './store.mjs'
import { seedDemo } from './seed.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR ?? join(here, 'data')
const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const secureCookies = /^(1|true|yes)$/i.test(process.env.COOKIE_SECURE ?? '')

const store = createStore(dataDir)

const seeded = seedDemo(store)

const environment = process.env.APP_ENV?.trim()
if (environment && environment !== store.get().environment) {
  store.get().environment = environment
  store.save()
}
if (seeded.seeded) {
  console.warn('[allneeds-api] ENVIRONNEMENT DE DÉMONSTRATION — comptes de démonstration créés.')
  console.warn('[allneeds-api] Mot de passe de démonstration commun à tous les comptes : « demonstration ».')
  console.warn('[allneeds-api] Ne pas utiliser ces comptes avec des données réelles.')
}

const handler = createApp({ store, allowedOrigins, secureCookies })
const server = createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error('[allneeds-api] requête non traitée', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: { code: 'internal_error', message: 'Erreur interne' } }))
    }
  })
})

server.listen(port, host, () => {
  console.log(`[allneeds-api] http://${host}:${port} — données : ${dataDir}`)
})

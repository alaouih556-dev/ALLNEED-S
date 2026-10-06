import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const EMPTY = () => ({
  version: 2,
  environment: 'demo',
  users: [],
  orgs: [],
  sessions: [],
  invitations: [],
  registrations: [],
  diagnostics: [],
  audit: [],
})

function migrate(loaded) {
  if (!loaded || typeof loaded !== 'object') return EMPTY()
  const state = loaded
  if (!Array.isArray(state.users)) state.users = []
  if (!Array.isArray(state.orgs)) state.orgs = []
  if (!Array.isArray(state.sessions)) state.sessions = []
  if (!Array.isArray(state.invitations)) state.invitations = []
  if (!Array.isArray(state.registrations)) state.registrations = []
  if (!Array.isArray(state.diagnostics)) state.diagnostics = []
  if (!Array.isArray(state.audit)) state.audit = []
  if (!state.environment) state.environment = 'demo'
  for (const user of state.users) {
    if (user.clientRole === undefined) user.clientRole = user.role === 'client' ? 'dirigeant' : null
  }
  state.version = 2
  return state
}

export function createStore(dir) {
  const file = join(dir, 'db.json')
  let state = null

  function get() {
    if (state) return state
    mkdirSync(dir, { recursive: true })
    if (existsSync(file)) {
      state = migrate(JSON.parse(readFileSync(file, 'utf8')))
    } else {
      state = EMPTY()
    }
    return state
  }

  function save() {
    mkdirSync(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(state, null, 2))
    renameSync(tmp, file)
  }

  function reset() {
    state = EMPTY()
    save()
  }

  return { get, save, reset, file }
}

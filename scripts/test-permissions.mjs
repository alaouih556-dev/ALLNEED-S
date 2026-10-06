import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

const transpile = (path) =>
  ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText

const asModule = (code) => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')

const permissions = await import(asModule(transpile('src/lib/permissions.ts')))
const { can, canAccessPath, requiredRoleFor, ROLE_PERMISSIONS, GUARDED_PATHS } = permissions

assert.equal(requiredRoleFor('/admin'), 'admin')
assert.equal(requiredRoleFor('/admin/clients/org-1'), 'admin')
assert.equal(requiredRoleFor('/concierge'), 'concierge')
assert.equal(requiredRoleFor('/expert/missions'), 'expert')
assert.equal(requiredRoleFor('/app/diagnostic-auto'), 'client')
assert.equal(requiredRoleFor('/app'), 'client')
assert.equal(requiredRoleFor('/'), null, 'site public sans rôle requis')
assert.equal(requiredRoleFor('/tarifs'), null)
assert.equal(requiredRoleFor('/connexion'), null)
assert.equal(requiredRoleFor('/administration'), null, 'préfixe non encadré')

assert.equal(canAccessPath(null, '/admin'), false, 'sans session, /admin est bloqué')
assert.equal(canAccessPath(null, '/concierge'), false)
assert.equal(canAccessPath(null, '/expert'), false)
assert.equal(canAccessPath(null, '/app'), false, 'sans session, /app est bloqué')
assert.equal(canAccessPath('client', '/admin'), false, 'un client n’ouvre pas l’administration')
assert.equal(canAccessPath('client', '/concierge'), false)
assert.equal(canAccessPath('client', '/expert'), false)
assert.equal(canAccessPath('admin', '/app'), false, 'l’administration ne s’ouvre pas dans l’espace client')
assert.equal(canAccessPath('concierge', '/admin'), false)
assert.equal(canAccessPath('admin', '/admin'), true)
assert.equal(canAccessPath('concierge', '/concierge'), true)
assert.equal(canAccessPath('expert', '/expert'), true)
assert.equal(canAccessPath('client', '/app'), true)
assert.equal(canAccessPath('client', '/app/diagnostic-auto'), true)
assert.equal(canAccessPath('client', '/'), true)

assert.deepEqual([...GUARDED_PATHS].sort(), ['/admin', '/app', '/concierge', '/expert'])

assert.equal(can('admin', 'member:invite'), true)
assert.equal(can('admin', 'concierge:manage'), true)
assert.equal(can('admin', 'audit:read'), true)
assert.equal(can('concierge', 'org:read:assigned'), true)
assert.equal(can('concierge', 'member:invite'), false, 'un concierge ne crée pas de comptes')
assert.equal(can('concierge', 'org:read:all'), false, 'un concierge ne voit que son portefeuille')
assert.equal(can('client', 'org:read:all'), false, 'un client ne voit que sa société')
assert.equal(can('client', 'diagnostic:write:own'), true)
assert.equal(can('client', 'crm:write'), false)
assert.equal(can('expert', 'mission:read:assigned'), true)
assert.equal(can('expert', 'org:read:all'), false)
assert.equal(can(null, 'org:read:own'), false)

for (const [role, list] of Object.entries(ROLE_PERMISSIONS)) {
  assert.ok(list.length > 0, `${role} : matrice de permissions non vide`)
}

const memory = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) },
    removeItem: (key) => { memory.delete(key) },
    clear: () => { memory.clear() },
    key: () => null,
    length: 0,
  },
})

const session = await import(asModule(transpile('src/lib/session.ts')))
assert.equal(session.readSession(), null, 'aucune session au démarrage')
session.writeSession({
  role: 'admin',
  userId: 'admin-nada',
  orgId: '',
  email: 'nada@allneeds.ma',
  createdAt: '2026-10-06T10:00:00.000Z',
})
const active = session.readSession()
assert.equal(active.role, 'admin')
assert.equal(active.userId, 'admin-nada')
assert.equal(canAccessPath(active.role, '/admin'), true)
session.clearSession()
assert.equal(session.readSession(), null, 'déconnexion = session effacée')
assert.equal(canAccessPath(session.readSession()?.role ?? null, '/admin'), false)

memory.set(session.SESSION_KEY, '{broken json')
assert.equal(session.readSession(), null, 'session corrompue ignorée')
memory.set(session.SESSION_KEY, JSON.stringify({ role: 'admin' }))
assert.equal(session.readSession(), null, 'session incomplète ignorée')

const guardedFiles = [
  ['src/routes/admin.tsx', '/admin'],
  ['src/routes/concierge.tsx', '/concierge'],
  ['src/routes/expert.tsx', '/expert'],
  ['src/routes/app.tsx', '/app'],
]
for (const [file, path] of guardedFiles) {
  const source = readFileSync(file, 'utf8')
  assert.ok(source.includes('beforeLoad'), `${file} : garde de route attendue`)
  assert.ok(source.includes(`canAccessPath(`), `${file} : contrôle de permission attendu`)
  assert.ok(source.includes(`'${path}'`), `${file} : chemin ${path} contrôlé`)
}

const connexion = readFileSync('src/routes/connexion.tsx', 'utf8')
assert.ok(connexion.includes('writeSession'), 'connexion : session ouverte à l’authentification')
const layouts = readFileSync('src/components/layouts.tsx', 'utf8')
assert.ok(layouts.includes('clearSession'), 'déconnexion : session effacée')

console.log(
  'OK — habilitations : 4 espaces protégés par beforeLoad, matrice de rôles, session ouverte/effacée, sessions invalides rejetées.',
)

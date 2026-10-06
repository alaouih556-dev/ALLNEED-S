import { hashPassword } from './auth.mjs'
import { CLIENT_ROLES } from './policy.mjs'

export const DEMO_PASSWORD = 'demonstration'

export const DEMO_ORGS = [
  { id: 'org-amal', name: 'École Al Amal', sector: 'enseignement' },
  { id: 'org-nour', name: 'Clinique Nour', sector: 'sante' },
  { id: 'org-riad', name: 'Riad Lumen', sector: 'tourisme' },
]

export const DEMO_USERS = [
  { id: 'admin-nada', email: 'nada@allneeds.ma', name: 'Nada Berrada', role: 'admin', orgId: null, assignedOrgIds: [] },
  { id: 'conc-001', email: 'concierge.sante@allneeds.ma', name: 'Concierge AllNeeds', role: 'concierge', orgId: null, assignedOrgIds: ['org-amal', 'org-nour'] },
  { id: 'expert-001', email: 'expert.sante@allneeds.ma', name: 'Expert Santé', role: 'expert', orgId: null, assignedOrgIds: ['org-nour'] },
  { id: 'sales-001', email: 'commercial@allneeds.ma', name: 'Yasmine Faiz', role: 'commercial', orgId: null, assignedOrgIds: [] },
  { id: 'usr-amina', email: 'a.bennani@al-amal.ma', name: 'Amina Bennani', role: 'client', clientRole: 'dirigeant', orgId: 'org-amal', assignedOrgIds: [] },
  { id: 'usr-youssef', email: 'direction@clinique-nour.ma', name: 'Dr Youssef Idrissi', role: 'client', clientRole: 'dirigeant', orgId: 'org-nour', assignedOrgIds: [] },
  { id: 'usr-salma', email: 'salma@riad-lumen.ma', name: 'Salma Ouazzani', role: 'client', clientRole: 'dirigeant', orgId: 'org-riad', assignedOrgIds: [] },
  { id: 'mgr-nour', email: 'responsable@clinique-nour.ma', name: 'Karim Senhaji', role: 'client', clientRole: 'manager', orgId: 'org-nour', assignedOrgIds: [] },
  { id: 'col-nour', email: 'accueil@clinique-nour.ma', name: 'Leïla Amrani', role: 'client', clientRole: 'collaborateur', orgId: 'org-nour', assignedOrgIds: [] },
]

export function seedDemo(store, { force = false } = {}) {
  const state = store.get()
  if (state.users.length > 0 && !force) return { seeded: false }
  if (force) store.reset()

  const target = store.get()
  target.environment = 'demo'
  target.orgs = DEMO_ORGS.map((org) => ({ ...org }))
  target.users = DEMO_USERS.map((user) => ({
    ...user,
    clientRole: user.role === 'client' ? (CLIENT_ROLES.includes(user.clientRole) ? user.clientRole : 'dirigeant') : null,
    passwordHash: hashPassword(DEMO_PASSWORD),
    active: true,
    createdAt: new Date().toISOString(),
  }))
  target.sessions = []
  target.invitations = []
  target.registrations = []
  target.diagnostics = []
  target.audit = []
  store.save()
  return { seeded: true }
}

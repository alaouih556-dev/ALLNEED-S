import type { AuthUser } from '@/features/auth/AuthContext'

/** Clés de modules pilotées par l'admin, synchronisées avec le backend (DEFAULT_MODULES). Le SaaS n'est PAS un module : il a son propre abonnement et sa propre activation. */
export const ACCESS_MODULE_KEYS = [
  'diagnostic',
  'besoins',
  'missions',
  'documents',
  'messages',
  'rendezVous',
  'equipe',
  'results',
  'prestataires',
  'abonnement',
  'devis',
  'notifications',
] as const

export type AccessModule = (typeof ACCESS_MODULE_KEYS)[number]

/** Première connexion : seuls Accueil + Diagnostic (+ Profil) sont visibles. Tout le reste est fermé tant qu'ALLNEEDS ne l'active pas. */
export const MINIMAL_CLIENT_MODULES: Record<AccessModule, boolean> = {
  diagnostic: true,
  besoins: false,
  missions: false,
  documents: false,
  messages: false,
  rendezVous: false,
  equipe: false,
  results: false,
  prestataires: false,
  abonnement: false,
  devis: false,
  notifications: false,
}

/** Résout les modules de l'entreprise : valeurs de l'organisation, sinon le minimum de première connexion. */
export function clientModules(org?: AuthUser['organization'] | null): Record<AccessModule, boolean> {
  const modules: Record<AccessModule, boolean> = { ...MINIMAL_CLIENT_MODULES }
  if (!org?.modules) return modules
  for (const key of ACCESS_MODULE_KEYS) {
    if (typeof org.modules[key] === 'boolean') modules[key] = org.modules[key]
  }
  return modules
}

export const ACCESS_PLAN_KEYS = ['BASE', 'PRO', 'PERFORMANCE'] as const
export type AccessPlan = (typeof ACCESS_PLAN_KEYS)[number]

/** Plans d'accès proposés à l'admin. Un plan n'ouvre jamais de module non recommandé : il sert de point de départ, l'admin reste libre de tout module individuellement. */
export const ACCESS_PLANS: Record<AccessPlan, { label: string; description: string; modules: AccessModule[] }> = {
  BASE: {
    label: 'BASE',
    description: 'Diagnostic, documents, messages',
    modules: ['diagnostic', 'documents', 'messages'],
  },
  PRO: {
    label: 'PRO',
    description: 'Base + besoins, missions, rendez-vous, équipe',
    modules: ['diagnostic', 'besoins', 'missions', 'documents', 'messages', 'rendezVous', 'equipe'],
  },
  PERFORMANCE: {
    label: 'PERFORMANCE',
    description: 'Pro + résultats, prestataires (le SaaS reste un abonnement séparé)',
    modules: ['diagnostic', 'besoins', 'missions', 'documents', 'messages', 'rendezVous', 'equipe', 'results', 'prestataires'],
  },
}

export function modulesFromPlan(plan: AccessPlan): Record<AccessModule, boolean> {
  const modules = { ...MINIMAL_CLIENT_MODULES }
  for (const key of ACCESS_PLANS[plan].modules) modules[key] = true
  return modules
}

/** Mappage URL → module : utilisé par la garde de routes pour rediriger vers /app quand le module est désactivé. */
export const ACCESS_ROUTES: Array<[string, AccessModule]> = [
  ['/app/performance', 'results'],
  ['/app/besoins', 'besoins'],
  ['/app/objectifs', 'missions'],
  ['/app/actions', 'missions'],
  ['/app/projets', 'missions'],
  ['/app/livrables', 'missions'],
  ['/app/devis', 'devis'],
  ['/app/ecosysteme', 'prestataires'],
  ['/app/prestataires', 'prestataires'],
  ['/app/rendez-vous', 'rendezVous'],
  ['/app/documents', 'documents'],
  ['/app/messages', 'messages'],
  ['/app/equipe', 'equipe'],
  ['/app/abonnement', 'abonnement'],
  ['/app/notifications', 'notifications'],
]

/** Retourne le module qui bloque la route, ou null si la route est autorisée par les modules de l'entreprise. */
export function blockedModuleForPath(path: string, modules: Record<AccessModule, boolean>): AccessModule | null {
  for (const [prefix, key] of ACCESS_ROUTES) {
    if (path.startsWith(prefix) && modules[key] === false) return key
  }
  return null
}

/* ------------------------------------------------------------------ */
/* SaaS : abonnement + activation indépendants des modules et du plan  */
/* ------------------------------------------------------------------ */

export interface SaasAccess {
  subscriptionActive: boolean
  enabled: boolean
  startDate: string | null
  endDate: string | null
  plan: string | null
}

export const DEFAULT_SAAS: SaasAccess = {
  subscriptionActive: false,
  enabled: false,
  startDate: null,
  endDate: null,
  plan: null,
}

/** Normalise l'état SaaS de l'entreprise. */
export function orgSaas(org?: AuthUser['organization'] | null): SaasAccess {
  const saas = org?.saas
  if (!saas) return { ...DEFAULT_SAAS }
  return {
    subscriptionActive: saas.subscriptionActive === true,
    enabled: saas.enabled === true,
    startDate: saas.startDate ?? null,
    endDate: saas.endDate ?? null,
    plan: saas.plan ?? null,
  }
}

/** Le SaaS n'est visible que si l'abonnement est actif ET l'activation explicite. */
export function orgSaasActive(org?: AuthUser['organization'] | null): boolean {
  const saas = orgSaas(org)
  return saas.subscriptionActive === true && saas.enabled === true
}

export const SAAS_ROUTES = ['/app/espace-metier', '/app/tourisme']

export function isSaasRoute(path: string): boolean {
  return SAAS_ROUTES.some((prefix) => path.startsWith(prefix))
}

/* ------------------------------------------------------------------ */
/* Garde avant diagnostic (parcours)                                    */
/* ------------------------------------------------------------------ */

/**
 * Pages fonctionnelles de l'espace client masquées tant que le diagnostic
 * n'est pas terminé. L'Accueil, le Diagnostic et le Profil restent toujours
 * accessibles (exceptions).
 */
export function isDiagnosticGuardedPath(path: string): boolean {
  if (!path.startsWith('/app/')) return false
  if (path === '/app/diagnostic-auto' || path.startsWith('/app/diagnostic-auto/')) return false
  if (path === '/app/parametres' || path.startsWith('/app/parametres/')) return false
  if (path === '/app/espace-metier') return false
  return true
}

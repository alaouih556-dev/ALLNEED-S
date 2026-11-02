import { useCallback, useEffect, useState } from 'react'
import { readParcours, writeParcours, type ParcoursState } from '@/lib/parcours'

export interface ConciergeRequestPayload {
  company: string
  contact: string
  phone: string
  email: string
  sector: string
  city: string
  availability: string
  objective: string
  priority: string
  comment: string
  submittedAt: string
}

export interface DiagnosticSynthesis {
  confirmed: string[]
  priorities: string[]
  watch: string[]
  opportunities: string[]
  actions: string[]
}

export type DiagnosticRecordStatus = 'soumis' | 'analyse' | 'en_analyse' | 'pret_a_valider' | 'restitue'

/** Analyse de l'équipe (concierge + admin). Jamais transmise telle quelle au client. */
export interface DiagnosticAnalysis {
  priorityLevel?: string
  internalNotes?: string
  priorities?: string[]
  recommendations?: string[]
  strengths?: string[]
  weaknesses?: string[]
  risks?: string[]
  opportunities?: string[]
  needsPrioritaires?: string[]
  actionPlan?: string[]
  nextSteps?: string[]
}

export interface DiagnosticRecord {
  id: string
  orgId: string
  format: 'Express' | 'Complet'
  sector?: string
  answers: Record<string, { score: number; comment: string; completed?: boolean }>
  status?: DiagnosticRecordStatus
  conciergeRequest?: ConciergeRequestPayload | null
  conciergeRequestedAt?: string | null
  notes?: string
  questionNotes?: Record<string, string>
  questionComments?: Record<string, string>
  synthesis?: DiagnosticSynthesis | null
  analysis?: DiagnosticAnalysis | null
  publishedAt?: string | null
  publishedBy?: string
  restitutionVisible?: boolean
  restitutionPublished?: boolean
  orgName?: string
  rendezVousAt?: string | null
  restoredAt?: string | null
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/** Restitution validée, telle qu'exposée au client via /api/diagnostics/:id/restitution. */
export interface DiagnosticRestitution {
  id: string
  orgId: string
  orgName: string
  sector: string | null
  format: string
  status: 'restitue'
  publishedAt: string | null
  conciergeRequestedAt: string | null
  rendezVousAt: string | null
  restoredAt: string | null
  notes: string
  synthesis: DiagnosticSynthesis
  analysis: Pick<
    DiagnosticAnalysis,
    | 'priorityLevel'
    | 'priorities'
    | 'recommendations'
    | 'strengths'
    | 'weaknesses'
    | 'risks'
    | 'opportunities'
    | 'needsPrioritaires'
    | 'actionPlan'
    | 'nextSteps'
  >
}

async function responseError(response: Response) {
  const body = response.headers.get('content-type')?.includes('json')
    ? ((await response.json().catch(() => ({}))) as { error?: string })
    : ({} as { error?: string })
  return body.error || `Erreur serveur (${response.status})`
}

/** Restitution validée d'un diagnostic. Le serveur refuse tant que ce n'est pas publié. */
export async function getRestitution(recordId: string): Promise<DiagnosticRestitution> {
  const response = await fetch(`/api/diagnostics/${encodeURIComponent(recordId)}/restitution`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(await responseError(response))
  return (await response.json()) as DiagnosticRestitution
}

/** Diagnostic complet (équipe). Retourne null si introuvable. */
export async function fetchDiagnosticRecord(recordId: string): Promise<DiagnosticRecord | null> {
  const response = await fetch(`/api/diagnostics/${encodeURIComponent(recordId)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const error = new Error(await responseError(response)) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return (await response.json()) as DiagnosticRecord
}

/** Met à jour un diagnostic (équipe). */
export async function patchDiagnosticRecord(recordId: string, body: Record<string, unknown>): Promise<DiagnosticRecord> {
  const response = await fetch(`/api/diagnostics/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = new Error(await responseError(response)) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return (await response.json()) as DiagnosticRecord
}

function sortRecords(records: DiagnosticRecord[]) {
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function useDiagnosticRecord(orgId: string | null) {
  const enabled = Boolean(orgId)
  const [records, setRecords] = useState<DiagnosticRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/diagnostics', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response))
      const payload = (await response.json()) as DiagnosticRecord[]
      setRecords(sortRecords(payload.filter((item) => item.orgId === orgId)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger votre diagnostic.')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (!enabled) {
      setRecords([])
      setError('')
      return
    }
    void refresh()
  }, [enabled, refresh])

  const submit = useCallback(
    async (input: { format: 'Express' | 'Complet'; sector?: string; answers: DiagnosticRecord['answers'] }) => {
      if (!orgId) throw new Error('Entreprise introuvable.')
      const response = await fetch('/api/diagnostics', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, format: input.format, sector: input.sector, answers: input.answers }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const record = (await response.json()) as DiagnosticRecord
      setRecords((current) => sortRecords([record, ...current.filter((item) => item.id !== record.id)]))
      return record
    },
    [orgId],
  )

  const patchRecord = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const response = await fetch(`/api/diagnostics/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const record = (await response.json()) as DiagnosticRecord
      setRecords((current) => sortRecords(current.map((item) => (item.id === record.id ? record : item))))
      return record
    },
    [],
  )

  /** Crée le diagnostic si le client n'en a pas encore, puis renvoie l'enregistrement courant. */
  const ensure = useCallback(
    async (input?: { sector?: string; answers?: DiagnosticRecord['answers'] }) => {
      if (!orgId) throw new Error('Entreprise introuvable.')
      if (records[0]) return records[0]
      return submit({
        format: 'Express',
        sector: input?.sector,
        answers: input?.answers ?? {},
      })
    },
    [orgId, records, submit],
  )

  return { enabled, records, primary: records[0] ?? null, loading, error, refresh, submit, ensure, patchRecord }
}

/** Tous les diagnostics visibles par le compte connecté (concierge / admin). */
export function useSubmittedDiagnostics() {
  const [records, setRecords] = useState<DiagnosticRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/diagnostics', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response))
      setRecords(sortRecords((await response.json()) as DiagnosticRecord[]))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les diagnostics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patchRecord = useCallback(async (id: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/diagnostics/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(await responseError(response))
    const record = (await response.json()) as DiagnosticRecord
    setRecords((current) => sortRecords(current.map((item) => (item.id === record.id ? record : item))))
    return record
  }, [])

  return { records, loading, error, refresh, patchRecord }
}

/** Resynchronise l'état du parcours local avec l'enregistrement serveur du diagnostic. */
export function useParcoursSync(orgId: string) {
  const { records } = useDiagnosticRecord(orgId || null)

  useEffect(() => {
    if (!orgId || records.length === 0) return
    const primary = records[0]
    const current = readParcours(orgId)
    const next: ParcoursState = { ...current }
    let changed = false
    const assign = (key: keyof ParcoursState, value: ParcoursState[keyof ParcoursState]) => {
      if (current[key] !== value) {
        ;(next as unknown as Record<string, unknown>)[key] = value
        changed = true
      }
    }
    assign('diagnosticId', primary.id)
    assign('submittedAt', current.submittedAt ?? primary.createdAt)
    assign('conciergeRequestedAt', primary.conciergeRequestedAt ?? current.conciergeRequestedAt)
    assign('rendezVousAt', primary.rendezVousAt ?? current.rendezVousAt)
    assign('restoredAt', primary.restoredAt ?? current.restoredAt)
    if (primary.sector && !current.sector) {
      const sector = primary.sector
      if (sector === 'sante' || sector === 'enseignement' || sector === 'tourisme') {
        next.sector = sector
        changed = true
      }
    }
    if (changed) writeParcours(orgId, next)
  }, [orgId, records])
}

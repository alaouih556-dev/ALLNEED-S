import { useCallback, useEffect, useState } from 'react'
import type { Tone } from '@/components/ui'

export interface ClientDocument {
  id: string
  orgId: string
  title: string
  type: string
  category: string
  status: string
  visibleToClient: boolean
  fileName?: string | null
  fileUrl?: string | null
  content?: string | null
  mimeType?: string | null
  sizeLabel?: string | null
  createdBy?: string | null
  createdByName?: string | null
  origin?: string | null
  createdAt: string
  updatedAt: string
  notes?: string | null
  orgName?: string
}

export type NewDocumentInput = {
  orgId: string
  title: string
  type: string
  category?: string
  status?: string
  visibleToClient?: boolean
  fileName?: string
  fileUrl?: string
  content?: string
  mimeType?: string
  sizeLabel?: string
  notes?: string
}

/** Catégories UX côté client (regroupent les pièces demandées). */
export const DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'identite', label: 'Identité', description: 'Extrait Kbis, pièce d’identité du dirigeant, justificatif d’adresse…' },
  { value: 'factures', label: 'Factures', description: 'Factures fournisseurs ou clients utiles à l’analyse.' },
  { value: 'contrats', label: 'Contrats', description: 'Contrats en cours (bail, prestataire, assurance…).' },
  { value: 'documents_utiles', label: 'Documents utiles', description: 'Tout autre document utile au diagnostic.' },
] as const

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  identite: 'Identité',
  factures: 'Factures',
  contrats: 'Contrats',
  documents_utiles: 'Documents utiles',
}

export function documentCategoryLabel(category?: string | null) {
  if (!category) return ''
  return DOCUMENT_CATEGORY_LABELS[category] || category
}

/** Convertit un fichier sélectionné en data URL (persisté côté backend). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  restitution: 'Restitution diagnostic',
  proposition: 'Proposition',
  devis: 'Devis',
  contrat: 'Contrat',
  compte_rendu: 'Compte rendu',
  document_preparatoire: 'Document préparatoire',
  livrable: 'Livrable',
  suivi: 'Document de suivi',
  facture: 'Facture',
  autorisation: 'Autorisation',
  autre: 'Autre',
}

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'restitution', label: 'Restitution diagnostic' },
  { value: 'proposition', label: 'Proposition' },
  { value: 'devis', label: 'Devis' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'compte_rendu', label: 'Compte rendu' },
  { value: 'document_preparatoire', label: 'Document préparatoire' },
  { value: 'livrable', label: 'Livrable' },
  { value: 'suivi', label: 'Document de suivi' },
  { value: 'facture', label: 'Facture' },
  { value: 'autorisation', label: 'Autorisation' },
  { value: 'autre', label: 'Autre' },
]

export function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABELS[type] || type || 'Document'
}

const DOCUMENT_STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  demande: { label: 'Manquant', tone: 'warning' },
  recu: { label: 'Déposé', tone: 'info' },
  valide: { label: 'Déposé', tone: 'success' },
}

export function documentStatus(type?: string) {
  return DOCUMENT_STATUS_LABELS[type ?? ''] ?? { label: type || 'Disponible', tone: 'neutral' as Tone }
}

export function documentDownloadUrl(id: string) {
  return `/api/documents/${encodeURIComponent(id)}/download`
}

export function documentOpenUrl(id: string) {
  return `/api/documents/${encodeURIComponent(id)}/download?inline=1`
}

async function responseError(response: Response) {
  const body = response.headers.get('content-type')?.includes('json')
    ? ((await response.json().catch(() => ({}))) as { error?: string })
    : ({} as { error?: string })
  return body.error || `Erreur serveur (${response.status})`
}

export function useDocuments(orgId?: string | null, enabled = true) {
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setDocuments([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''
      const response = await fetch(`/api/documents${query}`, { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response))
      setDocuments((await response.json()) as ClientDocument[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les documents.')
    } finally {
      setLoading(false)
    }
  }, [orgId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { documents, loading, error, refresh }
}

export async function createDocument(input: NewDocumentInput): Promise<ClientDocument> {
  const response = await fetch('/api/documents', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await responseError(response))
  return (await response.json()) as ClientDocument
}

export async function updateDocument(id: string, patch: Record<string, unknown>): Promise<ClientDocument> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(await responseError(response))
  return (await response.json()) as ClientDocument
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(await responseError(response))
}
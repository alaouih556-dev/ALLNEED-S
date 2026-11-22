import { apiRequest, ApiError } from '@/lib/accompagnement'
import type { Tone } from '@/components/ui'

export type WebsiteStatus = 'new' | 'pending_review' | 'assigned' | 'in_progress' | 'ready_for_review' | 'delivered' | 'revision_requested' | 'cancelled'

export type WebsiteBrief = {
  company: string; sector: string; description: string; contactName: string; phone: string; email: string; address: string; city: string; country: string
  socialLinks: string[]; existingUrl: string; colors: string; style: string; styleOther: string; inspirationUrls: string[]; designNotes: string
  sections: string[]; customSections: string; introduction: string; servicesDescription: string; productInfo: string; languages: string[]
  whatsapp: boolean; contactForm: boolean; googleMaps: boolean; extraFeatures: string
  objective: string; audience: string; marketingMessage: string; competitors: string; comments: string
}
export type WebsiteFile = { id: string; kind: 'logo' | 'business' | 'product'; name: string; mime: string; size: number; url: string; downloadUrl: string }
export type WebsiteSummary = {
  id: string; reference: string; orgId: string; organizationName: string; company: string; sector: string; status: WebsiteStatus; statusLabel: string
  clientName: string | null; commercialName: string | null; developerName: string | null; developerId?: string | null; previewUrl?: string | null; progress?: number
  createdAt: string; updatedAt: string; deliveredAt: string | null; websiteUrl: string | null; embeddable: boolean; canRevise: boolean
}
export type WebsiteEvent = { id: string; type: string; createdAt: string; actorName: string | null; from: WebsiteStatus | null; to: WebsiteStatus | null; message: string | null }
export type WebsiteDetail = WebsiteSummary & {
  brief: WebsiteBrief; files: WebsiteFile[]; events: WebsiteEvent[]
  deliveries: Array<{ id: string; url: string; embeddable: boolean; publishedAt: string; version: number }>
  revisions: Array<{ id: string; message: string; createdAt: string; authorName: string | null }>
  notes?: Array<{ id: string; text: string; authorName: string | null; createdAt: string }>
  allowedStatuses: WebsiteStatus[]
}
export type WebsiteMeta = {
  organizations: Array<{ id: string; name: string; sector?: string; city: string; contactName: string; contactEmail: string; contactPhone: string }>
  developers: Array<{ id: string; name: string }>
  statuses: Array<{ id: WebsiteStatus; label: string }>
}
export type ImportedSite = { id: string; name: string; url: string; deliveredAt: string | null; organizationName: string; reviewStatus?: string; orgId?: string | null; sourceId?: string }

export type StudioInput = { id: string; label: string; type: string; required: boolean; defaultValue: unknown; mediaType: string | null; multiline: boolean; options: Array<{ value: string; label: string }> }
export type StudioWorkflow = { key: string; name: string; description: string; state: 'available' | 'unavailable' | 'unsupported' | 'not_configured'; reason?: string | null; inputs: StudioInput[]; cost?: number | null }
export type StudioPayload = { configured: boolean; workflows: StudioWorkflow[]; organizations: Array<{ id: string; name: string; users?: Array<{ id: string; name: string }> }>; canImport: boolean }
export type StudioAsset = { id: string; type: 'image' | 'video' | 'audio'; width: number | null; height: number | null; duration: number | null; available: boolean; temporary: boolean; expiresAt: string | null; url: string; downloadUrl: string }
export type StudioGeneration = {
  id: string; workflowKey: string | null; workflowName: string; status: string; error: string | null; prompt: string; orgId: string | null; organizationName: string | null
  ownerName: string | null; source: 'app' | 'import'; reviewStatus: 'approved' | 'pending'; createdAt: string; completedAt: string | null; assets: StudioAsset[]; runId?: string | null
}

export const STATUS_TONE: Record<WebsiteStatus, Tone> = { new: 'brand', pending_review: 'info', assigned: 'violet', in_progress: 'info', ready_for_review: 'warning', delivered: 'success', revision_requested: 'warning', cancelled: 'neutral' }
export const STATUS_LABEL: Record<WebsiteStatus, string> = { new: 'Nouvelle', pending_review: 'En cours d’examen', assigned: 'Assignée', in_progress: 'En cours', ready_for_review: 'Prête pour validation', delivered: 'Livrée', revision_requested: 'Modification demandée', cancelled: 'Annulée' }
export const GENERATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  submitting: { label: 'Envoi en cours', tone: 'info' },
  running: { label: 'Génération en cours', tone: 'info' },
  completed: { label: 'Terminée', tone: 'success' },
  completed_with_errors: { label: 'Terminée avec erreurs', tone: 'warning' },
  failed: { label: 'Échec', tone: 'danger' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  interrupted: { label: 'Interrompue', tone: 'warning' },
}

export const postJson = <T,>(path: string, body: unknown, method = 'POST') => apiRequest<T>(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const newKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/** Réduit une photo trop lourde dans le navigateur ; le serveur revérifie le contenu réel du fichier. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!ALLOWED.includes(file.type)) throw new ApiError('Format non pris en charge : JPG, PNG ou WebP uniquement.')
  if (file.size <= MAX_BYTES) return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new ApiError('Cette image est illisible.')
  for (const side of [2400, 1800, 1400]) {
    const ratio = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio)
    canvas.height = Math.round(bitmap.height * ratio)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (blob && blob.size <= MAX_BYTES) return blob
  }
  throw new ApiError('Image trop lourde, même après réduction (4 Mo maximum).')
}

export async function uploadImage<T>(path: string, file: File): Promise<T> {
  const body = await prepareImage(file)
  const separator = path.includes('?') ? '&' : '?'
  return apiRequest<T>(`${path}${separator}name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'content-type': body.type || 'application/octet-stream' }, body })
}

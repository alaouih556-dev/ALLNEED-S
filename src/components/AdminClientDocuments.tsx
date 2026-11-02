import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { useDocuments } from '@/lib/documents'

/**
 * Gestion des documents d'une entreprise côté Admin : liste, ajout / rattachement,
 * auteur et date, visibilité client, téléchargement et suppression.
 */
export function AdminClientDocuments({ orgId }: { orgId: string }) {
  const { loading, error, refresh } = useDocuments(orgId, true)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setLocalError(error)
  }, [error])

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-950">Documents de l’entreprise</h3>
          <p className="mt-0.5 text-xs text-ink-500">Ajoutés par ALLNEEDS ou le concierge affecté. Rendez-les visibles au client.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCcw size={13} />
          Actualiser
        </Button>
      </div>
      {localError ? (
        <Alert tone="danger" className="mb-3">
          {localError}
        </Alert>
      ) : null}
      <DocumentsPanel orgId={orgId} variant="staff" />
    </div>
  )
}
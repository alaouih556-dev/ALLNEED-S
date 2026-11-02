import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ConciergeGuard, ConciergeHeading, ScopedEmpty } from '@/features/concierge/ScopedSection'
import { Select } from '@/components/ui'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { useDocuments } from '@/lib/documents'

export const Route = createFileRoute('/concierge/documents')({ component: ConciergeDocuments })

type ScopeOrg = { id: string; name: string }

function ConciergeDocuments() {
  const [orgs, setOrgs] = useState<ScopeOrg[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const { documents, loading } = useDocuments(orgId || undefined, true)

  useEffect(() => {
    let alive = true
    fetch('/api/concierge/orgs', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json())
      .then((rows: ScopeOrg[]) => {
        if (!alive) return
        setOrgs(rows)
      })
      .catch(() => {
        /* portefeuille vide par défaut */
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <ConciergeGuard>
      <ConciergeHeading
        eyebrow="Documents"
        title="Documents du portefeuille"
        description="Pièces disponibles pour vos entreprises, uniquement celles qui vous sont affectées."
      />
      <div className="mt-8">
        {orgs.length > 1 ? (
          <div className="mb-4 max-w-xs">
            <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Toutes mes entreprises</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {orgs.length === 0 && !loading && documents.length === 0 ? (
          <ScopedEmpty title="Aucune entreprise affectée" description="Les documents apparaîtront ici dès qu’au moins une entreprise vous sera attribuée." />
        ) : (
          <DocumentsPanel orgId={orgId || null} variant="staff" />
        )}
      </div>
    </ConciergeGuard>
  )
}
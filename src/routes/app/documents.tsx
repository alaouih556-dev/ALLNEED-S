import { createFileRoute } from '@tanstack/react-router'
import { FolderOpen } from 'lucide-react'
import { useDemo } from '@/store/store'
import { PageHeader } from '@/components/layouts'
import { Alert, Card } from '@/components/ui'
import { JourneyProgress } from '@/components/JourneyProgress'
import { DocumentsChecklist } from '@/features/parcours/DocumentsChecklist'
import { ConciergeRequest } from '@/features/parcours/ConciergeRequest'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { useParcours, parcoursCurrentStep } from '@/lib/parcours'
import { useDiagnosticRecord } from '@/features/parcours/useDiagnosticRecord'
import { useDocuments } from '@/lib/documents'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'

export const Route = createFileRoute('/app/documents')({
  component: DocumentsPage,
  head: () => ({ meta: [{ title: 'Mes documents — ALLNEEDS' }] }),
})

function DocumentsPage() {
  const { state, orgId: fallbackOrgId } = useDemo()
  const { orgId, orgName, email, sector } = useOrgContext()
  const effectiveOrgId = orgId || fallbackOrgId
  const { parcours, patch } = useParcours(effectiveOrgId)
  const { primary, ensure, patchRecord } = useDiagnosticRecord(effectiveOrgId || null)
  const { documents } = useDocuments(effectiveOrgId, true)

  const pending = documents.filter((d) => d.status === 'demande')

  const step = parcoursCurrentStep({
    sector: sector ?? parcours.sector,
    submittedAt: parcours.submittedAt,
    conciergeRequestedAt: parcours.conciergeRequestedAt ?? primary?.conciergeRequestedAt ?? null,
    rendezVousAt: parcours.rendezVousAt,
    restoredAt: parcours.restoredAt,
    offerChosenAt: parcours.offerChosenAt,
    subscriptionActive: state.subscription.status === 'actif',
  })

  async function sendConciergeRequest(payload: import('@/features/parcours/useDiagnosticRecord').ConciergeRequestPayload) {
    const record = await ensure({ sector: sector ?? undefined })
    const saved = await patchRecord(record.id, { conciergeRequest: payload })
    patch({
      diagnosticId: saved.id,
      submittedAt: parcours.submittedAt ?? saved.createdAt,
      conciergeRequestedAt: saved.conciergeRequestedAt ?? new Date().toISOString(),
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="Dossier"
        title="Mes documents"
        description="Contrats, devis signés, factures, autorisations parentales ou réglementaires. Tout est centralisé et tracé."
      />

      <JourneyProgress current={step} className="mb-6" />

      {pending.length > 0 ? (
        <Alert tone="warning" className="mb-6" title={`${pending.length} document(s) attendu(s)`}>
          Un document marqué « Manquant » est demandé par votre équipe ALLNEEDS. Déposez-le ci-dessous pour ne pas
          bloquer les étapes suivantes de votre accompagnement.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <DocumentsPanel orgId={effectiveOrgId} variant="client" />

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-brand-700" />
              <p className="text-sm font-semibold text-ink-950">Confiance et confidentialité</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-600">
              <li>• Vos documents sont accessibles à l’équipe ALLNEEDS assignée à votre établissement.</li>
              <li>• Aucune donnée n’est revendue, ni transmise à des tiers hors prestataires concernés.</li>
              <li>• Les autorisations sensibles sont purgées à la fin de la mission, sur demande.</li>
            </ul>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-950">Ce que nous demandons</p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-600">
              <li>• Établissement : statuts ou attestation d’existence, registre administratif.</li>
              <li>• Mineurs : autorisation parentale écrite et attestations de scolarité à jour.</li>
              <li>• Prestataires : attestation d’assurance, RIB ou coordonnées bancaires vérifiées.</li>
            </ul>
          </Card>
        </div>
      </div>

      {sector ? (
        <DocumentsChecklist
          sector={sector}
          currentStep={step}
          checked={parcours.documentsChecked}
          onToggle={(id) =>
            patch({
              documentsChecked: parcours.documentsChecked.includes(id)
                ? parcours.documentsChecked.filter((item) => item !== id)
                : [...parcours.documentsChecked, id],
            })
          }
        />
      ) : null}

      {sector ? (
        <ConciergeRequest
          sector={sector}
          currentStep={step}
          defaultEmail={email}
          defaultCompany={orgName}
          alreadyRequested={Boolean(parcours.conciergeRequestedAt || primary?.conciergeRequestedAt)}
          onSubmit={sendConciergeRequest}
        />
      ) : (
        <Alert tone="info" title="Choisissez votre secteur">
          Sélectionnez d’abord votre secteur depuis le diagnostic pour préparer la demande concierge.
        </Alert>
      )}
    </>
  )
}
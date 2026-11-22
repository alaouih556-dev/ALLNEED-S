import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'
import { ConciergeHeading } from '@/features/account-manager/ScopedSection'
import { DiagnosticRecordWorkspace } from '@/features/parcours/DiagnosticAnalysis'

export const Route = createFileRoute('/account-manager/diagnostics/$id')({ component: ConciergeDiagnosticDetail })

function ConciergeDiagnosticDetail() {
  const { id } = Route.useParams()

  return (
    <div>
        <ConciergeHeading
          eyebrow="Analyse du diagnostic"
          title="Vérifier, prioriser, restituer"
          description="Lisez les réponses du client, consignez votre note interne, puis préparez une restitution à valider avec le dirigeant."
          actions={<Link to="/account-manager/diagnostics"><Button size="sm" variant="outline"><ArrowLeft size={14} />Diagnostics</Button></Link>}
        />
        <DiagnosticRecordWorkspace id={id} orgsUrl="/api/account-manager/orgs" backTo="/account-manager/diagnostics" />
    </div>
  )
}

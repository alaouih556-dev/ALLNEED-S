import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'
import { ConciergeHeading } from '@/features/concierge/ScopedSection'
import { DiagnosticRecordWorkspace } from '@/features/parcours/DiagnosticAnalysis'

export const Route = createFileRoute('/concierge/diagnostics/$id')({ component: ConciergeDiagnosticDetail })

function ConciergeDiagnosticDetail() {
  const { id } = Route.useParams()

  return (
    <div>
        <ConciergeHeading
          eyebrow="Analyse du diagnostic"
          title="Vérifier, prioriser, restituer"
          description="Lisez les réponses du client, consignez votre note interne, puis préparez une restitution à valider avec le dirigeant."
          actions={<Link to="/concierge/diagnostics"><Button size="sm" variant="outline"><ArrowLeft size={14} />Diagnostics</Button></Link>}
        />
        <DiagnosticRecordWorkspace id={id} orgsUrl="/api/concierge/orgs" backTo="/concierge/diagnostics" />
    </div>
  )
}

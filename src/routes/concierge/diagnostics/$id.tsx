import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ConciergeHeading } from '@/features/concierge/ScopedSection'
import { DiagnosticRecordWorkspace } from '@/features/parcours/DiagnosticAnalysis'

export const Route = createFileRoute('/concierge/diagnostics/$id')({ component: ConciergeDiagnosticDetail })

function ConciergeDiagnosticDetail() {
  const { id } = Route.useParams()

  return (
    <div className="mx-auto max-w-[1500px] px-6">
        <Link
          to="/concierge/diagnostics"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Diagnostics à analyser
        </Link>
        <ConciergeHeading
          eyebrow="Analyse du diagnostic"
          title="Vérifier, prioriser, restituer"
          description="Lisez les réponses côté client, consignez votre note interne, puis préparez une restitution à valider avec le dirigeant."
        />
        <div className="mt-8">
          <DiagnosticRecordWorkspace id={id} orgsUrl="/api/concierge/orgs" backTo="/concierge/diagnostics" />
        </div>
    </div>
  )
}

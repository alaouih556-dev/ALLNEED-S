import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { DiagnosticRecordWorkspace } from '@/features/parcours/DiagnosticAnalysis'

export const Route = createFileRoute('/admin/diagnostics/$id')({
  component: AdminDiagnosticDetail,
  head: () => ({ meta: [{ title: 'Analyse d’un diagnostic — ALLNEEDS' }] }),
})

function AdminDiagnosticDetail() {
  const { id } = Route.useParams()

  return (
    <div>
      <Link to="/admin/diagnostics/reel" className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-ink-600 transition hover:bg-white hover:text-ink-950">
        <ArrowLeft className="h-4 w-4" />
        Retour aux diagnostics
      </Link>
      <PageHeader eyebrow="Diagnostic" title="Analyse et restitution" description="Lisez les réponses, ajoutez vos notes internes, puis publiez la restitution pour le client." />
      <DiagnosticRecordWorkspace id={id} orgsUrl="/api/admin/orgs" backTo="/admin/diagnostics/reel" />
    </div>
  )
}
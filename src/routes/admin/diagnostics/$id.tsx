import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { DiagnosticRecordWorkspace } from '@/features/parcours/DiagnosticAnalysis'

export const Route = createFileRoute('/admin/diagnostics/$id')({
  component: AdminDiagnosticDetail,
  head: () => ({ meta: [{ title: 'Analyse d’un diagnostic — ALLNEEDS' }] }),
})

function AdminDiagnosticDetail() {
  const { id } = Route.useParams()

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8">
      <Link
        to="/admin/diagnostics/reel"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Diagnostics clients
      </Link>
      <p className="eyebrow">Accès complet équipe</p>
      <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">Lecture, notes internes et restitution</h1>
      <div className="mt-6">
        <DiagnosticRecordWorkspace id={id} orgsUrl="/api/admin/orgs" backTo="/admin/diagnostics/reel" />
      </div>
    </div>
  )
}
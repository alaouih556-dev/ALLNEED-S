import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, FileSearch, RefreshCw } from 'lucide-react'
import { useSubmittedDiagnostics, type DiagnosticRecord } from '@/features/parcours/useDiagnosticRecord'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { diagnosticStaffStatusLabel } from '@/lib/diagnostic-status'
import { Alert, Badge, Button, Card } from '@/components/ui'

export const Route = createFileRoute('/admin/diagnostics/reel')({
  component: AdminRealDiagnostics,
  head: () => ({ meta: [{ title: 'Diagnostics clients — ALLNEEDS' }] }),
})

function sectorKey(sector?: string): SectorKey {
  return sector === 'sante' || sector === 'enseignement' || sector === 'tourisme' ? sector : 'sante'
}

function companyName(record: DiagnosticRecord) {
  return record.conciergeRequest?.company || record.orgName || record.orgId
}

function contactLine(record: DiagnosticRecord) {
  const request = record.conciergeRequest
  return [request?.contact, request?.city, request?.phone].filter(Boolean).join(' · ')
}

function AdminRealDiagnostics() {
  const { records, loading, error, refresh } = useSubmittedDiagnostics()
  const toAnalyse = records.filter((item) => item.status !== 'restitue')
  const published = records.filter((item) => item.status === 'restitue')

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <p className="eyebrow">Diagnostics des clients, accès complet</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink-950">Relecture, notes internes et restitutions</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
        Ouvrir un diagnostic pour lire les réponses et les notes internes, préparer le commentaire pour le client,
        publier ou masquer une restitution. Les pages « Diagnostics internes » et « Diagnostics à relire » restent
        les anciens outils de démonstration.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            <FileSearch className="h-4 w-4" /> À analyser
          </p>
          <p className="mt-3 font-display text-3xl font-bold text-ink-950">{toAnalyse.length}</p>
          <p className="mt-1 text-sm text-ink-500">Soumis, en attente de lecture.</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            <BadgeCheck className="h-4 w-4" /> Validés
          </p>
          <p className="mt-3 font-display text-3xl font-bold text-ink-950">{published.length}</p>
          <p className="mt-1 text-sm text-ink-500">Restitutions publiées.</p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
            <ClipboardList className="h-4 w-4" /> Total
          </p>
          <p className="mt-3 font-display text-3xl font-bold text-ink-950">{records.length}</p>
          <p className="mt-1 text-sm text-ink-500">Diagnostics de tous les clients.</p>
        </Card>
      </div>

      {error ? (
        <Alert tone="warning" title="Diagnostics indisponibles" className="mt-6">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Réessayer
            </Button>
          </div>
        </Alert>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-950">À analyser</h2>
        {!loading && toAnalyse.length === 0 ? (
          <Card className="mt-4 p-6 text-center">
            <p className="text-sm text-ink-500">Aucun diagnostic en attente.</p>
          </Card>
        ) : null}
        <div className="mt-4 space-y-4">
          {toAnalyse.map((record) => {
            const sector = sectorKey(record.sector)
            return (
              <Card key={record.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-ink-950">{companyName(record)}</h3>
                      <Badge tone={record.status === 'soumis' ? 'info' : 'warning'}>
                        {diagnosticStaffStatusLabel(record.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {contactLine(record) ? `${contactLine(record)} · ` : ''}
                      {PACKS[sector].label} · {record.format} · envoyé le{' '}
                      {new Date(record.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Link to="/admin/diagnostics/$id" params={{ id: record.id }}>
                    <Button>
                      Analyser <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-950">Restitutions validées</h2>
        {!loading && published.length === 0 ? (
          <Card className="mt-4 p-6 text-center">
            <p className="text-sm text-ink-500">Aucune restitution publiée pour l’instant.</p>
          </Card>
        ) : null}
        <div className="mt-4 space-y-4">
          {published.map((record) => {
            const sector = sectorKey(record.sector)
            return (
              <Card key={record.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-ink-950">{companyName(record)}</h3>
                      <Badge tone="success">Validé</Badge>
                      {record.restitutionVisible === false ? <Badge tone="neutral">Masquée au client</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {contactLine(record) ? `${contactLine(record)} · ` : ''}
                      {PACKS[sector].label} ·{' '}
                      {record.publishedAt
                        ? `publiée le ${new Date(record.publishedAt).toLocaleDateString('fr-FR')}`
                        : 'publiée'}
                    </p>
                  </div>
                  <Link to="/admin/diagnostics/$id" params={{ id: record.id }}>
                    <Button variant="outline">
                      Voir la restitution <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
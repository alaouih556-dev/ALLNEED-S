import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, FileSearch, RefreshCw } from 'lucide-react'
import { ConciergeHeading, ScopedEmpty } from '@/features/concierge/ScopedSection'
import { useSubmittedDiagnostics } from '@/features/parcours/useDiagnosticRecord'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { diagnosticStaffStatusLabel } from '@/lib/diagnostic-status'
import { Alert, Badge, Button, Card } from '@/components/ui'

export const Route = createFileRoute('/concierge/diagnostics/')({ component: ConciergeDiagnostics })

function sectorKey(sector?: string): SectorKey {
  return sector === 'sante' || sector === 'enseignement' || sector === 'tourisme' ? sector : 'sante'
}

function companyName(record: { orgId: string; orgName?: string; conciergeRequest?: { company?: string } | null }) {
  return record.conciergeRequest?.company || record.orgName || record.orgId
}

function contactLine(record: { conciergeRequest?: { contact?: string; phone?: string; city?: string } | null }) {
  const request = record.conciergeRequest
  return [request?.contact, request?.city, request?.phone].filter(Boolean).join(' · ')
}

function ConciergeDiagnostics() {
  const { records, loading, error, refresh } = useSubmittedDiagnostics()
  const navigate = useNavigate()
  const toAnalyse = records.filter((item) => item.status !== 'restitue')
  const published = records.filter((item) => item.status === 'restitue')

  return (
    <div className="mx-auto max-w-7xl px-6">
        <ConciergeHeading
          eyebrow="La base du diagnostic"
          title="Comprendre. Prioriser. Restituer. Faire avancer."
          description="Chaque diagnostic envoyé par un client attend une lecture, un commentaire pour le client et des priorités validées. Rien n’est publié automatiquement."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              <FileSearch className="h-4 w-4" />
              À analyser
            </p>
            <p className="mt-3 font-display text-3xl font-bold text-ink-950">{toAnalyse.length}</p>
            <p className="mt-1 text-sm text-ink-500">Diagnostics soumis, à lire et restituer.</p>
          </Card>
          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
              Validés
            </p>
            <p className="mt-3 font-display text-3xl font-bold text-ink-950">{published.length}</p>
            <p className="mt-1 text-sm text-ink-500">Restitutions publiées au client.</p>
          </Card>
          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
              <ClipboardList className="h-4 w-4" />
              Total
            </p>
            <p className="mt-3 font-display text-3xl font-bold text-ink-950">{records.length}</p>
            <p className="mt-1 text-sm text-ink-500">Diagnostics du portefeuille.</p>
          </Card>
        </div>

        {error ? (
          <Alert tone="warning" title="Diagnostics indisponibles" className="mt-6">
            {error} · Vérifiez que l’API est démarrée, puis rechargez.
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void refresh()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Réessayer
              </Button>
            </div>
          </Alert>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">En attente de votre lecture</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink-950">Diagnostics à analyser</h2>
            </div>
            {!loading ? <span className="text-sm text-ink-500">{toAnalyse.length} diagnostic(s)</span> : null}
          </div>

          {loading && !records.length ? (
            <Card className="mt-5 p-6">
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <RefreshCw className="h-4 w-4 animate-spin" /> Chargement des diagnostics…
              </p>
            </Card>
          ) : null}

          {!loading && toAnalyse.length === 0 ? (
            <div className="mt-5">
              <ScopedEmpty
                title="Aucun diagnostic en attente"
                description="Dès qu’un client soumet son questionnaire, il apparaît ici pour analyse."
              />
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {toAnalyse.map((record) => {
              const sector = sectorKey(record.sector)
              return (
                <div key={record.id} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => void navigate({ to: '/concierge/diagnostics/$id', params: { id: record.id } })}>
                  <Card className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-6">
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
                      <span>
                        <Button
                          tabIndex={-1}
                          onClick={(event) => {
                            event.stopPropagation()
                            void navigate({ to: '/concierge/diagnostics/$id', params: { id: record.id } })
                          }}
                        >
                          Analyser <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </span>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Validées et publiées au client</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink-950">Restitutions validées</h2>
            </div>
            <span className="text-sm text-ink-500">{published.length} restitution(s)</span>
          </div>

          {published.length === 0 ? (
            <div className="mt-5">
              <ScopedEmpty
                title="Aucune restitution validée"
                description="La restitution n’apparaît ici qu’après validation explicite par l’équipe."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {published.map((record) => {
                const sector = sectorKey(record.sector)
                return (
                  <Link key={record.id} to="/concierge/diagnostics/$id" params={{ id: record.id }} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Card className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-6">
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
                      <span>
                        <Button variant="outline" tabIndex={-1}>
                          Voir la restitution <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                      </span>
                    </div>
                  </Card></Link>
                )
              })}
            </div>
          )}
        </section>
    </div>
  )
}

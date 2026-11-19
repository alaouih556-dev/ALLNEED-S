import { isSectorActive } from '@/lib/active-sectors'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, EyeOff, FileSearch, RefreshCw } from 'lucide-react'
import { EmptyBox, HowItWorks, Initial, LoadingRows, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { ConciergeHeading } from '@/features/concierge/ScopedSection'
import { useSubmittedDiagnostics } from '@/features/parcours/useDiagnosticRecord'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { diagnosticStaffStatusLabel } from '@/lib/diagnostic-status'
import { Alert, Badge, Button } from '@/components/ui'

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
  const { records: allRecords, loading, error, refresh } = useSubmittedDiagnostics()
  const records = allRecords.filter((item) => !item.sector || isSectorActive(item.sector))
  const toAnalyse = records.filter((item) => item.status !== 'restitue')
  const published = records.filter((item) => item.status === 'restitue')

  return (
    <div>
      <ConciergeHeading
        eyebrow="Suivi"
        title="Diagnostics"
        description="Lisez les diagnostics envoyés par vos entreprises, préparez vos conclusions puis publiez la restitution. Rien n’est publié automatiquement."
        actions={<Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw size={14} />Actualiser</Button>}
      />

      <HowItWorks steps={['Le client envoie son diagnostic', 'Vous l’analysez', 'Vous publiez la restitution']} />

      <StatGrid>
        <MiniStat icon={<FileSearch size={18} />} tone="amber" label="À analyser" value={loading ? '–' : toAnalyse.length} hint="À lire puis restituer" />
        <MiniStat icon={<BadgeCheck size={18} />} tone="emerald" label="Restitutions publiées" value={loading ? '–' : published.length} hint="Visibles par le client" />
        <MiniStat icon={<ClipboardList size={18} />} tone="indigo" label="Total" value={loading ? '–' : records.length} hint="Diagnostics du portefeuille" />
        <MiniStat icon={<EyeOff size={18} />} tone="slate" label="Masquées au client" value={loading ? '–' : published.filter((r) => r.restitutionVisible === false).length} />
      </StatGrid>

      {error ? (
        <Alert tone="warning" title="Diagnostics indisponibles" className="mb-5">
          {error} · Vérifiez que l’API est démarrée, puis rechargez.
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="À analyser" description="Diagnostics soumis, en attente de votre lecture." action={<Badge tone={toAnalyse.length ? 'warning' : 'success'}>{toAnalyse.length}</Badge>}>
          {loading && !records.length ? <LoadingRows /> : null}
          {!loading && !toAnalyse.length ? <EmptyBox icon={<FileSearch size={20} />} title="Aucun diagnostic en attente" text="Dès qu’un client soumet son questionnaire, il apparaît ici pour analyse." /> : null}
          <Rows>
            {toAnalyse.map((record) => (
              <li key={record.id}>
                <Link to="/concierge/diagnostics/$id" params={{ id: record.id }} className="cg-org-row">
                  <Initial name={companyName(record)} tone="amber" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-950">{companyName(record)}</span>
                    <span className="block truncate text-xs text-ink-500">{contactLine(record) ? `${contactLine(record)} · ` : ''}{PACKS[sectorKey(record.sector)].label} · envoyé le {new Date(record.createdAt).toLocaleDateString('fr-FR')}</span>
                  </span>
                  <Badge tone={record.status === 'soumis' ? 'info' : 'warning'}>{diagnosticStaffStatusLabel(record.status)}</Badge>
                  <span className="cg-task-cta">Analyser<ArrowRight size={14} /></span>
                </Link>
              </li>
            ))}
          </Rows>
        </Panel>

        <Panel title="Restitutions publiées" description="Validées par l’équipe et visibles dans l’espace client." action={<Badge tone="success">{published.length}</Badge>}>
          {!loading && !published.length ? <EmptyBox icon={<BadgeCheck size={20} />} title="Aucune restitution publiée" text="Une restitution n’apparaît ici qu’après votre validation explicite." /> : null}
          <Rows>
            {published.map((record) => (
              <li key={record.id}>
                <Link to="/concierge/diagnostics/$id" params={{ id: record.id }} className="cg-org-row">
                  <Initial name={companyName(record)} tone="emerald" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-950">{companyName(record)}</span>
                    <span className="block truncate text-xs text-ink-500">{PACKS[sectorKey(record.sector)].label} · {record.publishedAt ? `publiée le ${new Date(record.publishedAt).toLocaleDateString('fr-FR')}` : 'publiée'}</span>
                  </span>
                  {record.restitutionVisible === false ? <Badge tone="neutral">Masquée au client</Badge> : <Badge tone="success">Publiée</Badge>}
                  <ArrowUpRight size={15} className="text-ink-300" />
                </Link>
              </li>
            ))}
          </Rows>
        </Panel>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, EyeOff, FileSearch, Gauge, RefreshCcw } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button } from '@/components/ui'
import { EmptyBox, HowItWorks, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, Segmented, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { useSubmittedDiagnostics, type DiagnosticRecord } from '@/features/parcours/useDiagnosticRecord'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { diagnosticStaffStatusLabel } from '@/lib/diagnostic-status'
import { isSectorActive } from '@/lib/active-sectors'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/diagnostics/reel')({
  component: AdminRealDiagnostics,
  head: () => ({ meta: [{ title: 'Diagnostics — ALLNEEDS' }] }),
})

function sectorKey(sector?: string): SectorKey {
  return sector === 'sante' || sector === 'enseignement' || sector === 'tourisme' ? sector : 'sante'
}
const companyName = (r: DiagnosticRecord) => r.conciergeRequest?.company || r.orgName || r.orgId
const contactLine = (r: DiagnosticRecord) => [r.conciergeRequest?.contact, r.conciergeRequest?.city, r.conciergeRequest?.phone].filter(Boolean).join(' · ')
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

type View = 'a_analyser' | 'restitues' | 'tous'

function AdminRealDiagnostics() {
  const { records: allRecords, loading, error, refresh } = useSubmittedDiagnostics()
  const records = allRecords.filter((item) => !item.sector || isSectorActive(item.sector))
  const [view, setView] = useState<View>('a_analyser')
  const [query, setQuery] = useState('')

  const toAnalyse = records.filter((r) => r.status !== 'restitue')
  const published = records.filter((r) => r.status === 'restitue')
  const visible = useMemo(
    () =>
      (view === 'a_analyser' ? toAnalyse : view === 'restitues' ? published : records)
        .filter((r) => matches(query, companyName(r), contactLine(r), r.format))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records.length, view, query, allRecords],
  )

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Diagnostics"
        description="Lisez les diagnostics envoyés par les clients, préparez vos conclusions et publiez la restitution."
        actions={<Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>}
      />

      <HowItWorks steps={['Le client envoie son diagnostic', 'Vous l’analysez', 'Vous publiez la restitution']} />

      <StatGrid>
        <MiniStat icon={<FileSearch size={18} />} tone="amber" label="À analyser" value={toAnalyse.length} active={view === 'a_analyser'} onClick={() => setView('a_analyser')} />
        <MiniStat icon={<BadgeCheck size={18} />} tone="emerald" label="Restitués" value={published.length} active={view === 'restitues'} onClick={() => setView('restitues')} />
        <MiniStat icon={<Gauge size={18} />} tone="indigo" label="Total" value={records.length} active={view === 'tous'} onClick={() => setView('tous')} />
        <MiniStat icon={<EyeOff size={18} />} tone="slate" label="Masqués au client" value={published.filter((r) => r.restitutionVisible === false).length} />
      </StatGrid>

      {error ? (
        <Alert tone="warning" title="Diagnostics indisponibles" className="mb-4">
          {error}
          <div className="mt-3"><Button size="sm" variant="outline" onClick={() => void refresh()}>Réessayer</Button></div>
        </Alert>
      ) : null}

      <Panel>
        <Toolbar>
          <Segmented value={view} onChange={setView} options={[{ value: 'a_analyser', label: 'À analyser', count: toAnalyse.length }, { value: 'restitues', label: 'Restitués', count: published.length }, { value: 'tous', label: 'Tous', count: records.length }]} />
          <SearchBox value={query} onChange={setQuery} placeholder="Entreprise, contact…" />
        </Toolbar>
        {loading ? <LoadingRows /> : null}
        {!loading && !visible.length ? <EmptyBox icon={<Gauge size={20} />} title={view === 'a_analyser' ? 'Aucun diagnostic à analyser' : 'Aucun diagnostic ici'} text={view === 'a_analyser' ? 'Les diagnostics envoyés par les clients apparaîtront ici.' : undefined} /> : null}
        <Rows>
          {visible.map((record) => {
            const done = record.status === 'restitue'
            return (
              <li key={record.id}>
                <Link to="/admin/diagnostics/$id" params={{ id: record.id }} className="grid gap-3 px-5 py-4 transition hover:bg-ink-50/70 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="flex min-w-0 gap-3">
                    <Initial name={companyName(record)} tone={done ? 'emerald' : 'amber'} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-ink-950">{companyName(record)}</p>
                        <Badge tone={done ? 'success' : record.status === 'soumis' ? 'info' : 'warning'}>{done ? 'Restitué' : diagnosticStaffStatusLabel(record.status)}</Badge>
                        {done && record.restitutionVisible === false ? <Badge tone="neutral">Masqué au client</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink-600">
                        {PACKS[sectorKey(record.sector)].label} · {record.format}
                        {contactLine(record) ? ` · ${contactLine(record)}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">{done ? `Publié le ${fmt(record.publishedAt)}` : `Envoyé le ${fmt(record.createdAt)}`}</p>
                    </div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1.5 justify-self-start rounded-xl px-3.5 py-2 text-sm font-semibold md:justify-self-end', done ? 'border border-ink-200 bg-white text-ink-800' : 'bg-indigo-600 text-white')}>
                    {done ? 'Voir' : 'Analyser'}<ArrowRight size={15} />
                  </span>
                </Link>
              </li>
            )
          })}
        </Rows>
      </Panel>
    </>
  )
}

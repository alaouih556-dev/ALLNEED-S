import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Briefcase, CalendarClock, CheckCircle2, ChevronDown, CircleAlert, Clock3, FileText, RefreshCcw, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Select } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, Segmented, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { useApiResource } from '@/lib/useApiResource'
import { MISSION_STATUS_META, MISSION_PRIORITY_LABELS, patchMission, type Mission, type MissionStatus } from '@/lib/accompagnement'
import { longDate, daysUntil } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/missions/')({
  component: AdminMissions,
  head: () => ({ meta: [{ title: 'Missions — ALLNEEDS' }] }),
})

type View = 'en_cours' | 'client' | 'retard' | 'terminees' | 'toutes'

function AdminMissions() {
  const { data, loading, error, refresh } = useApiResource<Mission[]>('/api/admin/missions')
  const { data: team } = useApiResource<{ concierges: Array<{ id: string; name: string }> }>('/api/admin/concierges')
  const [view, setView] = useState<View>('en_cours')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const missions = data ?? []
  const now = Date.now()
  const conciergeName = (id?: string | null) => (id ? team?.concierges?.find((c) => c.id === id)?.name ?? 'Concierge' : null)
  const isOpen = (m: Mission) => m.status !== 'terminee'
  const isLate = (m: Mission) => isOpen(m) && !!m.dueDate && daysUntil(m.dueDate, now) < 0
  const counts = {
    en_cours: missions.filter(isOpen).length,
    client: missions.filter((m) => m.status === 'a_valider_client').length,
    retard: missions.filter(isLate).length,
    terminees: missions.filter((m) => !isOpen(m)).length,
    toutes: missions.length,
  }

  const visible = useMemo(
    () =>
      missions
        .filter((m) => (view === 'en_cours' ? isOpen(m) : view === 'client' ? m.status === 'a_valider_client' : view === 'retard' ? isLate(m) : view === 'terminees' ? !isOpen(m) : true))
        .filter((m) => matches(query, m.title, m.orgName, m.offerCode)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missions, view, query],
  )

  async function changeStatus(mission: Mission, status: MissionStatus) {
    setBusy(mission.id)
    setActionError('')
    try {
      await patchMission(mission.id, { status })
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Mise à jour impossible.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Missions"
        description="Les missions créées quand une offre est acceptée. Suivez leur avancement et les échéances."
        actions={<>
          <Link to="/admin/offres"><Button variant="outline" size="sm">Voir les offres</Button></Link>
          <Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>
        </>}
      />

      <StatGrid>
        <MiniStat icon={<Briefcase size={18} />} tone="indigo" label="En cours" value={counts.en_cours} active={view === 'en_cours'} onClick={() => setView('en_cours')} />
        <MiniStat icon={<Clock3 size={18} />} tone="amber" label="En attente du client" value={counts.client} active={view === 'client'} onClick={() => setView('client')} />
        <MiniStat icon={<CircleAlert size={18} />} tone="rose" label="En retard" value={counts.retard} active={view === 'retard'} onClick={() => setView('retard')} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Terminées" value={counts.terminees} active={view === 'terminees'} onClick={() => setView('terminees')} />
      </StatGrid>

      {error ? <Alert tone="danger" title="Missions indisponibles" className="mb-4">{error}</Alert> : null}
      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      <Panel>
        <Toolbar>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'en_cours', label: 'En cours', count: counts.en_cours },
              { value: 'client', label: 'Attente client', count: counts.client },
              { value: 'retard', label: 'En retard', count: counts.retard },
              { value: 'terminees', label: 'Terminées', count: counts.terminees },
              { value: 'toutes', label: 'Toutes', count: counts.toutes },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Mission ou entreprise…" />
        </Toolbar>

        {loading ? <LoadingRows /> : null}
        {!loading && !visible.length ? <EmptyBox icon={<Briefcase size={20} />} title="Aucune mission ici" text={view === 'en_cours' ? 'Les missions apparaissent automatiquement quand une offre est acceptée.' : undefined} /> : null}

        <Rows>
          {visible.map((mission) => {
            const status = MISSION_STATUS_META[mission.status]
            const late = isLate(mission)
            const owner = conciergeName(mission.assignedConciergeId)
            return (
              <li key={mission.id}>
                <details className="group">
                  <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-ink-50/70 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 gap-3">
                      <Initial name={mission.orgName || 'M'} tone={late ? 'rose' : mission.status === 'terminee' ? 'emerald' : 'indigo'} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-ink-950">{mission.title}</p>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {late ? <Badge tone="danger">En retard</Badge> : null}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-ink-600">{mission.orgName || mission.orgId.slice(0, 8)} · offre {mission.offerCode} · priorité {MISSION_PRIORITY_LABELS[mission.priority] ?? mission.priority}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span className={cn('inline-flex items-center gap-1', late && 'font-semibold text-rose-600')}><CalendarClock size={13} />{mission.dueDate ? longDate(mission.dueDate) : 'Sans échéance'}</span>
                      <span className="inline-flex items-center gap-1"><UserRound size={13} />{owner ?? 'Non assignée'}</span>
                    </div>
                    <ChevronDown size={17} className="hidden text-ink-400 transition group-open:rotate-180 md:block" />
                  </summary>

                  <div className="space-y-3 border-t border-ink-100 bg-ink-50/50 px-5 py-4 md:pl-[4.25rem]">
                    {mission.contentStatus === 'a_valider' ? <Alert tone="warning">Le contenu de cette mission est encore à valider.</Alert> : null}
                    {mission.instructions ? <p className="text-sm text-ink-700"><b className="text-ink-900">Instructions : </b>{mission.instructions}</p> : null}
                    {mission.clientFeedback ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Retour du client : </b>{mission.clientFeedback}</p> : null}
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-500"><FileText size={13} />Livrables ({mission.deliverables.length})</p>
                      {mission.deliverables.length ? (
                        <ul className="grid gap-1.5 sm:grid-cols-2">{mission.deliverables.map((item) => <li key={item} className="flex gap-2 text-sm text-ink-700"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />{item}</li>)}</ul>
                      ) : <p className="text-sm text-ink-500">Aucun livrable pour l’instant.</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
                      {mission.status === 'a_valider_client' ? (
                        <span className="text-sm font-medium text-amber-700">En attente de la décision du client.</span>
                      ) : (
                        <>
                          <span className="text-sm text-ink-600">Changer le statut :</span>
                          <Select value={mission.status} disabled={busy === mission.id} onChange={(e) => void changeStatus(mission, e.target.value as MissionStatus)} className="w-52">
                            {([...new Set<MissionStatus>([mission.status, 'a_faire', 'en_cours', 'a_valider_client', ...(mission.status === 'validee_client' ? ['validee_client', 'terminee'] as MissionStatus[] : [])])]).map((value) => <option key={value} value={value}>{MISSION_STATUS_META[value].label}</option>)}
                          </Select>
                        </>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            )
          })}
        </Rows>
      </Panel>
    </>
  )
}

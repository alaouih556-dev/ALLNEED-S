import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Building2, CalendarClock, CheckCircle2, CircleAlert, ClipboardCheck, Clock3, ListTodo } from 'lucide-react'
import { LoadingRows, MiniStat, Panel, StatGrid } from '@/components/admin-kit'
import { ConciergeGuard, ConciergeHeading, ScopedEmpty } from '@/features/account-manager/ScopedSection'
import { Alert, Badge, Button, Card, Select } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import {
  MISSION_STATUS_META,
  MISSION_PRIORITY_LABELS,
  patchMission,
  type Mission,
  type MissionStatus,
} from '@/lib/accompagnement'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/account-manager/missions')({ component: ConciergeMissions })

type MissionFilter = 'actives' | 'a_faire' | 'en_cours' | 'a_valider_client' | 'terminee'

function ConciergeMissions() {
  const { data, loading, error, refresh } = useApiResource<Mission[]>('/api/account-manager/missions')

  return (
    <ConciergeGuard>
      <div className="space-y-5">
        <ConciergeHeading
          eyebrow="Suivi"
          title="Missions"
          description="Les missions des entreprises qui vous sont attribuées : statut, priorité, échéance et retours client."
          actions={<Link to={'/account-manager/rendez-vous' as any}><Button size="sm" variant="outline"><CalendarClock size={14} />Organiser un point client</Button></Link>}
        />
        {loading ? <Panel><LoadingRows /></Panel> : null}
        {error ? <Alert tone="danger" title="Missions indisponibles">{error}</Alert> : null}
        {!loading && !error ? <MissionsBoard missions={data ?? []} onRefresh={refresh} /> : null}
      </div>
    </ConciergeGuard>
  )
}

function MissionsBoard({ missions, onRefresh }: { missions: Mission[]; onRefresh: () => Promise<void> }) {
  const [filter, setFilter] = useState<MissionFilter>('actives')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const counts = useMemo(() => ({
    total: missions.length,
    a_faire: missions.filter((m) => m.status === 'a_faire').length,
    en_cours: missions.filter((m) => m.status === 'en_cours').length,
    a_valider_client: missions.filter((m) => m.status === 'a_valider_client').length,
    terminee: missions.filter((m) => m.status === 'terminee').length,
    attention: missions.filter((m) => m.status === 'a_valider_client').length,
  }), [missions])

  const visible = useMemo(
    () => missions.filter((m) => (filter === 'actives' ? m.status !== 'terminee' : m.status === filter)),
    [missions, filter],
  )

  async function changeStatus(mission: Mission, status: MissionStatus) {
    setBusy(mission.id)
    setActionError('')
    try {
      await patchMission(mission.id, { status })
      await onRefresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Mise à jour impossible.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <StatGrid>
        <MiniStat icon={<ClipboardCheck size={18} />} tone="indigo" label="Actives" value={counts.total - counts.terminee} hint={`${counts.total} au total`} active={filter === 'actives'} onClick={() => setFilter('actives')} />
        <MiniStat icon={<ListTodo size={18} />} tone="sky" label="À faire" value={counts.a_faire} active={filter === 'a_faire'} onClick={() => setFilter('a_faire')} />
        <MiniStat icon={<Clock3 size={18} />} tone="teal" label="En cours" value={counts.en_cours} active={filter === 'en_cours'} onClick={() => setFilter('en_cours')} />
        <MiniStat icon={<CircleAlert size={18} />} tone="amber" label="En attente client" value={counts.a_valider_client} hint="Décision du client attendue" active={filter === 'a_valider_client'} onClick={() => setFilter('a_valider_client')} />
      </StatGrid>
      <div className="mb-4 flex justify-end"><button type="button" className={`cg-filter-chip ${filter === 'terminee' ? 'is-active' : ''}`} onClick={() => setFilter(filter === 'terminee' ? 'actives' : 'terminee')}><CheckCircle2 size={14} />Terminées ({counts.terminee})</button></div>

      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      {visible.length === 0 ? <ScopedEmpty icon={<ClipboardCheck size={20} />} title="Aucune mission pour ce filtre" description="Les missions apparaissent ici dès qu’une entreprise de votre portefeuille accepte une offre." /> : null}

      <div className="concierge-mission-list">
        {visible.map((mission) => {
          const status = MISSION_STATUS_META[mission.status]
          return (
            <Card key={mission.id} className={`Account Manager-mission-card ${mission.status === 'a_valider_client' ? 'is-blocked' : ''}`}>
              <header>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500"><Building2 size={14} /> {mission.orgName || 'Entreprise'}</span>
                  <h3>{mission.title}</h3>
                  <small>{mission.offerCode} · {mission.description}</small>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </header>

              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">Priorité</p><p className="text-sm text-ink-900">{MISSION_PRIORITY_LABELS[mission.priority] ?? mission.priority}</p></div>
                <div><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">Échéance</p><p className="text-sm text-ink-900">{mission.dueDate ? longDate(mission.dueDate) : 'À définir'}</p></div>
                <div><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">Livrables</p><p className="text-sm text-ink-900">{mission.deliverables.length} élément(s)</p></div>
              </div>

              {mission.instructions ? (
                <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600"><strong className="text-ink-800">Instructions : </strong>{mission.instructions}</div>
              ) : null}
              {mission.instructionsResponse ? (
                <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800"><strong>Réponse client : </strong>{mission.instructionsResponse}</div>
              ) : null}
              {mission.clientFeedback ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><strong>Retour client : </strong>{mission.clientFeedback}</div>
              ) : null}

              <div className="concierge-mission-footer">
                <div className="flex flex-wrap items-center gap-2">
                  {mission.status === 'a_valider_client' ? <span className="text-xs font-semibold text-amber-700">Décision attendue du client · statut en lecture seule</span> : <><span className="text-xs text-ink-500">Statut opérationnel</span>
                  <Select
                    value={mission.status}
                    disabled={busy === mission.id}
                    onChange={(e) => void changeStatus(mission, e.target.value as MissionStatus)}
                    className="w-48"
                  >
                    {(['a_faire', 'en_cours', 'a_valider_client', ...(mission.status === 'validee_client' ? ['validee_client', 'terminee'] as MissionStatus[] : [])] as MissionStatus[]).map((value) => (
                      <option key={value} value={value}>{MISSION_STATUS_META[value].label}</option>
                    ))}
                  </Select></>}
                </div>
                <div>
                  <Link to={'/account-manager/entreprises/$id' as any} params={{ id: mission.orgId } as any}><Button size="sm" variant="outline">Ouvrir le suivi client</Button></Link>
                </div>
              </div>

              {mission.deliverables.length ? (
                <details className="concierge-mission-details">
                  <summary>Voir les livrables <span>{mission.deliverables.length} éléments</span></summary>
                  <div>
                    {mission.deliverables.map((item) => (
                      <article key={item}><strong>{item}</strong></article>
                    ))}
                  </div>
                </details>
              ) : null}
            </Card>
          )
        })}
      </div>
    </>
  )
}

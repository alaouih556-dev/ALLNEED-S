import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, CalendarClock, CircleAlert, ClipboardCheck, Clock3 } from 'lucide-react'
import { ConciergeGuard, ConciergeHeading, ScopedEmpty } from '@/features/concierge/ScopedSection'
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

export const Route = createFileRoute('/concierge/missions')({ component: ConciergeMissions })

type MissionFilter = 'actives' | 'a_faire' | 'en_cours' | 'a_valider_client' | 'terminee'

function ConciergeMissions() {
  const { data, loading, error, refresh } = useApiResource<Mission[]>('/api/concierge/missions')

  return (
    <ConciergeGuard>
      <div className="space-y-5">
        <ConciergeHeading
          eyebrow="Tenir l’engagement client"
          title="Chaque mission doit aboutir à un résultat suivi."
          description="Suivez les missions des entreprises qui vous sont attribuées : statut, priorité, échéance et retours client."
        />
        {loading ? <p className="text-sm text-ink-500">Chargement des missions…</p> : null}
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
      <section className="concierge-mission-stats">
        <article><ClipboardCheck size={17} /><strong>{counts.total}</strong><span>mission{counts.total === 1 ? '' : 's'} au total</span></article>
        <article><Clock3 size={17} /><strong>{counts.en_cours}</strong><span>en cours</span></article>
        <article className={counts.attention ? 'has-alert' : ''}><CircleAlert size={17} /><strong>{counts.attention}</strong><span>en attente client</span></article>
        <Link to={'/concierge/rendez-vous' as any}><CalendarClock size={17} /> Organiser un point client <ArrowRight size={14} /></Link>
      </section>

      <div className="concierge-mission-toolbar">
        <div><small>VOTRE FILE DE COORDINATION</small><h2>Ce qui demande votre attention</h2></div>
        <div>
          {([
            ['actives', `Actives (${counts.total - counts.terminee})`],
            ['a_faire', `À faire (${counts.a_faire})`],
            ['en_cours', `En cours (${counts.en_cours})`],
            ['a_valider_client', `Attente client (${counts.a_valider_client})`],
            ['terminee', `Terminées (${counts.terminee})`],
          ] as const).map(([key, label]) => (
            <button type="button" key={key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      {visible.length === 0 ? <ScopedEmpty title="Aucune mission pour ce filtre" description="Les missions apparaissent ici dès qu’une entreprise de votre portefeuille accepte une offre." /> : null}

      <div className="concierge-mission-list">
        {visible.map((mission) => {
          const status = MISSION_STATUS_META[mission.status]
          return (
            <Card key={mission.id} className={`concierge-mission-card ${mission.status === 'a_valider_client' ? 'is-blocked' : ''}`}>
              <header>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500"><Building2 size={14} /> {mission.orgName || mission.orgId.slice(0, 8)}</span>
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
                  <Link to={'/concierge/entreprises/$id' as any} params={{ id: mission.orgId } as any}><Button size="sm" variant="outline">Ouvrir le suivi client</Button></Link>
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

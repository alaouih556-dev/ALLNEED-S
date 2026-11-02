import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Boxes, CircleAlert, Clock3, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, CardBody, CardHeader, Select, Stat, Tabs } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import { MISSION_STATUS_META, MISSION_PRIORITY_LABELS, patchMission, type Mission, type MissionStatus } from '@/lib/accompagnement'
import { longDate, daysUntil } from '@/lib/format'

export const Route = createFileRoute('/admin/missions/')({
  component: AdminMissions,
  head: () => ({ meta: [{ title: 'Missions — ALLNEEDS' }] }),
})

export function AdminMissions() {
  const { data, loading, error, refresh } = useApiResource<Mission[]>('/api/admin/missions')
  const [filter, setFilter] = useState('ouvertes')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const missions = data ?? []
  const now = Date.now()
  const open = missions.filter((m) => m.status !== 'terminee')
  const late = open.filter((m) => m.dueDate && m.status !== 'terminee' && daysUntil(m.dueDate, now) < 0)
  const awaiting = missions.filter((m) => m.status === 'a_valider_client')
  const contracted = open.reduce((sum, m) => sum + (Number(m.offerCode === 'PERFORMANCE' ? 10945 : m.offerCode === 'PRO' ? 6445 : 3445) || 0), 0)
  const visible = useMemo(
    () => missions.filter((m) => (filter === 'toutes' ? true : filter === 'ouvertes' ? m.status !== 'terminee' : m.status === 'terminee')),
    [missions, filter],
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
        eyebrow="Production · valeur livrée"
        title="Pilotage des missions"
        description="Supervision globale de toutes les missions du parc : statut, entreprise, offre, priorité et échéance."
        actions={<Link to="/admin/offres"><Button variant="outline"><Boxes className="h-4 w-4" /> Offres acceptées</Button></Link>}
      />

      {loading ? <p className="text-sm text-ink-500">Chargement des missions…</p> : null}
      {error ? <Alert tone="danger" title="Missions indisponibles">{error}</Alert> : null}
      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      {!loading && !error ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Missions à piloter" value={open.length} hint={`${late.length} en retard`} tone={late.length ? 'warning' : 'brand'} />
            <Stat label="En attente client" value={awaiting.length} hint="Réponse client requise" tone={awaiting.length ? 'warning' : 'success'} icon={<Clock3 size={16} />} />
            <Stat label="Missions terminées" value={missions.length - open.length} hint="Clôturées" tone="success" />
            <Stat label="Offres acceptées" value={new Set(open.map((m) => m.offerRecordId).filter(Boolean)).size} hint="Périmètre accompagnement" tone="info" icon={<ShieldCheck size={16} />} />
          </div>

          <div className="mb-5">
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'ouvertes', label: 'En cours', count: open.length },
                { value: 'terminee', label: 'Terminées', count: missions.length - open.length },
                { value: 'toutes', label: 'Toutes', count: missions.length },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <Card className="p-8 text-center"><p className="font-semibold text-ink-900">Aucune mission dans cette vue.</p></Card>
          ) : (
            <div className="space-y-5">
              {visible.map((mission) => {
                const status = MISSION_STATUS_META[mission.status]
                const overdue = mission.dueDate && mission.status !== 'terminee' && daysUntil(mission.dueDate, now) < 0
                return (
                  <Card key={mission.id} className="overflow-hidden">
                    <CardHeader
                      title={mission.title}
                      description={`${mission.orgName || mission.orgId.slice(0, 8)} · offre ${mission.offerCode} · priorité ${MISSION_PRIORITY_LABELS[mission.priority] ?? mission.priority}`}
                      action={<Badge tone={status.tone}>{status.label}</Badge>}
                    />
                    <CardBody className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">Échéance</p><p className={`text-sm ${overdue ? 'font-semibold text-red-700' : 'text-ink-900'}`}>{mission.dueDate ? `${longDate(mission.dueDate)}${overdue ? ' · en retard' : ''}` : 'À définir'}</p></div>
                        <div><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">Livrables</p><p className="text-sm text-ink-900">{mission.deliverables.length} élément(s)</p></div>
                        <div><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">Concierge assigné</p><p className="text-sm text-ink-900">{mission.assignedConciergeId || 'Non assigné'}</p></div>
                      </div>

                      {mission.contentStatus === 'a_valider' ? <Alert tone="warning">Contenu de mission à valider.</Alert> : null}
                      {mission.instructions ? <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600"><strong className="text-ink-800">Instructions : </strong>{mission.instructions}</div> : null}
                      {mission.clientFeedback ? <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><strong>Retour client : </strong>{mission.clientFeedback}</div> : null}

                      {mission.deliverables.length ? (
                        <ul className="grid gap-1.5 sm:grid-cols-2">
                          {mission.deliverables.map((item) => (<li key={item} className="text-xs text-ink-600">— {item}</li>))}
                        </ul>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
                        {mission.status === 'a_valider_client' ? <span className="text-xs font-semibold text-amber-700">Décision attendue du client · statut en lecture seule</span> : <><span className="text-xs text-ink-500">Statut opérationnel</span><Select value={mission.status} disabled={busy === mission.id} onChange={(e) => void changeStatus(mission, e.target.value as MissionStatus)} className="w-48">{(['a_faire', 'en_cours', 'a_valider_client', ...(mission.status === 'validee_client' ? ['validee_client', 'terminee'] as MissionStatus[] : [])] as MissionStatus[]).map((value) => (<option key={value} value={value}>{MISSION_STATUS_META[value].label}</option>))}</Select></>}
                        {overdue ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700"><CircleAlert size={14} /> En retard de {Math.abs(daysUntil(mission.dueDate as string, now))} j</span> : null}
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </>
  )
}

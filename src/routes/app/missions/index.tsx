import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Briefcase, CircleAlert, Clock, Flag, Lock, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, EmptyState, Progress } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import { MISSION_STATUS_META, MISSION_PRIORITY_LABELS, formatOfferPrice, type Mission, type OfferRecord } from '@/lib/accompagnement'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/app/missions/')({
  component: MissionsPage,
  head: () => ({ meta: [{ title: 'Mes missions — ALLNEEDS' }] }),
})

function progressOf(missions: Array<{ status: Mission['status'] }>): number {
  if (!missions.length) return 0
  const done = missions.filter((mission) => mission.status === 'terminee').length
  return Math.round((done / missions.length) * 100)
}

function MissionsPage() {
  const { data, loading, error, code } = useApiResource<{ offer: OfferRecord; missions: Mission[] }>('/api/missions')

  if (loading) return <PageHeader eyebrow="Missions" title="Chargement de vos missions…" />

  if (code === 'OFFER_REQUIRED') {
    return (
      <>
        <PageHeader eyebrow="Missions" title="Vos missions démarrent après la validation d’une offre" />
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Lock className="h-6 w-6" /></span>
          <h2 className="mt-5 font-display text-2xl font-bold text-ink-950">Une offre d’accompagnement doit être active</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            Après votre choix, ALLNEEDS valide la demande. Les missions ne sont créées qu’une fois l’offre activée.
          </p>
          <div className="mt-7 flex justify-center">
            <Link to="/app/offres"><Button size="lg">Voir les offres d’accompagnement <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </Card>
      </>
    )
  }

  if (error) return <Alert tone="danger" title="Missions indisponibles">{error}</Alert>

  const offer = data?.offer
  const missions = data?.missions ?? []

  return (
    <>
      <PageHeader
        eyebrow="Missions · votre parcours"
        title="Vos missions"
        description="Retrouvez les missions incluses dans l'offre réellement acceptée par votre entreprise."
      />

      {offer ? (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-500">Offre acceptée</p>
                <p className="mt-1 font-display text-xl font-bold text-ink-950">{offer.offerName}</p>
                <p className="mt-0.5 text-sm font-semibold text-brand-700">{formatOfferPrice(offer.price)}</p>
              </div>
            </div>
            <Link to="/app/offres"><Button size="sm" variant="outline">Voir mon offre</Button></Link>
          </div>
          <Progress className="mt-4" value={progressOf(missions)} label={`Progression : ${missions.filter((m) => m.status === 'terminee').length}/${missions.length} mission(s) terminée(s)`} tone="emerald" />
        </Card>
      ) : null}

      {missions.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-5 w-5" />} title="Vos missions vont bientôt apparaître" description="Votre Account Manager prépare les premières missions de votre accompagnement." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {missions.map((mission, index) => {
            const status = MISSION_STATUS_META[mission.status]
            const actionProgress = mission.actions?.length ? progressOf(mission.actions) : null
            return (
              <Link
                key={mission.id}
                to="/app/missions/$id"
                params={{ id: mission.id }}
                className={`group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${missions.length === 5 && index === 4 ? 'lg:col-span-2' : ''}`}
                aria-label={`Ouvrir la mission ${mission.title}`}
              >
                <Card className="flex h-full cursor-pointer flex-col p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
                    <Sparkles size={14} /> Mission
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <h2 className="mt-2 font-display text-xl font-bold text-ink-950">{mission.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{mission.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1"><Flag size={13} /> Priorité {MISSION_PRIORITY_LABELS[mission.priority] ?? mission.priority}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> {mission.dueDate ? `Échéance ${longDate(mission.dueDate)}` : 'Échéance à définir'}</span>
                </div>
                {actionProgress !== null ? <Progress className="mt-4" value={actionProgress} label={`Progression des actions : ${actionProgress} %`} tone="emerald" /> : null}
                {mission.clientFeedback ? (
                  <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">Votre retour : {mission.clientFeedback}</p>
                ) : null}
                <div className="mt-4 flex-1" />
                <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition group-hover:bg-brand-800">Détails <ArrowRight size={14} /></span>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <Alert tone="warning" className="mt-6" icon={<CircleAlert className="h-4 w-4" />} title="Périmètre de l’accompagnement">
        Toute demande hors périmètre est chiffrée et validée avant exécution. Aucun travail supplémentaire n’est
        engagé sans accord.
      </Alert>
    </>
  )
}

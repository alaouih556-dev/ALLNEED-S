import { ActivityBoard } from '@/components/ActivityBoard'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Clock,
  FileText,
  Inbox,
  MessageSquare,
  Network,
  Receipt,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { useDemo } from '@/store/store'
import { PageHeader } from '@/components/layouts'
import { Badge, Button, Card, CardHeader, CardBody, EmptyState, Progress, Stat } from '@/components/ui'
import {
  DELIVERABLE_STATUS,
  DOC_STATUS,
  MEETING_STATUS,
  MISSION_STATUS,
  NEED_STATUS,
} from '@/lib/status'
import { ACCESS_OFFERS } from '@/data/catalog'
import { dateTime, daysUntil, longDate, money, relative } from '@/lib/format'
import { byId, percentage } from '@/lib/utils'

export const Route = createFileRoute('/app/')({
  component: ClientDashboard,
  head: () => ({ meta: [{ title: 'Mon espace — ALLNEEDS' }] }),
})

export function ClientDashboard() {
  const { state, orgId, user } = useDemo()
  const org = state.orgs.find((o) => o.id === orgId)
  const hasAccessSubscription = state.registrationProfile === null || Boolean(state.registrationProfile.tier)

  const orgNeeds = state.needs.filter((n) => n.orgId === orgId)
  const activeNeeds = orgNeeds.filter((n) => !['clos', 'signe'].includes(n.status))
  const openMissions = state.missions.filter((m) => m.orgId === orgId && m.status !== 'terminee')
  const pendingDocs = state.documents.filter((d) => d.status !== 'valide')
  const unread = state.threads.reduce((acc, t) => acc + t.unread, 0)
  const nextMeetings = state.meetings
    .filter((m) => m.orgId === orgId && (m.status === 'confirme' || m.status === 'propose'))
    .sort((a, b) => a.at.localeCompare(b.at))

  const tier = ACCESS_OFFERS.find((o) => o.tier === state.subscription.tier) ?? ACCESS_OFFERS[0]
  const poolUsed = state.subscription.consumed
  const poolRemaining = Math.max(0, tier.needsPerYear - poolUsed)
  const monthsLeft = Math.max(0, Math.round(daysUntil(state.subscription.renewsAt) / 30))
  const daysLeft = daysUntil(state.subscription.renewsAt)

  const pendingDeliverables = state.deliverables.filter((d) => d.status !== 'valide')

  return (
    <>
<ActivityBoard title={`${org?.sector === 'sante' ? 'Santé' : org?.sector === 'tourisme' ? 'Tourisme' : 'Enseignement'} · Votre tableau de bord`} items={[{label:'Besoins en cours',value:activeNeeds.length},{label:'Missions actives',value:openMissions.length},{label:'Rendez-vous prévus',value:nextMeetings.length},{label:'Diagnostics publiés',value:state.diagnostics.filter(d=>d.orgId===orgId&&d.status==='publie').length}]} />

      <PageHeader
        eyebrow="Espace client"
        title={`Bonjour ${user.name.split(' ')[0]}, voici où vous en êtes.`}
        description={`${org?.name ?? 'Votre établissement'} · ${org?.city ?? ''} · ${org?.kind ?? ''}`}
        actions={
          <>
            <Link to="/app/besoins">
              <Button variant="outline" size="sm">
                <Inbox className="h-3.5 w-3.5" />
                Nouveau besoin
              </Button>
            </Link>
            <Link to="/diagnostic">
              <Button size="sm">
                <CalendarDays className="h-3.5 w-3.5" />
                Diagnostic offert
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Besoins actifs"
          value={activeNeeds.length}
          hint={`${orgNeeds.length} besoins consommés au total`}
          tone="brand"
          icon={<Inbox className="h-3.5 w-3.5" />}
        />
        {hasAccessSubscription ? <Stat
          label="Pool ACCÈS restant" value={poolRemaining}
          hint={`${tier.needsPerYear} besoins/an · ${percentage(poolUsed, tier.needsPerYear)} % consommés`}
          tone={poolRemaining <= 3 ? 'warning' : 'success'} icon={<Network className="h-3.5 w-3.5" />}
        /> : <Stat label="ALLNEEDS ACCÈS" value="Non souscrit" hint="CONNECT · PLUS · PRIORITÉ disponibles dans votre compte" tone="brand" icon={<Network className="h-3.5 w-3.5" />} />}
        <Stat
          label="Missions en cours"
          value={openMissions.length}
          hint={openMissions.map((m) => m.code).join(' · ') || 'Aucune'}
          tone="violet"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Points en attente"
          value={pendingDocs.length + pendingDeliverables.length + unread}
          hint={`${pendingDocs.length} documents · ${pendingDeliverables.length} livrables · ${unread} messages`}
          tone="warning"
          icon={<Bell className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          {/* Besoins actifs */}
          <Card>
            <CardHeader
              title="Besoins en cours"
              description="Chaque besoin est suivi jusqu’à la signature chez le prestataire."
              action={
                <Link to="/app/besoins" className="text-xs font-semibold text-brand-700">
                  Tout voir
                </Link>
              }
            />
            <div className="divide-y divide-ink-50">
              {activeNeeds.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState
                    icon={<Inbox className="h-5 w-5" />}
                    title="Aucun besoin en cours"
                    description="Déposez un besoin : nous recherchons, vérifions et comparons pour vous."
                    action={
                      <Link to="/demande">
                        <Button size="sm">Déposer un besoin</Button>
                      </Link>
                    }
                  />
                </div>
              ) : null}

              {activeNeeds.slice(0, 5).map((need) => {
                const providers = need.candidateIds.map((id) => byId(state.providers, id)).filter(Boolean)
                const quotes = need.quoteIds.map((id) => byId(state.quotes, id)).filter(Boolean)
                const status = NEED_STATUS[need.status]
                return (
                  <Link
                    key={need.id}
                    to="/app/besoins/$id"
                    params={{ id: need.id }}
                    className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-ink-50/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink-950">{need.title}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {need.categoryLabel} · {providers.length} prestataire{providers.length > 1 ? 's' : ''} ·{' '}
                        {quotes.length} devis · déposé {relative(need.submittedAt)}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <Progress
                        value={Math.round(((['recu', 'analyse', 'recherche', 'propositions', 'devis', 'negociation', 'signe'] as string[]).indexOf(need.status) / 6) * 100)}
                        tone={need.status === 'signe' ? 'emerald' : 'brand'}
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
                  </Link>
                )
              })}
            </div>
          </Card>

          {/* Prochains rendez-vous */}
          <Card>
            <CardHeader
              title="Prochains rendez-vous"
              action={
                <Link to="/app/rendez-vous" className="text-xs font-semibold text-brand-700">
                  Tout voir
                </Link>
              }
            />
            <div className="divide-y divide-ink-50">
              {nextMeetings.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState title="Aucun rendez-vous à venir" description="Proposez un créneau à votre interlocuteur." />
                </div>
              ) : null}
              {nextMeetings.map((meeting) => (
                <div key={meeting.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50">
                    <span className="text-[0.6rem] font-semibold uppercase text-brand-700">
                      {new Date(meeting.at).toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold leading-none text-brand-900">
                      {new Date(meeting.at).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-950">{meeting.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {dateTime(meeting.at)} · {meeting.durationMin} min · {meeting.location}
                    </p>
                  </div>
                  <Badge tone={MEETING_STATUS[meeting.status].tone}>{MEETING_STATUS[meeting.status].label}</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Livrables */}
          <Card>
            <CardHeader
              title="Livrables en attente de votre validation"
              description="2 tours de retouches inclus par livrable."
              action={
                <Link to="/app/livrables" className="text-xs font-semibold text-brand-700">
                  Tous les livrables
                </Link>
              }
            />
            <div className="divide-y divide-ink-50">
              {pendingDeliverables.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState title="Rien à valider" description="Tous vos livrables sont validés." />
                </div>
              ) : null}
              {pendingDeliverables.map((deliverable) => {
                const mission = byId(state.missions, deliverable.missionId)
                const status = DELIVERABLE_STATUS[deliverable.status]
                return (
                  <div key={deliverable.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-950">{deliverable.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {mission?.code} · {deliverable.type} · v{deliverable.version}/{deliverable.maxVersions} ·{' '}
                        {relative(deliverable.updatedAt)}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          {/* Abonnement */}
          {hasAccessSubscription ? (
            <Card>
              <CardHeader title={`Abonnement ${tier.name}`} description={tier.tagline} />
              <CardBody>
                <div className="flex items-end justify-between"><p className="font-display text-3xl leading-none text-ink-950">{poolRemaining}<span className="ml-1 text-base text-ink-400">/ {tier.needsPerYear}</span></p><p className="text-xs text-ink-500">besoins restants</p></div>
                <Progress className="mt-4" value={percentage(poolUsed, tier.needsPerYear)} tone={poolRemaining <= 3 ? 'amber' : 'brand'} />
                <ul className="mt-5 space-y-2.5 text-sm text-ink-600"><li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-ink-400"/>Première proposition sous {tier.firstProposal}</li><li className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-ink-400"/>Réponse sous {tier.responseTime}</li><li className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-ink-400"/>{tier.quoteComparison}</li></ul>
                <div className="mt-5 rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">Renouvellement le {longDate(state.subscription.renewsAt)} ({monthsLeft} mois)</p>{daysLeft <= 45 ? <p className="mt-1 text-xs font-semibold text-amber-700">Préavis de non-reconduction à donner avant le {longDate(addDaysSafe(30))}</p> : null}</div>
                <Link to="/app/abonnement" className="mt-5 block"><Button size="sm" fullWidth variant="outline">Gérer mon abonnement</Button></Link>
              </CardBody>
            </Card>
          ) : (
            <Card className="border-brand-200 bg-brand-50/40">
              <CardHeader title="Découvrez ALLNEEDS ACCÈS" description="Un abonnement séparé, à choisir uniquement si vous souhaitez nous confier vos besoins de prestataires." />
              <CardBody>
                <div className="grid gap-2 text-xs text-ink-600"><p><strong>CONNECT</strong> · 6 besoins/an</p><p><strong>PLUS</strong> · 15 besoins/an</p><p><strong>PRIORITÉ</strong> · 30 besoins/an</p></div>
                <Link to="/app/abonnement" className="mt-5 block"><Button size="sm" fullWidth>Découvrir les abonnements</Button></Link>
              </CardBody>
            </Card>
          )}

          {/* Conformité */}
          <Card>
            <CardHeader title="Conformité et autorisations" />
            <CardBody>
              <ul className="space-y-3">
                {state.documents
                  .filter((d) => d.kind === 'autorisation')
                  .map((doc) => (
                    <li key={doc.id} className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{doc.name}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{doc.comment}</p>
                      </div>
                      <Badge tone={DOC_STATUS[doc.status].tone} className="ml-auto">
                        {DOC_STATUS[doc.status].label}
                      </Badge>
                    </li>
                  ))}
              </ul>
              <AlertInline />
              <Link to="/app/documents" className="mt-4 block">
                <Button size="sm" fullWidth variant="outline">
                  Gérer mes documents
                </Button>
              </Link>
            </CardBody>
          </Card>

          {/* Missions */}
          <Card>
            <CardHeader title="Missions" />
            <CardBody className="space-y-4">
              {openMissions.map((mission) => (
                <div key={mission.id}>
                  <div className="flex items-center justify-between">
                    <Link
                      to="/app/missions/$id"
                      params={{ id: mission.id }}
                      className="text-sm font-semibold text-ink-950 hover:text-brand-700"
                    >
                      {mission.code}
                    </Link>
                    <Badge tone={MISSION_STATUS[mission.status].tone}>{MISSION_STATUS[mission.status].label}</Badge>
                  </div>
                  <Progress className="mt-2" value={mission.onboardingProgress} label="Avancement" />
                  <p className="mt-2 text-xs text-ink-500">
                    Livraison prévue le {longDate(mission.targetEnd)} · {money(mission.price)}
                  </p>
                </div>
              ))}
              <Link to="/app/missions" className="block">
                <Button size="sm" fullWidth variant="outline">
                  Voir mes missions
                </Button>
              </Link>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  )
}

function AlertInline() {
  return (
    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      Aucune image d’élève n’est publiée sans autorisation écrite complète. Tant que la couverture est incomplète, les
      visuels sont remplacés.
    </p>
  )
}

function addDaysSafe(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

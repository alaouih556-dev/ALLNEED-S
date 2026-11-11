import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  MessageSquare,
  Network,
  Receipt,
  ShieldCheck,
  Star,
  Timer,
} from 'lucide-react'
import { useDemo } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'
import { useOperationalNeeds } from '@/features/operations/useOperationalNeeds'
import { useApiResource } from '@/lib/useApiResource'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, CardHeader, CardBody } from '@/components/ui'
import { NEED_FLOW, NEED_STATUS, URGENCY, normalizeNeedStatus } from '@/lib/status'
import { decideProposal, PROPOSAL_STATUS_META, type NeedProposal } from '@/lib/besoins'
import { longDate, money, relative } from '@/lib/format'
import { byId } from '@/lib/utils'
import type { Provider, Quote } from '@/types'

export const Route = createFileRoute('/app/besoins/$id')({
  component: BesoinDetail,
  head: ({ params }) => ({ meta: [{ title: `Besoin ${params.id ?? ''} — ALLNEEDS` }] }),
})

function BesoinDetail() {
  const { id } = Route.useParams()
  const { state, orgId } = useDemo()
  const auth = useAuth()
  const operations = useOperationalNeeds(state.needs)
  const proposals = useApiResource<{ needId: string; proposals: NeedProposal[] }>(operations.live ? `/api/needs/${encodeURIComponent(id)}/proposals` : null)
  const [decisionBusy, setDecisionBusy] = useState('')
  const [decisionError, setDecisionError] = useState('')

  const need = operations.needs.find((n) => n.id === id && (!operations.live || n.orgId === (auth.user?.organization?.id || orgId)))

  if (operations.loading) return <><PageHeader eyebrow="Besoins" title="Chargement du dossier"/><Alert tone="info">Récupération du besoin depuis le serveur…</Alert></>
  if (operations.error) return <><PageHeader eyebrow="Besoins" title="Chargement impossible"/><Alert tone="danger" title="Le dossier n’a pas pu être chargé">{operations.error}</Alert><Link to="/app/besoins" className="mt-4 inline-flex font-semibold underline">Retour à mes besoins</Link></>

  if (!need) {
    return (
      <>
        <PageHeader eyebrow="Besoins" title="Besoin introuvable" />
        <Alert tone="warning" title="Ce besoin n’existe pas ou n’est pas rattaché à votre établissement.">
          <Link to="/app/besoins" className="font-semibold underline">Retour à mes besoins</Link>
        </Alert>
      </>
    )
  }

  const normalized = normalizeNeedStatus(need.status) ?? need.status
  const providers = (operations.live ? [] : need.candidateIds)
    .map((pid) => byId(state.providers, pid))
    .filter((x): x is Provider => x != null)
  const quotes = (operations.live ? [] : need.quoteIds)
    .map((qid) => byId(state.quotes, qid))
    .filter((x): x is Quote => x != null)
  const liveProposals = operations.live ? (proposals.data?.proposals ?? []) : []
  const visibleProposals = operations.live ? liveProposals : quotes
  const hasTransmittedProposal = visibleProposals.some((proposal) => proposal.status === 'envoyee')
  const effectiveStatus = !proposals.loading && normalized === 'en_attente_client' && !hasTransmittedProposal ? 'en_recherche' : normalized
  const status = NEED_STATUS[effectiveStatus] ?? NEED_STATUS.nouveau
  const stepIndex = Math.max(0, NEED_FLOW.indexOf(effectiveStatus))
  const canValidate = ['propositions_disponibles', 'en_attente_client'].includes(effectiveStatus) && (!operations.live || liveProposals.length > 0)

  async function decide(id: string, decision: 'accept' | 'refuse') {
    setDecisionBusy(id)
    setDecisionError('')
    try {
      await decideProposal(id, decision)
      await Promise.all([proposals.refresh(), operations.refresh()])
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : 'Décision non enregistrée.')
    } finally {
      setDecisionBusy('')
    }
  }

  return (
    <>
      <Link to="/app/besoins" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        Tous mes besoins
      </Link>

      <PageHeader
        eyebrow={`${need.categoryLabel} · ${relative(need.submittedAt || need.createdAt || '')}`}
        title={need.title}
        description={need.description}
        actions={
          <>
            <Link to="/app/messages">
              <Button size="sm" variant="outline">
                <MessageSquare className="h-3.5 w-3.5" />
                Écrire à l’équipe
              </Button>
            </Link>
            <Badge tone={status.tone} className="px-3 py-1">{status.label}</Badge>
          </>
        }
      />

      {operations.live && canValidate ? (
        <Alert tone="success" className="mb-5" title="Des propositions vous attendent">
          <p>Comparez les propositions ci-dessous, puis acceptez ou refusez directement la proposition de votre choix.</p>
        </Alert>
      ) : null}
      {decisionError ? <Alert tone="danger" className="mb-5">{decisionError}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Avancement" description="Votre besoin suit toujours le même parcours." />
            <CardBody>
              <ol className="space-y-0">
                {NEED_FLOW.map((step, i) => {
                  const done = i < stepIndex
                  const active = i === stepIndex
                  return (
                    <li key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-700 text-white ring-4 ring-brand-100' : 'bg-ink-100 text-ink-400'}`}>
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        {i < NEED_FLOW.length - 1 ? <span className={`w-px flex-1 ${done ? 'bg-emerald-300' : 'bg-ink-200'}`} /> : null}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-semibold ${active ? 'text-ink-950' : done ? 'text-ink-700' : 'text-ink-400'}`}>{NEED_STATUS[step].label}</p>
                        {active ? <p className="mt-0.5 text-xs text-ink-500">Étape en cours</p> : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardBody>
          </Card>

          {operations.live ? (
            <Card>
              <CardHeader title="Propositions reçues" description="Vérifiées par ALLNEEDS avant transmission. Le contrat se conclut directement avec le prestataire." action={<Network className="h-4 w-4 text-ink-400" />} />
              <div className="divide-y divide-ink-50">
                {proposals.loading ? <CardBody><p className="text-sm text-ink-500">Chargement des propositions…</p></CardBody> : null}
                {!proposals.loading && liveProposals.length === 0 ? (
                  <CardBody><p className="text-sm text-ink-500">Les propositions sont en cours de préparation par votre concierge. Vous recevrez une notification dès qu’elles sont disponibles.</p></CardBody>
                ) : null}
                {liveProposals.map((proposal) => {
                  const meta = PROPOSAL_STATUS_META[proposal.status] ?? PROPOSAL_STATUS_META.proposee
                  return (
                    <div key={proposal.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink-950">{proposal.providerName}</p>
                            {proposal.recommended ? <Badge tone="brand"><Star className="mr-1 h-3 w-3" />Recommandée</Badge> : null}
                            {proposal.negotiated ? <Badge tone="violet">Négociée</Badge> : null}
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </div>
                          <p className="mt-1 text-sm font-medium text-ink-900">{proposal.title}</p>
                          {proposal.description ? <p className="mt-1 text-xs leading-relaxed text-ink-600">{proposal.description}</p> : null}
                          {proposal.deliveryDelay ? <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-500"><Timer size={13} /> Délai : {proposal.deliveryDelay}</p> : null}
                        </div>
                        <div className="text-right">
                          <p className="flex items-center justify-end gap-1 text-sm font-bold text-ink-950"><Receipt className="h-3.5 w-3.5" />{proposal.amount != null ? money(proposal.amount) : 'à préciser'}</p>
                          {canValidate && proposal.status === 'envoyee' ? <div className="mt-3 flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" disabled={decisionBusy === proposal.id} onClick={() => void decide(proposal.id, 'refuse')}>Refuser</Button><Button size="sm" disabled={decisionBusy === proposal.id} onClick={() => void decide(proposal.id, 'accept')}>Accepter</Button></div> : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Prestataires proposés" description="Vérifiés par ALLNEEDS avant proposition. Le contrat se conclut directement avec eux." action={<Network className="h-4 w-4 text-ink-400" />} />
              <div className="divide-y divide-ink-50">
                {providers.length === 0 ? <CardBody><p className="text-sm text-ink-500">Les prestataires sont en cours de recherche et de vérification.</p></CardBody> : null}
                {providers.map((provider) => {
                  const quote = quotes.find((q) => q.providerId === provider.id)
                  return (
                    <div key={provider.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink-950">{provider.name}</p>
                            <Badge tone={provider.verification === 'approfondie' ? 'brand' : 'neutral'}>Vérification {provider.verification}</Badge>
                            {provider.minorsCompliant ? <Badge tone="success">Conforme mineurs</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-ink-500">{provider.categoryLabel} · {provider.city} · réponse sous {provider.responseDelay}</p>
                        </div>
                        <div className="text-right">
                          <p className="flex items-center justify-end gap-1 text-sm font-semibold text-ink-900"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{provider.rating.toFixed(1)}<span className="text-xs font-normal text-ink-400">({provider.reviews})</span></p>
                          <p className="text-xs text-ink-500">{provider.priceHint}</p>
                        </div>
                      </div>
                      {quote ? (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-50 px-4 py-3">
                          <div><p className="text-xs text-ink-500">Devis reçu</p><p className="text-sm font-bold text-ink-950">{money(quote.amount)} HT</p></div>
                          <div className="text-xs text-ink-500"><p>Livraison : {quote.delayWeeks} semaines</p><p>Valable jusqu’au {longDate(quote.validUntil)}</p></div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Historique" />
            <CardBody>
              <ul className="space-y-4">
                {[...(need.timeline || [])].reverse().map((entry, i) => (
                  <li key={`${entry.at}-${i}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 rounded-full bg-brand-600" />
                      {i < need.timeline.length - 1 ? <span className="w-px flex-1 bg-ink-200" /> : null}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm text-ink-800">{entry.label}</p>
                      <p className="mt-0.5 text-xs text-ink-400">{relative(entry.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Fiche du besoin" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Catégorie</span><span className="text-right font-medium text-ink-900">{need.categoryLabel}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Budget max</span><span className="font-medium text-ink-900">{need.budgetMax ? money(need.budgetMax) : 'à définir'}</span></div>
              {need.volume ? <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Volume</span><span className="font-medium text-ink-900">{need.volume}</span></div> : null}
              <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Urgence</span><Badge tone={(URGENCY[need.urgency] ?? URGENCY.normale).tone}>{(URGENCY[need.urgency] ?? URGENCY.normale).label}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Échéance</span><span className="font-medium text-ink-900">{need.deadline ? longDate(need.deadline) : '—'}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Localisation</span><span className="font-medium text-ink-900">{need.location}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Interlocuteur</span><span className="font-medium text-ink-900">{need.assignedTo}</span></div>
            </CardBody>
          </Card>

          {liveProposals.length > 1 ? (
            <Card>
              <CardHeader title="Comparatif des propositions" />
              <CardBody className="space-y-4">
                {liveProposals.map((proposal) => {
                  const amounts = liveProposals.map((p) => p.amount).filter((a): a is number => a != null)
                  const best = amounts.length ? Math.min(...amounts) : null
                  return (
                    <div key={proposal.id}>
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-semibold text-ink-900">{proposal.providerName}</p>
                        <p className="font-display text-lg text-ink-950">{proposal.amount != null ? money(proposal.amount) : '—'}</p>
                      </div>
                      {best != null && proposal.amount === best ? <Badge tone="success" className="mt-1">Meilleur prix</Badge> : null}
                      {proposal.recommended ? <p className="mt-1 text-xs text-brand-700">Recommandée par votre concierge</p> : null}
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          ) : null}

          {operations.live && canValidate ? <p className="flex items-center gap-1.5 text-[11px] text-ink-400"><Timer size={12} /> La décision se prend sur chaque proposition ; le contrat est conclu directement avec le prestataire.</p> : null}

          <Alert tone="info" title="Rappel" icon={<ShieldCheck className="h-4 w-4" />}>
            Le contrat est conclu directement entre vous et le prestataire, qui reste responsable de sa prestation. ALLNEEDS vous informe de toute commission éventuellement perçue.
          </Alert>
        </aside>
      </div>
    </>
  )
}

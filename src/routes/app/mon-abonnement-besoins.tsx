import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, Check, Clock3, FileText, Lock, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, Modal, useDisclosure } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import { useAuth } from '@/features/auth/AuthContext'
import {
  activateNeedsSubscription,
  cancelNeedsSubscription,
  changeNeedsSubscription,
  formatNeedsPrice,
  NEEDS_SUBSCRIPTION_STATUS_META,
  type NeedsCatalogItem,
  type NeedsPlanCode,
  type NeedsSubscriptionPayload,
} from '@/lib/besoins'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/app/mon-abonnement-besoins')({
  component: BesoinsSubscriptionPage,
  head: () => ({ meta: [{ title: 'Abonnement Besoins — ALLNEEDS' }] }),
})

function BesoinsSubscriptionPage() {
  const auth = useAuth()
  const { data, loading, error, refresh } = useApiResource<NeedsSubscriptionPayload>('/api/needs/subscription')
  const confirm = useDisclosure()
  const cancelModal = useDisclosure()
  const [selected, setSelected] = useState<NeedsCatalogItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  const rawCurrent = data?.current ?? null
  const pending = data?.pending ?? (rawCurrent && ['pending', 'en_attente_validation'].includes(rawCurrent.status) ? rawCurrent : null)
  const current = rawCurrent?.status === 'active' ? rawCurrent : null
  const prerequisites = data?.prerequisites

  async function run(action: () => Promise<unknown>) {
    setSubmitting(true)
    setActionError('')
    try {
      await action()
      setRequestSent(true)
      await refresh()
      await auth.refresh()
      confirm.close()
      cancelModal.close()
      setSelected(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'L’opération n’a pas pu être enregistrée.')
    } finally {
      setSubmitting(false)
    }
  }

  const prereqBlock = !loading && prerequisites && !prerequisites.ok

  return (
    <>
      <PageHeader
        eyebrow="Espace client"
        title="Abonnement Besoins"
        description="Choisissez la formule qui couvre vos dépôts de besoins. Une seule formule est active à la fois pour votre entreprise."
      />

      {loading ? <p className="text-sm text-ink-500">Chargement de votre abonnement…</p> : null}
      {error ? <Alert tone="danger" title="Abonnement indisponible">{error}</Alert> : null}
      {requestSent ? <Alert tone="success" className="mb-5" title="Demande envoyée">Votre demande est en attente de validation par ALLNEEDS. Aucun abonnement n’est encore actif.</Alert> : null}

      {prereqBlock ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-ink-100 p-2 text-ink-600"><Lock size={18} /></span>
            <div>
              <h2 className="font-display text-xl font-bold text-ink-950">Abonnement Besoins non accessible pour l’instant</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{prerequisites?.error}</p>
              {prerequisites?.code === 'OFFER_REQUIRED' ? (
                <Link to="/app/offres" className="mt-4 inline-flex"><Button variant="outline">Choisir une offre d’accompagnement <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              ) : prerequisites?.code === 'DIAGNOSTIC_NOT_PUBLISHED' ? (
                <Link to="/app/diagnostics" className="mt-4 inline-flex"><Button variant="outline">Suivre ma restitution <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && current ? (
        <Card className="mb-6 border-emerald-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Votre abonnement actuel</p>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-ink-950">{current.planName}</h2>
              <p className="mt-1 text-sm text-ink-600">
                {formatNeedsPrice(current.price)} / mois · {current.usedThisMonth}/{current.monthlyLimit} besoins utilisés ·
                jusqu’à {current.proposalsLimit} propositions par besoin
                {current.planCode === 'PREMIUM' ? ' dont 1 négociée' : current.recommendedProposal ? ' dont 1 recommandée' : ''}.
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Période en cours jusqu’au {longDate(current.periodEnd)} · délai cible d’une première proposition : {current.targetDelayHours} h.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge tone={NEEDS_SUBSCRIPTION_STATUS_META[current.status].tone}>{NEEDS_SUBSCRIPTION_STATUS_META[current.status].label}</Badge>
              <Link to="/app/besoins"><Button>Déposer un besoin <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Button variant="ghost" size="sm" onClick={cancelModal.openFn}>Résilier l’abonnement</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && pending ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/40 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-700"/><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">En attente de validation</p></div><h2 className="mt-3 font-display text-2xl font-bold text-ink-950">{pending.planName}</h2><p className="mt-1 text-sm text-ink-600">{formatNeedsPrice(pending.price)} / mois · demande envoyée le {longDate(pending.createdAt)}.</p></div><Badge tone="warning">EN ATTENTE DE VALIDATION</Badge></div></Card>
      ) : null}

      {!loading && !prereqBlock && data?.catalog?.length ? (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {data.catalog.map((plan) => {
            const isCurrent = current?.planCode === plan.code
            const isPending = pending?.planCode === plan.code
            return (
              <Card key={plan.code} className={`flex h-full flex-col p-5 ${isCurrent ? 'border-emerald-300 ring-1 ring-emerald-100' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={plan.code === 'PREMIUM' ? 'brand' : 'neutral'}>{plan.name}</Badge>
                  {isCurrent ? <Badge tone="success">Actuel</Badge> : isPending ? <Badge tone="warning">En attente</Badge> : null}
                </div>
                <p className="mt-3 text-2xl font-extrabold text-ink-950">{formatNeedsPrice(plan.price)}<span className="text-sm font-medium text-ink-500"> /mois</span></p>
                <ul className="mt-4 flex-1 space-y-2">
                  <li className="flex items-start gap-2 text-xs leading-relaxed text-ink-700"><Check size={14} className="mt-0.5 shrink-0 text-brand-700" /> Jusqu’à {plan.monthlyLimit} besoins par mois</li>
                  <li className="flex items-start gap-2 text-xs leading-relaxed text-ink-700"><Check size={14} className="mt-0.5 shrink-0 text-brand-700" /> Jusqu’à {plan.proposalsLimit} propositions par besoin</li>
                  <li className="flex items-start gap-2 text-xs leading-relaxed text-ink-700"><Check size={14} className="mt-0.5 shrink-0 text-brand-700" /> Délai cible {plan.targetDelayHours} h</li>
                  {plan.recommendedProposal ? <li className="flex items-start gap-2 text-xs leading-relaxed text-ink-700"><Check size={14} className="mt-0.5 shrink-0 text-brand-700" /> 1 proposition recommandée</li> : null}
                  {plan.negotiatedProposal ? <li className="flex items-start gap-2 text-xs leading-relaxed text-ink-700"><Check size={14} className="mt-0.5 shrink-0 text-brand-700" /> 1 proposition négociée</li> : null}
                </ul>
                {isCurrent || isPending ? (
                  <Button className="mt-5" variant="outline" disabled>{isPending ? 'Demande envoyée' : 'Formule actuelle'}</Button>
                ) : (
                  <Button
                    className="mt-5"
                    variant={current ? 'outline' : 'primary'}
                    disabled={submitting || Boolean(pending)}
                    onClick={() => { setSelected(plan); setActionError(''); confirm.openFn() }}
                  >
                    {pending ? 'Une demande est en attente' : current ? 'Changer pour cette formule' : 'Souscrire'}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      ) : null}

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 text-ink-400" />
          <p className="text-xs leading-relaxed text-ink-500">
             Aucun débit ni aucune activation ne sont déclenchés depuis cette page. La formule devient active uniquement
             après validation par ALLNEEDS. Aucune offre d’accompagnement ni abonnement SaaS n’est modifié.
          </p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400"><Clock3 size={12} /> Un contenu marqué « Contenu à valider » sera précisé par votre Account Manager.</p>
      </Card>

      <Modal
        open={confirm.open}
        onClose={confirm.close}
         title={current ? 'Demander un changement de formule' : 'Confirmer la demande'}
         description="La formule ne sera appliquée qu’après validation par ALLNEEDS. L’historique est conservé."
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-ink-50 p-4">
              <div className="flex items-center gap-2">
                {!current ? <Sparkles size={14} className="text-brand-700" /> : null}
                <p className="text-sm font-semibold text-ink-950">{selected.name}</p>
              </div>
              <p className="mt-1 text-sm text-ink-600">{selected.monthlyLimit} besoins/mois · {selected.proposalsLimit} propositions par besoin · délai cible {selected.targetDelayHours} h.</p>
              <p className="mt-2 text-2xl font-extrabold text-ink-950">{formatNeedsPrice(selected.price)}<span className="text-sm font-medium text-ink-500"> /mois</span></p>
            </div>
            {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={confirm.close} disabled={submitting}>Annuler</Button>
              <Button
                disabled={submitting}
                onClick={() => void run(() => current ? changeNeedsSubscription(selected.code as NeedsPlanCode) : activateNeedsSubscription(selected.code as NeedsPlanCode))}
              >
                 {submitting ? 'Envoi…' : 'Envoyer la demande'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={cancelModal.open} onClose={cancelModal.close} title="Résilier l’abonnement Besoins" description="Le module Besoins sera fermé et vos dépôts impossibles jusqu’à une nouvelle souscription.">
        <div className="space-y-4">
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <p className="text-sm text-ink-600">Vos besoins déjà déposés et leur historique restent consultables par votre Account Manager.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancelModal.close} disabled={submitting}>Annuler</Button>
            <Button variant="danger" disabled={submitting} onClick={() => void run(cancelNeedsSubscription)}>{submitting ? 'Résiliation…' : 'Confirmer la résiliation'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, CreditCard, Download, FileText, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useDemo, tierLimit } from '@/store/store'
import { PageHeader } from '@/components/layouts'
import {
  Alert as Notice,
  Badge,
  Button,
  Card,
  CardHeader,
  CardBody,
  Divider,
  KeyValue,
  Modal,
  Progress,
  Select,
  useDisclosure,
} from '@/components/ui'
import { ACCESS_OFFERS, LAUNCH_OFFER, PLANS, SECTOR_LABEL } from '@/data/catalog'
import { formatNeedsPrice, NEEDS_PLAN_CODES, NEEDS_PLAN_LIMITS, NEEDS_PLAN_NAMES, NEEDS_PLAN_PRICES } from '@/lib/besoins'
import { longDate, money, pct } from '@/lib/format'
import { percentage } from '@/lib/utils'
import type { AccessOffer, Sector } from '@/types'
import { DEMO_CLIENT_PROFILES } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { OfferProposal } from '@/features/parcours/OfferProposal'
import { useParcours, parcoursCurrentStep } from '@/lib/parcours'
import { buildDiagnosticView, readLocalAnswers } from '@/lib/priorities'

export const Route = createFileRoute('/app/abonnement')({
  component: AbonnementPage,
  head: () => ({ meta: [{ title: 'Mon abonnement — ALLNEEDS' }] }),
})

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  actif: { label: 'Actif', tone: 'success' },
  expire: { label: 'Résilié', tone: 'danger' },
  suspendu: { label: 'Suspendu', tone: 'warning' },
}

function MissionOfferSection({ sector, recommendedCode }: { sector: 'enseignement' | 'sante' | 'tourisme'; recommendedCode?: string | null }) {
  const plans = PLANS[sector]
  const formatAmount = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount)
  return <section className="mt-10" aria-labelledby="mission-offers-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Votre secteur · {SECTOR_LABEL[sector]}</p><h2 id="mission-offers-title" className="mt-2 font-display text-2xl font-bold text-ink-950">Les accompagnements disponibles</h2><p className="mt-2 max-w-2xl text-sm text-ink-600">Le détail, le prix et les limites sont réunis ici. Une mission n’est engagée qu’après échange et validation d’un devis.</p></div><span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">Offre de lancement · jusqu’au {LAUNCH_OFFER.deadline}</span></div>
    <div className="grid items-start gap-4 xl:grid-cols-3">{plans.map((plan) => <Card key={plan.code} className={`flex h-full flex-col p-5 ${plan.code === 'PERFORMANCE' || plan.code === recommendedCode ? 'border-brand-300 ring-1 ring-brand-100' : ''}`}>
      <div className="flex items-center justify-between gap-2"><Badge tone={plan.code === 'PERFORMANCE' ? 'brand' : 'neutral'}>{plan.verb}</Badge><span className="text-xs text-ink-500">{plan.delay}</span></div>{plan.code === recommendedCode ? <p className="mt-2 inline-flex w-fit rounded-full bg-brand-700 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white">Recommandé d’après votre diagnostic</p> : null}<h3 className="mt-3 font-display text-xl font-bold text-ink-950">{plan.name}</h3><p className="mt-2 text-sm leading-relaxed text-ink-600">{plan.tagline}</p>
      <div className="mt-4 rounded-xl bg-ink-50 p-4">{plan.code === 'STARTER' ? <><p className="text-xl font-extrabold text-brand-700">Offert pendant le lancement</p><p className="mt-1 text-xs text-ink-500">2h15 · valeur habituelle {formatAmount(plan.priceNormal)} DH</p></> : <><p className="text-xs text-ink-500"><span className="line-through">{formatAmount(plan.priceNormal)} DH HT</span> <span className="ml-1 font-semibold text-brand-700">Prix de lancement</span></p><p className="mt-1 text-2xl font-extrabold text-ink-950">{formatAmount(plan.priceLaunch ?? plan.priceNormal)} <span className="text-sm font-semibold">DH HT</span></p><p className="mt-1 text-xs text-ink-500">Paiement unique · TVA en sus</p></>}</div>
      <ul className="mt-3 flex-1 space-y-2">{plan.highlights.slice(0,3).map((item) => <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ink-700"><Check size={14} className="mt-0.5 shrink-0 text-brand-700"/>{item}</li>)}</ul>
      <details className="mt-4 rounded-xl border border-ink-100 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-brand-700">Voir le périmètre et les limites</summary><div className="mt-3 space-y-3"><div>{plan.included.map((group) => <div key={group.title} className="mb-3"><p className="text-xs font-semibold text-ink-900">{group.title}</p><ul className="mt-1 list-disc space-y-1 pl-4">{group.items.map((item) => <li key={item} className="text-xs leading-relaxed text-ink-600">{item}</li>)}</ul>{group.limit ? <p className="mt-1 text-[11px] text-amber-700">{group.limit}</p> : null}</div>)}</div><div className="rounded-lg bg-ink-50 p-3"><p className="text-xs font-semibold text-ink-800">Non inclus</p><ul className="mt-1 list-disc space-y-1 pl-4">{plan.notIncluded.map((item) => <li key={item} className="text-xs leading-relaxed text-ink-600">{item}</li>)}</ul></div></div></details>
      <Link to={plan.code === 'STARTER' ? '/app/diagnostic-auto' : '/app/messages'} className="mt-4"><Button fullWidth variant={plan.code === 'STARTER' ? 'primary' : 'outline'}>{plan.code === 'STARTER' ? 'Préparer mon diagnostic' : 'Demander un échange'}<ArrowRight size={15}/></Button></Link>
    </Card>)}</div>
  </section>
}

function AccessOffersSection() {
  return (
    <section className="mt-12" aria-labelledby="access-offers-title">
      <p className="eyebrow">Abonnement Besoins</p>
      <h2 id="access-offers-title" className="mt-3 font-display text-2xl font-bold text-ink-950">
        Besoin d’un réseau de prestataires ?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
        L’abonnement Besoins sert à faire rechercher, comparer et suivre des prestataires selon votre rythme de
        besoins. Il ne finance jamais la prestation du prestataire.
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {NEEDS_PLAN_CODES.map((code) => {
          const plan = NEEDS_PLAN_LIMITS[code]
          return (
            <Card key={code} className={code === 'PREMIUM' ? 'border-brand-300 p-6 shadow-lift' : 'p-6'}>
              <div className="flex items-center justify-between"><p className="text-base font-bold text-ink-950">{NEEDS_PLAN_NAMES[code]}</p>{code === 'PREMIUM' ? <Badge tone="brand">Premium</Badge> : null}</div>
              <p className="mt-3 text-sm text-ink-600">Jusqu’à {plan.monthlyLimit} besoins par mois et {plan.proposalsLimit} propositions par besoin.</p>
              <div className="mt-4 rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">Mensuel</p><p className="mt-1 text-lg font-bold text-ink-950">{formatNeedsPrice(NEEDS_PLAN_PRICES[code])} <span className="text-xs">/mois</span></p></div>
              <ul className="mt-5 space-y-2 text-sm text-ink-700">
                <li>{plan.monthlyLimit} besoins par mois</li>
                <li>{plan.proposalsLimit} propositions par besoin</li>
                <li>Délai cible : {plan.targetDelayHours} h</li>
                {plan.recommendedProposal ? <li>1 proposition recommandée</li> : null}
                {plan.negotiatedProposal ? <li>1 proposition négociée</li> : null}
              </ul>
              <Link to="/app/mon-abonnement-besoins" className="block mt-6"><Button fullWidth variant={code === 'PREMIUM' ? 'primary' : 'outline'}>Gérer l’abonnement {NEEDS_PLAN_NAMES[code]}</Button></Link>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

export function AbonnementPage() {
  const { state, dispatch, orgId: fallbackOrgId } = useDemo()
  const auth = useAuth()
  const { orgId: liveOrgId, sector: accountSector } = useOrgContext()
  const effectiveOrgId = liveOrgId || fallbackOrgId
  const { parcours, patch } = useParcours(effectiveOrgId)
  const [choiceError, setChoiceError] = useState('')
  const cancel = useDisclosure()
  const upgrade = useDisclosure()
  const [tier, setTier] = useState<string>(state.subscription.tier)
  const [payment, setPayment] = useState<string>(state.subscription.payment)
  const demoProfile = DEMO_CLIENT_PROFILES[state.userId as keyof typeof DEMO_CLIENT_PROFILES]
  const org = state.orgs.find((item) => item.id === (demoProfile?.orgId ?? effectiveOrgId))
  const sector: Sector = accountSector ?? state.registrationProfile?.sector ?? org?.sector ?? 'enseignement'
  const current = ACCESS_OFFERS.find((o) => o.tier === state.subscription.tier) as AccessOffer | undefined
  const live = auth.status === 'authenticated'
  const hasAccessSubscription = live
    ? false
    : state.registrationProfile === null || Boolean(state.registrationProfile.tier)

  const answers = readLocalAnswers(sector)
  const view = buildDiagnosticView(sector, answers)
  const detectedVolets = new Set(view.priorities.map((item) => item.voletId))
  const recommendedCode = detectedVolets.size <= 1 ? 'STARTER' : detectedVolets.size === 2 ? 'PRO' : 'PERFORMANCE'

  const step = parcoursCurrentStep({
    sector,
    submittedAt: parcours.submittedAt,
    conciergeRequestedAt: parcours.conciergeRequestedAt,
    rendezVousAt: parcours.rendezVousAt,
    restoredAt: parcours.restoredAt,
    offerChosenAt: parcours.offerChosenAt,
    subscriptionActive: state.subscription.status === 'actif',
  })

  function choose(code: string) {
    setChoiceError('')
    try {
      patch({ offerCode: code, offerChosenAt: new Date().toISOString() })
      dispatch({
        type: 'TOAST_ADD',
        toast: {
          title: `Formule ${code} sélectionnée`,
          description: 'Le détail et le devis vous sont confirmés par votre concierge avant tout engagement.',
          tone: 'success',
        },
      })
    } catch {
      setChoiceError('Votre choix n’a pas pu être enregistré. Réessayez.')
    }
  }

  const sub = state.subscription
  const needsLimit = tierLimit(sub.tier, 'needsPerYear')
  const concurrentLimit = tierLimit(sub.tier, 'concurrentNeeds')
  const usedPct = percentage(sub.consumed, needsLimit)
  const status = STATUS[sub.status] ?? STATUS.actif

  if (!hasAccessSubscription) {
    return (
      <>
        <PageHeader eyebrow={`Votre espace · ${SECTOR_LABEL[sector]}`} title="Votre accompagnement" description="Les offres détaillées, leur prix et leurs limites sont réunis ici après votre restitution." />

        <OfferProposal
          sector={sector}
          currentStep={step}
          detectedVolets={[...detectedVolets]}
          chosenCode={parcours.offerCode}
          onChoose={choose}
          alreadySubscribed={Boolean(parcours.offerChosenAt)}
          error={choiceError || undefined}
        />

        {live && state.registrationProfile?.tier ? (
          <Notice tone="info" className="mt-6" title="Formule en cours d’activation">
            Votre choix « {state.registrationProfile.tier} » est enregistré. Les consommations et le
            prochain renouvellement apparaîtront ici après validation du contrat et de la première
            facturation.
          </Notice>
        ) : null}

        <MissionOfferSection sector={sector} recommendedCode={recommendedCode} />
        <AccessOffersSection />
        <p className="mt-4 text-xs text-ink-500">Aucun paiement automatique n’est déclenché depuis cette page. Les modalités sont confirmées au devis.</p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Abonnement"
        title="Mon abonnement"
        description="L’abonnement couvre la recherche, la vérification, la comparaison et le suivi. Il ne paie jamais un prestataire."
      />

      <OfferProposal
        sector={sector}
        currentStep={step}
        detectedVolets={[...detectedVolets]}
        chosenCode={parcours.offerCode}
        onChoose={choose}
        alreadySubscribed={state.subscription.status === 'actif'}
        error={choiceError || undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Formule ${current?.name ?? sub.tier}`}
              description={`Depuis le ${longDate(sub.startedAt)} · prochain renouvellement ${longDate(sub.renewsAt)}`}
              action={<Badge tone={status.tone} className="px-3 py-1">{status.label}</Badge>}
            />
            <CardBody>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="rounded-xl bg-ink-50 px-4 py-3">
                  <p className="text-xs text-ink-500">Tarifs catalogue · facturation {sub.payment === 'annuel' ? 'annuelle' : 'trimestrielle'}</p>
                  {current ? <p className="mt-1 text-xl font-bold text-ink-950">{new Intl.NumberFormat('fr-FR').format(current.priceYear)} DH/an <span className="text-sm font-medium text-ink-500">ou {new Intl.NumberFormat('fr-FR').format(current.priceMonth)} DH/mois</span></p> : <p className="mt-1 text-xl font-bold text-ink-950">À confirmer</p>}
                  <p className="mt-0.5 text-[11px] text-ink-500">Le montant réellement facturé figure sur votre devis ou contrat.</p>
                </div>
                <div className="text-right text-xs text-ink-500">
                  <p>Reconduction automatique : {sub.autoRenew ? 'oui' : 'non'}</p>
                </div>
              </div>

              <Divider className="my-5" />

              <Progress
                value={usedPct}
                tone={usedPct > 85 ? 'amber' : 'brand'}
                label={`Besoins utilisés : ${sub.consumed} / ${needsLimit}`}
              />
              <p className="mt-2 text-xs text-ink-500">
                {needsLimit - sub.consumed} besoin(s) restant(s) cette année · {concurrentLimit} besoin(s) simultané(s)
                autorisé(s). Report du pool non utilisé : {sub.poolCarriedOver}.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={upgrade.openFn}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Changer de formule
                </Button>
                <Button size="sm" variant="ghost">
                  <Download className="h-3.5 w-3.5" />
                  Factures
                </Button>
                <Button size="sm" variant="ghost" onClick={cancel.openFn}>
                  Résilier
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ce que couvre votre formule" description="Engagements de service ALLNEEDS" />
            <CardBody>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  `${current?.needsPerYear} besoin(s) par an`,
                  `${current?.providersPerNeed} prestataire(s) proposé(s) par besoin`,
                  `Vérification ${current?.verification === 'approfondie' ? 'approfondie' : 'de base'} des prestataires`,
                  `Première proposition : ${current?.firstProposal}`,
                  `Comparaison chiffrée des devis : ${current?.quoteComparison}`,
                  `Suivi : ${current?.followUp}`,
                  `Réponse sous ${current?.responseTime}`,
                  current?.starterDiagnostic === 'inclus' ? 'Diagnostic STARTER inclus' : 'Diagnostic STARTER en option',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Notice tone="info" title="Ce que l’abonnement ne fait pas">
            Il ne finance pas la prestation du prestataire, ne garantit pas un résultat commercial, et ne remplace pas un
            contrat de travail. Le devis du prestataire est toujours signé entre vous et lui.
          </Notice>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Consommés cette année" />
            <CardBody className="space-y-1">
              <KeyValue label="Besoins déposés">{sub.consumed}</KeyValue>
              <KeyValue label="Pool non utilisé">{pct(Math.max(0, needsLimit - sub.consumed))} du quota</KeyValue>
              <KeyValue label="Report au 1er janvier">{sub.poolCarriedOver}</KeyValue>
              <KeyValue label="Diagnostics STARTER inclus utilisés">{sub.starterUsed}</KeyValue>
              <KeyValue label="Réductions missions incluses">
                {current?.missionDiscount ? 'Avantage abonné sur PRO et PERFORMANCE' : '—'}
              </KeyValue>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Moyens de paiement" />
            <CardBody>
              <div className="flex items-center gap-3 rounded-xl border border-ink-100 p-4">
                <span className="rounded-lg bg-ink-950 p-2 text-white">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">Virement bancaire</p>
                  <p className="text-xs text-ink-500">Déclaration trimestrielle ou annuelle</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                La facturation est annuelle, non remboursable au prorata des périodes consommées sauf résiliation pour
                cause légitime prévue au contrat.
              </p>
            </CardBody>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink-950">Une question sur la facturation ?</p>
            <p className="mt-1 text-xs text-ink-500">
              Écrivez-nous : la facturation et les engagements contractuels sont gérés par la même équipe que vos besoins.
            </p>
            <Link to="/app/messages" className="mt-3 inline-block text-xs font-semibold text-brand-700">
              Ouvrir la messagerie
            </Link>
          </Card>
        </aside>
      </div>

      <MissionOfferSection sector={sector} recommendedCode={recommendedCode} />

      <AccessOffersSection />

      <Modal
        open={cancel.open}
        onClose={cancel.close}
        title="Résilier mon abonnement"
        description="Préavis de 30 jours avant l’échéance en cours. Vos accès restent actifs jusqu’à cette date."
        size="sm"
      >
        <div className="space-y-4">
          <Notice tone="warning" title="Avant de confirmer">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Les besoins en cours ne sont pas interrompus immédiatement.</li>
              <li>Les missions en cours ne sont pas annulées : elles relèvent du contrat de mission.</li>
              <li>Le pool de besoins non utilisé n’est pas remboursé.</li>
            </ul>
          </Notice>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel.close}>
              Conserver mon abonnement
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'SUBSCRIPTION_CANCEL' })
                cancel.close()
              }}
            >
              Confirmer la résiliation
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={upgrade.open} onClose={upgrade.close} title="Changer de formule" description="Effet immédiat, au prorata.">
        <div className="space-y-4">
          <div className="space-y-2">
            {ACCESS_OFFERS.filter((o) => o.tier !== sub.tier).map((offer) => (
              <button
                key={offer.tier}
                onClick={() => setTier(offer.tier)}
                className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
                  tier === offer.tier ? 'border-brand-600 bg-brand-50' : 'border-ink-100 hover:border-ink-300'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-ink-950">{offer.name}</p>
                  <p className="text-xs text-ink-500">
                    {offer.needsPerYear} besoin(s)/an · {offer.providersPerNeed} prestataire(s)/besoin
                  </p>
                  <p className="mt-1 text-xs font-semibold text-brand-700">{new Intl.NumberFormat('fr-FR').format(offer.priceYear)} DH/an · {new Intl.NumberFormat('fr-FR').format(offer.priceMonth)} DH/mois</p>
                </div>

              </button>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-700">Périodicité</p>
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="annuel">Annuel</option>
              <option value="trimestriel">Trimestriel</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={upgrade.close}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                dispatch({
                  type: 'SUBSCRIPTION_PATCH',
                  patch: { tier: tier as typeof sub.tier, payment: payment as typeof sub.payment },
                })
                if (state.registrationProfile) {
                  dispatch({ type: 'REGISTRATION_SET', profile: { ...state.registrationProfile, tier, payment } })
                }
                dispatch({
                  type: 'TOAST_ADD',
                  toast: {
                    title: 'Formule mise à jour',
                    description: 'La nouvelle formule est appliquée à votre espace.',
                    tone: 'success',
                  },
                })
                upgrade.close()
              }}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

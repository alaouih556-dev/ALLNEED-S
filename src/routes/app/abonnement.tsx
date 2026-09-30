import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, CreditCard, Download, Sparkles } from 'lucide-react'
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
  PriceTag,
  Progress,
  Select,
  useDisclosure,
} from '@/components/ui'
import { ACCESS_OFFERS } from '@/data/catalog'
import { longDate, money, pct } from '@/lib/format'
import { percentage } from '@/lib/utils'
import type { AccessOffer } from '@/types'

export const Route = createFileRoute('/app/abonnement')({
  component: AbonnementPage,
  head: () => ({ meta: [{ title: 'Mon abonnement — ALLNEEDS' }] }),
})

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  actif: { label: 'Actif', tone: 'success' },
  expire: { label: 'Résilié', tone: 'danger' },
  suspendu: { label: 'Suspendu', tone: 'warning' },
}

export function AbonnementPage() {
  const { state, dispatch } = useDemo()
  const cancel = useDisclosure()
  const upgrade = useDisclosure()
  const [tier, setTier] = useState<string>(state.subscription.tier)
  const [payment, setPayment] = useState<string>(state.subscription.payment)
  const current = ACCESS_OFFERS.find((o) => o.tier === state.subscription.tier) as AccessOffer | undefined

  const sub = state.subscription
  const needsLimit = tierLimit(sub.tier, 'needsPerYear')
  const concurrentLimit = tierLimit(sub.tier, 'concurrentNeeds')
  const usedPct = percentage(sub.consumed, needsLimit)
  const status = STATUS[sub.status] ?? STATUS.actif

  return (
    <>
      <PageHeader
        eyebrow="Abonnement"
        title="Mon abonnement"
        description="L’abonnement couvre la recherche, la vérification, la comparaison et le suivi. Il ne paie jamais un prestataire."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Formule ${current?.name ?? sub.tier}`}
              description={`Depuis le ${longDate(sub.startedAt)} · renouvellement ${longDate(sub.renewsAt)}`}
              action={<Badge tone={status.tone} className="px-3 py-1">{status.label}</Badge>}
            />
            <CardBody>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <PriceTag amount={current?.priceYear ?? 0} note={`ou ${money(current?.priceMonth ?? 0)}/mois · HT`} />
                <div className="text-right text-xs text-ink-500">
                  <p>Prélèvement {sub.payment === 'annuel' ? 'annuel' : 'trimestriel'}</p>
                  <p className="mt-0.5">Reconduction automatique : {sub.autoRenew ? 'oui' : 'non'}</p>
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
                  current?.starterDiagnostic === 'offert' ? 'Diagnostic STARTER offert' : 'Diagnostic STARTER en option',
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
              <KeyValue label="Diagnostics STARTER offerts utilisés">{sub.starterUsed}</KeyValue>
              <KeyValue label="Réductions missions incluses">
                {current?.missionDiscount ? `-${current.missionDiscount} % sur PRO et PERFORMANCE` : '—'}
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
                </div>
                <span className="text-sm font-semibold text-ink-900">{money(offer.priceYear)} / an</span>
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-700">Périodicité</p>
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="annuel">Annuel — 10 % équivalent</option>
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

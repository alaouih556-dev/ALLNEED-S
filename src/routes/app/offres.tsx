import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, Check, Clock3, FileText, Lock, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, Modal, useDisclosure } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import {
  acceptOffer,
  formatOfferPrice,
  type OfferCatalogItem,
  type OffersPayload,
  type OfferCode,
} from '@/lib/accompagnement'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/app/offres')({
  component: OffersPage,
  head: () => ({ meta: [{ title: 'Nos offres d’accompagnement — ALLNEEDS' }] }),
})

function OffersPage() {
  const { data, loading, error, refresh } = useApiResource<OffersPayload>('/api/offers')
  const confirm = useDisclosure()
  const [selected, setSelected] = useState<OfferCatalogItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  async function confirmAccept() {
    if (!selected) return
    setSubmitting(true)
    setAcceptError('')
    try {
      await acceptOffer(selected.code as OfferCode)
      setRequestSent(true)
      confirm.close()
      setSelected(null)
      await refresh()
    } catch (cause) {
      setAcceptError(cause instanceof Error ? cause.message : 'Votre acceptation n’a pas pu être enregistrée.')
    } finally {
      setSubmitting(false)
    }
  }

  const current = data?.current ?? null
  const pendingPayload = data?.pending
  const pending = Array.isArray(pendingPayload) ? (pendingPayload[0] ?? null) : (pendingPayload ?? (current?.status === 'en_attente_validation' ? current : null))
  const active = current && ['actif', 'acceptee'].includes(current.status) ? current : null
  const recommended = data?.recommendedOfferCode ?? null
  const recommendedSource = data?.recommendedOfferSource ?? null

  return (
    <>
      <PageHeader
        eyebrow="Accompagnement"
        title="Nos offres d’accompagnement"
        description="Choisissez la formule adaptée aux priorités de votre diagnostic. Une seule demande peut être examinée à la fois pour votre entreprise."
      />

      {loading ? <p className="text-sm text-ink-500">Chargement des offres…</p> : null}
      {error ? <Alert tone="danger" title="Offres indisponibles">{error}</Alert> : null}

      {!loading && data?.locked ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-ink-100 p-2 text-ink-600"><Lock size={18} /></span>
            <div>
              <h2 className="font-display text-xl font-bold text-ink-950">Les offres apparaîtront après votre restitution</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                Les offres d’accompagnement sont disponibles une fois votre restitution validée et publiée par
                votre Account Manager. Vous pourrez alors comparer et accepter la formule adaptée à vos priorités.
              </p>
              <Link to="/app/diagnostics" className="mt-4 inline-flex">
                <Button variant="outline">Suivre ma restitution <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && requestSent ? (
        <Alert tone="success" className="mb-5" title="Demande envoyée">
          Votre choix a été transmis à ALLNEEDS. L’offre et ses missions seront activées après validation.
        </Alert>
      ) : null}

      {!loading && pending ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-700"/><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">En attente de validation</p></div><h2 className="mt-3 font-display text-2xl font-bold text-ink-950">{pending.offerName}</h2><p className="mt-1 text-sm text-ink-600">{formatOfferPrice(pending.price)} · demande envoyée le {longDate(pending.createdAt)}.</p></div><Badge tone="warning">EN ATTENTE DE VALIDATION</Badge></div>
        </Card>
      ) : null}

      {!loading && active ? (
        <Card className="mb-6 border-emerald-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Offre acceptée</p>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-ink-950">{active.offerName}</h2>
              <p className="mt-1 text-sm text-ink-600">
                {formatOfferPrice(active.price)} · acceptée le {longDate(active.acceptedAt || active.createdAt)}
                {active.acceptedByName ? ` par ${active.acceptedByName}` : ''}.
              </p>
            </div>
            <Link to="/app/missions">
              <Button>Voir mes missions <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {!loading && !data?.locked && data?.offers?.length ? (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {data.offers.map((offer) => {
            const isRecommended = !active && !pending && recommended === offer.code
            const isCurrent = active?.offerCode === offer.code
            const isPending = pending?.offerCode === offer.code
            return (
              <Card key={offer.code} className={`flex h-full flex-col p-5 ${isRecommended || isCurrent ? 'border-brand-300 ring-1 ring-brand-100' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={offer.code === 'PERFORMANCE' ? 'brand' : 'neutral'}>{offer.name}</Badge>
                   {isCurrent ? <Badge tone="success">Acceptée</Badge> : isPending ? <Badge tone="warning">En attente</Badge> : null}
                </div>
                {isRecommended ? (
                  recommendedSource === 'explicit' ? (
                    <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-700 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white">
                      <Sparkles size={12} /> Recommandée d’après votre diagnostic
                    </p>
                  ) : (
                    <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-800">
                      <Sparkles size={12} /> Suggestion indicative · à valider par votre Account Manager
                    </p>
                  )
                ) : null}
                <p className="mt-3 text-2xl font-extrabold text-ink-950">{formatOfferPrice(offer.price)}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{offer.summary}</p>

                <ul className="mt-4 flex-1 space-y-2">
                  {offer.missions.map((mission) => (
                    <li key={mission.key} className="flex items-start gap-2 text-xs leading-relaxed text-ink-700">
                      <Check size={14} className="mt-0.5 shrink-0 text-brand-700" />
                      <span>
                        {mission.title}
                        {mission.contentStatus === 'a_valider' ? <em className="ml-1 not-italic text-amber-700">· Contenu à valider</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-5"
                  variant={isRecommended ? 'primary' : 'outline'}
                  disabled={Boolean(active || pending) || submitting}
                  onClick={() => {
                    setSelected(offer)
                    setAcceptError('')
                    confirm.openFn()
                  }}
                >
                  {isPending ? 'Demande envoyée' : isCurrent ? 'Offre active' : active ? 'Une offre est déjà active' : pending ? 'Une demande est en attente' : 'Choisir cette offre'}
                </Button>
              </Card>
            )
          })}
        </div>
      ) : null}

      {!loading && !data?.locked && !data?.offers?.length && !active && !pending ? (
        <Alert tone="info" title="Aucune offre disponible">Les offres d’accompagnement seront publiées après votre restitution.</Alert>
      ) : null}

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 text-ink-400" />
          <p className="text-xs leading-relaxed text-ink-500">
            Le détail contractuel (périmètre, délais, modalités de paiement) vous est confirmé par votre Account Manager.
            Aucun paiement automatique n’est déclenché depuis cette page. Le catalogue d’accompagnement est distinct
            des abonnements Besoins et du SaaS.
          </p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400">
          <Clock3 size={12} /> Un contenu de mission marqué « Contenu à valider » sera précisé par votre Account Manager.
        </p>
      </Card>

      <Modal
        open={confirm.open}
        onClose={confirm.close}
        title="Confirmer la demande"
        description="Votre demande sera examinée par ALLNEEDS avant toute activation."
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-ink-50 p-4">
              <p className="text-sm font-semibold text-ink-950">{selected.name}</p>
              <p className="mt-1 text-sm text-ink-600">{selected.summary}</p>
              <p className="mt-2 text-2xl font-extrabold text-ink-950">{formatOfferPrice(selected.price)}</p>
            </div>
            {acceptError ? <Alert tone="danger">{acceptError}</Alert> : null}
            <p className="text-xs text-ink-500">
               En confirmant, votre choix est transmis à ALLNEEDS. Aucune mission n’est créée avant sa validation.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={confirm.close} disabled={submitting}>Annuler</Button>
               <Button onClick={confirmAccept} disabled={submitting}>{submitting ? 'Envoi…' : 'Envoyer la demande'}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

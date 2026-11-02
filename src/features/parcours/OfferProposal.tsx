import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { JourneyProgress } from '@/components/JourneyProgress'
import { LAUNCH_OFFER, PLANS, SECTOR_LABEL } from '@/data/catalog'
import type { MissionCode, MissionOffer, Sector } from '@/types'

const VOLET_ADVICE: Record<number, string> = {
  1: 'priorités concentrées sur l’organisation et la transformation de la demande',
  2: 'priorités concentrées sur l’image, l’acquisition et les avis',
  3: 'priorités concentrées sur l’équipe et la façon de travailler',
  4: 'priorités concentrées sur les charges et les prestataires',
}

function recommend(plans: MissionOffer[], voletCount: number): MissionCode {
  if (voletCount <= 1) return 'STARTER'
  if (voletCount === 2) return 'PRO'
  return 'PERFORMANCE'
}

/**
 * Proposition d'offre après restitution : recommandation reliée aux volets
 * détectés. Le comparatif complet reste sur la page (aucun doublon d'offres).
 */
export function OfferProposal({
  sector,
  currentStep,
  detectedVolets,
  chosenCode,
  onChoose,
  alreadySubscribed,
  error,
}: {
  sector: Sector
  currentStep: number
  detectedVolets: number[]
  chosenCode: string | null
  onChoose: (code: string) => void
  alreadySubscribed: boolean
  error?: string
}) {
  const plans = PLANS[sector]
  const recommended = recommend(plans, detectedVolets.length)
  const best = plans.find((plan) => plan.code === recommended) ?? plans[0]

  return (
    <div className="space-y-6">
      <JourneyProgress current={currentStep} />

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Étape 5 · Offre</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">
              L’offre adaptée à votre diagnostic
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              La recommandation découle des {detectedVolets.length} volet(s) où vos priorités se concentrent
              {detectedVolets.length
                ? ` — ${detectedVolets.map((id) => VOLET_ADVICE[id]).filter(Boolean).join(', ')}`
                : ''}.{' '}
              Vous restez libre de comparer les autres formules avant toute décision.
            </p>
          </div>
          <Badge tone={alreadySubscribed ? 'success' : 'brand'}>
            {alreadySubscribed ? 'Abonnement actif' : 'Offre de lancement'}
          </Badge>
        </div>

        {error ? <Alert tone="danger" className="mt-5">{error}</Alert> : null}

        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/50 p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-800">
            <Sparkles className="h-4 w-4" />
            Recommandé pour vous · {SECTOR_LABEL[sector]}
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-bold text-ink-950">{best.name}</p>
              <p className="mt-1 text-sm text-ink-600">{best.tagline}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {best.highlights.map((item) => (
                  <li key={item}>
                    <Badge>{item}</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold text-brand-800">
                {best.priceLaunch ?? best.priceNormal} DH
              </p>
              <p className="text-xs text-ink-500">{best.priceNote}</p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-700">
            <strong>Non inclus :</strong> {best.notIncluded.join(' · ')}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => onChoose(best.code)} disabled={chosenCode === best.code}>
              {chosenCode === best.code ? 'Offre choisie' : 'Choisir cette offre'}
              {chosenCode === best.code ? <Check className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
            <a href="#mission-offers-title">
              <Button variant="outline">Comparer toutes les formules</Button>
            </a>
            <a href="#access-offers-title">
              <Button variant="ghost">Comparer l’abonnement ACCÈS</Button>
            </a>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-ink-500">
          {chosenCode
            ? `Formule ${chosenCode} sélectionnée. Une mission n’est engagée qu’après échange, devis et validation écrite — jusqu’à là, aucun paiement n’est déclenché.`
            : `Offre de lancement jusqu’au ${LAUNCH_OFFER.deadline} · ${LAUNCH_OFFER.condition}. Aucun paiement automatique n’est déclenché depuis cette page.`}
        </p>
      </Card>
    </div>
  )
}

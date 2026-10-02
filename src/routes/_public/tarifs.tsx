import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Info } from 'lucide-react'
import { ACCESS_OFFERS, LAUNCH_OFFER, PLANS, SECTORS, SECTOR_ORDER } from '@/data/catalog'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CtaBand } from '@/components/marketing'
import { AccordionList } from '@/components/MissionPage'
import { Alert, Badge, Button, Card, SectionHeading } from '@/components/ui'
import type { Sector } from '@/types'
import { useSelectedSector } from '@/lib/sector-filter'

export const Route = createFileRoute('/_public/tarifs')({
  component: TarifsPage,
  head: () => ({
    meta: [
      { title: 'Tarifs — ALLNEEDS' },
      {
        name: 'description',
        content:
          'Prix de lancement et prix normal HT des missions STARTER, PRO et PERFORMANCE, et des abonnements ACCÈS. TVA 20 % en sus.',
      },
    ],
  }),
})

function TarifsPage() {
  const selectedSector = useSelectedSector()
  const visibleSectors: Sector[] = selectedSector ? [selectedSector] : SECTOR_ORDER
  return (
    <>
      <section className="border-b border-ink-100 bg-ink-50">
        <div className="container-page py-16">
          <p className="eyebrow">Tarifs</p>
          <h1 className="display-1 mt-4 max-w-3xl">Tous les prix, au même endroit.</h1>
          <p className="lede mt-5 max-w-2xl">
            Prix hors taxes, TVA 20 % en sus. L’offre de lancement s’applique jusqu’au {LAUNCH_OFFER.deadline}{' '}
            {LAUNCH_OFFER.condition}. Les abonnements ACCÈS ne sont pas concernés par cette offre.
          </p>
        </div>
      </section>

      <section className="container-page py-16">
        <SectionHeading
          eyebrow="Missions"
          title={selectedSector ? `Tarifs ${SECTORS[selectedSector].name}` : "Prix de lancement par secteur"}
          description="Le même cadre, des prix alignés sur la taille et la complexité de votre établissement."
        />

        <div className="mt-12 space-y-12">
          {visibleSectors.map((sector: Sector) => (
            <div key={sector}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl tracking-tight text-ink-950">{SECTORS[sector].name}</h2>
                  <p className="mt-1 text-sm text-ink-500">{SECTORS[sector].tagline}</p>
                </div>
                <Link to="/secteurs/$sector" params={{ sector }}>
                  <Button size="sm" variant="outline">
                    Voir la page
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {PLANS[sector].map((plan) => (
                  <Card key={plan.code} className={cn('p-6', plan.code === 'PRO' && 'border-brand-300')}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-ink-950">{plan.name}</p>
                      <Badge tone="brand">{plan.verb}</Badge>
                    </div>

                    <div className="mt-5 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-ink-500">Prix normal HT</span>
                        <span className="text-sm font-semibold tabular-nums text-ink-700">
                          {plan.priceNormal === 0 ? 'Offert' : money(plan.priceNormal)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-brand-700">Prix de lancement HT</span>
                        <span className="font-display text-2xl tabular-nums text-ink-950">
                          {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
                      <p className="flex items-center justify-between">
                        <span>Paiement</span>
                        <span className="font-medium text-ink-700">{plan.payment}</span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span>Délai</span>
                        <span className="text-right font-medium text-ink-700">{plan.delay}</span>
                      </p>
                    </div>

                    <Link to="/missions/$code" params={{ code: plan.code.toLowerCase() }} search={{ secteur: sector }} className="mt-6 block">
                      <Button size="sm" fullWidth variant="outline">
                        Fiche {plan.name}
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-ink-100 bg-ink-50 py-16">
        <div className="container-page">
          <SectionHeading eyebrow="Abonnement ACCÈS" title="Tarifs annuels HT" />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {ACCESS_OFFERS.map((offer) => (
              <Card key={offer.tier} className={cn('p-6', offer.featured && 'border-brand-300 shadow-lift')}>
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-ink-950">{offer.name}</p>
                  {offer.featured ? <Badge tone="brand">Populaire</Badge> : null}
                </div>
                <p className="mt-5 font-display text-4xl leading-none tracking-tight text-ink-950">
                  {money(offer.priceYear)}
                </p>
                <p className="mt-1.5 text-xs text-ink-500">HT / an</p>
                <p className="mt-4 text-sm text-ink-600">ou {money(offer.priceMonth)} HT par mois</p>
                <ul className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-600">
                  <li>{offer.needsPerYear} besoins par an (pool reportable)</li>
                  <li>{offer.providersPerNeed} prestataires par besoin</li>
                  <li>Première proposition sous {offer.firstProposal}</li>
                  <li>Réponse sous {offer.responseTime}</li>
                  {offer.missionDiscount > 0 ? <li>Remise {offer.missionDiscount} % sur PRO et PERFORMANCE</li> : null}
                </ul>
                <Link to="/inscription" search={{ offre: offer.tier }} className="mt-6 block">
                  <Button size="sm" fullWidth>
                    Choisir {offer.name}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="display-2">Questions sur les prix</h2>
            <div className="mt-8">
              <AccordionList
                items={[
                  {
                    q: 'Qu’est-ce que « HT » exactement ?',
                    a: 'Les prix sont affichés hors taxes. La TVA de 20 % s’applique en sus, avec facture à l’en-tête de votre établissement.',
                  },
                  {
                    q: 'L’offre de lancement s’applique-t-elle à l’abonnement ?',
                    a: 'Non. Les tarifs de l’abonnement ACCÈS ne sont pas concernés par l’offre de lancement des missions.',
                  },
                  {
                    q: 'Puis-je changer de niveau en cours d’année ?',
                    a: 'Oui, avec un prorata. L’écart est facturé ou remboursé sur la période restante.',
                  },
                  {
                    q: 'Les frais du prestataire sont-ils inclus ?',
                    a: 'Jamais. Le contrat est conclu directement entre vous et le prestataire, qui reste responsable de sa prestation.',
                  },
                  {
                    q: 'Comment se passe le paiement ?',
                    a: 'Missions : paiement unique. Abonnement : payable d’avance en une fois ou en 4 échéances trimestrielles. Les conditions précises figurent sur le devis.',
                  },
                  {
                    q: 'La remise abonné est-elle cumulable ?',
                    a: 'La remise de 10 % (PLUS) ou 15 % (PRIORITÉ) s’applique au prix normal des missions PRO et PERFORMANCE et n’est pas cumulable avec l’offre de lancement.',
                  },
                ]}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Alert tone="info" title="Ce qui n’est pas dans le prix" icon={<Info className="h-4 w-4" />}>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>Budget publicitaire : 3 000 DH par mois minimum conseillé pour PERFORMANCE.</li>
                <li>Prestataires : leur devis est conclu directement avec vous.</li>
                <li>Productions supplémentaires au-delà des limites écrites.</li>
              </ul>
            </Alert>

            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Offre de lancement</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                Valable jusqu’au <strong>{LAUNCH_OFFER.deadline}</strong> {LAUNCH_OFFER.condition}. Le diagnostic
                STARTER est offert pendant cette période.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                Contenus et informations nécessaires (textes, photos, accès) fournis par le client dans les délais
                convenus. 2 tours de retouches par livrable.
              </p>
              <Link to="/conditions" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                Lire les conditions complètes
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <CtaBand
        title="Le premier pas est offert"
        description="Réservez un diagnostic de 1h30. Vous repartez avec 3 priorités écrites, sans engagement."
      />
    </>
  )
}

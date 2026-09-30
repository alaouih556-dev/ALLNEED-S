import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  Network,
  Quote,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { ACCESS_OFFERS, LAUNCH_OFFER, PLANS, SECTORS, SECTOR_ORDER, SECTOR_LABEL } from '@/data/catalog'
import { money } from '@/lib/format'
import {
  ComparisonTable,
  CtaBand,
  FaqList,
  HighlightGrid,
  LeverGrid,
  MissionTabs,
  OneLiners,
  ReasonCards,
  SectorTabs,
  StepBlocks,
} from '@/components/marketing'
import { Badge, Button, Card, SectionHeading } from '@/components/ui'

export const Route = createFileRoute('/_public/')({
  component: HomePage,
  head: () => ({
    meta: [
      { title: 'ALLNEEDS — Comprendre · Structurer · Agir' },
      {
        name: 'description',
        content:
          'Réseau de solutions pour écoles privées, cliniques et hôtels. Diagnostic, structuration et accompagnement 30 jours. Prestataires vérifiés, un seul interlocuteur.',
      },
    ],
  }),
})

const STATS = [
  { value: '1h30', label: 'pour identifier vos 3 priorités', icon: Compass },
  { value: '4 à 6', label: 'semaines pour structurer', icon: FileSpreadsheet },
  { value: '30 jours', label: 'd’accompagnement et de suivi', icon: CalendarCheck },
  { value: '1', label: 'seul interlocuteur, du début à la fin', icon: Users },
]

function HomePage() {
  const plans = PLANS.enseignement
  const sector = SECTORS.enseignement

  return (
    <>
      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-fade mask-fade-b pointer-events-none absolute inset-0" />
        <div className="container-page relative py-16 sm:py-24">
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">Réseau de solutions</Badge>
                <Badge tone="warning">Diagnostic STARTER offert</Badge>
              </div>

              <h1 className="display-1 mt-6">
                Le besoin de votre établissement
                <span className="block italic text-brand-700">est le point de départ.</span>
              </h1>

              <p className="lede mt-6 max-w-xl">
                Vous formez, nous structurons. Nous identifions les priorités de votre établissement, construisons les
                solutions adaptées et mobilisons les compétences nécessaires. Un seul interlocuteur, des livrables
                concrets, un périmètre clair dès le départ.
              </p>

              <p className="mt-4 max-w-xl text-sm font-medium text-ink-500">
                Pour qui : {sector.audience}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/diagnostic">
                  <Button size="lg">
                    Commencer par le diagnostic offert
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/missions">
                  <Button size="lg" variant="outline">
                    Voir les 3 formules
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-xs text-ink-500">
                {LAUNCH_OFFER.label} · jusqu’au {LAUNCH_OFFER.deadline} {LAUNCH_OFFER.condition}
              </p>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-ink-100 bg-ink-50 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Votre parcours</p>
                <p className="mt-1 text-sm text-ink-600">
                  Diagnostic offert → Mission de structuration → Accompagnement 30 jours
                </p>
              </div>
              <div className="divide-y divide-ink-100">
                {plans.map((plan) => (
                  <div key={plan.code} className="flex items-start gap-4 px-6 py-5">
                    <span className="mt-0.5 font-display text-2xl text-sand-400">{plan.step}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink-950">{plan.name}</p>
                        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{plan.verb}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{plan.tagline}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl text-ink-950">
                        {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                      </p>
                      <p className="text-[0.65rem] text-ink-400">HT</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-ink-950 px-6 py-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-wider text-sand-300">Ou l’abonnement ACCÈS</p>
                <p className="mt-1.5 text-sm text-ink-200">
                  Un pool de besoins annuel, reportable sur 12 mois, à partir de {money(ACCESS_OFFERS[0].priceYear)} HT
                  par an.
                </p>
                <Link to="/acces" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  Voir les niveaux ACCÈS
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-4">
                <stat.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                <div>
                  <p className="font-display text-2xl leading-none tracking-tight text-ink-950">{stat.value}</p>
                  <p className="mt-1.5 text-xs text-ink-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Secteurs */}
      <section className="border-y border-ink-100 bg-ink-50 py-10">
        <div className="container-page flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-ink-700">Un même cadre, trois secteurs :</p>
          <SectorTabs />
        </div>
      </section>

      {/* ------------------------------------------------------- Méthode */}
      <section className="container-page py-20">
        <SectionHeading
          eyebrow="Comment ça marche"
          title="Trois étapes, un périmètre écrit"
          description="Nous ne vendons pas des livrables génériques. Chaque étape produit quelque chose d’utilisable immédiatement."
        />
        <div className="mt-14">
          <StepBlocks steps={sector.steps} />
        </div>
        <div className="mt-12">
          <MissionTabs />
        </div>
      </section>

      {/* --------------------------------------------------------- Leviers */}
      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Les 4 leviers"
            title="Nous travaillons ce qui pèse vraiment sur vos résultats"
            description="Inscriptions, image, équipe, charges : quatre leviers, quatre diagnostics, une seule priorité à la fois."
          />
          <div className="mt-14">
            <LeverGrid levers={sector.levers} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Formules */}
      <section className="container-page py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Nos formules"
            title="Choisissez votre point de départ"
            description="Le prix de lancement s’applique jusqu’au 31 octobre 2026 ou aux 5 premiers clients, selon la première échéance."
          />
          <Link to="/tarifs">
            <Button variant="outline" size="sm">
              Voir le comparatif complet
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.code}
              className={plan.code === 'PRO' ? 'relative border-brand-300 shadow-lift lg:-mt-4 lg:mb-4' : 'relative'}
            >
              {plan.code === 'PRO' ? (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-700 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                  Le plus choisi
                </span>
              ) : null}
              <div className="border-b border-ink-100 px-6 py-5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">{plan.step}</p>
                  <Badge tone="brand">{plan.verb}</Badge>
                </div>
                <h3 className="mt-3 font-display text-2xl tracking-tight text-ink-950">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <p className="font-display text-4xl leading-none tracking-tight text-ink-950">
                    {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                  </p>
                  {plan.priceLaunch !== null ? (
                    <>
                      <span className="text-sm text-ink-400 line-through">{money(plan.priceNormal)}</span>
                      <span className="text-xs font-semibold uppercase text-ink-500">HT</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-ink-500">{plan.priceNote}</p>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm leading-relaxed text-ink-600">{plan.tagline}</p>

                <p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-400">
                  Idéal si
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{plan.idealFor}</p>

                <ul className="mt-6 space-y-2.5">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {highlight}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/missions/$code" params={{ code: plan.code.toLowerCase() }}>
                    <Button size="sm" fullWidth>
                      Détail de la formule
                    </Button>
                  </Link>
                </div>

                <p className="mt-4 border-t border-ink-100 pt-4 text-xs italic text-ink-500">
                  « {plan.commitment} »
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- ACCÈS */}
      <section className="border-y border-ink-100 bg-ink-950 py-20 text-white">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow text-sand-300">ALLNEEDS ACCÈS</p>
              <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                L’abonnement qui trouve, vérifie et suit les prestataires dont votre établissement a besoin.
              </h2>
              <p className="mt-4 leading-relaxed text-ink-200">
                Vous exprimez un besoin. Nous le comprenons, sélectionnons et vérifions les prestataires adaptés, vous
                les présentons et suivons la mise en relation. Vous disposez d’un pool de besoins pour l’année : vous
                l’utilisez au rythme de votre activité, sans perdre ce que vous n’avez pas encore consommé.
              </p>
              <Link to="/acces" className="mt-7 inline-block">
                <Button className="bg-sand-400 text-ink-950 hover:bg-sand-300">
                  Découvrir les 3 niveaux
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {ACCESS_OFFERS.map((offer) => (
                <div
                  key={offer.tier}
                  className={
                    offer.featured
                      ? 'rounded-2xl border border-sand-400/40 bg-white/5 p-5 sm:-mt-3'
                      : 'rounded-2xl border border-white/10 bg-white/[0.03] p-5'
                  }
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{offer.name}</p>
                    {offer.featured ? (
                      <span className="rounded-full bg-sand-400 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-ink-950">
                        Populaire
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 font-display text-3xl leading-none">{money(offer.priceYear)}</p>
                  <p className="text-xs text-ink-400">HT / an · {money(offer.priceMonth)} par mois</p>
                  <ul className="mt-5 space-y-2 text-xs text-ink-200">
                    <li className="flex items-center gap-2">
                      <Network className="h-3.5 w-3.5 text-sand-300" /> {offer.needsPerYear} besoins par an
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-sand-300" /> {offer.providersPerNeed} prestataires par
                      besoin
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-sand-300" /> Vérification{' '}
                      {offer.verification === 'approfondie' ? 'approfondie' : 'de base'}
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Pourquoi */}
      <section className="container-page py-20">
        <SectionHeading
          eyebrow="Pourquoi ALLNEEDS"
          title="Votre établissement d’abord, pas un catalogue"
          align="center"
        />
        <div className="mt-14">
          <ReasonCards reasons={sector.reasons} />
        </div>
        <div className="mt-16">
          <HighlightGrid items={sector.highlights} />
        </div>
      </section>

      {/* ------------------------------------------------------- Preuves */}
      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="eyebrow">La différence</p>
            <h2 className="display-2 mt-3">Une phrase par formule, pas dix pages de catalogue.</h2>
            <p className="lede mt-4">
              Nos trois formules disent la même chose : nous partons de votre situation et nous livrons quelque chose
              d’utilisable.
            </p>
            <Link to="/missions" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
              Comparer les formules en détail
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <OneLiners
            lines={sector.oneLiner}
            links={{ STARTER: 'Voir STARTER', PRO: 'Voir PRO', PERFORMANCE: 'Voir PERFORMANCE' }}
          />
        </div>
      </section>

      {/* --------------------------------------------------- Comparatif */}
      <section className="container-page py-20">
        <SectionHeading
          eyebrow="Comparatif"
          title="Ce que contient chaque formule"
          description="Rien n’est caché. Les limites sont écrites, y compris ce que nous ne faisons pas."
        />
        <div className="mt-12">
          <ComparisonTable rows={sector.comparison} />
        </div>
      </section>

      {/* ----------------------------------------------------- Engagement */}
      <section className="container-page pb-8">
        <Card className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-700" />
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Nos engagements écrits</p>
            </div>
            <h3 className="mt-4 font-display text-2xl tracking-tight text-ink-950">
              Un cadre qui protège les familles et la direction.
            </h3>
            <ul className="mt-5 grid gap-3 text-sm text-ink-600 sm:grid-cols-2">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Aucune donnée nominative d’élève utilisée.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Images d’enfants uniquement avec autorisation écrite des représentants légaux.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Le site, les réseaux sociaux et les comptes publicitaires restent votre propriété.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                2 tours de retouches par livrable, toute production supplémentaire est une prestation à part.
              </li>
            </ul>
          </div>
          <Link to="/diagnostic" className="lg:w-56">
            <Button size="lg" fullWidth>
              Diagnostic offert
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section className="container-page py-20">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="eyebrow">Questions fréquentes</p>
            <h2 className="display-2 mt-3">Les questions qu’on nous pose avant de signer.</h2>
            <p className="mt-4 text-sm text-ink-600">
              Une autre question ? Écrivez-nous, nous répondons sous 24 h ouvrées.
            </p>
            <Link to="/faq" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
              Voir toutes les questions
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <FaqList items={sector.faq.slice(0, 4)} />
        </div>
      </section>

      {/* ------------------------------------------------------ Témoignage */}
      <section className="container-page pb-20">
        <Card className="relative overflow-hidden p-8 sm:p-12">
          <Quote className="absolute right-8 top-8 h-16 w-16 text-ink-50" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Référence Enseignement</p>
            <p className="mt-5 font-display text-2xl leading-snug tracking-tight text-ink-900">
              « Nous avions 300 demandes sur papier. En six semaines, nous avions un parcours d’inscription écrit, une
              page en ligne et une équipe qui sait exactement quoi faire. »
            </p>
            <p className="mt-5 text-sm text-ink-500">
              Amina Bennani, directrice — <span className="font-semibold text-ink-700">École Al Amal, Casablanca</span>
            </p>
            <p className="mt-4 text-xs text-ink-400">
              Données de démonstration. Les références réelles sont communiquées lors du premier rendez-vous.
            </p>
          </div>
        </Card>
      </section>

      <CtaBand
        title="Commencez par le diagnostic OFFERT"
        description="1h30 pour identifier vos 3 priorités, sans engagement. Vous repartez avec un livrable écrit, même si vous ne travaillez pas avec nous ensuite."
      />

      <section className="container-page pb-20">
        <p className="text-center text-xs text-ink-400">
          Vous souhaitez d’abord voir les prestataires que nous pouvons mobiliser ?{' '}
          <Link to="/secteurs" className="font-semibold text-brand-700">
            Comparez nos trois secteurs ({SECTOR_ORDER.map((s) => SECTOR_LABEL[s]).join(', ')})
          </Link>
        </p>
      </section>
    </>
  )
}

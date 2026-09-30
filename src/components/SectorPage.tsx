import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { LAUNCH_OFFER, PLANS, SECTORS } from '@/data/catalog'
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
import { Alert, Badge, Button, Card, SectionHeading } from '@/components/ui'
import type { Sector } from '@/types'

export function SectorPage({ sector }: { sector: Sector }) {
  const content = SECTORS[sector]
  const plans = PLANS[sector]

  return (
    <>
      <section className="border-b border-ink-100 bg-ink-50">
        <div className="container-page py-12">
          <div className="mb-8">
            <SectorTabs active={sector} />
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="eyebrow">{content.name}</p>
              <h1 className="display-1 mt-4">{content.tagline}</h1>
              <p className="lede mt-5 max-w-xl">{content.promise}</p>
              <p className="mt-4 text-sm font-medium text-ink-500">Pour qui : {content.audience}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/diagnostic">
                  <Button size="lg">
                    Diagnostic STARTER offert
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/missions" search={{ secteur: sector }}>
                  <Button size="lg" variant="outline">
                    Comparer les formules
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-ink-100">
                {plans.map((plan) => (
                  <div key={plan.code} className="flex items-start gap-4 px-6 py-5">
                    <span className="mt-0.5 font-display text-2xl text-sand-400">{plan.step}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink-950">{plan.name}</p>
                        <Badge tone="brand">{plan.verb}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">{plan.delay}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl text-ink-950">
                        {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                      </p>
                      <p className="text-[0.65rem] text-ink-400">
                        {plan.priceLaunch === null ? plan.payment : `${plan.payment} · HT`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <SectionHeading eyebrow="Comment ça marche" title="Comprendre · Structurer · Agir" />
        <div className="mt-14">
          <StepBlocks steps={content.steps} />
        </div>
        <div className="mt-12">
          <MissionTabs />
        </div>
      </section>

      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Les leviers" title={`Les ${content.levers.length} leviers que nous travaillons`} />
          <div className="mt-14">
            <LeverGrid levers={content.levers} />
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <SectionHeading eyebrow="Pourquoi ALLNEEDS" title="Votre établissement d’abord" align="center" />
        <div className="mt-14">
          <ReasonCards reasons={content.reasons} />
        </div>
        <div className="mt-16">
          <HighlightGrid items={content.highlights} />
        </div>
      </section>

      <section className="container-page pb-20">
        <SectionHeading
          eyebrow="Formules"
          title="Trois formules, un périmètre écrit"
          description={`Offre de lancement jusqu’au ${LAUNCH_OFFER.deadline} ${LAUNCH_OFFER.condition}.`}
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.code} className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">{plan.step}</p>
                <Badge tone="brand">{plan.verb}</Badge>
              </div>
              <h3 className="mt-3 font-display text-2xl tracking-tight text-ink-950">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="font-display text-3xl leading-none tracking-tight text-ink-950">
                  {plan.priceLaunch === null ? 'Offert' : money(plan.priceLaunch)}
                </p>
                {plan.priceLaunch !== null ? (
                  <span className="text-xs text-ink-400 line-through">{money(plan.priceNormal)}</span>
                ) : null}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-600">{plan.tagline}</p>
              <ul className="mt-5 space-y-2">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                to="/missions/$code"
                params={{ code: plan.code.toLowerCase() }}
                search={{ secteur: sector }}
                className="mt-6"
              >
                <Button size="sm" fullWidth variant={plan.code === 'PRO' ? 'primary' : 'outline'}>
                  Voir la fiche {plan.name}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Comparatif" title="Formule par formule, ligne par ligne" />
          <div className="mt-12">
            <ComparisonTable rows={content.comparison} />
          </div>
        </div>
      </section>

      {content.awarenessNote ? (
        <section className="container-page py-16">
          <Alert tone="warning" title="À savoir" icon={<Info className="h-4 w-4" />}>
            {content.awarenessNote}
          </Alert>
        </section>
      ) : null}

      {content.extraNotes.length > 0 ? (
        <section className="container-page pb-16">
          <div className="grid gap-5 md:grid-cols-3">
            {content.extraNotes.map((note) => (
              <Card key={note.title} className="p-5">
                <p className="text-sm font-semibold text-ink-950">{note.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{note.detail}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container-page py-20">
        <SectionHeading eyebrow="La différence" title="Une phrase par formule" align="center" />
        <div className="mt-14">
          <OneLiners
            lines={content.oneLiner}
            links={{ STARTER: 'Voir STARTER', PRO: 'Voir PRO', PERFORMANCE: 'Voir PERFORMANCE' }}
          />
        </div>
      </section>

      <section className="container-page pb-20">
        <SectionHeading eyebrow="FAQ" title={`Questions fréquentes ${sector === 'enseignement' ? 'ENSEIGNEMENT' : ''}`} />
        <div className="mt-12">
          <FaqList items={content.faq} />
        </div>
      </section>

      <CtaBand
        title="Commencez par le diagnostic OFFERT"
        description="1h30 pour identifier vos 3 priorités, sans engagement. Vous repartez avec un livrable écrit, même si vous ne travaillez pas avec nous ensuite."
      />
    </>
  )
}

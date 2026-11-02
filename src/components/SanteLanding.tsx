import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  Clock3,
  ShieldCheck,
  HeartPulse,
  Target,
} from 'lucide-react'
import { Button, Card, Badge, SectionHeading } from '@/components/ui'
import { cn } from '@/lib/utils'
import { FaqList } from '@/components/marketing'

/* ------------------------------------------------------------------ */
/* Données (contenu calqué sur la référence allneeds-sante)           */
/* ------------------------------------------------------------------ */

const HERO = {
  title: 'Votre structure de santé peut mieux fonctionner. Identifions vos priorités.',
  lead:
    'Un diagnostic gratuit de 30 min pour comprendre votre organisation et définir vos prochaines priorités, lors d’un rendez-vous dédié.',
  cta: 'Découvrir le diagnostic et demander un rendez-vous',
  secondary: 'Voir comment le diagnostic se déroule',
  sub: 'Gratuit · 30 min · Sur rendez-vous · Sans engagement',
}

const PRIORITES = [
  'Une priorité visible pour vous',
  'Un levier discret mais décisif',
  "Ce que votre équipe attend",
]

const POURQUOI = [
  {
    title: 'Votre structure d’abord',
    detail: 'Nous partons de votre organisation, pas d’un catalogue de services.',
  },
  {
    title: 'Un cadre qui respecte votre profession',
    detail: 'Communication informative, aucune promesse médicale, aucun conseil clinique.',
  },
  {
    title: 'Un seul interlocuteur',
    detail: 'Nous mobilisons les compétences nécessaires, vous n’avez pas à chercher dix prestataires.',
  },
]

const DIAGNOSTIC = {
  title: 'Diagnostic 360°',
  intro: 'Un échange cadré, structuré et sans engagement pour faire le point sur votre structure de santé.',
  items: [
    { label: 'Gratuit', detail: 'Le diagnostic complet est offert lors d’un rendez-vous dédié.' },
    { label: '30 min', detail: 'Le temps d’analyser les enjeux d’organisation de votre structure.' },
    { label: '3 priorités', detail: 'Vous repartez avec trois priorités et des pistes d’action adaptées.' },
    { label: 'Sans engagement', detail: 'Vous décidez librement de poursuivre ou non après le diagnostic.' },
  ],
}

const AXES = [
  { title: 'Patients et développement', detail: 'Parcours patient, rendez-vous, relance, suivi.' },
  { title: 'Visibilité et confiance', detail: 'Présence en ligne informative, avis, image de la structure.' },
  { title: 'Équipe et organisation', detail: 'Rôles, accueil, protocoles, outils de suivi.' },
  { title: 'Charges et équipements', detail: 'Matériel, maintenance, assurances, contrats, fournisseurs.' },
  {
    title: 'Accompagnement et financement',
    detail: 'Accès aux programmes de financement auxquels votre structure peut prétendre.',
  },
]

const STEPS = [
  { number: '1', title: 'Prendre rendez-vous', detail: 'Choisissez un créneau pour votre diagnostic gratuit.' },
  { number: '2', title: 'Faire le diagnostic', detail: 'Pendant 30 min, nous analysons les enjeux d’organisation de votre structure.' },
  { number: '3', title: 'Recevoir vos priorités', detail: 'Vous repartez avec trois priorités et des pistes d’action adaptées.' },
]

/* Mini-questionnaire (référence : 5 questions Oui / Pas vraiment) */
const QUESTIONS: [string, string][] = [
  ['Mon agenda est rempli comme je le souhaite.', 'Patients et développement'],
  ['Mes patients me trouvent facilement en ligne et me font confiance.', 'Visibilité et confiance'],
  ['Chacun connaît son rôle à l’accueil, sans me solliciter.', 'Équipe et organisation'],
  ["Je connais mes charges (matériel, assurances, logiciels) et je les ai comparées.", 'Charges et équipements'],
  ["Je connais les programmes de financement auxquels ma structure peut prétendre.", 'Accompagnement et financement'],
]

/* Offres : noms actuels du projet (STARTER n’est pas affiché) */
const OFFRES = [
  {
    code: 'BASIQUE',
    verb: 'Comprendre',
    price: 3445,
    note: 'Diagnostic et état des lieux',
    included: ['Cartographier votre structure', 'Révéler vos 3 priorités'],
  },
  {
    code: 'PRO',
    verb: 'Structurer',
    price: 6445,
    note: 'Mission de structuration · paiement unique',
    included: ['Construire vos parcours et protocoles', 'Renforcer votre visibilité', 'Installer vos outils de pilotage'],
  },
  {
    code: 'PERFORMANCE',
    verb: 'Agir',
    price: 10945,
    note: 'Structuration + accompagnement 30 jours · paiement unique',
    included: ['Mettre en œuvre votre plan d’action', 'Piloter et ajuster avec vous', 'Optimiser vos charges'],
  },
]

/* Abonnements besoins : noms actuels du projet (CONNECT/PLUS/PRIORITÉ non affichés) */
const ABONNEMENTS = [
  { name: 'ESSENTIEL', price: 149, period: 'mois', tagline: 'Accès au réseau.' },
  { name: 'AVANCÉ', price: 349, period: 'mois', tagline: 'Comparer et suivre.' },
  { name: 'PREMIUM', price: 549, period: 'mois', tagline: 'Un accompagnement prioritaire.' },
]

const LAUNCH = {
  title: 'Offre de lancement',
  detail: '20 % de remise pour les 10 premiers clients qui souscrivent Pro ou Performance.',
  condition: "Les abonnements Accès Santé sont exclus de l’offre de lancement.",
}

const CONFIANCE = {
  title: 'Un cadre qui respecte votre profession',
  intro: 'Nous n’intervenons jamais sur l’acte médical.',
  detail:
    'Aucun accès aux dossiers patients : seulement des données d’organisation. Une communication informative, sans promesse médicale. Un seul interlocuteur, un périmètre clair dès le départ.',
}

const FAQ = [
  {
    q: 'Le diagnostic est-il vraiment gratuit ?',
    a: 'Oui. Le diagnostic complet est gratuit et se déroule sur rendez-vous pendant 30 min. Il est sans engagement. Votre compte-rendu est utilisable même si vous ne donnez aucune suite. Le mini-questionnaire en ligne est une première indication et ne remplace pas ce rendez-vous.',
  },
  {
    q: 'Le diagnostic m’engage-t-il à acheter une formule ?',
    a: 'Non. Le diagnostic est gratuit et sans engagement. Vous décidez librement si vous souhaitez poursuivre après avoir découvert vos priorités et les modalités d’accompagnement.',
  },
  {
    q: 'Promettez-vous des résultats chiffrés ?',
    a: 'Non, pas avant analyse. Nous identifions, mesurons, ajustons et rendons compte.',
  },
  {
    q: 'Quelles informations dois-je fournir ?',
    a: 'Uniquement des informations d’organisation : agenda, accueil, équipe, charges. Aucun dossier patient. Vos documents sont conservés 90 jours si aucune suite n’est donnée.',
  },
]

/* ------------------------------------------------------------------ */
/* Mini-questionnaire                                                 */
/* ------------------------------------------------------------------ */

function MiniQuestionnaire() {
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null, null, null])

  const handle = (i: number, valeur: boolean) => {
    const next = answers.slice()
    next[i] = valeur
    setAnswers(next)
  }

  const complete = answers.every((a) => a !== null)
  const gaps = complete
    ? QUESTIONS.filter((_, i) => !answers[i]).map(([, lever]) => lever)
    : []

  return (
    <section className="border-y border-ink-100 bg-white">
      <div className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Vous préférez commencer en ligne ?</p>
          <h2 className="display-2">Répondez à cinq questions pour une première indication</h2>
          <p className="lede mt-4">
            Ce mini-questionnaire ne remplace pas le diagnostic complet de 30 min sur rendez-vous. Il donne une
            première tendance sur les leviers à activer.
          </p>
        </div>

        <div className="mt-10 mx-auto max-w-xl space-y-3">
          {QUESTIONS.map(([q, lever], i) => (
            <Card key={q} className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-[0.7rem] font-bold text-brand-800">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-ink-700">{q}</p>
                  <p className="mt-1 text-xs text-ink-500">{lever}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Oui', 'Pas vraiment'].map((label, k) => {
                  const pressed = answers[i] === (k === 0)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handle(i, k === 0)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        pressed
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400 hover:text-ink-950',
                      )}
                      aria-pressed={pressed ? 'true' : 'false'}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>

        {complete && (
          <div className="mt-10 mx-auto max-w-xl">
            <Card className="p-6 sm:p-8 border-brand-200 bg-brand-50/40">
              {gaps.length > 0 ? (
                <>
                  <h3 className="font-display text-base font-semibold text-ink-950">
                    Vos réponses font apparaître {gaps.length} zone{gaps.length > 1 ? 's' : ''} d’attention
                  </h3>
                  <p className="mt-2 text-sm text-ink-600">{gaps.join(', ')}.</p>
                </>
              ) : (
                <>
                  <h3 className="font-display text-base font-semibold text-ink-950">
                    Les 5 leviers vous semblent en place
                  </h3>
                  <p className="mt-2 text-sm text-ink-600">
                    Le diagnostic complet vous dira où se cache encore un potentiel.
                  </p>
                </>
              )}
              <p className="mt-4 text-sm text-ink-600">
                Cette indication en ligne ne remplace pas le diagnostic complet gratuit de 30 min sur rendez-vous.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <Link to="/inscription">
                  <Button size="lg" className="w-full sm:w-auto">
                    Demander un rendez-vous pour le diagnostic <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="fine text-xs text-ink-500">Mini-questionnaire indicatif, pas un score ni un diagnostic.</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function SanteLanding() {
  return (
    <div className="overflow-hidden bg-white text-ink-950">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-white border-b border-ink-100">
        <div className="allneeds-hero-bg" aria-hidden="true">
          <img
            src="/allneeds-sante-morocco-hero.png"
            alt=""
            className="allneeds-hero-bg-image"
          />
          <div className="allneeds-hero-bg-overlay" />
          <div className="allneeds-hero-light-sweep" />
          <div className="allneeds-hero-glow allneeds-hero-glow-a" />
          <div className="allneeds-hero-glow allneeds-hero-glow-b" />
        </div>
        <div className="container-page py-16 sm:py-20 lg:py-24 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/90 px-4 py-2 text-sm font-semibold text-brand-800 shadow-sm">
              <HeartPulse className="h-4 w-4" /> ALLNEEDS SANTÉ
            </div>
            <h1 className="mt-6 max-w-xl font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-3xl lg:text-[3.2rem]">
              {HERO.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-ink-600">{HERO.lead}</p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <Link to="/diagnostic">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  {HERO.secondary} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-sm text-ink-500">{HERO.sub}</p>
          </div>

          <div className="mt-10 lg:mt-0 max-w-[820px]">
            <Card className="p-4 sm:p-5 border-brand-200 bg-white/94 backdrop-blur-[10px]">
              <div className="flex items-start gap-2 mb-2">
                <span className="shrink-0 text-xs font-semibold text-brand-800 uppercase tracking-wider">Votre compte-rendu</span>
              </div>
              <h3 className="font-display text-base font-semibold text-ink-950 mb-3">Vos 3 priorités</h3>
              <ol className="space-y-2 text-sm text-ink-700">
                {PRIORITES.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-xl bg-brand-50/50 p-2.5 border-l-4 border-brand-700">
                    <span className="shrink-0 rounded-full bg-brand-700 px-2 py-0.5 text-[0.7rem] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="opacity-60 select-none">{p}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-ink-500">
                Elles se dévoilent à l’issue du diagnostic complet de 30 min.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pourquoi ALLNEEDS */}
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Pourquoi ALLNEEDS Santé"
            title="La proposition de valeur pour les professionnels de santé"
            description="Une approche qui part de votre organisation, pas d’un catalogue."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {POURQUOI.map((r, i) => (
              <Card key={r.title} className="p-6 sm:p-8 group hover:shadow-lift transition">
                <span className="font-display text-3xl text-sand-400 group-hover:text-brand-400 transition-colors">
                  0{i + 1}
                </span>
                <h3 className="mt-3 text-base font-semibold text-ink-950">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{r.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Diagnostic 360° */}
      <section className="border-y border-ink-100 bg-ink-50">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Diagnostic 360°</p>
            <h2 className="display-2">Un diagnostic offert, structuré, sans engagement</h2>
            <p className="lede mt-4">{DIAGNOSTIC.intro}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DIAGNOSTIC.items.map((item) => (
              <Card key={item.label} className="p-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 mx-auto mb-4">
                  {item.label === 'Gratuit' ? (
                    <Check className="h-5 w-5" />
                  ) : item.label === '30 min' ? (
                    <Clock3 className="h-5 w-5" />
                  ) : item.label === '3 priorités' ? (
                    <Target className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <h3 className="font-display text-base font-semibold text-ink-950">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Les 5 axes */}
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Cinq leviers pour votre structure</p>
            <h2 className="display-2">Les axes que nous passons en revue ensemble</h2>
            <p className="lede mt-4">Chaque axe est examiné lors du diagnostic pour faire émerger vos priorités.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {AXES.map((axe) => (
              <Card key={axe.title} className="p-6 sm:p-8 group hover:-translate-y-1 transition">
                <h3 className="font-display text-sm font-semibold text-ink-950 leading-snug">{axe.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{axe.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça se passe */}
      <section className="border-y border-ink-100 bg-white">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Parcours simple</p>
            <h2 className="display-2">Comment le diagnostic se déroule</h2>
            <p className="lede mt-4">Trois rendez-vous d’esprit, de la prise de contact à vos priorités.</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="relative pl-10">
                <span className="absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                  {step.number}
                </span>
                <h3 className="font-display text-base font-semibold text-ink-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mini-questionnaire */}
      <MiniQuestionnaire />

      {/* Offres */}
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Après le diagnostic</p>
            <h2 className="display-2">Un accompagnement adapté à vos priorités</h2>
            <p className="lede mt-4">
              Après le diagnostic, vous choisissez librement de poursuivre ou non. Les noms ci-dessous sont ceux du
              catalogue ALLNEEDS actuel.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {OFFRES.map((offre) => (
              <Card key={offre.code} className="p-6 sm:p-8 flex flex-col">
                <Badge tone="brand">{offre.code}</Badge>
                <h3 className="mt-4 font-display text-base font-semibold text-ink-950">{offre.verb}</h3>
                <p className="mt-1 text-xs text-ink-500">{offre.note}</p>
                <ul className="mt-6 space-y-2 text-sm text-ink-700">
                  {offre.included.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-xl border-l-4 border-brand-700 bg-brand-50/50 p-6 sm:p-8">
            <p className="font-semibold text-ink-950">{LAUNCH.title}</p>
            <p className="mt-2 text-sm text-ink-600">{LAUNCH.detail}</p>
            <p className="mt-2 text-xs text-ink-500">{LAUNCH.condition}</p>
          </div>
        </div>
      </section>

      {/* Abonnements besoins (présentation courte) */}
      <section className="border-y border-ink-100 bg-ink-50 py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Abonnement besoins</p>
            <h2 className="display-2">Trouver, vérifier et suivre vos prestataires</h2>
            <p className="lede mt-4">
              L’abonnement Accès Santé vous donne accès à un réseau de prestataires vérifiés, selon votre rythme.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {ABONNEMENTS.map((a) => (
              <Card key={a.name} className="p-6 sm:p-8 text-center">
                <Badge tone="brand">{a.name}</Badge>
                <p className="mt-2 text-sm text-ink-600">{a.tagline}</p>
              </Card>
            ))}
          </div>
          <p className="mt-10 text-center text-xs text-ink-500">
            Les détails des formules et des abonnements sont communiqués lors d’un échange.
          </p>
        </div>
      </section>

      {/* Confiance */}
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl">
            <p className="eyebrow">Engagements</p>
            <h2 className="display-2">{CONFIANCE.title}</h2>
            <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50/40 p-6 sm:p-8">
              <p className="font-semibold text-ink-950">{CONFIANCE.intro}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{CONFIANCE.detail}</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-ink-700">
              {[
                'Diagnostic gratuit de 30 min, sur rendez-vous et sans engagement.',
                'Confidentialité de vos échanges et de vos données d’organisation.',
                'Aucune donnée de dossier patient n’est requise ni consultée.',
                'Un compte-rendu structuré avec vos 3 priorités.',
                'Un accompagnement professionnel par un interlocuteur unique.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y border-ink-100 bg-white py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-3xl">
            <p className="eyebrow">Questions fréquentes</p>
            <h2 className="display-2">Ce qu’il faut savoir avant de réserver</h2>
            <FaqList items={FAQ} />
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 sm:py-24">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink-950 px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-16 lg:py-20">
            <div className="relative max-w-2xl mx-auto text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">
                Prendre rendez-vous
              </p>
              <h2 className="mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl">
                Faisons le point sur votre structure de santé.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-200">
                Diagnostic gratuit de 30 min, sur rendez-vous et sans engagement.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row sm:justify-center gap-3">
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    Contacter notre équipe <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-xs text-ink-400">
                ALLNEEDS Santé · Cabinets · Centres · Laboratoires · Paramédical
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, CheckCircle2, HeartPulse, Hotel, Layers3, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react'
import { SECTORS } from '@/data/catalog'
import { Badge, Button, Card, SectionHeading } from '@/components/ui'

export const Route = createFileRoute('/_public/')({
  component: HomePage,
  head: () => ({
    meta: [
      { title: 'ALLNEEDS — Une plateforme, trois univers métier' },
      { name: 'description', content: 'ALLNEEDS accompagne les entreprises dans trois secteurs : Santé, Enseignement et Tourisme. Choisissez votre secteur pour découvrir un parcours et des outils adaptés.' },
    ],
  }),
})

const sectors = [
  {
    id: 'sante' as const,
    icon: HeartPulse,
    label: 'Santé',
    subtitle: 'Cabinets, centres de santé, laboratoires et professions paramédicales',
    accent: 'Patients · organisation · charges · visibilité',
  },
  {
    id: 'enseignement' as const,
    icon: Building2,
    label: 'Enseignement',
    subtitle: 'Écoles privées, crèches, centres de formation et soutien scolaire',
    accent: 'Inscriptions · équipe · communication · prestataires',
  },
  {
    id: 'tourisme' as const,
    icon: Hotel,
    label: 'Tourisme',
    subtitle: 'Hôtels, riads, restaurants, agences et opérateurs d’activités',
    accent: 'Réservations · exploitation · restauration · expériences',
  },
]

function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-ink-100">
        <div className="grid-fade mask-fade-b pointer-events-none absolute inset-0" />
        <div className="container-page relative py-20 sm:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <div className="flex justify-center gap-2"><Badge tone="brand">ALLNEEDS</Badge><Badge tone="neutral">Plateforme multi-sectorielle</Badge></div>
            <h1 className="display-1 mt-7">Un seul écosystème pour <span className="italic text-brand-700">comprendre, structurer et piloter</span> vos besoins professionnels.</h1>
            <p className="lede mx-auto mt-7 max-w-3xl">ALLNEEDS ne vous affiche pas trois métiers mélangés. La page d’accueil présente le projet dans son ensemble, puis vous choisissez votre secteur. À partir de ce choix, le parcours, les contenus, les diagnostics et les outils deviennent spécifiques à votre activité.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a href="#secteurs"><Button size="lg">Choisir mon secteur <ArrowRight className="h-4 w-4" /></Button></a>
              <Link to="/connexion"><Button size="lg" variant="outline">Connexion aux espaces</Button></Link>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
            <Card className="p-5"><Layers3 className="h-5 w-5 text-brand-700" /><p className="mt-3 font-semibold text-ink-950">1. Choisir son secteur</p><p className="mt-2 text-sm leading-relaxed text-ink-500">La navigation se spécialise immédiatement pour éviter les contenus inutiles.</p></Card>
            <Card className="p-5"><Stethoscope className="h-5 w-5 text-brand-700" /><p className="mt-3 font-semibold text-ink-950">2. Diagnostiquer les priorités</p><p className="mt-2 text-sm leading-relaxed text-ink-500">ALLNEEDS part de la réalité de la structure avant de proposer une mission ou un outil.</p></Card>
            <Card className="p-5"><ShieldCheck className="h-5 w-5 text-brand-700" /><p className="mt-3 font-semibold text-ink-950">3. Ouvrir les bons accès</p><p className="mt-2 text-sm leading-relaxed text-ink-500">Les SaaS peuvent être visibles dans l’espace client tout en restant verrouillés jusqu’à validation par l’administrateur.</p></Card>
          </div>
        </div>
      </section>

      <section id="secteurs" className="container-page py-20">
        <SectionHeading eyebrow="Votre point d’entrée" title="Choisissez votre secteur" description="Vous ne verrez ensuite que le contenu réellement utile à votre métier. Les trois univers restent séparés." align="center" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {sectors.map((sector) => {
            const content = SECTORS[sector.id]
            return (
              <Link key={sector.id} to="/secteurs/$sector" params={{ sector: sector.id }} className="group">
                <Card className="h-full p-7 transition duration-200 group-hover:-translate-y-1 group-hover:border-brand-300 group-hover:shadow-lift">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><sector.icon className="h-6 w-6" /></div>
                  <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">ALLNEEDS {sector.label}</p>
                  <h2 className="mt-2 font-display text-3xl tracking-tight text-ink-950">{content.tagline}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-ink-600">{sector.subtitle}</p>
                  <div className="mt-6 rounded-xl bg-ink-50 p-4 text-xs font-medium text-ink-600">{sector.accent}</div>
                  <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-brand-700">Entrer dans ce secteur <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="border-y border-ink-100 bg-ink-50 py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Le socle ALLNEEDS" title="Une méthode commune, des applications différentes" description="Quel que soit le secteur, le principe reste le même : partir d’un besoin réel, clarifier les priorités, construire une solution et suivre sa mise en œuvre." />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Comprendre', 'Diagnostic structuré et collecte des faits avant toute recommandation.'],
              ['02', 'Structurer', 'Parcours, procédures, tableaux de bord, livrables et organisation.'],
              ['03', 'Agir', 'Mise en œuvre, pilotage, suivi des résultats et ajustements.'],
              ['04', 'Connecter', 'Prestataires, besoins, devis et suivi selon les accès autorisés.'],
            ].map(([n, title, text]) => <Card key={n} className="p-5"><span className="font-display text-3xl text-sand-400">{n}</span><p className="mt-4 font-semibold text-ink-950">{title}</p><p className="mt-2 text-sm leading-relaxed text-ink-500">{text}</p></Card>)}
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="rounded-3xl bg-ink-950 p-8 text-white sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><div className="flex items-center gap-2 text-sand-300"><Sparkles className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">UX séparée par rôle</span></div><h2 className="mt-4 font-display text-4xl tracking-tight">Client, Concierge et Administrateur n’ont pas le même écran.</h2><p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-200">Le client suit sa structure. Le concierge ne voit que les entreprises et secteurs attribués ou apportés par lui. L’administrateur gère les comptes, les affectations et les droits d’accès.</p></div>
            <Link to="/connexion"><Button size="lg" variant="secondary">Voir les 3 espaces <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </section>
    </>
  )
}

import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock3, FileCheck2, MessagesSquare, ShieldCheck } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { JourneyProgress } from '@/components/JourneyProgress'

const PROMISES = [
  {
    icon: Clock3,
    title: '10 minutes',
    detail: 'Vous répondez à un questionnaire court et cadré. Aucune donnée de patient, d’élève ou de voyageur.',
  },
  {
    icon: FileCheck2,
    title: 'Vos documents',
    detail: 'Vous préparez ce qui manque à votre dossier, sans attendre le rendez-vous.',
  },
  {
    icon: MessagesSquare,
    title: 'Un concierge',
    detail: 'Une personne identifiée lit votre demande et vous recontacte pour caler un point.',
  },
  {
    icon: ShieldCheck,
    title: 'Vos priorités',
    detail: 'Vous recevez une restitution hiérarchisée, vérifiable ligne à ligne, puis une offre adaptée.',
  },
]

/**
 * Introduction du parcours client : cadrage, secteur et première étape.
 */
export function JourneyIntro({
  sector,
  currentStep,
  companyName,
  started,
  onStart,
}: {
  sector: SectorKey
  currentStep: number
  companyName: string
  started: boolean
  onStart: () => void
}) {
  const pack = PACKS[sector]

  return (
    <div className="space-y-6">
      <JourneyProgress current={currentStep} />

      <Card className="overflow-hidden p-0">
        <div className="bg-ink-950 px-5 py-7 sm:px-8 sm:py-9">
          <p className="eyebrow text-sand-300">Espace {pack.labelUpper} · {companyName}</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
            D’abord comprendre.
            <br />
            Ensuite décider.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-200 sm:text-base">
            Votre parcours ALLNEEDS tient en cinq temps : un diagnostic court, la préparation de vos
            documents, un rendez-vous avec votre concierge, une restitution de vos priorités, puis le
            niveau d’accompagnement qui vous convient.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={onStart}
              className="rounded-full"
              size="lg"
            >
              {started ? 'Reprendre mon diagnostic' : 'Commencer mon diagnostic'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Link to="/app/documents">
              <Button variant="outline" size="lg" className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Préparer mes documents
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-px bg-ink-100 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="bg-white p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-sm font-bold text-ink-950">{title}</p>
              <p className="mt-1.5 text-xs leading-5 text-ink-500">{detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">Votre questionnaire</p>
        <h2 className="mt-3 font-display text-xl font-bold text-ink-950">
          Diagnostic {pack.label} · 4 volets
        </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
            Chaque volet couvre un chantier précis de votre établissement. Vous répondez sur une échelle de 1
            à 5, vous pouvez revenir en arrière à tout moment, et vos réponses sont conservées.
          </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {pack.volets.map((volet, index) => (
            <li key={volet.id} className="flex gap-3 rounded-xl border border-ink-100 p-4">
              <span className="font-display text-lg font-bold leading-none text-brand-700">0{index + 1}</span>
              <span>
                <span className="block text-sm font-semibold text-ink-950">{volet.title}</span>
                <span className="mt-1 block text-xs leading-5 text-ink-500">{volet.subtitle}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={onStart}>
            {started ? 'Reprendre' : 'Démarrer'} le questionnaire
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Link to="/app/rendez-vous">
            <Button variant="ghost">Voir mes rendez-vous</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

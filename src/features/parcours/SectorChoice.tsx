import { Compass, GraduationCap, HeartPulse, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui'
import type { Sector } from '@/types'

const SECTORS: Array<{
  id: Sector
  name: string
  audience: string
  detail: string
  icon: typeof HeartPulse
  color: string
}> = [
  {
    id: 'sante',
    name: 'Santé',
    audience: 'Cabinets · Centres · Laboratoires',
    detail: 'Accueil, rendez-vous, organisation des soins encadrés, charges et visibilité du cabinet.',
    icon: HeartPulse,
    color: 'bg-rose-50 text-rose-800',
  },
  {
    id: 'enseignement',
    name: 'Enseignement',
    audience: 'Écoles · Crèches · Formation',
    detail: 'Admissions, suivi des familles, remplissage des classes, équipe pédagogique et coûts.',
    icon: GraduationCap,
    color: 'bg-sky-50 text-sky-800',
  },
  {
    id: 'tourisme',
    name: 'Tourisme',
    audience: 'Riads · Hôtels · Restaurants',
    detail: 'Réservations, saisonnalité, expérience client, équipe et maîtrise des charges.',
    icon: Compass,
    color: 'bg-amber-50 text-amber-900',
  },
]

/**
 * Choix du secteur. Un seul secteur, un seul questionnaire :
 * le secteur choisi conditionne l'ensemble du parcours.
 */
export function SectorChoice({
  onPick,
  title = 'Quel est votre secteur ?',
  description = 'Votre secteur détermine le questionnaire de diagnostic et toute la suite de votre parcours. Il n’est pas possible de mélanger les trois.',
}: {
  onPick: (sector: Sector) => void
  title?: string
  description?: string
}) {
  return (
    <Card className="p-5 sm:p-7">
      <p className="eyebrow">Étape 1 · Choix du secteur</p>
      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink-950">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{description}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {SECTORS.map(({ id, name, audience, detail, icon: Icon, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink-400">{audience}</p>
            <h3 className="mt-1 font-display text-xl font-bold text-ink-950">{name}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-600">{detail}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-700">
              Choisir {name}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3">
        <p className="text-xs text-ink-500">
          Le secteur est conservé pour tout le parcours : diagnostic, documents, concierge, restitution et offres.
        </p>
        <span className="text-xs font-semibold text-brand-700">Une seule sélection</span>
      </div>
    </Card>
  )
}

import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, CircleAlert, FileText, Upload } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Progress } from '@/components/ui'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { cn } from '@/lib/utils'

export interface ChecklistItem {
  id: string
  label: string
  detail: string
  required: boolean
}

const UNIVERSAL: ChecklistItem[] = [
  {
    id: 'identite',
    label: 'Identité du dirigeant',
    detail: 'Nom, fonction et coordonnées professionnelles à jour.',
    required: true,
  },
  {
    id: 'contact',
    label: 'Coordonnées de l’établissement',
    detail: 'Adresse, téléphone et e-mail réellement utilisés.',
    required: true,
  },
  {
    id: 'activation',
    label: 'Création du mot de passe',
    detail: 'Votre compte doit être validé et sécurisé.',
    required: true,
  },
]

/**
 * Liste de préparation des documents. Elle ne remplace pas la page Documents :
 * elle cadre ce qu’il faut réunir avant le rendez-vous concierge.
 */
export function DocumentsChecklist({
  sector,
  currentStep,
  checked,
  onToggle,
}: {
  sector: SectorKey
  currentStep: number
  checked: string[]
  onToggle: (id: string) => void
}) {
  const pack = PACKS[sector]
  const items: ChecklistItem[] = [
    ...UNIVERSAL,
    ...pack.documents.map((label, index) => ({
      id: `pack-${index}`,
      label,
      detail: 'Pièce utile au diagnostic de votre secteur.',
      required: index < 2,
    })),
  ]
  const requiredCount = items.filter((item) => item.required).length
  const requiredDone = items.filter((item) => item.required && checked.includes(item.id)).length
  const ready = requiredDone === requiredCount

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Étape 2 · Préparation</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">
              Réunissez ce qui manque à votre dossier
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              Cette liste sert à arriver au rendez-vous Account Manager avec un dossier complet. Elle reprend les
              pièces du secteur {pack.label.toLowerCase()} et les éléments indispensables à votre compte.
            </p>
          </div>
          <Badge tone={ready ? 'success' : 'warning'}>
            {requiredDone} / {requiredCount} indispensables
          </Badge>
        </div>

        <div className="mt-5">
          <Progress value={Math.round((requiredDone / Math.max(1, requiredCount)) * 100)} label="Préparation du dossier" />
        </div>

        <ul className="mt-6 space-y-3">
          {items.map((item) => {
            const done = checked.includes(item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  aria-pressed={done}
                  className={cn(
                    'flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    done ? 'border-emerald-200 bg-emerald-50/50' : 'border-ink-100 bg-white hover:border-brand-200',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                      done ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-ink-300 ring-ink-200',
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : <FileText size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-sm font-semibold', done ? 'text-ink-800' : 'text-ink-950')}>
                        {item.label}
                      </span>
                      {item.required ? <Badge tone="warning">Indispensable</Badge> : <Badge>Utile</Badge>}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-ink-500">{item.detail}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            {ready
              ? 'Votre dossier est prêt pour le rendez-vous.'
              : 'Vous pouvez continuer : les pièces manquantes seront demandées au rendez-vous.'}
          </p>
          <Link to="/app/documents" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
            Gérer mes documents
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#demande-account-manager">
            <Button>
              Passer à la demande Account Manager
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
          <Link to="/app/diagnostic-auto">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Ouvrir mon questionnaire
            </Button>
          </Link>
        </div>
      </Card>

      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title="Aucun document n’est envoyé automatiquement"
        description="Vous restez maître de ce que vous transmettez. Rien n’est partagé avec un tiers sans votre accord."
      />
    </div>
  )
}

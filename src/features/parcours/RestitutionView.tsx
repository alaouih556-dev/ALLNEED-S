import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  Info,
  Pencil,
  Target,
} from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, Meter, Tabs } from '@/components/ui'
import { JourneyProgress } from '@/components/JourneyProgress'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import type { PriorityItem } from '@/lib/priorities'
import type { DiagnosticRecord } from './useDiagnosticRecord'

type Tab = 'priorites' | 'points' | 'synthese'

export function RestitutionView({
  sector,
  currentStep,
  priorities,
  answered,
  total,
  globalIndex,
  record,
  onRestore,
  error,
  canAcknowledge = false,
  busy = false,
}: {
  sector: SectorKey
  currentStep: number
  priorities: PriorityItem[]
  answered: number
  total: number
  globalIndex: number
  record: DiagnosticRecord | null
  onRestore: () => void
  error?: string
  canAcknowledge?: boolean
  busy?: boolean
}) {
  const pack = PACKS[sector]
  const [tab, setTab] = useState<Tab>('priorites')
  const restored = Boolean(record?.restoredAt)
  const synthesis = record?.synthesis ?? null
  const hasDiagnosis = answered > 0

  if (!hasDiagnosis) {
    return (
      <div className="space-y-6">
        <JourneyProgress current={currentStep} />
        <Card className="p-5 sm:p-7">
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title="Votre restitution apparaîtra ici"
            description="Répondez d’abord à votre questionnaire. Une fois votre Account Manager en ayant pris connaissance, vos priorités sont hiérarchisées et commentées."
            action={
              <Link to="/app/diagnostic-auto">
                <Button>Ouvrir mon diagnostic</Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <JourneyProgress current={currentStep} />

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Étape 4 · Restitution</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">Vos priorités</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              Classement calculé à partir de vos réponses sur le questionnaire {pack.label} : plus la note
              est basée et le sujet pesant, plus la priorité remonte.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={restored ? 'success' : 'warning'}>
              {restored ? 'Restitution validée' : 'En attente de validation'}
            </Badge>
            <span className="text-xs text-ink-500">
              {answered}/{total} questions · indice {globalIndex}/100
            </span>
          </div>
        </div>

        {error ? (
          <Alert tone="danger" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {restored ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
              <Check className="h-4 w-4" strokeWidth={3} />
              Restitution validée le {new Date(record!.restoredAt!).toLocaleDateString('fr-FR')}
            </span>
          ) : canAcknowledge ? (
            <Button onClick={onRestore} disabled={busy}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              {busy ? 'Enregistrement…' : 'Valider cette restitution'}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
              <CalendarClock className="h-4 w-4" />
              En attente de la restitution de votre Account Manager
            </span>
          )}
          <Link to="/app/abonnement">
            <Button variant={restored ? 'primary' : 'outline'}>
              Voir l’offre adaptée
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/app/rendez-vous">
            <Button variant="ghost">
              <CalendarClock className="mr-2 h-4 w-4" />
              Reprendre rendez-vous
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <Tabs
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          tabs={[
            { value: 'priorites', label: 'Priorités' },
            { value: 'points', label: 'Points d’appui & vigilance' },
            { value: 'synthese', label: 'Synthèse Account Manager' },
          ]}
        />

        {tab === 'priorites' ? (
          <ol className="mt-6 space-y-4">
            {priorities.map((item) => (
              <li key={item.questionId} className="rounded-2xl border border-ink-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-3xl font-bold leading-none text-brand-700">
                      0{item.rank}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink-950">{item.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Volet {item.voletId} · {item.voletTitle}
                      </p>
                    </div>
                  </div>
                  <Badge
                    tone={item.level === 'Élevée' ? 'danger' : item.level === 'Importante' ? 'warning' : 'neutral'}
                  >
                    {item.level}
                  </Badge>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-ink-700">{item.question}</p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-ink-50 p-4">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">
                      Votre situation
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.situation}</p>
                    {item.comment ? (
                      <p className="mt-2 text-xs italic text-ink-500">« {item.comment} »</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-brand-50 p-4">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-700">
                      Ce que cela coûte aujourd’hui
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-brand-900">{item.consequence}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                  <p className="flex items-start gap-2 text-sm text-ink-700">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    {item.recommendation}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-ink-500">
                    <span>Note {item.score}/5</span>
                    <span>Poids ×{item.weight}</span>
                    <span className="font-semibold text-ink-800">Priorité {item.scorePriority}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <Meter value={Math.round((item.score / 5) * 100)} />
                </div>
              </li>
            ))}
            {priorities.length === 0 ? (
              <li>
                <EmptyState
                  title="Pas de priorité remontée"
                  description="Vos réponses ne font ressortir aucune difficulté interne. Gardez cette grille pour suivre les points à surveiller."
                />
              </li>
            ) : null}
          </ol>
        ) : null}

        {tab === 'points' ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                <BadgeCheck className="h-4 w-4" />
                Points d’appui
              </p>
              <ul className="mt-4 space-y-3">
                {priorities.filter((item) => item.score >= 4).map((item) => (
                  <li key={item.questionId} className="text-sm leading-relaxed text-emerald-950">
                    {item.title} · {item.situation}
                  </li>
                ))}
                {priorities.filter((item) => item.score >= 4).length === 0 ? (
                  <li className="text-sm text-emerald-900/70">
                    Aucun point d’appui net à ce stade : le questionnaire porte sur les sujets en difficulté.
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Points de vigilance
              </p>
              <ul className="mt-4 space-y-3">
                {priorities.map((item) => (
                  <li key={item.questionId} className="text-sm leading-relaxed text-amber-950">
                    <strong>{item.voletId} · {item.voletTitle}</strong> — {item.why}
                  </li>
                ))}
                {priorities.length === 0 ? (
                  <li className="text-sm text-amber-900/70">Aucun point de vigilance remonté.</li>
                ) : null}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === 'synthese' ? (
          synthesis ? (
            <div className="mt-6 space-y-5">
              <SynthBlock title="Ce qui est confirmé" items={synthesis.confirmed} tone="success" icon={<Check className="h-4 w-4" />} />
              <SynthBlock title="Priorités retenues" items={synthesis.priorities} tone="brand" icon={<Target className="h-4 w-4" />} />
              <SynthBlock title="À surveiller" items={synthesis.watch} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
              <SynthBlock title="Opportunités" items={synthesis.opportunities} tone="info" icon={<Info className="h-4 w-4" />} />
              <SynthBlock title="Premières actions" items={synthesis.actions} tone="violet" icon={<Pencil className="h-4 w-4" />} />
              {record?.notes ? (
                <p className="rounded-xl border border-ink-100 bg-ink-50 p-4 text-sm italic leading-relaxed text-ink-600">
                  {record.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={<Pencil className="h-5 w-5" />}
              title="Synthèse en préparation"
              description="Votre Account Manager rédige la synthèse après lecture du diagnostic et du rendez-vous. Elle apparaîtra ici, chapitre par chapitre."
            />
          )
        ) : null}
      </Card>
    </div>
  )
}

function SynthBlock({
  title,
  items,
  tone,
  icon,
}: {
  title: string
  items: string[]
  tone: 'success' | 'brand' | 'warning' | 'info' | 'violet'
  icon: ReactNode
}) {
  const styles: Record<string, string> = {
    success: 'border-emerald-100 bg-emerald-50/40 text-emerald-950',
    brand: 'border-brand-100 bg-brand-50/50 text-brand-950',
    warning: 'border-amber-100 bg-amber-50/40 text-amber-950',
    info: 'border-sky-100 bg-sky-50/40 text-sky-950',
    violet: 'border-violet-100 bg-violet-50/40 text-violet-950',
  }
  return (
    <section className={`rounded-2xl border p-5 ${styles[tone]}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] opacity-80">
        {icon}
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
            {item}
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm opacity-70">Rien à signaler sur ce chapitre.</li> : null}
      </ul>
    </section>
  )
}

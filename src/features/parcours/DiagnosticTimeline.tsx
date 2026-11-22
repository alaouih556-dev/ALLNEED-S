import { Check, Loader2 } from 'lucide-react'

export interface DiagnosticTimelineProps {
  answered: boolean
  submittedAt?: string | null
  publishedAt?: string | null
}

/**
 * Fil d'analyse d'un diagnostic — vu par le client après transmission.
 * Étape 3 et 4 ne s'activent qu'à la publication de la restitution (jamais au statut « soumis »).
 */
export function RestitutionStatusTimeline({ answered, submittedAt, publishedAt }: DiagnosticTimelineProps) {
  const submitted = Boolean(submittedAt)
  const published = Boolean(publishedAt)
  const steps = [
    { label: 'Diagnostic complété', hint: 'Vos réponses sont enregistrées.', done: answered },
    { label: 'Diagnostic transmis', hint: 'Envoyé à votre Account Manager ALLNEEDS.', done: submitted },
    { label: 'Analyse de l’Account Manager', hint: 'Lecture de vos réponses, vérifications et préparation de la restitution.', done: published, active: submitted && !published },
    { label: 'Restitution disponible', hint: 'Vos priorités validées avec le dirigeant.', done: published },
  ]

  return (
    <ol className="mt-5 space-y-0">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              className={`absolute left-[11px] top-7 h-full w-0.5 rounded-full ${step.done ? 'bg-emerald-300' : 'bg-ink-100'}`}
            />
          ) : null}
          <span
            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              step.done
                ? 'bg-emerald-600 text-white'
                : step.active
                  ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                  : 'bg-ink-100 text-ink-400'
            }`}
          >
            {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
          </span>
          <div className="pt-0">
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                step.done ? 'text-emerald-900' : step.active ? 'text-ink-950' : 'text-ink-400'
              }`}
            >
              {step.label}
              {step.active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" /> : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{step.hint}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
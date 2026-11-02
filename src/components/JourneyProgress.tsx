import { Check } from 'lucide-react'
import { PARCOURS_STEPS } from '@/lib/parcours'
import { cn } from '@/lib/utils'

/**
 * Indicateur discret de progression du parcours client.
 * Aucun wizard : le client voit où il est, ce qui est terminé et la prochaine étape.
 */
export function JourneyProgress({
  current,
  className,
  compact = false,
}: {
  current: number
  className?: string
  compact?: boolean
}) {
  const safeCurrent = Math.max(0, Math.min(current, PARCOURS_STEPS.length - 1))
  const nextStep = PARCOURS_STEPS.find((_, index) => index >= safeCurrent)

  return (
    <nav aria-label="Progression de votre parcours ALLNEEDS" className={cn('rounded-2xl border border-ink-100 bg-white px-4 py-3 sm:px-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-ink-400">Votre parcours</p>
        {nextStep ? (
          <p className="text-xs text-ink-500">
            Étape suivante · <span className="font-semibold text-brand-700">{nextStep.label}</span>
          </p>
        ) : null}
      </div>
      <ol className="mt-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0">
        {PARCOURS_STEPS.map((step, index) => {
          const done = index < safeCurrent
          const active = index === safeCurrent
          return (
            <li
              key={step.id}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              {index > 0 ? <span aria-hidden="true" className="hidden h-px flex-1 bg-ink-100 sm:block" /> : null}
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.62rem] font-bold ring-1 ring-inset',
                  done && 'bg-brand-700 text-white ring-brand-700',
                  active && 'bg-brand-50 text-brand-800 ring-brand-300',
                  !done && !active && 'bg-ink-50 text-ink-400 ring-ink-200',
                )}
              >
                {done ? <Check size={12} strokeWidth={3} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block truncate text-xs font-semibold',
                    done ? 'text-ink-800' : active ? 'text-brand-800' : 'text-ink-400',
                  )}
                >
                  {step.label}
                </span>
                {!compact ? (
                  <span className="hidden truncate text-[0.68rem] text-ink-400 lg:block">{step.hint}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/* Briques d’interface partagées par les pages d’administration.
   Objectif : une seule façon d’afficher chiffres, listes, filtres et états vides. */

export type KitTone = 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' | 'teal'

const TONE_CLS: Record<KitTone, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
  teal: 'bg-teal-50 text-teal-600',
}

export function toneClass(tone: KitTone) {
  return TONE_CLS[tone]
}

/* ---------- Chiffres ---------- */

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</div>
}

export function MiniStat({
  icon,
  tone = 'indigo',
  label,
  value,
  hint,
  active,
  onClick,
}: {
  icon: ReactNode
  tone?: KitTone
  label: string
  value: ReactNode
  hint?: string
  active?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'an-panel flex items-center gap-3 p-4 text-left transition',
        onClick && 'hover:-translate-y-0.5 hover:shadow-md',
        active && 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#f5f7fb]',
      )}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', TONE_CLS[tone])}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-ink-500">{label}</span>
        <span className="block font-display text-2xl font-extrabold leading-tight tabular-nums text-ink-950">{value}</span>
        {hint ? <span className="block truncate text-[0.7rem] text-ink-400">{hint}</span> : null}
      </span>
    </Tag>
  )
}

/* ---------- Conteneurs ---------- */

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('an-panel overflow-hidden', className)}>
      {title || action ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-[0.98rem] font-extrabold tracking-tight text-ink-950">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/* ---------- Recherche + filtres ---------- */

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-ink-100 p-4 md:flex-row md:items-center md:justify-between">{children}</div>
}

export function SearchBox({ value, onChange, placeholder = 'Rechercher…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50 md:max-w-xs">
      <Search size={15} className="shrink-0 text-ink-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; count?: number }>
}) {
  return (
    <div className="an-seg max-w-full overflow-x-auto" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={cn('flex shrink-0 items-center gap-1.5', value === o.value && 'is-on')} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined ? <span className={cn('rounded-md px-1.5 text-[0.65rem] tabular-nums', value === o.value ? 'bg-indigo-50 text-indigo-700' : 'bg-white/70 text-ink-500')}>{o.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

/* ---------- Listes ---------- */

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-ink-100">{children}</ul>
}

export function Initial({ name, tone = 'indigo', size = 'md' }: { name: string; tone?: KitTone; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-xl font-extrabold', TONE_CLS[tone], size === 'lg' ? 'h-12 w-12 text-lg' : 'h-10 w-10 text-sm')}>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

export function EmptyBox({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-50 text-ink-400">{icon}</span>
      <p className="mt-4 font-semibold text-ink-900">{title}</p>
      {text ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{text}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-ink-100 px-5 py-4 last:border-0">
          <span className="an-skeleton h-10 w-10" />
          <span className="flex-1 space-y-2">
            <span className="an-skeleton block h-3 w-1/3" />
            <span className="an-skeleton block h-3 w-1/2" />
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---------- Étapes (aide visuelle simple) ---------- */

export function HowItWorks({ steps }: { steps: string[] }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-600">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(15,27,51,.04)]">
            <b className="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-[0.65rem] text-white">{i + 1}</b>
            {s}
          </span>
          {i < steps.length - 1 ? <span className="text-ink-300">→</span> : null}
        </li>
      ))}
    </ol>
  )
}

export function matches(query: string, ...fields: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => (f ?? '').toLowerCase().includes(q))
}

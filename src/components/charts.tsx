import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* Lightweight, dependency-free SVG charts for the ALLNEEDS workspaces. */

export const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6']

/* ------------------------------------------------------------------ */
/* Area chart                                                          */
/* ------------------------------------------------------------------ */

export interface AreaSeries {
  name: string
  color: string
  values: number[]
}

export function AreaChart({
  labels,
  series,
  height = 240,
  className,
}: {
  labels: string[]
  series: AreaSeries[]
  height?: number
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = height
  const pad = { t: 16, r: 12, b: 28, l: 32 }
  const max = Math.max(4, ...series.flatMap((s) => s.values))
  const niceMax = Math.ceil(max / 4) * 4
  const n = Math.max(1, labels.length - 1)
  const x = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t))

  const path = (values: number[]) =>
    values
      .map((v, i) => {
        if (i === 0) return `M${x(0)},${y(v)}`
        const cx = (x(i - 1) + x(i)) / 2
        return `C${cx},${y(values[i - 1])} ${cx},${y(v)} ${x(i)},${y(v)}`
      })
      .join(' ')

  return (
    <div className={cn('relative w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={series.map((s) => s.name).join(', ')}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`${id}-g${si}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="an-chart-grid" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" className="an-chart-label">{t}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" className="an-chart-label">{l}</text>
        ))}
        {series.map((s, si) => (
          <g key={si}>
            <path d={`${path(s.values)} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-g${si})`} />
            <path d={path(s.values)} fill="none" style={{ stroke: s.color }} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        ))}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#cbd5e1" />
            {series.map((s, si) => (
              <circle key={si} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} style={{ fill: 'var(--an-surface)', stroke: s.color }} strokeWidth={2.4} />
            ))}
          </g>
        ) : null}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - pad.l - pad.r) / n / 2}
            y={0}
            width={(W - pad.l - pad.r) / n}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[9rem] -translate-x-1/2 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="mb-1 font-semibold text-ink-900">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3 text-ink-600">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
              <b className="tabular-nums text-ink-900">{s.values[hover] ?? 0}</b>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Donut chart                                                         */
/* ------------------------------------------------------------------ */

export interface Slice {
  label: string
  value: number
  color: string
}

export function DonutChart({ slices, center, sub, size = 168 }: { slices: Slice[]; center: ReactNode; sub?: string; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = 42
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" className="an-chart-track" strokeWidth="11" />
        {total > 0
          ? slices.map((s) => {
              const len = (s.value / total) * c
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth="11"
                  strokeDasharray={`${Math.max(0, len - 1.2)} ${c}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${s.label} : ${s.value}`}</title>
                </circle>
              )
              offset += len
              return el
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl font-extrabold tracking-tight text-ink-950">{center}</span>
        {sub ? <span className="text-[0.7rem] font-medium text-ink-500">{sub}</span> : null}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: Array<{ label: string; color: string; value?: ReactNode }> }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-ink-600">
            <i className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: it.color }} />
            <span className="truncate">{it.label}</span>
          </span>
          {it.value !== undefined ? <b className="tabular-nums text-ink-950">{it.value}</b> : null}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Horizontal bar list                                                 */
/* ------------------------------------------------------------------ */

export function BarList({ items, color = '#4f46e5' }: { items: Array<{ label: string; value: number; hint?: string; color?: string }>; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink-700">{it.label}</span>
            <span className="shrink-0 tabular-nums font-bold text-ink-950">{it.value}{it.hint ? <small className="ml-1 font-medium text-ink-400">{it.hint}</small> : null}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#eef2f7]">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({ values, color = '#4f46e5', className }: { values: number[]; color?: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  const W = 120
  const H = 36
  const max = Math.max(1, ...values)
  const n = Math.max(1, values.length - 1)
  const pts = values.map((v, i) => [(i / n) * W, H - 3 - (v / max) * (H - 6)] as const)
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn('h-9 w-full', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.25 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id}-s)`} />
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Funnel / stage bar                                                  */
/* ------------------------------------------------------------------ */

export function StageBar({ stages }: { stages: Array<{ label: string; value: number; color: string }> }) {
  const total = stages.reduce((s, x) => s + x.value, 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#eef2f7]">
        {total > 0
          ? stages.map((s) => (s.value ? <div key={s.label} title={`${s.label} : ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full border-r-2 border-white last:border-r-0" /> : null))
          : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stages.map((s) => (
          <div key={s.label} className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-medium text-ink-500"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-ink-950">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

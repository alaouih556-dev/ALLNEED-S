import type { ReactNode } from 'react'
import { BarChart3, Building2, CalendarDays, CheckCircle2, Layers3, Target } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { longDate } from '@/lib/format'

export type DiagnosticReportAudience = 'client' | 'concierge' | 'admin'

export interface DiagnosticReportAxis {
  id: string | number
  title: string
  subtitle?: string
  score?: number | null
  summary?: string
  detail?: ReactNode
}

export function DiagnosticReportView({
  audience,
  orgName,
  sector,
  date,
  status,
  score,
  answered,
  total,
  priorityCount,
  published,
  axes,
  children,
}: {
  audience: DiagnosticReportAudience
  orgName: string
  sector?: string | null
  date?: string | null
  status: string
  score?: number | null
  answered?: number
  total?: number
  priorityCount?: number
  published: boolean
  axes: DiagnosticReportAxis[]
  children?: ReactNode
}) {
  const coverage = total ? Math.round(((answered ?? 0) / total) * 100) : null

  return (
    <section className="space-y-5" aria-label={`Rapport diagnostic ${audience}`}>
      <Card className="overflow-hidden border-brand-100 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Rapport de diagnostic</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink-950">{orgName}</h1>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
              {sector ? <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{sector}</span> : null}
              {date ? <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{longDate(date)}</span> : null}
            </p>
          </div>
          <Badge tone={published ? 'success' : 'warning'}>{status}</Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={<BarChart3 size={17} />} label="Score global" value={score == null ? 'Non calculé' : `${score}/100`} />
          <SummaryCard icon={<Layers3 size={17} />} label="Axes traités" value={total ? `${answered ?? 0}/${total}` : String(axes.length)} />
          <SummaryCard icon={<Target size={17} />} label="Priorités" value={priorityCount == null ? 'À définir' : String(priorityCount)} />
          <SummaryCard icon={<CheckCircle2 size={17} />} label="Statut restitution" value={published ? 'Publiée' : 'En préparation'} />
        </div>
        {coverage != null ? (
          <div className="mt-4" aria-label={`Couverture ${coverage}%`}>
            <div className="mb-1 flex justify-between text-xs text-ink-500"><span>Couverture</span><span>{coverage}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${coverage}%` }} /></div>
          </div>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </Card>

      <div>
        <h2 className="font-display text-xl font-bold text-ink-950">Axes du diagnostic</h2>
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          {axes.map((axis) => (
            <Card key={axis.id} className="min-w-0 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-950">{axis.title}</h3>
                  {axis.subtitle ? <p className="mt-1 text-xs text-ink-500">{axis.subtitle}</p> : null}
                </div>
                {axis.score != null ? <Badge tone={axis.score < 50 ? 'warning' : 'success'}>{axis.score}/100</Badge> : null}
              </div>
              {axis.summary ? <p className="mt-3 text-sm leading-relaxed text-ink-600">{axis.summary}</p> : null}
              {axis.detail ? (
                <details className="mt-4 rounded-xl border border-ink-100 bg-ink-50/50">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    Voir les réponses détaillées
                  </summary>
                  <div className="border-t border-ink-100 p-4">{axis.detail}</div>
                </details>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-500">{icon}{label}</p>
      <p className="mt-2 font-display text-lg font-bold text-ink-950">{value}</p>
    </div>
  )
}

import { Link } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, CalendarClock, Check, FileText, Info, Pencil, Target, AlertTriangle, TrendingUp, ShieldAlert, ListChecks, Footprints } from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { longDate } from '@/lib/format'
import type { DiagnosticRestitution } from './useDiagnosticRecord'
import { DiagnosticReportView } from './DiagnosticReportView'

/**
 * Restitution VALIDÉE ET PUBLIÉE, telle qu'exposée par
 * GET /api/diagnostics/:id/restitution. Jamais de champs internes ici.
 */
export function RestitutionPanel({
  restitution,
  restoredAt,
  canAcknowledge,
  onRestore,
  busy = false,
  error,
}: {
  restitution: DiagnosticRestitution
  restoredAt?: string | null
  canAcknowledge: boolean
  onRestore: () => void
  busy?: boolean
  error?: string
}) {
  const analysis = restitution.analysis
  const priorities = analysis.priorities ?? []
  const recommendations = analysis.recommendations ?? []
  const strengths = analysis.strengths ?? []
  const weaknesses = analysis.weaknesses ?? []
  const risks = analysis.risks ?? []
  const opportunities = analysis.opportunities ?? []
  const needsPrioritaires = analysis.needsPrioritaires ?? []
  const actionPlan = analysis.actionPlan ?? []
  const nextSteps = analysis.nextSteps ?? []
  const restored = Boolean(restoredAt)
  const reportAxes = [
    { id: 'confirmed', title: 'Points confirmés', items: restitution.synthesis.confirmed, icon: <Check className="h-4 w-4" />, tone: 'emerald' as const },
    { id: 'priorities', title: 'Priorités retenues', items: restitution.synthesis.priorities, icon: <Target className="h-4 w-4" />, tone: 'brand' as const },
    { id: 'watch', title: 'Points de vigilance', items: restitution.synthesis.watch, icon: <AlertTriangle className="h-4 w-4" />, tone: 'amber' as const },
    { id: 'opportunities', title: 'Opportunités', items: restitution.synthesis.opportunities, icon: <Info className="h-4 w-4" />, tone: 'sky' as const },
    { id: 'actions', title: 'Premières actions', items: restitution.synthesis.actions, icon: <Pencil className="h-4 w-4" />, tone: 'violet' as const },
  ]

  return (
    <div className="space-y-6">
      <DiagnosticReportView
        audience="client"
        orgName={restitution.orgName || 'Votre entreprise'}
        sector={restitution.sector}
        date={restitution.publishedAt}
        status="Rapport disponible"
        priorityCount={priorities.length}
        published
        axes={reportAxes.map((axis) => ({
          id: axis.id,
          title: axis.title,
          summary: axis.items.length ? `${axis.items.length} élément${axis.items.length > 1 ? 's' : ''} retenu${axis.items.length > 1 ? 's' : ''}.` : 'Aucun élément retenu.',
          detail: <ListBlock title={axis.title} items={axis.items} icon={axis.icon} tone={axis.tone} />,
        }))}
      >
        {analysis.priorityLevel ? <Badge tone="brand">Niveau de priorité · {analysis.priorityLevel}</Badge> : null}
        {error ? <Alert tone="danger" className="mt-5">{error}</Alert> : null}
        {restitution.notes ? <p className="mt-4 rounded-xl border border-ink-100 bg-white p-4 text-sm leading-relaxed text-ink-700">{restitution.notes}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {restored ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
              <Check className="h-4 w-4" strokeWidth={3} />
              Restitution validée {restoredAt ? `le ${longDate(restoredAt)}` : ''}
            </span>
          ) : canAcknowledge ? (
            <Button size="lg" onClick={onRestore} disabled={busy}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              {busy ? 'Enregistrement…' : 'Valider cette restitution'}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
              <CalendarClock className="h-4 w-4" />
              À prendre en compte
            </span>
          )}
          <Link to="/app/documents">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Documents associés
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </DiagnosticReportView>

      {restitution.rendezVousAt ? (
        <Card className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            <CalendarClock className="h-4 w-4" />
            Votre rendez-vous de restitution
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {new Date(restitution.rendezVousAt).toLocaleDateString('fr-FR')} à{' '}
            {new Date(restitution.rendezVousAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            .
          </p>
        </Card>
      ) : null}

      {priorities.length > 0 ? (
        <Card className="p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            <ListChecks className="h-4 w-4" />
            Vos priorités
          </p>
          <ol className="mt-4 space-y-3">
            {priorities.map((priority, index) => (
              <li key={priority} className="flex gap-3 rounded-xl border border-ink-100 p-4">
                <span className="font-display text-2xl font-bold leading-none text-brand-700">0{index + 1}</span>
                <p className="text-sm font-semibold leading-relaxed text-ink-800">{priority}</p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {recommendations.length > 0 ? (
        <Card className="p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            <TrendingUp className="h-4 w-4" />
            Recommandations
          </p>
          <ul className="mt-4 space-y-2">
            {recommendations.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {(strengths.length > 0 || weaknesses.length > 0) ? (
        <Card className="p-5 sm:p-7">
          <div className="grid gap-5 md:grid-cols-2">
            <ListBlock title="Points forts" items={strengths} icon={<BadgeCheck className="h-4 w-4" />} tone="emerald" />
            <ListBlock title="Points faibles" items={weaknesses} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
          </div>
        </Card>
      ) : null}

      {(risks.length > 0 || opportunities.length > 0) ? (
        <Card className="p-5 sm:p-7">
          <div className="grid gap-5 md:grid-cols-2">
            <ListBlock title="Risques" items={risks} icon={<ShieldAlert className="h-4 w-4" />} tone="amber" />
            <ListBlock title="Opportunités" items={opportunities} icon={<TrendingUp className="h-4 w-4" />} tone="sky" />
          </div>
        </Card>
      ) : null}

      {needsPrioritaires.length > 0 ? (
        <Card className="p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            <Target className="h-4 w-4" />
            Besoins prioritaires
          </p>
          <ul className="mt-4 space-y-2">
            {needsPrioritaires.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {actionPlan.length > 0 ? (
        <Card className="p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
            <ListChecks className="h-4 w-4" />
            Plan d’action
          </p>
          <ol className="mt-4 space-y-3">
            {actionPlan.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-700">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {nextSteps.length > 0 ? (
        <Card className="p-5 sm:p-7">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
            <Footprints className="h-4 w-4" />
            Prochaines étapes
          </p>
          <ul className="mt-4 space-y-2">
            {nextSteps.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

function ListBlock({
  title,
  items,
  icon,
  tone,
}: {
  title: string
  items: string[]
  icon: ReactNode
  tone: 'emerald' | 'brand' | 'amber' | 'sky' | 'violet'
}) {
  const styles: Record<string, string> = {
    emerald: 'border-emerald-100 bg-emerald-50/40 text-emerald-950',
    brand: 'border-brand-100 bg-brand-50/50 text-brand-950',
    amber: 'border-amber-100 bg-amber-50/40 text-amber-950',
    sky: 'border-sky-100 bg-sky-50/40 text-sky-950',
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
        {items.length === 0 ? <li className="text-sm opacity-70">Rien à signaler.</li> : null}
      </ul>
    </section>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, ListChecks, Pencil, Plus, Target, Trash2, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { EmptyBox, LoadingRows, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { ProgressBar, TaskBoard, orgApi, shortDate, useOrgResource } from '@/features/organization/core'
import { STRATEGY_STATUS, type Objective, type Strategy, type StrategyDetail, type StrategyStatus } from '@/features/organization/strategy'

export const Route = createFileRoute('/organisation/strategies/$id')({ component: StrategyPage })

function StrategyPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useOrgResource<StrategyDetail>(`/strategies/${id}`)
  const [editing, setEditing] = useState(false)
  const [objective, setObjective] = useState<Objective | 'new' | null>(null)
  const [actionError, setActionError] = useState('')
  if (loading && !data) return <LoadingRows count={5} />
  if (error || !data) return <Alert tone="danger">{error || 'Stratégie introuvable.'}</Alert>
  const strategy = data.strategy
  const status = STRATEGY_STATUS[strategy.status]

  async function saveObjectives(objectives: Objective[]) {
    setActionError('')
    try { await orgApi(`/strategies/${strategy.id}`, { method: 'PATCH', body: { objectives } }); await reload() } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); throw cause }
  }
  async function removeStrategy() {
    if (!window.confirm('Supprimer définitivement cette stratégie ? Ses tâches sont conservées, sans lien avec elle.')) return
    try { await orgApi(`/strategies/${strategy.id}`, { method: 'DELETE' }); void navigate({ to: '/organisation/strategies' }) } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Suppression impossible.') }
  }

  return (
    <div>
      <Link to="/organisation/strategies" className="cg-link mb-3"><ArrowLeft size={14} />Toutes les stratégies</Link>
      <PageHeader
        eyebrow={status.label}
        title={strategy.title}
        description={strategy.summary || 'Résumé à compléter'}
        actions={strategy.canManage ? <><Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={14} />Modifier</Button><Button size="sm" variant="outline" onClick={() => void removeStrategy()}><Trash2 size={14} />Supprimer</Button></> : null}
      />
      {actionError ? <Alert tone="danger" className="mb-5">{actionError}</Alert> : null}
      <StatGrid>
        <MiniStat icon={<Target size={18} />} tone="indigo" label="Atteinte des objectifs" value={strategy.objectiveProgress === null ? '–' : `${strategy.objectiveProgress} %`} ratio={(strategy.objectiveProgress ?? 0) / 100} hint={`${strategy.objectives.length} objectif(s)`} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Plan d’action" value={`${strategy.taskStats.completion} %`} ratio={strategy.taskStats.completion / 100} hint={`${strategy.taskStats.done}/${strategy.taskStats.total} actions`} />
        <MiniStat icon={<ListChecks size={18} />} tone="sky" label="Actions ouvertes" value={strategy.taskStats.open} />
        <MiniStat icon={<TriangleAlert size={18} />} tone="amber" label="En retard" value={strategy.taskStats.overdue} hint={`${strategy.taskStats.blocked} bloquée(s)`} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Objectifs" description="Mettez à jour les valeurs pour suivre les résultats." action={strategy.canManage ? <Button size="sm" variant="outline" onClick={() => setObjective('new')}><Plus size={14} />Ajouter</Button> : null}>
          {!strategy.objectives.length ? <EmptyBox icon={<Target size={20} />} title="Aucun objectif" text="Définissez ce que cette stratégie doit atteindre." /> : null}
          <Rows>
            {strategy.objectives.map((item) => {
              const percent = Number(item.target) > 0 && item.current !== null ? Math.min(100, Math.round((Number(item.current) / Number(item.target)) * 100)) : null
              return (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0"><span className="block text-sm font-semibold text-ink-950">{item.title}</span><span className="block text-xs text-ink-500">{[item.metric, item.dueDate ? shortDate(item.dueDate) : null].filter(Boolean).join(' · ') || 'Indicateur à définir'}</span></span>
                    <span className="flex shrink-0 items-center gap-2">
                      <strong className="text-sm text-ink-950">{item.current ?? '–'} / {item.target ?? '–'} {item.unit}</strong>
                      {strategy.canManage ? <button type="button" className="og-icon" aria-label={`Modifier ${item.title}`} onClick={() => setObjective(item)}><Pencil size={14} /></button> : null}
                      {strategy.canManage ? <button type="button" className="og-icon is-danger" aria-label={`Supprimer ${item.title}`} onClick={() => { if (window.confirm('Supprimer cet objectif ?')) void saveObjectives(strategy.objectives.filter((o) => o.id !== item.id)).catch(() => undefined) }}><Trash2 size={14} /></button> : null}
                    </span>
                  </div>
                  {percent !== null ? <div className="mt-2"><ProgressBar value={percent} /></div> : null}
                </li>
              )
            })}
          </Rows>
        </Panel>
        <Panel title="Cadre">
          <dl className="cl-facts">
            <div><dt>Statut</dt><dd><Badge tone={status.tone}>{status.label}</Badge></dd></div>
            <div><dt>Responsable</dt><dd>{strategy.ownerName || '–'}</dd></div>
            <div><dt>Cible</dt><dd>{strategy.audience || '–'}</dd></div>
            <div><dt>Canaux</dt><dd>{strategy.channels || '–'}</dd></div>
            <div><dt>Période</dt><dd>{strategy.startDate ? shortDate(strategy.startDate) : '–'} → {strategy.endDate ? shortDate(strategy.endDate) : '–'}</dd></div>
          </dl>
        </Panel>
      </div>

      <Panel className="mt-5" title="Plan d’action" description="Assignez les actions aux équipes marketing et suivez leur avancement.">
        <TaskBoard departmentId="marketing" strategyId={strategy.id} objectives={strategy.objectives} canCreate={strategy.canManage} onChanged={() => void reload()} />
      </Panel>

      {editing ? <EditStrategy strategy={strategy} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void reload() }} /> : null}
      {objective ? <ObjectiveModal objective={objective === 'new' ? null : objective} onClose={() => setObjective(null)} onSave={async (next) => {
        const list = objective === 'new' ? [...strategy.objectives, next] : strategy.objectives.map((o) => (o.id === next.id ? next : o))
        await saveObjectives(list)
        setObjective(null)
      }} /> : null}
    </div>
  )
}

function EditStrategy({ strategy, onClose, onSaved }: { strategy: Strategy; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: strategy.title, summary: strategy.summary, audience: strategy.audience, channels: strategy.channels, status: strategy.status, startDate: strategy.startDate ?? '', endDate: strategy.endDate ?? '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await orgApi(`/strategies/${strategy.id}`, { method: 'PATCH', body: form }); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title="Modifier la stratégie">
      <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Titre" required className="sm:col-span-2"><Input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Résumé" className="sm:col-span-2"><Textarea rows={3} maxLength={4000} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
        <Field label="Cible"><Input maxLength={500} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></Field>
        <Field label="Canaux"><Input maxLength={500} value={form.channels} onChange={(e) => setForm({ ...form, channels: e.target.value })} /></Field>
        <Field label="Début"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="Fin"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        <Field label="Statut"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StrategyStatus })}>{Object.entries(STRATEGY_STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}</Select></Field>
        {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></div>
      </form>
    </Modal>
  )
}

function ObjectiveModal({ objective, onClose, onSave }: { objective: Objective | null; onClose: () => void; onSave: (next: Objective) => Promise<void> }) {
  const [form, setForm] = useState({ title: objective?.title ?? '', metric: objective?.metric ?? '', target: objective?.target?.toString() ?? '', current: objective?.current?.toString() ?? '', unit: objective?.unit ?? '', dueDate: objective?.dueDate ?? '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ id: objective?.id ?? '', title: form.title, metric: form.metric, target: form.target === '' ? null : Number(form.target), current: form.current === '' ? null : Number(form.current), unit: form.unit, dueDate: form.dueDate || null })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
      setSaving(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={objective ? 'Modifier l’objectif' : 'Nouvel objectif'}>
      <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Objectif" required className="sm:col-span-2"><Input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Indicateur" hint="Ex. : leads qualifiés"><Input maxLength={80} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} /></Field>
        <Field label="Unité" hint="Ex. : %, MAD, leads"><Input maxLength={20} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
        <Field label="Cible"><Input type="number" step="any" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
        <Field label="Valeur actuelle"><Input type="number" step="any" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></Field>
        <Field label="Échéance"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></div>
      </form>
    </Modal>
  )
}

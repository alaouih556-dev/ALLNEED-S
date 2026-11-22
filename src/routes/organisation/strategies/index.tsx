import { useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Plus, Target } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { EmptyBox, LoadingRows, MiniStat, Panel, StatGrid } from '@/components/admin-kit'
import { ProgressBar, orgApi, shortDate, useOrgResource } from '@/features/organization/core'
import { STRATEGY_STATUS, type Strategy } from '@/features/organization/strategy'

export const Route = createFileRoute('/organisation/strategies/')({ component: StrategiesPage })

function StrategiesPage() {
  const navigate = useNavigate()
  const { data, loading, error } = useOrgResource<{ strategies: Strategy[]; canManage: boolean }>('/strategies')
  const [creating, setCreating] = useState(false)
  const list = data?.strategies ?? []
  return (
    <div>
      <PageHeader
        eyebrow="Service Marketing"
        title="Stratégies marketing"
        description="Définissez vos stratégies, leurs objectifs et leurs plans d’action, puis suivez les résultats."
        actions={data?.canManage ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} />Nouvelle stratégie</Button> : null}
      />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <StatGrid>
        <MiniStat icon={<Target size={18} />} tone="indigo" label="Stratégies" value={list.length} />
        <MiniStat icon={<Target size={18} />} tone="emerald" label="Actives" value={list.filter((s) => s.status === 'active').length} />
        <MiniStat icon={<Target size={18} />} tone="sky" label="Objectifs" value={list.reduce((n, s) => n + s.objectives.length, 0)} />
        <MiniStat icon={<Target size={18} />} tone="amber" label="Actions ouvertes" value={list.reduce((n, s) => n + s.taskStats.open, 0)} />
      </StatGrid>
      <Panel title="Toutes les stratégies">
        {loading && !data ? <LoadingRows /> : null}
        {data && !list.length ? <EmptyBox icon={<Target size={20} />} title="Aucune stratégie" text={data.canManage ? 'Créez votre première stratégie marketing.' : 'Les stratégies publiées apparaîtront ici.'} action={data.canManage ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} />Nouvelle stratégie</Button> : undefined} /> : null}
        <div className="og-teams">
          {list.map((strategy) => {
            const status = STRATEGY_STATUS[strategy.status]
            return (
              <Link key={strategy.id} to="/organisation/strategies/$id" params={{ id: strategy.id }} className="og-team">
                <span className="flex items-start justify-between gap-2"><strong>{strategy.title}</strong><Badge tone={status.tone}>{status.label}</Badge></span>
                <small>{strategy.summary || 'Résumé à compléter'}</small>
                <ProgressBar value={strategy.taskStats.completion} />
                <span className="og-team-meta"><span>{strategy.objectives.length} objectif(s)</span><span>{strategy.taskStats.done}/{strategy.taskStats.total} actions</span>{strategy.endDate ? <span>{shortDate(strategy.endDate)}</span> : null}<ArrowRight size={13} /></span>
              </Link>
            )
          })}
        </div>
      </Panel>
      {creating ? <CreateStrategy onClose={() => setCreating(false)} onCreated={(id) => void navigate({ to: '/organisation/strategies/$id', params: { id } })} /> : null}
    </div>
  )
}

function CreateStrategy({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ title: '', summary: '', audience: '', channels: '', startDate: '', endDate: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await orgApi<Strategy>('/strategies', { method: 'POST', body: form })
      onCreated(created.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
      setSaving(false)
    }
  }
  return (
    <Modal open onClose={onClose} title="Nouvelle stratégie" description="Vous ajouterez ensuite les objectifs et le plan d’action.">
      <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Titre" required className="sm:col-span-2"><Input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Résumé" className="sm:col-span-2"><Textarea rows={3} maxLength={4000} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
        <Field label="Cible"><Input maxLength={500} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></Field>
        <Field label="Canaux"><Input maxLength={500} value={form.channels} onChange={(e) => setForm({ ...form, channels: e.target.value })} /></Field>
        <Field label="Début"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="Fin"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? 'Création…' : 'Créer la stratégie'}</Button></div>
      </form>
    </Modal>
  )
}

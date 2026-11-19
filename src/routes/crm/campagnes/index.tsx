import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, BarChart3, Megaphone, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { BarList, CHART_COLORS } from '@/components/charts'
import { DataTable, FilterBar, MultiPick, RequirePermission, StatusPill, crmSend, errorText, fmtDate, useCrm, useCrmQuery, useFilterState, useNotify, type Column, type Page } from '@/features/crm/core'

export const Route = createFileRoute('/crm/campagnes/')({ component: () => <RequirePermission perm="campaigns.view"><CampaignsPage /></RequirePermission> })

export type CampaignRow = { id: string; name: string; description: string; type: string; startDate: string | null; endDate: string | null; status: string; zoneIds: string[]; zoneNames: string[]; goals: { appointments: number | null; calls: number | null; contacts: number | null }; agentIds: string[]; agentNames: string[]; databaseIds: string[]; databaseNames: string[]; createdByName: string; createdAt: string; metrics: { contacts: number; calls: number; reached: number; appointments: number; conversionRate: number; goal: number; progress: number | null } }

function CampaignsPage() {
  const { me, can, refreshLookups } = useCrm()
  const navigate = useNavigate()
  const notify = useNotify()
  const manage = can('campaigns.manage')
  const [values, setValues] = useFilterState({ pageSize: '25' })
  const { data, loading, error, reload } = useCrmQuery<Page<CampaignRow>>('/campaigns', values)
  const [editing, setEditing] = useState<CampaignRow | 'new' | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [comparing, setComparing] = useState(false)
  const filters = [{ key: 'status', label: 'Statut', options: [{ value: 'draft', label: 'Brouillon' }, { value: 'active', label: 'Active' }, { value: 'paused', label: 'En pause' }, { value: 'completed', label: 'Terminée' }, { value: 'archived', label: 'Archivée' }] }]
  const columns: Column<CampaignRow>[] = [
    { key: 'name', label: 'Campagne', sort: 'name', render: (c) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{c.name}</p><p className="truncate text-xs text-ink-500">{[c.type, c.databaseNames.join(', ')].filter(Boolean).join(' · ') || '—'}</p></div> },
    { key: 'dates', label: 'Dates', sort: 'startDate', hideOn: 'md', render: (c) => <span className="text-xs text-ink-600">{c.startDate ? fmtDate(c.startDate) : '—'} → {c.endDate ? fmtDate(c.endDate) : '—'}</span> },
    { key: 'team', label: 'Agents', hideOn: 'lg', render: (c) => <span className="text-xs text-ink-600">{c.agentNames.join(', ') || '—'}</span> },
    { key: 'calls', label: 'Appels', hideOn: 'md', render: (c) => c.metrics.calls },
    { key: 'appointments', label: 'RDV', sort: 'appointments', render: (c) => <b>{c.metrics.appointments}{c.metrics.goal ? <span className="font-normal text-ink-400"> / {c.metrics.goal}</span> : null}</b> },
    { key: 'progress', label: 'Objectif', sort: 'progress', render: (c) => c.metrics.progress === null ? <span className="text-xs text-ink-400">—</span> : <div className="w-24"><div className="crm-progress"><i style={{ width: `${c.metrics.progress}%` }} /></div><span className="text-[0.68rem] text-ink-500">{c.metrics.progress} %</span></div> },
    { key: 'status', label: 'Statut', sort: 'status', render: (c) => <StatusPill kind="campaign" value={c.status} /> },
  ]
  const compared = (data?.rows || []).filter((c) => selected.has(c.id))
  return (
    <div>
      <PageHeader
        eyebrow="CRM · Développement"
        title="Campagnes"
        description={me?.isAdmin ? 'Organisez la prospection par campagne : bases, agents, zones, dates et objectifs. Suivez la progression en temps réel.' : 'Les campagnes qui vous sont assignées et leur progression.'}
        actions={<>{manage ? <Button size="sm" onClick={() => setEditing('new')}><Plus size={14} />Nouvelle campagne</Button> : null}<Button size="sm" variant="outline" disabled={selected.size < 2} onClick={() => setComparing(true)}><BarChart3 size={14} />Comparer ({selected.size})</Button></>}
      />
      <FilterBar values={values} onChange={setValues} filters={filters} searchPlaceholder="Nom, type, description…" />
      <DataTable
        columns={columns} page={data} loading={loading} error={error} values={values} onChange={setValues} selectable selected={selected} onSelect={setSelected}
        onRowClick={(c) => void navigate({ to: '/crm/campagnes/$id' as any, params: { id: c.id } as any })}
        empty={{ icon: <Megaphone size={20} />, title: 'Aucune campagne', text: manage ? 'Créez une campagne puis rattachez-y des bases et des agents.' : 'Aucune campagne ne vous est assignée.', action: manage ? <Button size="sm" onClick={() => setEditing('new')}><Plus size={14} />Nouvelle campagne</Button> : undefined }}
        rowActions={manage ? (c) => (
          <>
            <Button size="sm" variant="ghost" aria-label={`Modifier ${c.name}`} title="Modifier" onClick={() => setEditing(c)}><Pencil size={14} /></Button>
            {c.status !== 'archived' ? <Button size="sm" variant="ghost" aria-label={`Archiver ${c.name}`} title="Archiver" onClick={() => void crmSend(`/campaigns/${c.id}`, 'DELETE').then(() => { notify('Campagne archivée'); void reload(); void refreshLookups() }, (e) => notify('Archivage impossible', 'warning', errorText(e)))}><Archive size={14} /></Button> : null}
          </>
        ) : undefined}
      />
      {editing ? <CampaignModal campaign={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { await reload(); await refreshLookups() }} /> : null}
      {comparing ? (
        <Modal open onClose={() => setComparing(false)} title="Comparaison des campagnes" size="lg">
          <div className="grid gap-6 sm:grid-cols-2">
            {([['Contacts', 'contacts', CHART_COLORS[0]], ['Appels', 'calls', CHART_COLORS[1]], ['Rendez-vous', 'appointments', CHART_COLORS[3]], ['Conversion (%)', 'conversionRate', CHART_COLORS[5]]] as const).map(([title, key, color]) => <div key={key}><p className="crm-subtitle">{title}</p><BarList color={color} items={compared.map((c) => ({ label: c.name, value: c.metrics[key] }))} /></div>)}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

export function CampaignModal({ campaign, onClose, onSaved }: { campaign: CampaignRow | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { me, lookups } = useCrm()
  const notify = useNotify()
  const [form, setForm] = useState({ name: campaign?.name || '', description: campaign?.description || '', type: campaign?.type || me?.campaignTypes[0] || '', startDate: campaign?.startDate || '', endDate: campaign?.endDate || '', status: campaign?.status || 'draft', databaseIds: campaign?.databaseIds || [], agentIds: campaign?.agentIds || [], zoneIds: campaign?.zoneIds || [], goalAppointments: campaign?.goals?.appointments?.toString() || '', goalCalls: campaign?.goals?.calls?.toString() || '', goalContacts: campaign?.goals?.contacts?.toString() || '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  async function save() {
    if (form.name.trim().length < 2) { setError('Donnez un nom à la campagne.'); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('La date de fin doit suivre la date de début.'); return }
    for (const g of [form.goalAppointments, form.goalCalls, form.goalContacts]) if (g && (!/^\d+$/.test(g))) { setError('Les objectifs doivent être des nombres entiers.'); return }
    setBusy(true)
    setError('')
    const body = { name: form.name.trim(), description: form.description, type: form.type, startDate: form.startDate || null, endDate: form.endDate || null, status: form.status, databaseIds: form.databaseIds, agentIds: form.agentIds, zoneIds: form.zoneIds, goals: { appointments: form.goalAppointments || null, calls: form.goalCalls || null, contacts: form.goalContacts || null } }
    try {
      if (campaign) await crmSend(`/campaigns/${campaign.id}`, 'PATCH', body)
      else await crmSend('/campaigns', 'POST', body)
      notify(campaign ? 'Campagne mise à jour' : 'Campagne créée')
      onClose()
      await onSaved()
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={campaign ? `Modifier · ${campaign.name}` : 'Nouvelle campagne'} size="lg">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nom" required className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoFocus /></Field>
          <Field label="Type"><Select value={form.type} onChange={(e) => set('type', e.target.value)}><option value="">—</option>{(me?.campaignTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Début"><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="Fin"><Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} /></Field>
          <Field label="Statut"><Select value={form.status} onChange={(e) => set('status', e.target.value)}><option value="draft">Brouillon</option><option value="active">Active</option><option value="paused">En pause</option><option value="completed">Terminée</option><option value="archived">Archivée</option></Select></Field>
          <Field label="Objectif RDV"><Input inputMode="numeric" value={form.goalAppointments} onChange={(e) => set('goalAppointments', e.target.value)} placeholder="ex. 40" /></Field>
          <Field label="Objectif d’appels"><Input inputMode="numeric" value={form.goalCalls} onChange={(e) => set('goalCalls', e.target.value)} /></Field>
          <Field label="Objectif de contacts"><Input inputMode="numeric" value={form.goalContacts} onChange={(e) => set('goalContacts', e.target.value)} /></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} /></Field>
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Bases"><MultiPick options={lookups?.databases || []} value={form.databaseIds} onChange={(v) => set('databaseIds', v)} empty="Aucune base." /></Field>
          <Field label="Agents"><MultiPick options={(lookups?.agents || []).filter((a) => a.role === 'agent')} value={form.agentIds} onChange={(v) => set('agentIds', v)} empty="Aucun agent." /></Field>
          <Field label="Zones"><MultiPick options={lookups?.zones || []} value={form.zoneIds} onChange={(v) => set('zoneIds', v)} empty="Aucune zone." /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : campaign ? 'Enregistrer' : 'Créer la campagne'}</Button></div>
      </form>
    </Modal>
  )
}

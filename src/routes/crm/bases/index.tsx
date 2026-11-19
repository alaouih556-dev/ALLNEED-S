import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, Database, Pencil, Plus, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { DataTable, FilterBar, MultiPick, RequirePermission, StatusPill, crmSend, errorText, fmtDate, useCrm, useCrmQuery, useFilterState, useNotify, type Column, type Page } from '@/features/crm/core'
import { ImportWizard } from '@/features/crm/ImportWizard'

export const Route = createFileRoute('/crm/bases/')({ component: () => <RequirePermission perm="contacts.view"><DatabasesPage /></RequirePermission> })

export type DatabaseRow = { id: string; name: string; description: string; source: string; status: string; campaignId: string | null; campaignName: string; zoneId: string | null; zoneName: string; createdAt: string; updatedAt: string; importedAt: string | null; createdByName: string; totalContacts: number; contactsCalled: number; contactsRemaining: number; contactsReached: number; appointmentsBooked: number; agentIds: string[]; agentNames: string[] }

function DatabasesPage() {
  const { me, lookups, refreshLookups } = useCrm()
  const navigate = useNavigate()
  const notify = useNotify()
  const isAdmin = Boolean(me?.isAdmin)
  const [values, setValues] = useFilterState({ pageSize: '25' })
  const { data, loading, error, reload } = useCrmQuery<Page<DatabaseRow>>('/databases', values)
  const [editing, setEditing] = useState<DatabaseRow | 'new' | null>(null)
  const [importing, setImporting] = useState<DatabaseRow | null>(null)

  const filters = [
    { key: 'status', label: 'Statut', options: [{ value: 'draft', label: 'Brouillon' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Terminée' }, { value: 'archived', label: 'Archivée' }] },
    { key: 'campaignId', label: 'Campagne', options: (lookups?.campaigns || []).map((c) => ({ value: c.id, label: c.name })) },
    { key: 'zoneId', label: 'Zone', options: (lookups?.zones || []).map((z) => ({ value: z.id, label: z.name })) },
  ]
  const columns: Column<DatabaseRow>[] = [
    { key: 'name', label: 'Base de contacts', sort: 'name', render: (d) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{d.name}</p><p className="truncate text-xs text-ink-500">{d.description || d.source || '—'}</p></div> },
    { key: 'source', label: 'Source', sort: 'source', hideOn: 'lg', render: (d) => <span className="text-xs text-ink-600">{d.source || '—'}</span> },
    { key: 'total', label: 'Contacts', sort: 'total', render: (d) => <b>{d.totalContacts}</b> },
    { key: 'called', label: 'Appelés', sort: 'called', hideOn: 'md', render: (d) => d.contactsCalled },
    { key: 'remaining', label: 'Restants', sort: 'remaining', hideOn: 'md', render: (d) => d.contactsRemaining },
    { key: 'appointments', label: 'RDV', sort: 'appointments', render: (d) => d.appointmentsBooked },
    { key: 'agents', label: 'Agents', hideOn: 'lg', render: (d) => <span className="text-xs text-ink-600">{d.agentNames.join(', ') || '—'}</span> },
    { key: 'campaign', label: 'Campagne', hideOn: 'lg', render: (d) => <span className="text-xs text-ink-600">{d.campaignName || '—'}</span> },
    { key: 'status', label: 'Statut', sort: 'status', render: (d) => <StatusPill kind="database" value={d.status} /> },
    { key: 'createdAt', label: 'Créée le', sort: 'createdAt', hideOn: 'lg', render: (d) => <span className="text-xs text-ink-500">{fmtDate(d.createdAt)}</span> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="CRM · Données"
        title="Bases de contacts"
        description={isAdmin ? 'Créez vos bases, importez des fichiers CSV ou Excel, puis assignez-les à des agents et à une campagne.' : 'Les bases qui vous sont assignées.'}
        actions={isAdmin ? <Button size="sm" onClick={() => setEditing('new')}><Plus size={14} />Nouvelle base</Button> : undefined}
      />
      <FilterBar values={values} onChange={setValues} filters={filters} searchPlaceholder="Nom, source, description…" />
      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={error}
        values={values}
        onChange={setValues}
        onRowClick={(d) => void navigate({ to: '/crm/bases/$id' as any, params: { id: d.id } as any })}
        empty={{ icon: <Database size={20} />, title: isAdmin ? 'Aucune base' : 'Aucune base assignée', text: isAdmin ? 'Créez une base puis importez un fichier de contacts.' : 'Un administrateur doit vous assigner une base.', action: isAdmin ? <Button size="sm" onClick={() => setEditing('new')}><Plus size={14} />Nouvelle base</Button> : undefined }}
        rowActions={isAdmin ? (d) => (
          <>
            <Button size="sm" variant="ghost" title="Importer" aria-label={`Importer dans ${d.name}`} disabled={d.status === 'archived'} onClick={() => setImporting(d)}><Upload size={14} /></Button>
            <Button size="sm" variant="ghost" title="Modifier" aria-label={`Modifier ${d.name}`} onClick={() => setEditing(d)}><Pencil size={14} /></Button>
            {d.status !== 'archived' ? <Button size="sm" variant="ghost" title="Archiver" aria-label={`Archiver ${d.name}`} onClick={() => void crmSend(`/databases/${d.id}`, 'DELETE').then(() => { notify('Base archivée'); void reload(); void refreshLookups() }, (e) => notify('Archivage impossible', 'warning', errorText(e)))}><Archive size={14} /></Button> : null}
          </>
        ) : undefined}
      />
      {editing ? <DatabaseModal database={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async (d, openImport) => { await reload(); await refreshLookups(); if (openImport) setImporting(d) }} /> : null}
      {importing ? <ImportWizard databaseId={importing.id} databaseName={importing.name} onClose={() => setImporting(null)} onDone={() => { void reload(); void refreshLookups() }} /> : null}
    </div>
  )
}

export function DatabaseModal({ database, onClose, onSaved }: { database: DatabaseRow | null; onClose: () => void; onSaved: (d: DatabaseRow, openImport: boolean) => Promise<void> }) {
  const { lookups } = useCrm()
  const notify = useNotify()
  const [form, setForm] = useState({ name: database?.name || '', description: database?.description || '', source: database?.source || '', status: database?.status || 'draft', campaignId: database?.campaignId || '', zoneId: database?.zoneId || '', agentIds: database?.agentIds || [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  async function save(openImport: boolean) {
    if (form.name.trim().length < 2) { setError('Indiquez un nom pour la base.'); return }
    setBusy(true)
    setError('')
    try {
      const body = { ...form, name: form.name.trim(), campaignId: form.campaignId || null, zoneId: form.zoneId || null }
      const d = database ? await crmSend<DatabaseRow>(`/databases/${database.id}`, 'PATCH', body) : await crmSend<DatabaseRow>('/databases', 'POST', body)
      notify(database ? 'Base mise à jour' : 'Base créée')
      onClose()
      await onSaved(d, openImport)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const agents = (lookups?.agents || []).filter((a) => a.role === 'agent')
  return (
    <Modal open onClose={onClose} title={database ? `Modifier · ${database.name}` : 'Nouvelle base de contacts'} size="lg">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(false) }}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoFocus /></Field>
          <Field label="Source" hint="Salon, achat de fichier, site web…"><Input value={form.source} onChange={(e) => set('source', e.target.value)} maxLength={120} /></Field>
          <Field label="Statut"><Select value={form.status} onChange={(e) => set('status', e.target.value)}><option value="draft">Brouillon</option><option value="active">Active</option><option value="completed">Terminée</option><option value="archived">Archivée</option></Select></Field>
          <Field label="Campagne"><Select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}><option value="">Aucune</option>{(lookups?.campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Zone géographique"><Select value={form.zoneId} onChange={(e) => set('zoneId', e.target.value)}><option value="">Aucune</option>{(lookups?.zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} /></Field>
        <Field label="Agents assignés" hint="Ils verront les contacts non assignés de cette base."><MultiPick options={agents} value={form.agentIds} onChange={(v) => set('agentIds', v)} empty="Aucun agent : créez-en un dans Utilisateurs." /></Field>
        <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          {!database ? <Button type="button" variant="outline" disabled={busy} onClick={() => void save(true)}><Upload size={14} />Créer et importer</Button> : null}
          <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : database ? 'Enregistrer' : 'Créer la base'}</Button>
        </div>
      </form>
    </Modal>
  )
}

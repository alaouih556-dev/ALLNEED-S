import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, CalendarPlus, Contact as ContactIcon, Pencil, PhoneCall, Plus, Tags, UserCheck, X } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { DataTable, ExportButtons, FilterBar, RequirePermission, StatusPill, crmGet, crmSend, errorText, fmtDateTime, statusOptions, useCrm, useCrmQuery, useFilterState, useLookupFilters, useNotify, type Column, type Contact, type Page } from '@/features/crm/core'
import { AppointmentModal, CallModal, ContactModal, crmMemberLabel } from '@/features/crm/forms'
import { EXPORT_COLUMNS, exportValue } from '../bases/$id'

export const Route = createFileRoute('/crm/contacts/')({ component: () => <RequirePermission perm="contacts.view"><ContactsPage /></RequirePermission> })

function ContactsPage() {
  const { me, can, lookups } = useCrm()
  const navigate = useNavigate()
  const notify = useNotify()
  const isAdmin = Boolean(me?.isAdmin)
  const [values, setValues] = useFilterState({ pageSize: '25', sort: 'updatedAt', dir: 'desc' })
  const { data, loading, error, reload } = useCrmQuery<Page<Contact>>('/contacts', values)
  const filters = useLookupFilters(['database', 'campaign', 'agent', 'contactStatus', 'callStatus', 'appointmentStatus', 'city', 'region', 'zone'])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [assigning, setAssigning] = useState<Contact | null>(null)
  const [calling, setCalling] = useState<Contact | null>(null)
  const [booking, setBooking] = useState<{ contact: Contact; callId?: string } | null>(null)
  const [bulk, setBulk] = useState<'assign' | 'status' | 'tags' | 'campaign' | null>(null)

  async function bulkRun(action: string, extra: Record<string, unknown>) {
    try {
      const r = await crmSend<{ updated: number }>('/contacts/bulk', 'POST', { ids: [...selected], action, ...extra })
      notify(`${r.updated} contact(s) mis à jour`)
      setSelected(new Set())
      setBulk(null)
      await reload()
    } catch (e) {
      notify('Action impossible', 'warning', errorText(e))
    }
  }

  async function assignContact(contact: Contact, agentId: string | null) {
    try {
      await crmSend(`/contacts/${contact.id}`, 'PATCH', { agentId })
      notify('Assignation mise à jour')
      setAssigning(null)
      await reload()
    } catch (e) {
      notify('Assignation impossible', 'warning', errorText(e))
    }
  }

  const columns: Column<Contact>[] = [
    { key: 'name', label: 'Contact', sort: 'name', render: (c) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{c.fullName}</p><p className="truncate text-xs text-ink-500">{c.phone || c.email}{c.tags?.length ? ` · ${c.tags.slice(0, 3).join(', ')}` : ''}</p></div> },
    { key: 'city', label: 'Ville', sort: 'city', hideOn: 'md', render: (c) => <span className="text-xs text-ink-600">{c.city || '—'}</span> },
    { key: 'status', label: 'Statut', sort: 'status', render: (c) => <StatusPill kind="contact" value={c.status} /> },
    { key: 'call', label: 'Dernier appel', hideOn: 'lg', render: (c) => <div className="flex flex-col gap-1"><StatusPill kind="call" value={c.callStatus} /><span className="text-[0.68rem] text-ink-400">{c.lastContactAt ? fmtDateTime(c.lastContactAt) : ''}</span></div> },
    { key: 'agent', label: 'Agent', hideOn: 'lg', render: (c) => <span className="text-xs text-ink-600">{c.agentName || 'Non assigné'}</span> },
    { key: 'db', label: 'Base de contacts', hideOn: 'lg', render: (c) => <span className="text-xs text-ink-600">{c.databaseName}</span> },
    { key: 'cb', label: 'Rappel', sort: 'nextCallback', hideOn: 'md', render: (c) => c.nextCallbackAt ? <span className={`text-xs font-semibold ${new Date(c.nextCallbackAt) <= new Date() ? 'text-red-600' : 'text-amber-700'}`}>{fmtDateTime(c.nextCallbackAt)}</span> : <span className="text-xs text-ink-400">—</span> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="CRM · Données"
        title="Contacts"
        description={isAdmin ? 'Tous les contacts des bases. Filtrez, assignez en masse, appelez et prenez des rendez-vous.' : 'Tous les contacts de l’équipe CRM. Modifiez-les, appelez et prenez des rendez-vous.'}
        actions={
          <>
            {can('contacts.create') ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} />Nouveau contact</Button> : null}
            {can('contacts.export') ? <ExportButtons name="contacts" getData={async () => { const r = await crmGet<{ rows: Contact[] }>('/contacts/export', { ...values, page: undefined, pageSize: undefined }); return { columns: EXPORT_COLUMNS.map((c) => c[1]), rows: r.rows.map((c) => EXPORT_COLUMNS.map(([k]) => exportValue(c, k))) } }} /> : null}
          </>
        }
      />
      <FilterBar values={values} onChange={(v) => { setValues(v); setSelected(new Set()) }} filters={filters} searchPlaceholder="Nom, téléphone, e-mail, ville, tag…">
        <label className="crm-toggle"><input type="checkbox" checked={values.callbackDue === '1'} onChange={(e) => setValues({ ...values, callbackDue: e.target.checked ? '1' : '', page: '1' })} />Rappels échus</label>
        {isAdmin ? <label className="crm-toggle"><input type="checkbox" checked={values.unassigned === '1'} onChange={(e) => setValues({ ...values, unassigned: e.target.checked ? '1' : '', page: '1' })} />Non assignés</label> : null}
        {isAdmin ? <label className="crm-toggle"><input type="checkbox" checked={values.archived === '1'} onChange={(e) => setValues({ ...values, archived: e.target.checked ? '1' : '', page: '1' })} />Archivés</label> : null}
      </FilterBar>

      {selected.size ? (
        <div className="crm-bulkbar">
          <b>{selected.size} sélectionné(s)</b>
          {isAdmin ? <Button size="sm" variant="outline" onClick={() => setBulk('assign')}><UserCheck size={14} />Assigner</Button> : null}
          {can('contacts.edit') ? <Button size="sm" variant="outline" onClick={() => setBulk('status')}>Changer le statut</Button> : null}
          {can('contacts.edit') ? <Button size="sm" variant="outline" onClick={() => setBulk('tags')}><Tags size={14} />Ajouter des tags</Button> : null}
          {isAdmin ? <Button size="sm" variant="outline" onClick={() => setBulk('campaign')}>Campagne</Button> : null}
          {isAdmin ? <Button size="sm" variant="outline" onClick={() => void bulkRun(values.archived === '1' ? 'unarchive' : 'archive', {})}><Archive size={14} />{values.archived === '1' ? 'Désarchiver' : 'Archiver'}</Button> : null}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X size={14} />Désélectionner</Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={error}
        values={values}
        onChange={setValues}
        selectable={can('contacts.edit') || isAdmin}
        selected={selected}
        onSelect={setSelected}
        onRowClick={(c) => void navigate({ to: '/crm/contacts/$id' as any, params: { id: c.id } as any })}
        empty={{ icon: <ContactIcon size={20} />, title: 'Aucun contact', text: Object.keys(values).some((k) => !['page', 'pageSize', 'sort', 'dir'].includes(k)) ? 'Aucun contact ne correspond à ces filtres.' : isAdmin ? 'Importez un fichier dans une base, ou créez un contact.' : 'Aucun contact ne vous est assigné pour le moment.' }}
        rowActions={(c) => (
          <>
            {can('contacts.edit') ? <Button size="sm" variant="ghost" title="Modifier" aria-label={`Modifier ${c.fullName}`} onClick={() => setEditing(c)}><Pencil size={14} /></Button> : null}
            {isAdmin ? <Button size="sm" variant="ghost" title="Assigner" aria-label={`Assigner ${c.fullName}`} onClick={() => setAssigning(c)}><UserCheck size={14} /></Button> : null}
            {can('calls.create') ? <Button size="sm" variant="ghost" title="Enregistrer un appel" aria-label={`Appel avec ${c.fullName}`} onClick={() => setCalling(c)}><PhoneCall size={14} /></Button> : null}
            {can('appointments.create') ? <Button size="sm" variant="ghost" title="Prendre un rendez-vous" aria-label={`Rendez-vous avec ${c.fullName}`} onClick={() => setBooking({ contact: c })}><CalendarPlus size={14} /></Button> : null}
          </>
        )}
      />

      {creating ? <ContactModal contact={null} defaultDatabaseId={values.databaseId} onClose={() => setCreating(false)} onSaved={() => void reload()} /> : null}
      {editing ? <ContactModal contact={editing} onClose={() => setEditing(null)} onSaved={() => void reload()} /> : null}
      {assigning ? <BulkModal kind="assign" count={1} initial={assigning.agentId || ''} onClose={() => setAssigning(null)} onRun={(extra) => void assignContact(assigning, (extra.agentId as string | null) ?? null)} agents={(lookups?.agents || []).filter((a) => a.active || a.id === assigning.agentId)} campaigns={[]} statuses={[]} /> : null}
      {calling ? <CallModal contact={calling} onClose={() => setCalling(null)} onSaved={(call, book) => { void reload(); if (book) setBooking({ contact: calling, callId: call.id }) }} /> : null}
      {booking ? <AppointmentModal contact={booking.contact} callId={booking.callId} onClose={() => setBooking(null)} onSaved={() => void reload()} /> : null}
      {bulk ? <BulkModal kind={bulk} count={selected.size} onClose={() => setBulk(null)} onRun={(extra) => void bulkRun(bulk, extra)} agents={(lookups?.agents || []).filter((a) => a.active)} campaigns={lookups?.campaigns || []} statuses={statusOptions(me?.labels, 'contact')} /> : null}
    </div>
  )
}

function BulkModal({ kind, count, initial = '', agents, campaigns, statuses, onClose, onRun }: { kind: 'assign' | 'status' | 'tags' | 'campaign'; count: number; initial?: string; agents: Array<{ id: string; name: string; role?: string }>; campaigns: Array<{ id: string; name: string }>; statuses: Array<{ value: string; label: string }>; onClose: () => void; onRun: (extra: Record<string, unknown>) => void }) {
  const [value, setValue] = useState(initial)
  const titles = { assign: 'Assigner à un membre du CRM', status: 'Changer le statut', tags: 'Ajouter des tags', campaign: 'Rattacher à une campagne' }
  return (
    <Modal open onClose={onClose} title={titles[kind]} description={`${count} contact(s) sélectionné(s).`} size="sm">
      <div className="space-y-4">
        {kind === 'assign' ? <Field label="Membre du CRM"><Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Retirer l’assignation</option>{agents.map((a) => <option key={a.id} value={a.id}>{crmMemberLabel(a)}</option>)}</Select></Field> : null}
        {kind === 'status' ? <Field label="Nouveau statut"><Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choisir…</option>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field> : null}
        {kind === 'tags' ? <Field label="Tags" hint="Séparés par des virgules"><Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></Field> : null}
        {kind === 'campaign' ? <Field label="Campagne"><Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Celle de la base</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button disabled={(kind === 'status' || kind === 'tags') && !value} onClick={() => onRun(kind === 'assign' ? { agentId: value || null } : kind === 'status' ? { status: value } : kind === 'tags' ? { tags: value } : { campaignId: value || null })}>Appliquer</Button>
        </div>
      </div>
    </Modal>
  )
}

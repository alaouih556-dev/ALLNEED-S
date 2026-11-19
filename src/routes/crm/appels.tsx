import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarCheck2, Clock3, Pencil, PhoneCall, PhoneIncoming, PhoneMissed, UserCheck, UserX } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Button } from '@/components/ui'
import { MiniStat, Panel } from '@/components/admin-kit'
import { BarList, CHART_COLORS } from '@/components/charts'
import { DataTable, ExportButtons, FilterBar, RequirePermission, StatusPill, crmGet, fmtDateTime, fmtDuration, periodParams, useCrm, useCrmQuery, useFilterState, useLookupFilters, useStatusLabel, type Call, type Column, type Page } from '@/features/crm/core'
import { CallModal } from '@/features/crm/forms'

export const Route = createFileRoute('/crm/appels')({ component: () => <RequirePermission perm="contacts.view"><CallsPage /></RequirePermission> })

type Stats = { kpis: Record<string, number>; perAgent: Array<{ id: string; name: string; calls: number; reached: number }>; perCampaign: Array<{ id: string; name: string; calls: number; reached: number }> }

function CallsPage() {
  const { me, can } = useCrm()
  const navigate = useNavigate()
  const label = useStatusLabel()
  const isAdmin = Boolean(me?.isAdmin)
  const [values, setValues] = useFilterState({ period: 'month', pageSize: '25', sort: 'at', dir: 'desc' })
  const range = periodParams(values)
  const listParams = { ...values, ...range, period: undefined }
  const { data, loading, error, reload } = useCrmQuery<Page<Call>>('/calls', listParams)
  const stats = useCrmQuery<Stats>('/stats', { ...range, agentId: values.agentId, campaignId: values.campaignId, databaseId: values.databaseId, callStatus: values.callStatus })
  const filters = useLookupFilters(['agent', 'campaign', 'database', 'callStatus'])
  const [editing, setEditing] = useState<Call | null>(null)
  const k = stats.data?.kpis
  const v = (n?: number) => (stats.loading && !stats.data ? '–' : n ?? 0)

  const columns: Column<Call>[] = [
    { key: 'at', label: 'Date', sort: 'at', render: (c) => <span className="whitespace-nowrap text-xs font-semibold text-ink-700">{fmtDateTime(c.at)}</span> },
    { key: 'contact', label: 'Contact', sort: 'contact', render: (c) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{c.contactName}</p><p className="truncate text-xs text-ink-500">{c.phone}</p></div> },
    { key: 'agent', label: 'Agent', sort: 'agent', hideOn: 'md', render: (c) => <span className="text-xs text-ink-600">{c.agentName}</span> },
    { key: 'status', label: 'Statut', sort: 'status', render: (c) => <StatusPill kind="call" value={c.status} /> },
    { key: 'result', label: 'Résultat / notes', hideOn: 'lg', render: (c) => <span className="line-clamp-2 max-w-xs text-xs text-ink-600">{[c.result, c.notes].filter(Boolean).join(' — ') || '—'}</span> },
    { key: 'duration', label: 'Durée', sort: 'duration', hideOn: 'md', render: (c) => <span className="text-xs text-ink-600">{fmtDuration(c.durationSec)}</span> },
    { key: 'callback', label: 'Rappel', hideOn: 'lg', render: (c) => <span className="text-xs text-amber-700">{c.callbackAt ? fmtDateTime(c.callbackAt) : '—'}</span> },
    { key: 'campaign', label: 'Campagne', hideOn: 'lg', render: (c) => <span className="text-xs text-ink-600">{c.campaignName || '—'}</span> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="CRM · Activité"
        title="Appels"
        description="Chaque appel est consigné à la main après avoir composé le numéro : aucun appel n’est passé ou enregistré automatiquement."
        actions={<ExportButtons name="appels" getData={async () => { const all = await crmGet<Page<Call>>('/calls', { ...listParams, page: 1, pageSize: 200 }); const rows: Call[] = [...all.rows]; for (let p = 2; p <= Math.min(all.pages, 50); p++) rows.push(...(await crmGet<Page<Call>>('/calls', { ...listParams, page: p, pageSize: 200 })).rows); return { columns: ['Date', 'Contact', 'Téléphone', 'Agent', 'Statut', 'Résultat', 'Notes', 'Durée (s)', 'Rappel', 'Campagne', 'Base de contacts'], rows: rows.map((c) => [c.at, c.contactName, c.phone, c.agentName, label('call', c.status), c.result, c.notes, c.durationSec ?? '', c.callbackAt || '', c.campaignName, c.databaseName]) } }} />}
      />
      <FilterBar values={values} onChange={setValues} filters={filters} period searchPlaceholder="Contact, téléphone, notes, agent…" />

      <div className="crm-kpi-grid">
        <MiniStat icon={<PhoneCall size={18} />} tone="indigo" label="Appels" value={v(k?.totalCalls)} hint={`${v(k?.callsToday)} aujourd’hui`} />
        <MiniStat icon={<PhoneIncoming size={18} />} tone="emerald" label="Aboutis" value={v(k?.successfulCalls)} ratio={k?.totalCalls ? k.successfulCalls / k.totalCalls : 0} />
        <MiniStat icon={<PhoneMissed size={18} />} tone="rose" label="Sans réponse / échec" value={v(k?.unsuccessfulCalls)} ratio={k?.totalCalls ? k.unsuccessfulCalls / k.totalCalls : 0} />
        <MiniStat icon={<UserCheck size={18} />} tone="teal" label="Contacts joints" value={v(k?.contactsReached)} />
        <MiniStat icon={<UserX size={18} />} tone="slate" label="Contacts non joints" value={v(k?.contactsNotReached)} />
        <MiniStat icon={<Clock3 size={18} />} tone="amber" label="Rappels échus" value={v(k?.callbacksDue)} onClick={() => void navigate({ to: '/crm/contacts' as any, search: { callbackDue: '1' } as any })} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        {isAdmin ? <Panel title="Appels par agent"><div className="p-5">{stats.data?.perAgent.length ? <BarList items={stats.data.perAgent.map((a) => ({ label: a.name, value: a.calls, hint: `${a.reached} joints` }))} /> : <p className="text-sm text-ink-500">Aucun appel sur la période.</p>}</div></Panel> : null}
        <Panel title="Appels par campagne" description={`${v(k?.appointmentsBooked)} rendez-vous générés sur la période`}><div className="p-5">{stats.data?.perCampaign.filter((c) => c.calls).length ? <BarList color={CHART_COLORS[3]} items={stats.data.perCampaign.filter((c) => c.calls).map((c) => ({ label: c.name, value: c.calls, hint: `${c.reached} joints` }))} /> : <p className="flex items-center gap-2 text-sm text-ink-500"><CalendarCheck2 size={15} />Aucun appel rattaché à une campagne sur la période.</p>}</div></Panel>
      </div>

      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={error}
        values={values}
        onChange={setValues}
        onRowClick={(c) => void navigate({ to: '/crm/contacts/$id' as any, params: { id: c.contactId } as any })}
        empty={{ icon: <PhoneCall size={20} />, title: 'Aucun appel sur cette période', text: 'Ouvrez un contact et cliquez sur « Enregistrer un appel » après l’avoir appelé.' }}
        rowActions={(c) => (can('calls.edit') && (isAdmin || c.agentId === me?.user.id) ? <Button size="sm" variant="ghost" aria-label="Modifier l’appel" title="Modifier" onClick={() => setEditing(c)}><Pencil size={14} /></Button> : null)}
      />
      {editing ? <CallModal contact={{ id: editing.contactId, fullName: editing.contactName, phone: editing.phone, phone2: '' }} call={editing} onClose={() => setEditing(null)} onSaved={() => { void reload(); void stats.reload() }} /> : null}
    </div>
  )
}

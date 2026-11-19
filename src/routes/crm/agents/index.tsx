import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { BarChart3, UserPlus, UserRoundCog } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Button, Modal } from '@/components/ui'
import { BarList, CHART_COLORS } from '@/components/charts'
import { DataTable, FilterBar, RequirePermission, StatusPill, fmtDateTime, periodParams, useCrm, useCrmQuery, useFilterState, type Column, type CrmUser, type Page } from '@/features/crm/core'

export const Route = createFileRoute('/crm/agents/')({ component: () => <RequirePermission perm="agents.view"><AgentsPage /></RequirePermission> })

function AgentsPage() {
  const { lookups } = useCrm()
  const navigate = useNavigate()
  const [values, setValues] = useFilterState({ period: 'month', pageSize: '25', sort: 'appointments', dir: 'desc' })
  const params = { ...values, ...periodParams(values), period: undefined }
  const { data, loading, error } = useCrmQuery<Page<CrmUser>>('/agents', params)
  const [compare, setCompare] = useState<Set<string>>(new Set())
  const [showCompare, setShowCompare] = useState(false)
  const nameOf = (list: Array<{ id: string; name: string }> | undefined, ids: string[]) => ids.map((id) => list?.find((x) => x.id === id)?.name).filter(Boolean).join(', ')
  const filters = [
    { key: 'status', label: 'Statut', options: [{ value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Désactivé' }, { value: 'suspended', label: 'Suspendu' }] },
    { key: 'campaignId', label: 'Campagne', options: (lookups?.campaigns || []).map((c) => ({ value: c.id, label: c.name })) },
    { key: 'zoneId', label: 'Zone', options: (lookups?.zones || []).map((z) => ({ value: z.id, label: z.name })) },
  ]
  const columns: Column<CrmUser>[] = [
    { key: 'name', label: 'Agent', sort: 'name', render: (a) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{a.name}</p><p className="truncate text-xs text-ink-500">{a.email}{a.phone ? ` · ${a.phone}` : ''}</p></div> },
    { key: 'status', label: 'Statut', render: (a) => <StatusPill kind="user" value={a.status} /> },
    { key: 'assign', label: 'Affectations', hideOn: 'lg', render: (a) => <span className="text-xs text-ink-600">{[nameOf(lookups?.databases, a.databaseIds), nameOf(lookups?.campaigns, a.campaignIds), nameOf(lookups?.zones, a.zoneIds)].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'contacts', label: 'Contacts', hideOn: 'md', render: (a) => a.contactsAssigned ?? 0 },
    { key: 'calls', label: 'Appels', sort: 'calls', render: (a) => a.callsMade ?? 0 },
    { key: 'reached', label: 'Joints', sort: 'reached', hideOn: 'md', render: (a) => <span>{a.contactsReached ?? 0} <span className="text-xs text-ink-400">({a.contactRate ?? 0} %)</span></span> },
    { key: 'appointments', label: 'RDV', sort: 'appointments', render: (a) => <b>{a.appointmentsBooked ?? 0}</b> },
    { key: 'conversion', label: 'Conversion', sort: 'conversion', render: (a) => `${a.conversionRate ?? 0} %` },
    { key: 'last', label: 'Dernière activité', sort: 'lastActivity', hideOn: 'lg', render: (a) => <span className="text-xs text-ink-500">{fmtDateTime(a.lastActivityAt)}</span> },
  ]
  const compared = (data?.rows || []).filter((a) => compare.has(a.id))
  return (
    <div>
      <PageHeader
        eyebrow="CRM · Équipe"
        title="Agents"
        description="Performance de chaque agent sur la période : appels, contacts joints, rendez-vous et conversion. Les comptes se créent dans Utilisateurs."
        actions={<><Link to={'/crm/utilisateurs' as any}><Button size="sm" variant="outline"><UserPlus size={14} />Créer un agent</Button></Link><Button size="sm" disabled={compare.size < 2} onClick={() => setShowCompare(true)}><BarChart3 size={14} />Comparer ({compare.size})</Button></>}
      />
      <FilterBar values={values} onChange={setValues} filters={filters} period searchPlaceholder="Nom ou e-mail…" />
      <DataTable columns={columns} page={data} loading={loading} error={error} values={values} onChange={setValues} selectable selected={compare} onSelect={setCompare} onRowClick={(a) => void navigate({ to: '/crm/agents/$id' as any, params: { id: a.id } as any })} empty={{ icon: <UserRoundCog size={20} />, title: 'Aucun agent', text: 'Créez un compte avec le rôle Agent dans la gestion des utilisateurs.', action: <Link to={'/crm/utilisateurs' as any}><Button size="sm">Gérer les utilisateurs</Button></Link> }} />
      <p className="mt-2 text-xs text-ink-400">Cochez au moins deux agents pour les comparer.</p>
      {showCompare ? (
        <Modal open onClose={() => setShowCompare(false)} title="Comparaison des agents" description="Sur la période sélectionnée." size="lg">
          <div className="grid gap-6 sm:grid-cols-2">
            {([['Appels', 'callsMade', CHART_COLORS[0]], ['Contacts joints', 'contactsReached', CHART_COLORS[2]], ['Rendez-vous', 'appointmentsBooked', CHART_COLORS[3]], ['Conversion (%)', 'conversionRate', CHART_COLORS[5]]] as const).map(([title, key, color]) => (
              <div key={key}><p className="crm-subtitle">{title}</p><BarList color={color} items={compared.map((a) => ({ label: a.name, value: Number(a[key] ?? 0) }))} /></div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

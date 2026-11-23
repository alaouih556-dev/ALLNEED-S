import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDownRight, ArrowUpRight, FileText, LineChart, Printer } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Tabs } from '@/components/ui'
import { EmptyBox, LoadingRows, Panel } from '@/components/admin-kit'
import { AreaChart, BarList, CHART_COLORS } from '@/components/charts'
import { ExportButtons, FilterBar, Pagination, RequirePermission, periodParams, useCrm, useCrmQuery, useFilterState, useLookupFilters } from '@/features/crm/core'

export const Route = createFileRoute('/crm/rapports')({ component: () => <RequirePermission perm="reports.view"><ReportsPage /></RequirePermission> })

type Report = { columns: string[]; rows: Array<Array<string | number>>; series: Array<{ label: string; value: number; value2?: number }>; totals: Record<string, number>; previous: { from: string; to: string; totals: Record<string, number> } | null }
const TYPES: Array<{ value: string; label: string; adminOnly?: boolean; series: [string, string?]; timeline?: boolean }> = [
  { value: 'calls', label: 'Appels', series: ['Appels', 'Joints'], timeline: true },
  { value: 'contacts', label: 'Contacts', series: ['Contacts par statut'] },
  { value: 'appointments', label: 'Rendez-vous', series: ['Rendez-vous pris'], timeline: true },
  { value: 'agents', label: 'Agents', series: ['Appels', 'RDV'] },
  { value: 'databases', label: 'Bases', series: ['Contacts', 'RDV'] },
  { value: 'campaigns', label: 'Campagnes', series: ['Appels', 'RDV'] },
  { value: 'zones', label: 'Zones', series: ['Contacts par ville'] },
  { value: 'conversion', label: 'Conversion', series: ['Entonnoir'] },
  { value: 'callbacks', label: 'Rappels', series: ['Ponctualité des rappels'] },
]

function ReportsPage() {
  const { me } = useCrm()
  const [values, setValues] = useFilterState({ type: 'calls', period: 'month', compare: '1' })
  const type = TYPES.find((t) => t.value === values.type) || TYPES[0]
  const filters = useLookupFilters(['agent', 'campaign', 'database', 'zone', 'contactStatus', 'callStatus', 'appointmentStatus'])
  const params = { type: type.value, ...periodParams(values), compare: values.compare, agentId: values.agentId, campaignId: values.campaignId, databaseId: values.databaseId, zoneId: values.zoneId, status: values.status, callStatus: values.callStatus, appointmentStatus: values.appointmentStatus }
  const { data, loading, error } = useCrmQuery<Report>('/reports', params)
  const [page, setPage] = useState(1)
  const pageSize = 25
  const rows = data?.rows || []
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const labels = useMemo(() => (data?.series || []).map((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s.label) ? `${s.label.slice(8)}/${s.label.slice(5, 7)}` : s.label)), [data?.series])
  const range = periodParams(values)
  const fileName = `rapport-${type.value}-${range.from || 'debut'}-${range.to || 'fin'}`

  return (
    <div className="crm-report">
      <PageHeader
        eyebrow="CRM · Développement"
        title="Rapports et analyses"
        description={me?.isAdmin ? 'Analyses détaillées sur toute l’équipe, avec comparaison à la période précédente et export.' : 'Analyses de votre propre activité.'}
        actions={
          <>
            <ExportButtons name={fileName} disabled={!rows.length} getData={async () => ({ columns: data?.columns || [], rows })} />
            <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => window.print()}><Printer size={14} />PDF</Button>
          </>
        }
      />
      <Tabs className="mb-4" value={type.value} onChange={(v) => { setValues({ ...values, type: v }); setPage(1) }} tabs={TYPES.filter((t) => !t.adminOnly || me?.isAdmin).map((t) => ({ value: t.value, label: t.label }))} />
      <FilterBar values={values} onChange={(v) => { setValues(v); setPage(1) }} filters={filters} search={false} period>
        <label className="crm-toggle"><input type="checkbox" checked={values.compare === '1'} onChange={(e) => setValues({ ...values, compare: e.target.checked ? '1' : '' })} />Comparer à la période précédente</label>
      </FilterBar>
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {loading && !data ? <LoadingRows count={5} /> : null}

      {data ? (
        <>
          <div className="crm-totals">
            {Object.entries(data.totals).map(([k, v]) => {
              const prev = data.previous?.totals?.[k]
              const delta = prev === undefined ? null : v - prev
              return (
                <div key={k} className="crm-total">
                  <span>{k}</span>
                  <b>{v}</b>
                  {delta !== null ? <small className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>{delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : null}{delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} vs période précédente ({prev})</small> : null}
                </div>
              )
            })}
          </div>
          <Panel className="mb-5" title={type.series.filter(Boolean).join(' et ')} description={data.previous ? `Période précédente comparée : ${data.previous.from} → ${data.previous.to}` : undefined}>
            <div className="p-5">
              {!data.series.length ? <EmptyBox icon={<LineChart size={20} />} title="Aucune donnée à représenter" /> : type.timeline && data.series.length > 1 && data.series.length <= 120 ? (
                <AreaChart labels={labels} height={220} series={[{ name: type.series[0], color: CHART_COLORS[0], values: data.series.map((s) => s.value) }, ...(type.series[1] ? [{ name: type.series[1], color: CHART_COLORS[2], values: data.series.map((s) => s.value2 ?? 0) }] : [])]} />
              ) : (
                <div className={type.series[1] ? 'grid gap-6 lg:grid-cols-2' : ''}>
                  <div>{type.series[1] ? <p className="crm-subtitle">{type.series[0]}</p> : null}<BarList items={data.series.map((s, i) => ({ label: labels[i], value: s.value }))} /></div>
                  {type.series[1] ? <div><p className="crm-subtitle">{type.series[1]}</p><BarList color={CHART_COLORS[3]} items={data.series.map((s, i) => ({ label: labels[i], value: s.value2 ?? 0 }))} /></div> : null}
                </div>
              )}
            </div>
          </Panel>
          <Panel tone="indigo" title="Données détaillées" description={`${rows.length} ligne(s)${rows.length >= 5000 ? ' (limitées aux 5 000 premières)' : ''}`}>
            {!rows.length ? <EmptyBox icon={<FileText size={20} />} title="Aucune donnée pour ces filtres" /> : (
              <>
                <div className="overflow-x-auto"><table className="crm-table"><thead><tr>{data.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{pageRows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="whitespace-nowrap">{/^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? new Date(String(v)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : String(v ?? '')}</td>)}</tr>)}</tbody></table></div>
                <div className="crm-print-hide"><Pagination page={{ rows: pageRows, page, pageSize, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / pageSize)) }} values={{}} onChange={(v) => setPage(Number(v.page) || 1)} /></div>
              </>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  )
}

import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CalendarCheck2, CheckCircle2, Contact as ContactIcon, Megaphone, Pencil, Percent, PhoneCall, PhoneIncoming, Sparkles, Target, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Button } from '@/components/ui'
import { EmptyBox, LoadingRows, MiniStat, Panel } from '@/components/admin-kit'
import { AreaChart, BarList, CHART_COLORS, DonutChart, Legend } from '@/components/charts'
import { FilterBar, Info, RequirePermission, STATUS_HEX, StatusPill, fmtDate, periodParams, useCrm, useCrmQuery, useFilterState, useStatusLabel } from '@/features/crm/core'
import { CampaignModal, type CampaignRow } from './index'

export const Route = createFileRoute('/crm/campagnes/$id')({ component: () => <RequirePermission perm="campaigns.view"><CampaignDetail /></RequirePermission> })

type Detail = CampaignRow & { extra: { contactsAssigned: number; interested: number; completedAppointments: number }; stats: { kpis: Record<string, number>; series: Array<{ day: string; calls: number; reached: number; appointments: number }>; perAgent: Array<{ id: string; name: string; calls: number; appointments: number; conversionRate: number }>; appointmentStatus: Array<{ key: string; value: number }> } }

function CampaignDetail() {
  const { id } = Route.useParams()
  const { can, refreshLookups } = useCrm()
  const label = useStatusLabel()
  const [values, setValues] = useFilterState({ period: 'all' })
  const { data, loading, error, reload } = useCrmQuery<Detail>(`/campaigns/${id}`, periodParams(values))
  const [editing, setEditing] = useState(false)
  if (loading && !data) return <LoadingRows count={6} />
  if (error || !data) return <EmptyBox icon={<Megaphone size={20} />} title="Campagne introuvable" text={error} action={<Link to={'/crm/campagnes' as any}><Button size="sm" variant="outline">Retour aux campagnes</Button></Link>} />
  const k = data.stats.kpis
  const goal = (n: number, g: number | null) => (g ? `${n} / ${g}` : String(n))
  const apptSlices = data.stats.appointmentStatus.filter((s) => s.value).map((s) => ({ label: label('appointment', s.key), value: s.value, color: STATUS_HEX[s.key] || '#94a3b8' }))
  const series = data.stats.series.length > 1 && data.stats.series.length <= 62 ? data.stats.series : []
  return (
    <div>
      <PageHeader
        eyebrow={`Campagne${data.type ? ` · ${data.type}` : ''}`}
        title={data.name}
        description={data.description || `${data.startDate ? `Du ${fmtDate(data.startDate)}` : ''}${data.endDate ? ` au ${fmtDate(data.endDate)}` : ''}` || 'Aucune description.'}
        actions={<><Link to={'/crm/campagnes' as any}><Button size="sm" variant="outline"><ArrowLeft size={14} />Campagnes</Button></Link><Link to={'/crm/contacts' as any} search={{ campaignId: id } as any}><Button size="sm" variant="outline"><ContactIcon size={14} />Contacts</Button></Link><Link to={'/crm/appels' as any} search={{ campaignId: id, period: 'all' } as any}><Button size="sm" variant="outline"><PhoneCall size={14} />Appels</Button></Link><Link to={'/crm/rendez-vous' as any} search={{ campaignId: id, view: 'list' } as any}><Button size="sm" variant="outline"><CalendarCheck2 size={14} />RDV</Button></Link>{can('campaigns.manage') ? <Button size="sm" onClick={() => setEditing(true)}><Pencil size={14} />Modifier</Button> : null}</>}
      />
      <FilterBar values={values} onChange={setValues} filters={[]} search={false} period />
      <div className="crm-kpi-grid">
        <MiniStat icon={<ContactIcon size={18} />} tone="indigo" label="Contacts" value={goal(k.totalContacts, data.goals?.contacts)} hint={`${data.extra.contactsAssigned} assignés à un agent`} />
        <MiniStat icon={<PhoneCall size={18} />} tone="sky" label="Appels" value={goal(k.totalCalls, data.goals?.calls)} ratio={data.goals?.calls ? k.totalCalls / data.goals.calls : undefined} />
        <MiniStat icon={<PhoneIncoming size={18} />} tone="emerald" label="Contacts joints" value={k.contactsReached} hint={`${data.extra.interested} intéressé(s)`} />
        <MiniStat icon={<Target size={18} />} tone="teal" label="RDV pris" value={goal(k.appointmentsBooked, data.goals?.appointments)} ratio={data.goals?.appointments ? k.appointmentsBooked / data.goals.appointments : undefined} hint={data.metrics.progress !== null ? `${data.metrics.progress} % de l’objectif` : 'Pas d’objectif'} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="amber" label="RDV confirmés / réalisés" value={`${k.confirmedAppointments} / ${data.extra.completedAppointments}`} />
        <MiniStat icon={<Percent size={18} />} tone="slate" label="Conversion" value={`${k.conversionRate} %`} hint="RDV ÷ contacts appelés" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Progression dans le temps" description="Choisissez une période de 2 à 62 jours pour la courbe.">
          <div className="p-4">{series.length ? <AreaChart labels={series.map((s) => `${s.day.slice(8)}/${s.day.slice(5, 7)}`)} series={[{ name: 'Appels', color: CHART_COLORS[0], values: series.map((s) => s.calls) }, { name: 'RDV', color: CHART_COLORS[3], values: series.map((s) => s.appointments) }]} height={220} /> : <EmptyBox icon={<Sparkles size={20} />} title="Courbe disponible sur une période limitée" />}</div>
        </Panel>
        <Panel title="Statut des rendez-vous"><div className="flex flex-col items-center gap-4 p-5 sm:flex-row xl:flex-col 2xl:flex-row"><DonutChart slices={apptSlices} center={k.appointmentsBooked} sub="RDV" />{apptSlices.length ? <Legend items={apptSlices.map((s) => ({ label: s.label, color: s.color, value: s.value }))} /> : <p className="text-sm text-ink-500">Aucun rendez-vous.</p>}</div></Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Paramètres">
          <dl className="crm-info-grid p-5">
            <Info label="Statut"><StatusPill kind="campaign" value={data.status} /></Info>
            <Info label="Type">{data.type}</Info>
            <Info label="Début">{data.startDate ? fmtDate(data.startDate) : ''}</Info>
            <Info label="Fin">{data.endDate ? fmtDate(data.endDate) : ''}</Info>
            <Info label="Bases">{data.databaseNames.join(', ')}</Info>
            <Info label="Agents">{data.agentNames.join(', ')}</Info>
            <Info label="Zones">{data.zoneNames.join(', ')}</Info>
            <Info label="Objectifs">{[data.goals?.appointments ? `${data.goals.appointments} RDV` : '', data.goals?.calls ? `${data.goals.calls} appels` : '', data.goals?.contacts ? `${data.goals.contacts} contacts` : ''].filter(Boolean).join(' · ')}</Info>
            <Info label="Créée par">{data.createdByName}</Info>
          </dl>
        </Panel>
        <Panel title="Performance par agent">
          <div className="p-5">{data.stats.perAgent.length ? <BarList items={data.stats.perAgent.map((a) => ({ label: a.name, value: a.appointments, hint: `${a.calls} appels · ${a.conversionRate} %` }))} /> : <EmptyBox icon={<UserCheck size={20} />} title="Aucune activité d’agent" />}</div>
        </Panel>
      </div>
      {editing ? <CampaignModal campaign={data} onClose={() => setEditing(false)} onSaved={async () => { await reload(); await refreshLookups() }} /> : null}
    </div>
  )
}

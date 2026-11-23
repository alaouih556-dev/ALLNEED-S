import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CalendarCheck2, CalendarClock, CheckCircle2, Clock3, Contact as ContactIcon, Percent, PhoneCall, PhoneIncoming, Timer } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Button } from '@/components/ui'
import { EmptyBox, LoadingRows, MiniStat, Panel, Rows } from '@/components/admin-kit'
import { AreaChart, CHART_COLORS, DonutChart, Legend } from '@/components/charts'
import { FilterBar, Info, STATUS_HEX, StatusPill, fmtDateTime, fmtDuration, periodParams, useCrm, useCrmQuery, useFilterState, useStatusLabel, type Appointment, type CrmUser } from '@/features/crm/core'
import { AppointmentRows, actionLabel } from '../index'

export const Route = createFileRoute('/crm/agents/$id')({ component: AgentDetail })

type Detail = { agent: CrmUser; metrics: Record<string, number | null>; series: Array<{ day: string; calls: number; reached: number; appointments: number }>; callStatus: Array<{ key: string; value: number }>; appointmentStatus: Array<{ key: string; value: number }>; activity: Array<{ id: string; at: string; action: string }>; upcoming: Appointment[] }

function AgentDetail() {
  const { id } = Route.useParams()
  const { me, lookups } = useCrm()
  const label = useStatusLabel()
  const [values, setValues] = useFilterState({ period: 'month' })
  const { data, loading, error } = useCrmQuery<Detail>(`/agents/${id}`, periodParams(values))
  const isSelf = me?.user.id === id
  if (loading && !data) return <LoadingRows count={6} />
  if (error || !data) return <EmptyBox icon={<ContactIcon size={20} />} title="Agent introuvable" text={error} />
  const m = data.metrics
  const nameOf = (list: Array<{ id: string; name: string }> | undefined, ids: string[]) => ids.map((x) => list?.find((y) => y.id === x)?.name).filter(Boolean).join(', ')
  const callSlices = data.callStatus.filter((s) => s.value).map((s) => ({ label: label('call', s.key), value: s.value, color: STATUS_HEX[s.key] || '#94a3b8' }))
  const series = data.series.length > 62 ? [] : data.series
  return (
    <div>
      <PageHeader
        eyebrow={isSelf ? 'CRM · Ma performance' : 'CRM · Agent'}
        title={data.agent.name}
        description={`${data.agent.email}${data.agent.phone ? ` · ${data.agent.phone}` : ''} · dernière activité ${fmtDateTime(data.agent.lastActivityAt)}`}
        actions={me?.isAdmin ? <Link to={'/crm/agents' as any}><Button size="sm" variant="outline"><ArrowLeft size={14} />Agents</Button></Link> : undefined}
      />
      <FilterBar values={values} onChange={setValues} filters={[]} search={false} period />
      <div className="crm-kpi-grid">
        <MiniStat icon={<PhoneCall size={18} />} tone="indigo" label="Appels" value={m.callsMade ?? 0} hint={`${m.callsToday ?? 0} aujourd’hui`} />
        <MiniStat icon={<PhoneIncoming size={18} />} tone="emerald" label="Contacts joints" value={m.contactsReached ?? 0} hint={`Taux de contact ${m.contactRate ?? 0} %`} />
        <MiniStat icon={<CalendarCheck2 size={18} />} tone="teal" label="RDV pris" value={m.appointmentsBooked ?? 0} hint={`${m.confirmedAppointments ?? 0} confirmés`} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="sky" label="RDV réalisés" value={m.completedAppointments ?? 0} />
        <MiniStat icon={<Percent size={18} />} tone="amber" label="Conversion" value={`${m.conversionRate ?? 0} %`} hint="RDV ÷ contacts appelés" />
        <MiniStat icon={<Timer size={18} />} tone="slate" label="Durée moyenne" value={fmtDuration(m.avgCallDurationSec as number | null)} hint={`${m.callbacks ?? 0} rappel(s) programmé(s)`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Activité dans le temps"><div className="p-4">{series.length > 1 ? <AreaChart labels={series.map((s) => `${s.day.slice(8)}/${s.day.slice(5, 7)}`)} series={[{ name: 'Appels', color: CHART_COLORS[0], values: series.map((s) => s.calls) }, { name: 'Joints', color: CHART_COLORS[2], values: series.map((s) => s.reached) }, { name: 'RDV', color: CHART_COLORS[3], values: series.map((s) => s.appointments) }]} height={220} /> : <EmptyBox icon={<Clock3 size={20} />} title="Choisissez une période de 2 à 62 jours" />}</div></Panel>
        <Panel title="Résultat des appels"><div className="flex flex-col items-center gap-4 p-5 sm:flex-row xl:flex-col 2xl:flex-row"><DonutChart slices={callSlices} center={m.callsMade ?? 0} sub="appels" />{callSlices.length ? <Legend items={callSlices.map((s) => ({ label: s.label, color: s.color, value: s.value }))} /> : <p className="text-sm text-ink-500">Aucun appel sur la période.</p>}</div></Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Profil et affectations">
          <dl className="crm-info-grid p-5">
            <Info label="Statut"><StatusPill kind="user" value={data.agent.status} /></Info>
            <Info label="Contacts assignés">{String(m.contactsAssigned ?? 0)}</Info>
            <Info label="Bases">{nameOf(lookups?.databases, data.agent.databaseIds)}</Info>
            <Info label="Campagnes">{nameOf(lookups?.campaigns, data.agent.campaignIds)}</Info>
            <Info label="Zones">{nameOf(lookups?.zones, data.agent.zoneIds)}</Info>
            <Info label="Dernière connexion">{fmtDateTime(data.agent.lastLoginAt)}</Info>
          </dl>
          {me?.isAdmin ? <div className="border-t border-ink-100 p-4"><Link to={'/crm/utilisateurs' as any} search={{ q: data.agent.email } as any}><Button size="sm" variant="outline">Modifier le compte et les affectations</Button></Link></div> : null}
        </Panel>
        <Panel title="Prochains rendez-vous" action={<CalendarClock size={16} className="text-ink-400" />}><AppointmentRows rows={data.upcoming} loading={false} empty="Aucun rendez-vous à venir." withDate /></Panel>
        <Panel title="Dernières actions">
          {!data.activity.length ? <EmptyBox icon={<Clock3 size={20} />} title="Aucune action" /> : null}
          <Rows>{data.activity.map((a) => <li key={a.id} className="px-5 py-2.5 text-sm"><span className="text-ink-900">{actionLabel(a.action)}</span><span className="block text-xs text-ink-500">{fmtDateTime(a.at)}</span></li>)}</Rows>
        </Panel>
      </div>
    </div>
  )
}

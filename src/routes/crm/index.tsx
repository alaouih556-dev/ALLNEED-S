import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, CalendarCheck2, CalendarClock, CalendarX2, CheckCircle2, Clock3, Database, PhoneCall, PhoneIncoming, PhoneMissed, Percent, RefreshCcw, Trophy, UserRoundCheck, UsersRound, Contact as ContactIcon, Upload, Megaphone } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Tabs } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows } from '@/components/admin-kit'
import { AreaChart, BarList, CHART_COLORS, DonutChart, Legend } from '@/components/charts'
import { FilterBar, RequirePermission, STATUS_HEX, StatusPill, fmtDateTime, fmtDate, periodParams, useCrm, useCrmQuery, useFilterState, useLookupFilters, useStatusLabel, type Appointment, type Call } from '@/features/crm/core'

export const Route = createFileRoute('/crm/')({ component: () => <RequirePermission perm="dashboard.view"><CrmDashboard /></RequirePermission> })

type Stats = {
  kpis: Record<string, number>
  series: Array<{ day: string; calls: number; reached: number; appointments: number }>
  callStatus: Array<{ key: string; value: number }>
  appointmentStatus: Array<{ key: string; value: number }>
  perAgent: Array<{ id: string; name: string; calls: number; reached: number; appointments: number; conversionRate: number; lastActivityAt: string | null }>
  perDatabase: Array<{ id: string; name: string; contacts: number; called: number; reached: number; appointments: number; conversionRate: number }>
  perCampaign: Array<{ id: string; name: string; status: string; contacts: number; calls: number; reached: number; appointments: number; conversionRate: number; goal: number; progress: number | null }>
  geo: Array<{ city: string; contacts: number; appointments: number }>
  todayAppointments: Appointment[]
  upcomingAppointments: Appointment[]
  recentCalls: Call[]
  recentActivity: Array<{ id: string; at: string; userName: string; action: string; entityType: string; details: Record<string, unknown> }>
  topAgents: Stats['perAgent']
  agentsNeedingAttention: Stats['perAgent']
  recentImports: Array<{ id: string; fileName: string; databaseName: string; status: string; inserted: number; invalid: number; createdAt: string }>
}

const ACTION_LABELS: Record<string, string> = {
  'user.created': 'a créé un compte', 'user.updated': 'a modifié un compte', 'user.deactivated': 'a désactivé un compte', 'user.deleted': 'a supprimé un compte', 'user.password_reset': 'a réinitialisé un mot de passe',
  'database.created': 'a créé une base', 'database.updated': 'a modifié une base', 'database.imported': 'a importé des contacts', 'database.import_failed': 'a rencontré un échec d’import', 'database.assigned': 'a assigné une base', 'database.deleted': 'a supprimé une base',
  'contact.created': 'a créé un contact', 'contact.updated': 'a mis à jour un contact', 'contact.assigned': 'a assigné des contacts', 'contact.archived': 'a archivé des contacts', 'contact.deleted': 'a supprimé un contact', 'contact.exported': 'a exporté des contacts', 'contact.geocoded': 'a géolocalisé des contacts',
  'call.recorded': 'a enregistré un appel', 'call.updated': 'a modifié un appel', 'appointment.created': 'a pris un rendez-vous', 'appointment.updated': 'a mis à jour un rendez-vous', 'appointment.cancelled': 'a annulé un rendez-vous',
  'campaign.created': 'a créé une campagne', 'campaign.updated': 'a modifié une campagne', 'campaign.assigned': 'a assigné une campagne', 'campaign.deleted': 'a supprimé une campagne', 'zone.created': 'a créé une zone', 'zone.updated': 'a modifié une zone', 'zone.assigned': 'a assigné une zone', 'zone.deleted': 'a supprimé une zone', 'settings.changed': 'a modifié les réglages',
}
export const actionLabel = (a: string) => ACTION_LABELS[a] || a

/** Regroupe les séries par mois quand la période est longue (lisibilité). */
function groupSeries(series: Stats['series']) {
  if (series.length <= 62) return { labels: series.map((s) => `${s.day.slice(8, 10)}/${s.day.slice(5, 7)}`), rows: series }
  const map = new Map<string, Stats['series'][number]>()
  for (const s of series) { const k = s.day.slice(0, 7); const g = map.get(k) || { day: k, calls: 0, reached: 0, appointments: 0 }; g.calls += s.calls; g.reached += s.reached; g.appointments += s.appointments; map.set(k, g) }
  const rows = [...map.values()]
  return { labels: rows.map((r) => new Date(`${r.day}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' })), rows }
}

function CrmDashboard() {
  const { me } = useCrm()
  const navigate = useNavigate()
  const label = useStatusLabel()
  const [values, setValues] = useFilterState({ period: 'month' })
  const filters = useLookupFilters(['agent', 'campaign', 'database', 'zone', 'callStatus', 'appointmentStatus'])
  const params = { ...periodParams(values), agentId: values.agentId, campaignId: values.campaignId, databaseId: values.databaseId, zoneId: values.zoneId, callStatus: values.callStatus, appointmentStatus: values.appointmentStatus }
  const { data, loading, error, reload } = useCrmQuery<Stats>('/stats', params)
  const [compareTab, setCompareTab] = useState('agents')
  const isAdmin = Boolean(me?.isAdmin)
  const k = data?.kpis
  const v = (n?: number) => (loading && !data ? '–' : n ?? 0)
  const grouped = useMemo(() => groupSeries(data?.series || []), [data?.series])

  const callSlices = (data?.callStatus || []).filter((s) => s.value).map((s, i) => ({ label: label('call', s.key), value: s.value, color: STATUS_HEX[s.key] || CHART_COLORS[i % CHART_COLORS.length] }))
  const apptSlices = (data?.appointmentStatus || []).filter((s) => s.value).map((s) => ({ label: label('appointment', s.key), value: s.value, color: STATUS_HEX[s.key] || '#94a3b8' }))
  const firstName = (me?.user.name || '').split(' ')[0]

  return (
    <div>
      <PageHeader
        eyebrow={isAdmin ? 'CRM · Pilotage' : 'CRM · Mon activité'}
        title={isAdmin ? 'Tableau de bord' : `Bonjour ${firstName}`}
        description={isAdmin ? 'Appels, contacts joints, rendez-vous et performance de l’équipe, calculés en temps réel.' : 'Vos appels, vos rendez-vous et vos rappels du jour, sur votre périmètre.'}
        actions={
          <>
            <Link to={'/crm/contacts' as any}><Button size="sm"><ContactIcon size={14} />{isAdmin ? 'Contacts' : 'Mes contacts'}</Button></Link>
            <Button size="sm" variant="outline" onClick={() => void reload()}><RefreshCcw size={14} />Actualiser</Button>
          </>
        }
      />

      <FilterBar values={values} onChange={setValues} filters={filters} search={false} period />
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <div className="crm-kpi-grid">
        <MiniStat icon={<ContactIcon size={18} />} tone="indigo" label="Contacts" value={v(k?.totalContacts)} hint={`${v(k?.contactsNeverCalled)} jamais appelés`} onClick={() => void navigate({ to: '/crm/contacts' as any })} />
        <MiniStat icon={<PhoneCall size={18} />} tone="sky" label="Appels sur la période" value={v(k?.totalCalls)} hint={`${v(k?.callsToday)} aujourd’hui`} onClick={() => void navigate({ to: '/crm/appels' as any })} />
        <MiniStat icon={<PhoneIncoming size={18} />} tone="emerald" label="Contacts joints" value={v(k?.contactsReached)} hint={`${v(k?.contactsNotReached)} non joints`} />
        <MiniStat icon={<CalendarCheck2 size={18} />} tone="teal" label="RDV pris" value={v(k?.appointmentsBooked)} hint={`${v(k?.confirmedAppointments)} confirmés · ${v(k?.pendingAppointments)} à confirmer`} onClick={() => void navigate({ to: '/crm/rendez-vous' as any })} />
        <MiniStat icon={<Percent size={18} />} tone="amber" label="Taux de conversion" value={loading && !data ? '–' : `${k?.conversionRate ?? 0} %`} hint="RDV ÷ contacts appelés" />
        {isAdmin ? <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Agents actifs" value={v(k?.activeAgents)} hint={`${v(k?.totalDatabases)} base(s) de contacts`} onClick={() => void navigate({ to: '/crm/agents' as any })} /> : <MiniStat icon={<Clock3 size={18} />} tone="amber" label="Rappels à faire" value={v(k?.callbacksDue)} hint="Échus aujourd’hui" onClick={() => void navigate({ to: '/crm/contacts' as any, search: { callbackDue: '1' } as any })} />}
      </div>
      <div className="crm-kpi-strip">
        <span><PhoneIncoming size={14} />Appels aboutis <b>{v(k?.successfulCalls)}</b></span>
        <span><PhoneMissed size={14} />Appels sans réponse <b>{v(k?.unsuccessfulCalls)}</b></span>
        <span><Clock3 size={14} />RDV à confirmer <b>{v(k?.pendingAppointments)}</b></span>
        <span><CheckCircle2 size={14} />RDV confirmés <b>{v(k?.confirmedAppointments)}</b></span>
        <span><CalendarX2 size={14} />RDV annulés <b>{v(k?.cancelledAppointments)}</b></span>
        <span><AlertTriangle size={14} />Absences <b>{v(k?.noShowAppointments)}</b></span>
        <span><Database size={14} />Bases <b>{v(k?.totalDatabases)}</b></span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel tone="blue" title="Appels dans le temps" description="Appels passés et contacts effectivement joints.">
          <div className="p-4">
            {grouped.rows.length > 1 ? <AreaChart labels={grouped.labels} series={[{ name: 'Appels', color: CHART_COLORS[0], values: grouped.rows.map((r) => r.calls) }, { name: 'Joints', color: CHART_COLORS[2], values: grouped.rows.map((r) => r.reached) }]} height={230} /> : <EmptyBox icon={<PhoneCall size={20} />} title="Choisissez une période de plusieurs jours" text="La courbe s’affiche sur une période d’au moins deux jours." />}
          </div>
        </Panel>
        <Panel tone="blue" title="Résultat des appels" description="Aboutis ou non, par statut.">
          <div className="flex flex-col items-center gap-4 p-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <DonutChart slices={callSlices} center={k?.totalCalls ?? 0} sub="appels" />
            {callSlices.length ? <Legend items={callSlices.map((s) => ({ label: s.label, color: s.color, value: s.value }))} /> : <p className="text-sm text-ink-500">Aucun appel sur la période.</p>}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel tone="violet" title="Rendez-vous dans le temps" description="Rendez-vous pris chaque jour (date de prise).">
          <div className="p-4">
            {grouped.rows.length > 1 ? <AreaChart labels={grouped.labels} series={[{ name: 'Rendez-vous', color: CHART_COLORS[3], values: grouped.rows.map((r) => r.appointments) }]} height={200} /> : <EmptyBox icon={<CalendarClock size={20} />} title="Période trop courte pour une courbe" />}
          </div>
        </Panel>
        <Panel tone="violet" title="Statut des rendez-vous" description="Répartition sur la période.">
          <div className="flex flex-col items-center gap-4 p-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <DonutChart slices={apptSlices} center={apptSlices.reduce((a, s) => a + s.value, 0)} sub="rendez-vous" />
            {apptSlices.length ? <Legend items={apptSlices.map((s) => ({ label: s.label, color: s.color, value: s.value }))} /> : <p className="text-sm text-ink-500">Aucun rendez-vous sur la période.</p>}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5" tone="indigo" title="Comparaisons" description="Performance par agent, base, campagne et ville sur la période.">
        <Tabs className="px-4" value={compareTab} onChange={setCompareTab} tabs={[...(isAdmin ? [{ value: 'agents', label: 'Agents' }] : []), { value: 'databases', label: 'Bases' }, { value: 'campaigns', label: 'Campagnes' }, { value: 'geo', label: 'Géographie' }]} />
        <div className="p-5">
          {loading && !data ? <LoadingRows /> : null}
          {compareTab === 'agents' && isAdmin ? (
            data?.perAgent.length ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div><p className="crm-subtitle">Appels par agent</p><BarList items={data.perAgent.map((a) => ({ label: a.name, value: a.calls, hint: `${a.reached} joints` }))} /></div>
                <div><p className="crm-subtitle">Rendez-vous et conversion</p><BarList color={CHART_COLORS[2]} items={data.perAgent.map((a) => ({ label: a.name, value: a.appointments, hint: `${a.conversionRate} %` }))} /></div>
              </div>
            ) : <EmptyBox icon={<UsersRound size={20} />} title="Aucun agent" text="Créez des comptes agents depuis la gestion des utilisateurs." action={<Link to={'/crm/utilisateurs' as any}><Button size="sm">Gérer les utilisateurs</Button></Link>} />
          ) : null}
          {compareTab === 'databases' ? (data?.perDatabase.length ? <BarList items={data.perDatabase.map((d) => ({ label: d.name, value: d.contacts, hint: `${d.called} appelés · ${d.appointments} RDV · ${d.conversionRate} %` }))} /> : <EmptyBox icon={<Database size={20} />} title="Aucune base" />) : null}
          {compareTab === 'campaigns' ? (data?.perCampaign.length ? (
            <ul className="space-y-4">
              {data.perCampaign.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-3 text-sm"><Link to={'/crm/campagnes/$id' as any} params={{ id: c.id } as any} className="font-semibold text-ink-900 hover:underline">{c.name}</Link><span className="text-xs text-ink-500">{c.calls} appels · {c.appointments} RDV{c.goal ? ` / ${c.goal}` : ''}</span></div>
                  <div className="crm-progress mt-1.5"><i style={{ width: `${c.progress ?? Math.min(100, c.conversionRate)}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <EmptyBox icon={<Megaphone size={20} />} title="Aucune campagne" />) : null}
          {compareTab === 'geo' ? (data?.geo.length ? <BarList color={CHART_COLORS[1]} items={data.geo.map((g) => ({ label: g.city, value: g.contacts, hint: `${g.appointments} RDV` }))} /> : <EmptyBox icon={<Database size={20} />} title="Aucune donnée géographique" />) : null}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel tone="violet" title="Rendez-vous du jour" action={<Badge tone="info">{data?.todayAppointments.length ?? 0}</Badge>}>
          <AppointmentRows rows={data?.todayAppointments || []} loading={loading && !data} empty="Aucun rendez-vous aujourd’hui." />
        </Panel>
        <Panel tone="violet" title="Prochains rendez-vous" action={<Link to={'/crm/rendez-vous' as any} className="cg-link">Calendrier<ArrowRight size={13} /></Link>}>
          <AppointmentRows rows={data?.upcomingAppointments || []} loading={loading && !data} empty="Aucun rendez-vous à venir." withDate />
        </Panel>
        <Panel tone="blue" title="Derniers appels" action={<Link to={'/crm/appels' as any} className="cg-link">Tout voir<ArrowRight size={13} /></Link>}>
          {loading && !data ? <LoadingRows /> : null}
          {data && !data.recentCalls.length ? <EmptyBox icon={<PhoneCall size={20} />} title="Aucun appel sur la période" /> : null}
          <Rows>
            {(data?.recentCalls || []).map((c) => (
              <li key={c.id}>
                <Link to={'/crm/contacts/$id' as any} params={{ id: c.contactId } as any} className="cg-org-row">
                  <Initial name={c.contactName || '?'} tone="sky" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{c.contactName}</span><span className="block truncate text-xs text-ink-500">{fmtDateTime(c.at)} · {c.agentName}</span></span>
                  <StatusPill kind="call" value={c.status} />
                </Link>
              </li>
            ))}
          </Rows>
        </Panel>
        <Panel tone="teal" title="Activité récente">
          {data && !data.recentActivity.length ? <EmptyBox icon={<RefreshCcw size={20} />} title="Aucune activité enregistrée" /> : null}
          <Rows>
            {(data?.recentActivity || []).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <Initial name={a.userName} tone="slate" />
                <span className="min-w-0 flex-1 text-sm"><b className="text-ink-950">{a.userName}</b> <span className="text-ink-600">{actionLabel(a.action)}</span><span className="block text-xs text-ink-400">{fmtDateTime(a.at)}</span></span>
              </li>
            ))}
          </Rows>
        </Panel>
        {isAdmin ? (
          <Panel tone="amber" title="Meilleurs agents" description="Classés par rendez-vous pris sur la période.">
            {data && !data.topAgents.length ? <EmptyBox icon={<Trophy size={20} />} title="Aucun agent" /> : null}
            <Rows>
              {(data?.topAgents || []).map((a, i) => (
                <li key={a.id}>
                  <Link to={'/crm/agents/$id' as any} params={{ id: a.id } as any} className="cg-org-row">
                    <span className="crm-rank">{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{a.name}</span><span className="block text-xs text-ink-500">{a.calls} appels · {a.reached} joints</span></span>
                    <Badge tone="success">{a.appointments} RDV</Badge>
                  </Link>
                </li>
              ))}
            </Rows>
          </Panel>
        ) : null}
        {isAdmin ? (
          <Panel tone="amber" title="Agents à accompagner" description="Inactifs depuis plusieurs jours, ou peu de contacts joints.">
            {data && !data.agentsNeedingAttention.length ? <EmptyBox icon={<UserRoundCheck size={20} />} title="Toute l’équipe est active" /> : null}
            <Rows>
              {(data?.agentsNeedingAttention || []).map((a) => (
                <li key={a.id}>
                  <Link to={'/crm/agents/$id' as any} params={{ id: a.id } as any} className="cg-org-row">
                    <Initial name={a.name} tone="amber" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{a.name}</span><span className="block text-xs text-ink-500">{a.lastActivityAt ? `Dernière activité ${fmtDateTime(a.lastActivityAt)}` : 'Aucune activité enregistrée'}</span></span>
                    <Badge tone="warning">{a.calls ? `${Math.round((a.reached / a.calls) * 100)} % joints` : 'Inactif'}</Badge>
                  </Link>
                </li>
              ))}
            </Rows>
          </Panel>
        ) : null}
        {isAdmin ? (
          <Panel tone="emerald" title="Derniers imports" action={<Link to={'/crm/bases' as any} className="cg-link">Bases<ArrowRight size={13} /></Link>}>
            {data && !data.recentImports.length ? <EmptyBox icon={<Upload size={20} />} title="Aucun import" text="Importez un fichier CSV ou Excel depuis une base." /> : null}
            <Rows>
              {(data?.recentImports || []).map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <Initial name={i.fileName} tone={i.status === 'completed' ? 'emerald' : i.status === 'failed' ? 'rose' : 'amber'} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{i.fileName}</span><span className="block truncate text-xs text-ink-500">{i.databaseName} · {fmtDate(i.createdAt)}</span></span>
                  <Badge tone={i.status === 'completed' ? 'success' : i.status === 'failed' ? 'danger' : 'warning'}>{i.inserted} ajoutés{i.invalid ? ` · ${i.invalid} invalides` : ''}</Badge>
                </li>
              ))}
            </Rows>
          </Panel>
        ) : null}
        <Panel tone="coral" title="Campagnes" action={<Link to={'/crm/campagnes' as any} className="cg-link">Tout voir<ArrowRight size={13} /></Link>}>
          {data && !data.perCampaign.length ? <EmptyBox icon={<Megaphone size={20} />} title="Aucune campagne" /> : null}
          <Rows>
            {(data?.perCampaign || []).slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link to={'/crm/campagnes/$id' as any} params={{ id: c.id } as any} className="cg-org-row">
                  <Initial name={c.name} tone="indigo" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{c.name}</span><span className="block text-xs text-ink-500">{c.appointments} RDV{c.goal ? ` sur ${c.goal}` : ''} · {c.conversionRate} %</span></span>
                  <StatusPill kind="campaign" value={c.status} />
                </Link>
              </li>
            ))}
          </Rows>
        </Panel>
      </div>
    </div>
  )
}

export function AppointmentRows({ rows, loading, empty, withDate }: { rows: Appointment[]; loading: boolean; empty: string; withDate?: boolean }) {
  if (loading) return <LoadingRows />
  if (!rows.length) return <EmptyBox icon={<CalendarClock size={20} />} title={empty} />
  return (
    <Rows>
      {rows.map((a) => (
        <li key={a.id}>
          <Link to={'/crm/rendez-vous' as any} search={{ appointment: a.id } as any} className="cg-org-row">
            <span className="crm-time"><b>{a.start}</b>{withDate ? <small>{fmtDate(a.date)}</small> : <small>{a.end}</small>}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{a.contactName || a.title}</span><span className="block truncate text-xs text-ink-500">{[a.city, a.agentName].filter(Boolean).join(' · ') || a.type}</span></span>
            <StatusPill kind="appointment" value={a.status} />
          </Link>
        </li>
      ))}
    </Rows>
  )
}

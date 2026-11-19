import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  Inbox,
  Network,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRoundCog,
} from 'lucide-react'
import { apiRequest } from '@/lib/accompagnement'
import { useAuth } from '@/features/auth/AuthContext'
import { ValidationRequests } from '@/components/ValidationRequests'
import { AreaChart, BarList, DonutChart, Legend, Sparkline, StageBar } from '@/components/charts'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { isSectorActive, SINGLE_SECTOR } from '@/lib/active-sectors'

export const Route = createFileRoute('/admin/')({ component: AdminDashboard, head: () => ({ meta: [{ title: 'Tableau de bord — ALLNEEDS' }] }) })

/* ------------------------------------------------------------------ */
/* Types (sous-ensemble des réponses API utilisées par le tableau)     */
/* ------------------------------------------------------------------ */

type Org = { id: string; name: string; sector?: string; active?: boolean; plan?: string; saas?: { subscriptionActive?: boolean }; users?: Array<{ id: string; active?: boolean; passwordConfigured?: boolean }> }
type Registration = { id: string; name?: string; orgName?: string; sector?: string; status?: string; createdAt?: string; approvedAt?: string; appointmentDate?: string; appointmentSlot?: string; appointmentStatus?: string }
type Diagnostic = { id: string; orgId?: string; sector?: string; status?: string; format?: string; createdAt?: string; updatedAt?: string; restoredAt?: string }
type Mission = { id: string; title?: string; status?: string; orgId?: string; createdAt?: string; completedAt?: string | null }
type Need = { id: string; title?: string; status?: string; orgId?: string; createdAt?: string }
type Offer = { id: string; offerName?: string; offerCode?: string; price?: number; status?: string; orgId?: string; orgName?: string; createdAt?: string; requestedAt?: string }
type NeedsSub = { id: string; status?: string; planCode?: string; price?: number; orgId?: string }
type StaffRequest = { id?: string | number; status?: string }

interface DashboardData {
  orgs: Org[]
  registrations: Registration[]
  diagnostics: Diagnostic[]
  missions: Mission[]
  needs: Need[]
  offers: Offer[]
  needsSubs: NeedsSub[]
  concierges: Array<{ id: string; name?: string; active?: boolean }>
  pendingConcierges: unknown[]
  requests: StaffRequest[]
}

const EMPTY: DashboardData = { orgs: [], registrations: [], diagnostics: [], missions: [], needs: [], offers: [], needsSubs: [], concierges: [], pendingConcierges: [], requests: [] }

const SECTORS: Record<string, { label: string; color: string }> = {
  sante: { label: 'Santé', color: 'var(--an-accent-2)' },
  enseignement: { label: 'Enseignement', color: 'var(--an-accent)' },
  tourisme: { label: 'Tourisme', color: '#14b8a6' },
}
const OTHER_SECTOR = { label: 'Autre', color: '#94a3b8' }

const REG_LABELS: Record<string, string> = {
  pending: 'Nouvelle demande',
  nouveau: 'Nouvelle demande',
  en_attente_activation: 'Activation en attente',
  active: 'Compte actif',
  actif: 'Compte actif',
  refusee: 'Refusée',
  refused: 'Refusée',
}

const arr = <T,>(value: unknown, key?: string): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (key && value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key])) return (value as Record<string, T[]>)[key]
  return []
}

async function loadDashboard(): Promise<{ data: DashboardData; failed: number }> {
  const calls = await Promise.allSettled([
    apiRequest<unknown>('/api/admin/orgs'),
    apiRequest<unknown>('/api/admin/registrations'),
    apiRequest<unknown>('/api/diagnostics'),
    apiRequest<unknown>('/api/admin/missions'),
    apiRequest<unknown>('/api/needs'),
    apiRequest<unknown>('/api/admin/offers'),
    apiRequest<unknown>('/api/admin/needs/subscriptions'),
    apiRequest<unknown>('/api/admin/concierges'),
    apiRequest<unknown>('/api/staff/requests'),
  ])
  const v = (i: number) => (calls[i].status === 'fulfilled' ? (calls[i] as PromiseFulfilledResult<unknown>).value : null)
  // Seuls les secteurs actifs (aujourd’hui : Santé) sont affichés.
  const orgs = arr<Org>(v(0)).filter((o) => isSectorActive(o.sector))
  const orgIds = new Set(orgs.map((o) => o.id))
  const inScope = (x: { orgId?: string; sector?: string }) => (x.sector ? isSectorActive(x.sector) : !x.orgId || orgIds.has(x.orgId))
  return {
    failed: calls.filter((c) => c.status === 'rejected').length,
    data: {
      orgs,
      registrations: arr<Registration>(v(1)).filter(inScope),
      diagnostics: arr<Diagnostic>(v(2)).filter(inScope),
      missions: arr<Mission>(v(3), 'missions').filter(inScope),
      needs: arr<Need>(v(4), 'needs').filter(inScope),
      offers: arr<Offer>(v(5), 'offers').filter(inScope),
      needsSubs: arr<NeedsSub>(v(6), 'subscriptions').filter(inScope),
      concierges: arr(v(7), 'concierges'),
      pendingConcierges: arr(v(7), 'pending'),
      requests: arr<StaffRequest>(v(8), 'requests'),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Helpers temporels                                                   */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000
const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() || 0 : 0)

function weekBuckets(count: number) {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  return Array.from({ length: count }, (_, i) => {
    const to = end - (count - 1 - i) * 7 * DAY
    const from = to - 7 * DAY
    const label = new Date(from).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace('.', '')
    return { from, to, label }
  })
}

function countPerBucket(dates: number[], buckets: Array<{ from: number; to: number }>) {
  return buckets.map((b) => dates.filter((d) => d >= b.from && d < b.to).length)
}

function since(dates: number[], days: number) {
  const limit = Date.now() - days * DAY
  return dates.filter((d) => d >= limit).length
}

function relativeTime(t: number) {
  const diff = Date.now() - t
  const min = Math.round(diff / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `il y a ${d} j`
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const mad = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} MAD`

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function AdminDashboard() {
  const auth = useAuth()
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(0)
  const [range, setRange] = useState<8 | 12>(8)
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now())

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await loadDashboard()
    setData(result.data)
    setFailed(result.failed)
    setRefreshedAt(Date.now())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const m = useMemo(() => {
    const { orgs, registrations, diagnostics, missions, needs, offers, needsSubs, requests, pendingConcierges, concierges } = data
    const regDates = registrations.map((r) => ts(r.createdAt)).filter(Boolean)
    const diagDates = diagnostics.map((d) => ts(d.createdAt)).filter(Boolean)
    const missionDates = missions.map((x) => ts(x.createdAt)).filter(Boolean)
    const needDates = needs.map((x) => ts(x.createdAt)).filter(Boolean)
    const b8 = weekBuckets(8)

    const activeOrgs = orgs.filter((o) => o.active !== false)
    const pendingRegs = registrations.filter((r) => ['pending', 'nouveau', 'en_attente_activation'].includes(r.status ?? ''))
    const diagToReview = diagnostics.filter((d) => ['soumis', 'analyse', 'en_analyse', 'pret_a_valider'].includes(d.status ?? ''))
    const pendingRequests = requests.filter((r) => !r.status || ['pending', 'en_attente_validation', 'nouveau'].includes(r.status))
    const missionsDone = missions.filter((x) => /termin|valid|livr/.test(x.status ?? ''))
    const missionsActive = missions.filter((x) => !/termin|valid|livr|annul/.test(x.status ?? ''))
    const acceptedOffers = offers.filter((o) => /accept|valid|active/.test(o.status ?? ''))
    const offerRevenue = acceptedOffers.reduce((s, o) => s + (Number(o.price) || 0), 0)
    const activeSubs = needsSubs.filter((s) => /active|actif/.test(s.status ?? ''))
    const mrr = activeSubs.reduce((s, x) => s + (Number(x.price) || 0), 0)
    const saasActive = orgs.filter((o) => o.saas?.subscriptionActive).length
    const usersTotal = orgs.reduce((s, o) => s + (o.users?.length ?? 0), 0)
    const usersActivated = orgs.reduce((s, o) => s + (o.users?.filter((u) => u.passwordConfigured).length ?? 0), 0)

    const sectorCounts = new Map<string, number>()
    for (const o of orgs) sectorCounts.set(o.sector ?? 'autre', (sectorCounts.get(o.sector ?? 'autre') ?? 0) + 1)
    const statusSlices = [
      { label: 'Comptes actifs', value: orgs.filter((o) => o.active !== false && !o.saas?.subscriptionActive).length, color: 'var(--an-accent-2)' },
      { label: 'Actifs avec SaaS', value: orgs.filter((o) => o.active !== false && o.saas?.subscriptionActive).length, color: 'var(--an-accent)' },
      { label: 'Désactivés', value: orgs.filter((o) => o.active === false).length, color: '#cbd5e1' },
    ]
    const sectorSlices = SINGLE_SECTOR ? statusSlices : [...sectorCounts.entries()].map(([k, value]) => ({ label: (SECTORS[k] ?? OTHER_SECTOR).label, color: (SECTORS[k] ?? OTHER_SECTOR).color, value })).sort((a, b) => b.value - a.value)

    const diagStages = [
      { label: 'Brouillon', value: diagnostics.filter((d) => !d.status || d.status === 'brouillon').length, color: '#cbd5e1' },
      { label: 'Soumis', value: diagnostics.filter((d) => d.status === 'soumis').length, color: '#f59e0b' },
      { label: 'En analyse', value: diagnostics.filter((d) => ['analyse', 'en_analyse', 'pret_a_valider'].includes(d.status ?? '')).length, color: 'var(--an-accent)' },
      { label: 'Restitué', value: diagnostics.filter((d) => d.status === 'restitue').length, color: '#10b981' },
    ]

    const regStatus = new Map<string, number>()
    for (const r of registrations) {
      const label = REG_LABELS[r.status ?? ''] ?? (r.status || 'Inconnu')
      regStatus.set(label, (regStatus.get(label) ?? 0) + 1)
    }

    const orgName = (id?: string) => orgs.find((o) => o.id === id)?.name ?? 'Entreprise'
    type Event = { id: string; at: number; title: string; detail: string; icon: ReactNode; tone: string; to: string }
    const events: Event[] = [
      ...registrations.map((r) => ({ id: `r-${r.id}`, at: ts(r.createdAt), title: `Nouvelle inscription · ${r.orgName ?? r.name ?? ''}`, detail: `${r.name ?? 'Contact'} · ${(SECTORS[r.sector ?? ''] ?? OTHER_SECTOR).label}`, icon: <UserPlus size={15} />, tone: 'bg-indigo-50 text-indigo-600', to: '/admin/inscriptions' })),
      ...registrations.filter((r) => r.approvedAt).map((r) => ({ id: `ra-${r.id}`, at: ts(r.approvedAt), title: `Inscription approuvée · ${r.orgName ?? ''}`, detail: REG_LABELS[r.status ?? ''] ?? 'Accès préparé', icon: <ShieldCheck size={15} />, tone: 'bg-emerald-50 text-emerald-600', to: '/admin/inscriptions' })),
      ...diagnostics.map((d) => ({ id: `d-${d.id}`, at: ts(d.createdAt), title: `Diagnostic ${d.format ? `${d.format} ` : ''}${d.status === 'restitue' ? 'restitué' : 'soumis'}`, detail: `${orgName(d.orgId)} · ${(SECTORS[d.sector ?? ''] ?? OTHER_SECTOR).label}`, icon: <Gauge size={15} />, tone: 'bg-amber-50 text-amber-600', to: '/admin/diagnostics/reel' })),
      ...offers.map((o) => ({ id: `o-${o.id}`, at: ts(o.requestedAt ?? o.createdAt), title: `Offre ${o.offerName ?? o.offerCode ?? ''} demandée`, detail: `${o.orgName ?? orgName(o.orgId)} · ${mad(Number(o.price) || 0)}`, icon: <Receipt size={15} />, tone: 'bg-sky-50 text-sky-600', to: '/admin/offres' })),
      ...missions.map((x) => ({ id: `m-${x.id}`, at: ts(x.createdAt), title: `Mission ouverte · ${x.title ?? ''}`, detail: orgName(x.orgId), icon: <Briefcase size={15} />, tone: 'bg-violet-50 text-violet-600', to: '/admin/missions' })),
    ]
      .filter((e) => e.at)
      .sort((a, b) => b.at - a.at)
      .slice(0, 7)

    const upcoming = registrations
      .filter((r) => r.appointmentDate && ts(r.appointmentDate) >= Date.now() - DAY)
      .sort((a, b) => ts(a.appointmentDate) - ts(b.appointmentDate))
      .slice(0, 4)

    return {
      b8,
      regDates,
      diagDates,
      missionDates,
      needDates,
      activeOrgs,
      pendingRegs,
      diagToReview,
      pendingRequests,
      missionsDone,
      missionsActive,
      offerRevenue,
      acceptedOffers,
      mrr,
      activeSubs,
      saasActive,
      usersTotal,
      usersActivated,
      sectorSlices,
      diagStages,
      regStatus: [...regStatus.entries()].map(([label, value]) => ({ label, value })),
      events,
      upcoming,
      pendingConcierges,
      concierges,
    }
  }, [data])

  const buckets = useMemo(() => weekBuckets(range), [range])
  const firstName = (auth.user?.name ?? 'Admin').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const todo = m.pendingRegs.length + m.diagToReview.length + m.pendingRequests.length + m.pendingConcierges.length
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const kpis = [
    { label: 'Entreprises clientes', value: m.activeOrgs.length, delta: since(m.regDates, 30), deltaLabel: '30 j', spark: countPerBucket(m.regDates, m.b8), color: 'var(--an-accent)', icon: <Building2 size={18} />, iconCls: 'bg-indigo-50 text-indigo-600', to: '/admin/clients', foot: `${m.usersActivated}/${m.usersTotal} utilisateurs activés` },
    { label: 'Inscriptions', value: data.registrations.length, delta: since(m.regDates, 7), deltaLabel: '7 j', spark: countPerBucket(m.regDates, m.b8), color: 'var(--an-accent-2)', icon: <UserPlus size={18} />, iconCls: 'bg-sky-50 text-sky-600', to: '/admin/inscriptions', foot: `${m.pendingRegs.length} en attente de traitement` },
    { label: 'Diagnostics 360°', value: data.diagnostics.length, delta: since(m.diagDates, 30), deltaLabel: '30 j', spark: countPerBucket(m.diagDates, m.b8), color: '#f59e0b', icon: <Gauge size={18} />, iconCls: 'bg-amber-50 text-amber-600', to: '/admin/diagnostics/reel', foot: `${m.diagToReview.length} à relire` },
    { label: 'Missions actives', value: m.missionsActive.length, delta: since(m.missionDates, 30), deltaLabel: '30 j', spark: countPerBucket(m.missionDates, m.b8), color: '#10b981', icon: <Briefcase size={18} />, iconCls: 'bg-emerald-50 text-emerald-600', to: '/admin/missions', foot: `${m.missionsDone.length} terminées` },
  ]

  const actions = [
    { label: 'Inscriptions à traiter', detail: 'Approuver et préparer les accès', value: m.pendingRegs.length, icon: <ClipboardCheck size={17} />, to: '/admin/inscriptions', tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Diagnostics à relire', detail: 'Analyser et restituer au client', value: m.diagToReview.length, icon: <FileCheck2 size={17} />, to: '/admin/diagnostics/reel', tone: 'bg-amber-50 text-amber-600' },
    { label: 'Demandes à valider', detail: 'Offres, Besoins et accès SaaS', value: m.pendingRequests.length, icon: <Inbox size={17} />, to: '/admin', tone: 'bg-sky-50 text-sky-600', anchor: '#validations' },
    { label: 'Concierges en attente', detail: 'Activer les comptes de l’équipe', value: m.pendingConcierges.length, icon: <UserRoundCog size={17} />, to: '/admin/concierges', tone: 'bg-teal-50 text-teal-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="an-hero">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <span className="an-hero-chip"><Sparkles size={13} />{today}</span>
            <h1 className="mt-4">{greeting}, {firstName}</h1>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100/90">
              {loading ? 'Chargement des indicateurs…' : todo ? <>Vous avez <b className="text-white">{todo} élément{todo > 1 ? 's' : ''}</b> qui attendent une décision. Voici la situation de l’activité ALLNEEDS en temps réel.</> : 'Tout est à jour : aucune décision en attente. Voici la situation de l’activité ALLNEEDS en temps réel.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/admin/inscriptions" className="an-hero-btn">Traiter les inscriptions<ArrowRight size={15} /></Link>
              <button type="button" onClick={() => void refresh()} className="an-hero-btn is-ghost"><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</button>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto sm:min-w-[340px]">
            <div className="an-hero-stat"><small>Chiffre d’affaires offres</small><b>{mad(m.offerRevenue)}</b></div>
            <div className="an-hero-stat"><small>Abonnements Besoins / mois</small><b>{mad(m.mrr)}</b></div>
            <div className="an-hero-stat"><small>Accès SaaS actifs</small><b>{m.saasActive}</b></div>
            <div className="an-hero-stat"><small>Concierges</small><b>{m.concierges.length}</b></div>
          </div>
        </div>
      </section>

      {failed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {failed} source{failed > 1 ? 's' : ''} de données n’{failed > 1 ? 'ont' : 'a'} pas répondu : certains indicateurs peuvent être incomplets.
        </div>
      ) : null}

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to as any} className="an-kpi an-kpi-toned group" style={{ ['--tone' as string]: k.color }}>
            <div className="flex items-start justify-between">
              <span className="an-kpi-icon an-kpi-icon-toned">{k.icon}</span>
              <ArrowUpRight size={16} className="text-ink-300 transition group-hover:text-ink-600" />
            </div>
            <p className="mt-4 text-[0.8rem] font-medium text-ink-500">{k.label}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              {loading ? <span className="an-skeleton h-8 w-16" /> : <span className="font-display text-[2rem] font-extrabold leading-none tracking-tight text-ink-950 tabular-nums">{k.value}</span>}
              <span className={cn('an-delta', k.delta ? 'up' : 'flat')}>{k.delta ? `+${k.delta}` : '0'} · {k.deltaLabel}</span>
            </div>
            <Sparkline values={k.spark} color={k.color} className="mt-3" />
            <p className="mt-1 border-t border-ink-100 pt-2.5 text-[0.72rem] text-ink-500">{k.foot}</p>
          </Link>
        ))}
      </section>

      {/* Activité + secteurs */}
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="an-panel xl:col-span-2">
          <div className="an-panel-head">
            <div>
              <h2>Activité de la plateforme</h2>
              <p>Inscriptions et diagnostics reçus, par semaine</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-4 text-xs text-ink-500 sm:flex">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--an-accent)]" />Inscriptions</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f59e0b]" />Diagnostics</span>
              </div>
              <div className="an-seg">
                {([8, 12] as const).map((r) => <button key={r} type="button" className={cn(range === r && 'is-on')} onClick={() => setRange(r)}>{r} sem.</button>)}
              </div>
            </div>
          </div>
          <div className="px-3 pb-3 pt-4 sm:px-5">
            <AreaChart
              labels={buckets.map((b) => b.label)}
              series={[
                { name: 'Inscriptions', color: 'var(--an-accent)', values: countPerBucket(m.regDates, buckets) },
                { name: 'Diagnostics', color: '#f59e0b', values: countPerBucket(m.diagDates, buckets) },
              ]}
            />
          </div>
        </div>

        <div className="an-panel">
          <div className="an-panel-head">
            <div>
              <h2>{SINGLE_SECTOR ? 'Comptes clients Santé' : 'Répartition par secteur'}</h2>
              <p>{SINGLE_SECTOR ? 'Statut des entreprises clientes' : 'Entreprises clientes enregistrées'}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-6 p-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <DonutChart slices={m.sectorSlices} center={data.orgs.length} sub="entreprises" />
            <div className="w-full min-w-0 flex-1">
              {m.sectorSlices.length ? <Legend items={m.sectorSlices.map((s) => ({ ...s, value: s.value }))} /> : <p className="text-sm text-ink-500">Aucune entreprise pour l’instant.</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Pipelines */}
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="an-panel">
          <div className="an-panel-head">
            <div>
              <h2>Pipeline des diagnostics</h2>
              <p>Où en sont les diagnostics 360° des clients</p>
            </div>
            <Link to="/admin/diagnostics/reel" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Voir tout →</Link>
          </div>
          <div className="p-5"><StageBar stages={m.diagStages} /></div>
        </div>

        <div className="an-panel">
          <div className="an-panel-head">
            <div>
              <h2>Statut des inscriptions</h2>
              <p>Du formulaire public jusqu’au compte actif</p>
            </div>
            <Link to="/admin/inscriptions" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Gérer →</Link>
          </div>
          <div className="p-5">
            {m.regStatus.length ? <BarList items={m.regStatus} color="#6366f1" /> : <EmptyLine text="Aucune inscription reçue pour l’instant." />}
          </div>
        </div>
      </section>

      {/* À traiter + activité récente */}
      <section className="grid gap-4 xl:grid-cols-5">
        <div className="an-panel xl:col-span-3">
          <div className="an-panel-head pb-3">
            <div>
              <h2>À traiter</h2>
              <p>Les files de travail qui attendent une décision</p>
            </div>
            <span className={cn('rounded-md px-2 py-1 text-xs font-bold', todo ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700')}>{todo ? `${todo} en attente` : 'À jour'}</span>
          </div>
          <div className="divide-y divide-ink-100 border-t border-ink-100">
            {actions.map((a) => (
              <Link key={a.label} to={a.to as any} hash={a.anchor ? a.anchor.slice(1) : undefined} className="an-row-link">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', a.tone)}>{a.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-950">{a.label}</span>
                  <span className="block truncate text-xs text-ink-500">{a.detail}</span>
                </span>
                {a.value ? <span className="min-w-[2rem] rounded-lg bg-ink-950 px-2 py-1 text-center text-xs font-bold text-white tabular-nums">{a.value}</span> : <CheckCircle2 size={18} className="text-emerald-500" />}
                <ArrowRight size={15} className="text-ink-300" />
              </Link>
            ))}
          </div>
          {m.upcoming.length ? (
            <div className="border-t border-ink-100 p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500"><CalendarClock size={14} />Rendez-vous à venir</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {m.upcoming.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-indigo-50 text-center leading-none text-indigo-700">
                      <span><b className="block text-base">{new Date(r.appointmentDate!).getDate()}</b><small className="text-[0.6rem] uppercase">{new Date(r.appointmentDate!).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-950">{r.orgName ?? r.name}</p>
                      <p className="truncate text-xs text-ink-500">{r.appointmentSlot ?? 'Créneau à confirmer'} · {r.appointmentStatus === 'demande' ? 'à confirmer' : r.appointmentStatus ?? ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="an-panel xl:col-span-2">
          <div className="an-panel-head pb-3">
            <div>
              <h2>Activité récente</h2>
              <p>Mis à jour {relativeTime(refreshedAt)}</p>
            </div>
            <Activity size={17} className="text-ink-300" />
          </div>
          <ol className="relative border-t border-ink-100 px-5 py-4">
            {m.events.map((e, i) => (
              <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < m.events.length - 1 ? <span className="absolute left-[17px] top-9 h-[calc(100%-28px)] w-px bg-ink-100" /> : null}
                <span className={cn('relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-white', e.tone)}>{e.icon}</span>
                <Link to={e.to as any} className="min-w-0 flex-1 rounded-lg pt-0.5">
                  <p className="truncate text-sm font-semibold text-ink-900 hover:text-indigo-700">{e.title}</p>
                  <p className="truncate text-xs text-ink-500">{e.detail}</p>
                  <p className="mt-0.5 text-[0.68rem] text-ink-400">{relativeTime(e.at)}</p>
                </Link>
              </li>
            ))}
            {!loading && !m.events.length ? <EmptyLine text="Aucune activité enregistrée pour l’instant." /> : null}
            {loading ? [0, 1, 2].map((i) => <div key={i} className="mb-4 flex gap-3"><span className="an-skeleton h-9 w-9 rounded-full" /><span className="flex-1 space-y-2"><span className="an-skeleton block h-3 w-3/4" /><span className="an-skeleton block h-3 w-1/2" /></span></div>) : null}
          </ol>
        </div>
      </section>

      {/* Validations (fonctionnel, existant) */}
      <section id="validations" className="scroll-mt-24">
        <ValidationRequests />
      </section>

      {/* Accès rapides */}
      <section>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">Accès rapides</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/admin/clients', label: 'Clients & accès', detail: 'Modules et utilisateurs', icon: <Building2 size={17} /> },
            { to: '/admin/concierges', label: 'Concierges', detail: 'Équipe et affectations', icon: <UserRoundCog size={17} /> },
            { to: '/admin/offres', label: 'Offres', detail: 'Catalogue et demandes', icon: <Receipt size={17} /> },
            { to: '/admin/abonnements', label: 'Abonnements Besoins', detail: 'Formules mensuelles', icon: <Network size={17} /> },
          ].map((q) => (
            <Link key={q.to} to={q.to as any} className="an-quick">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">{q.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-950">{q.label}</span>
                <span className="block truncate text-xs text-ink-500">{q.detail}</span>
              </span>
              <ArrowRight size={15} className="text-ink-300" />
            </Link>
          ))}
        </div>
      </section>

      <p className="flex items-center justify-center gap-2 pt-2 text-center text-xs text-ink-400">
        <Avatar name={auth.user?.name ?? 'Admin'} size="sm" />
        Données réelles issues du serveur ALLNEEDS · aucune donnée de démonstration
      </p>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">{text}</p>
}

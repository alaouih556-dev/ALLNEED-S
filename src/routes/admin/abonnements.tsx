import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Banknote, CheckCircle2, Clock3, Inbox, RefreshCcw, Repeat } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Select } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, Segmented, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { apiRequest } from '@/lib/accompagnement'
import {
  NEEDS_SUBSCRIPTION_STATUS_META,
  fetchAdminNeedsSubscriptions,
  patchAdminNeedsSubscription,
  type NeedsCatalogItem,
  type NeedsSubscriptionStatus,
  type NeedsSubscriptionSummary,
} from '@/lib/besoins'
import { longDate, money } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/abonnements')({
  component: AdminNeedsSubscriptionsPage,
  head: () => ({ meta: [{ title: 'Abonnements Besoins — ALLNEEDS' }] }),
})

const isPending = (s: NeedsSubscriptionSummary) => s.status === 'pending' || s.status === 'en_attente_validation'
const isActive = (s: NeedsSubscriptionSummary) => s.status === 'active'
type View = 'en_attente' | 'actifs' | 'tous'

function AdminNeedsSubscriptionsPage() {
  const [rows, setRows] = useState<NeedsSubscriptionSummary[]>([])
  const [catalog, setCatalog] = useState<NeedsCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [view, setView] = useState<View>('en_attente')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminNeedsSubscriptions()
      setRows(result.subscriptions)
      setCatalog(result.catalog)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement des abonnements impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function decide(id: string, decision: 'approve' | 'refuse') {
    setBusy(id); setError('')
    try {
      await apiRequest(`/api/staff/requests/needs/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Décision impossible')
    } finally {
      setBusy('')
    }
  }

  async function change(id: string, status: NeedsSubscriptionStatus) {
    setBusy(id); setError('')
    try {
      await patchAdminNeedsSubscription(id, { status })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible')
    } finally {
      setBusy('')
    }
  }

  const counts = { en_attente: rows.filter(isPending).length, actifs: rows.filter(isActive).length, tous: rows.length }
  const mrr = rows.filter(isActive).reduce((s, r) => s + (Number(r.price) || 0), 0)
  const visible = useMemo(
    () => rows.filter((r) => (view === 'en_attente' ? isPending(r) : view === 'actifs' ? isActive(r) : true)).filter((r) => matches(query, r.orgName, r.planName)),
    [rows, view, query],
  )

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Abonnements Besoins"
        description="Les formules mensuelles qui permettent aux clients de déposer des besoins et de recevoir des propositions."
        actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>}
      />

      <StatGrid>
        <MiniStat icon={<Clock3 size={18} />} tone="amber" label="À valider" value={counts.en_attente} active={view === 'en_attente'} onClick={() => setView('en_attente')} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Actifs" value={counts.actifs} active={view === 'actifs'} onClick={() => setView('actifs')} />
        <MiniStat icon={<Repeat size={18} />} tone="indigo" label="Total souscrit" value={counts.tous} active={view === 'tous'} onClick={() => setView('tous')} />
        <MiniStat icon={<Banknote size={18} />} tone="sky" label="Revenu mensuel" value={money(mrr)} />
      </StatGrid>

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <Panel className="mb-6">
        <Toolbar>
          <Segmented value={view} onChange={setView} options={[{ value: 'en_attente', label: 'À valider', count: counts.en_attente }, { value: 'actifs', label: 'Actifs', count: counts.actifs }, { value: 'tous', label: 'Tous', count: counts.tous }]} />
          <SearchBox value={query} onChange={setQuery} placeholder="Entreprise ou formule…" />
        </Toolbar>
        {loading ? <LoadingRows /> : null}
        {!loading && !visible.length ? <EmptyBox icon={<Inbox size={20} />} title={view === 'en_attente' ? 'Aucun abonnement à valider' : 'Aucun abonnement ici'} text="Les demandes d’abonnement des clients apparaîtront ici." /> : null}
        <Rows>
          {visible.map((row) => {
            const meta = NEEDS_SUBSCRIPTION_STATUS_META[row.status] ?? NEEDS_SUBSCRIPTION_STATUS_META.pending
            const usage = row.monthlyLimit ? Math.min(100, Math.round((row.usedThisMonth / row.monthlyLimit) * 100)) : 0
            return (
              <li key={row.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-center">
                <div className="flex min-w-0 gap-3">
                  <Initial name={row.orgName || 'E'} tone={isPending(row) ? 'amber' : isActive(row) ? 'emerald' : 'slate'} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink-950">{row.orgName || row.orgId}</p>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-600">Formule <b className="text-ink-900">{row.planName}</b> · {money(row.price)}/mois{row.periodEnd ? <span className="text-ink-400"> · jusqu’au {longDate(row.periodEnd)}</span> : null}</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-ink-500"><span>Besoins ce mois</span><b className="text-ink-900">{row.usedThisMonth}/{row.monthlyLimit}</b></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100"><div className={cn('h-full rounded-full', usage >= 100 ? 'bg-rose-500' : 'bg-indigo-500')} style={{ width: `${usage}%` }} /></div>
                </div>
                {isPending(row) ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === row.id} onClick={() => void decide(row.id, 'approve')}><CheckCircle2 size={14} />Activer</Button>
                    <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => void decide(row.id, 'refuse')}>Refuser</Button>
                  </div>
                ) : (
                  <Select aria-label="Changer le statut" value={row.status} disabled={busy === row.id} onChange={(e) => void change(row.id, e.target.value as NeedsSubscriptionStatus)} className="w-full md:w-36">
                    <option value="active">Actif</option>
                    <option value="suspended">Suspendu</option>
                    <option value="cancelled">Résilié</option>
                    <option value="expired">Expiré</option>
                    {!['active', 'suspended', 'cancelled', 'expired'].includes(row.status) ? <option value={row.status}>{meta.label}</option> : null}
                  </Select>
                )}
              </li>
            )
          })}
        </Rows>
      </Panel>

      {catalog.length ? (
        <Panel title="Formules proposées" description="Prix mensuels et limites de chaque formule.">
          <div className="grid gap-4 p-5 md:grid-cols-3">
            {catalog.map((plan) => (
              <div key={plan.code} className={cn('rounded-2xl border p-5', plan.recommendedProposal && !plan.negotiatedProposal ? 'border-indigo-200 bg-indigo-50/40' : 'border-ink-100')}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-extrabold tracking-tight text-ink-950">{plan.name}</p>
                  <p className="font-display text-lg font-extrabold text-indigo-700">{money(plan.price)}<small className="text-xs font-medium text-ink-500">/{plan.period}</small></p>
                </div>
                <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-700">
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />{plan.monthlyLimit} besoins par mois</li>
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />Jusqu’à {plan.proposalsLimit} propositions par besoin</li>
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />Réponse visée sous {plan.targetDelayHours} h</li>
                  {plan.recommendedProposal ? <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />Proposition recommandée</li> : null}
                  {plan.negotiatedProposal ? <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />Négociation incluse</li> : null}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  )
}

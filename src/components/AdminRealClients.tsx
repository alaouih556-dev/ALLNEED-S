import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Database, FileText, KeyRound, RefreshCcw, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { AdminClientAccess } from '@/components/AdminClientAccess'
import { AdminClientDataControl } from '@/components/AdminClientDataControl'
import { AdminClientDocuments } from '@/components/AdminClientDocuments'
import { PageHeader } from '@/components/layouts'
import { Alert, Avatar, Badge, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

type User = { id: string; name: string; email: string; role: string; active?: boolean; passwordConfigured?: boolean }
type Org = { id: string; name: string; sector: string; slug: string; active: boolean; plan?: string; modules: Record<string, boolean>; users: User[]; saas?: { subscriptionActive?: boolean } }

const SECTOR: Record<string, { label: string; cls: string }> = {
  sante: { label: 'Santé', cls: 'bg-sky-50 text-sky-700' },
  enseignement: { label: 'Enseignement', cls: 'bg-indigo-50 text-indigo-700' },
  tourisme: { label: 'Tourisme', cls: 'bg-teal-50 text-teal-700' },
}

const TABS = [
  { key: 'access', label: 'Accès & SaaS', icon: <KeyRound size={15} /> },
  { key: 'users', label: 'Utilisateurs', icon: <UsersRound size={15} /> },
  { key: 'data', label: 'Données', icon: <Database size={15} /> },
  { key: 'docs', label: 'Documents', icon: <FileText size={15} /> },
] as const
type TabKey = (typeof TABS)[number]['key']

export function AdminRealClients() {
  const [items, setItems] = useState<Org[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('access')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/admin/orgs', { credentials: 'same-origin', cache: 'no-store' })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Chargement impossible')
      setItems(b)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((o) => (sector === 'all' || o.sector === sector) && (!q || `${o.name} ${o.slug} ${o.users.map((u) => u.email).join(' ')}`.toLowerCase().includes(q)))
  }, [items, query, sector])

  const selected = items.find((o) => o.id === selectedId) ?? filtered[0] ?? null
  const sectors = [...new Set(items.map((o) => o.sector))]
  const activeCount = items.filter((o) => o.active).length
  const usersCount = items.reduce((s, o) => s + o.users.length, 0)
  const saasCount = items.filter((o) => o.saas?.subscriptionActive).length

  return (
    <div>
      <PageHeader
        eyebrow="Administration · comptes réels"
        title="Clients & accès"
        description="Chaque entreprise est isolée. Activez le compte global ou chaque module séparément."
        actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat icon={<Building2 size={17} />} tone="bg-indigo-50 text-indigo-600" label="Entreprises" value={items.length} />
        <MiniStat icon={<CheckCircle2 size={17} />} tone="bg-emerald-50 text-emerald-600" label="Comptes actifs" value={activeCount} />
        <MiniStat icon={<UsersRound size={17} />} tone="bg-sky-50 text-sky-600" label="Utilisateurs liés" value={usersCount} />
        <MiniStat icon={<ShieldCheck size={17} />} tone="bg-amber-50 text-amber-600" label="Abonnements SaaS" value={saasCount} />
      </div>

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Liste */}
        <div className="an-panel h-fit overflow-hidden xl:sticky xl:top-[96px]">
          <div className="space-y-3 border-b border-ink-100 p-4">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50">
              <Search size={15} className="text-ink-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une entreprise…" className="h-full flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div className="an-seg w-full">
              <button type="button" className={cn('flex-1', sector === 'all' && 'is-on')} onClick={() => setSector('all')}>Tous</button>
              {sectors.map((s) => (
                <button key={s} type="button" className={cn('flex-1', sector === s && 'is-on')} onClick={() => setSector(s)}>{SECTOR[s]?.label ?? s}</button>
              ))}
            </div>
          </div>
          <ul className="max-h-[60vh] divide-y divide-ink-100 overflow-y-auto">
            {loading && !items.length ? [0, 1, 2].map((i) => <li key={i} className="flex gap-3 p-4"><span className="an-skeleton h-10 w-10" /><span className="flex-1 space-y-2"><span className="an-skeleton block h-3 w-2/3" /><span className="an-skeleton block h-3 w-1/3" /></span></li>) : null}
            {filtered.map((org) => (
              <li key={org.id}>
                <button type="button" onClick={() => setSelectedId(org.id)} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left transition', selected?.id === org.id ? 'bg-indigo-50/70' : 'hover:bg-ink-50')}>
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold', SECTOR[org.sector]?.cls ?? 'bg-ink-100 text-ink-700')}>{org.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-950">{org.name}</span>
                    <span className="block truncate text-xs text-ink-500">{SECTOR[org.sector]?.label ?? org.sector} · {org.users.length} utilisateur{org.users.length > 1 ? 's' : ''}</span>
                  </span>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', org.active ? 'bg-emerald-500' : 'bg-red-400')} title={org.active ? 'Actif' : 'Désactivé'} />
                </button>
              </li>
            ))}
            {!loading && !filtered.length ? <li className="p-8 text-center text-sm text-ink-500">Aucune entreprise ne correspond.</li> : null}
          </ul>
        </div>

        {/* Détail */}
        {selected ? (
          <div className="an-panel min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 p-5">
              <div className="flex min-w-0 items-center gap-4">
                <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-extrabold', SECTOR[selected.sector]?.cls ?? 'bg-ink-100 text-ink-700')}>{selected.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold tracking-tight text-ink-950">{selected.name}</h2>
                  <p className="mt-0.5 text-sm text-ink-500">{SECTOR[selected.sector]?.label ?? selected.sector} · /{selected.slug}{selected.plan ? ` · Plan ${selected.plan}` : ''}</p>
                </div>
              </div>
              <Badge tone={selected.active ? 'success' : 'danger'}>{selected.active ? 'Compte actif' : 'Compte désactivé'}</Badge>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-ink-100 px-3">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition', tab === t.key ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-ink-500 hover:text-ink-900')}>
                  {t.icon}{t.label}
                  {t.key === 'users' ? <span className="rounded-md bg-ink-100 px-1.5 text-[0.68rem] text-ink-600">{selected.users.length}</span> : null}
                </button>
              ))}
            </div>
            <div className="p-5" key={`${selected.id}-${tab}`}>
              {tab === 'access' ? <AdminClientAccess orgId={selected.id} /> : null}
              {tab === 'data' ? <AdminClientDataControl orgId={selected.id} onDeleted={() => { setSelectedId(null); void load() }} /> : null}
              {tab === 'docs' ? <AdminClientDocuments orgId={selected.id} /> : null}
              {tab === 'users' ? (
                selected.users.length ? (
                  <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                    {selected.users.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                        <Avatar name={u.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-950">{u.name}</p>
                          <p className="truncate text-xs text-ink-500">{u.email} · {u.role}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Badge tone={u.active === false ? 'danger' : 'success'}>{u.active === false ? 'Désactivé' : 'Actif'}</Badge>
                          <Badge tone={u.passwordConfigured ? 'success' : 'warning'}>{u.passwordConfigured ? 'Mot de passe créé' : 'Activation en attente'}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-ink-200 p-10 text-center">
                    <UsersRound className="mx-auto text-ink-300" />
                    <p className="mt-3 font-semibold text-ink-900">Aucun utilisateur lié</p>
                    <p className="mt-1 text-sm text-ink-500">Les utilisateurs apparaissent ici après l’approbation de l’inscription.</p>
                  </div>
                )
              ) : null}
            </div>
          </div>
        ) : !loading ? (
          <div className="an-panel grid place-items-center p-14 text-center">
            <div>
              <Building2 className="mx-auto text-ink-300" size={32} />
              <p className="mt-3 font-semibold text-ink-900">Aucune entreprise réelle enregistrée</p>
              <p className="mt-1 text-sm text-ink-500">Les entreprises apparaissent après approbation d’une inscription.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MiniStat({ icon, tone, label, value }: { icon: React.ReactNode; tone: string; label: string; value: number }) {
  return (
    <div className="an-panel flex items-center gap-3 p-4">
      <span className={cn('grid h-10 w-10 place-items-center rounded-xl', tone)}>{icon}</span>
      <div>
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="font-display text-xl font-extrabold tabular-nums text-ink-950">{value}</p>
      </div>
    </div>
  )
}

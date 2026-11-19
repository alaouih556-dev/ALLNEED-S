import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, CheckCircle2, Clock3, Inbox, Mail, Phone, RefreshCcw, UserPlus, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Select, type Tone } from '@/components/ui'
import { EmptyBox, HowItWorks, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, Segmented, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { isSectorActive } from '@/lib/active-sectors'
import { cn } from '@/lib/utils'

type Concierge = { id: string; name: string; email: string; active?: boolean; sectors?: string[]; orgIds?: string[] }
type Registration = {
  id: string
  orgName: string
  name: string
  email: string
  phone: string
  sector: string
  city: string
  appointmentDate: string
  appointmentSlot: string
  appointmentStatus?: string
  status: string
  conciergeId?: string | null
  concierge?: Concierge | null
  createdAt: string
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  demande_recue: { label: 'Nouvelle demande', tone: 'warning' },
  en_attente_affectation: { label: 'À affecter', tone: 'warning' },
  concierge_affecte: { label: 'Concierge affecté', tone: 'info' },
  en_attente_activation: { label: 'Activation en attente', tone: 'info' },
  actif: { label: 'Compte actif', tone: 'success' },
  refusee: { label: 'Refusée', tone: 'danger' },
}
const statusMeta = (status: string) => STATUS[status] || { label: status.replaceAll('_', ' '), tone: 'neutral' as Tone }

const isNew = (r: Registration) => ['demande_recue', 'en_attente_affectation'].includes(r.status) || (!r.conciergeId && r.status !== 'actif' && r.status !== 'refusee')
const isWaiting = (r: Registration) => !isNew(r) && ['concierge_affecte', 'en_attente_activation'].includes(r.status)

type View = 'a_traiter' | 'activation' | 'actifs' | 'toutes'

export const Route = createFileRoute('/admin/inscriptions')({ component: AdminRegistrations, head: () => ({ meta: [{ title: 'Inscriptions — ALLNEEDS' }] }) })

function AdminRegistrations() {
  const [items, setItems] = useState<Registration[]>([])
  const [concierges, setConcierges] = useState<Concierge[]>([])
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('a_traiter')

  async function load() {
    setError('')
    try {
      const [registrationsRes, conciergesRes] = await Promise.all([
        fetch('/api/admin/registrations', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/admin/concierges', { credentials: 'same-origin', cache: 'no-store' }),
      ])
      const registrationsBody = await registrationsRes.json()
      if (!registrationsRes.ok) throw new Error(registrationsBody.error || 'Chargement impossible')
      const conciergesBody = await conciergesRes.json()
      setItems((registrationsBody as Registration[]).filter((item) => !item.sector || isSectorActive(item.sector)))
      if (conciergesRes.ok) setConcierges((conciergesBody.concierges || []).filter((c: Concierge) => c.active !== false))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function assign(id: string) {
    const conciergeId = selection[id] || items.find((i) => i.id === id)?.conciergeId || ''
    if (!conciergeId) { setError('Choisissez un concierge avant d’affecter.'); return }
    setBusy(id); setError(''); setInfo('')
    try {
      const r = await fetch(`/api/admin/registrations/${id}/assign`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conciergeId }) })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Affectation impossible')
      if (b.delivery && !b.delivery.sent) setInfo('Concierge affecté, mais l’e-mail d’activation n’a pas pu partir. Utilisez « Renvoyer le lien ».')
      else if (b.registration?.status === 'actif') setInfo('Concierge affecté. Le compte était déjà actif.')
      else setInfo('C’est fait : concierge affecté et lien d’activation envoyé au dirigeant.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Affectation impossible')
      await load()
    } finally {
      setBusy('')
    }
  }

  async function resend(id: string) {
    setBusy(id); setError(''); setInfo('')
    try {
      const r = await fetch(`/api/admin/registrations/${id}/resend`, { method: 'POST', credentials: 'same-origin' })
      const b = await r.json()
      if (!r.ok || !b.delivery?.sent) throw new Error(b.error || b.delivery?.error || 'Renvoi impossible')
      setInfo('Lien de création du mot de passe renvoyé par e-mail.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Renvoi impossible')
    } finally {
      setBusy('')
    }
  }

  const counts = {
    a_traiter: items.filter(isNew).length,
    activation: items.filter(isWaiting).length,
    actifs: items.filter((r) => r.status === 'actif').length,
    toutes: items.length,
  }

  const visible = useMemo(
    () =>
      items
        .filter((r) => (view === 'a_traiter' ? isNew(r) : view === 'activation' ? isWaiting(r) : view === 'actifs' ? r.status === 'actif' : true))
        .filter((r) => matches(query, r.orgName, r.name, r.email, r.city, r.phone))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items, view, query],
  )

  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="Inscriptions"
        description="Chaque nouvelle demande reçoit un concierge. Le dirigeant reçoit alors un lien pour activer son compte."
        actions={<Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>}
      />

      <HowItWorks steps={['Une demande arrive', 'Vous choisissez un concierge', 'Le dirigeant active son compte']} />

      <StatGrid>
        <MiniStat icon={<Inbox size={18} />} tone="amber" label="À traiter" value={counts.a_traiter} hint="Sans concierge" active={view === 'a_traiter'} onClick={() => setView('a_traiter')} />
        <MiniStat icon={<Clock3 size={18} />} tone="sky" label="Activation en attente" value={counts.activation} hint="Lien envoyé au dirigeant" active={view === 'activation'} onClick={() => setView('activation')} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Comptes actifs" value={counts.actifs} active={view === 'actifs'} onClick={() => setView('actifs')} />
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Total reçu" value={counts.toutes} active={view === 'toutes'} onClick={() => setView('toutes')} />
      </StatGrid>

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {info ? <Alert tone="success" className="mb-4">{info}</Alert> : null}
      {!loading && !concierges.length ? <Alert tone="warning" className="mb-4">Aucun concierge actif : créez-en un dans « Concierges » pour pouvoir affecter les demandes.</Alert> : null}

      <Panel>
        <Toolbar>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'a_traiter', label: 'À traiter', count: counts.a_traiter },
              { value: 'activation', label: 'En activation', count: counts.activation },
              { value: 'actifs', label: 'Actifs', count: counts.actifs },
              { value: 'toutes', label: 'Toutes', count: counts.toutes },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Nom, e-mail, ville…" />
        </Toolbar>

        {loading ? <LoadingRows /> : null}
        {!loading && !visible.length ? (
          <EmptyBox icon={<Inbox size={20} />} title={view === 'a_traiter' ? 'Rien à traiter' : 'Aucune inscription ici'} text={view === 'a_traiter' ? 'Toutes les demandes ont un concierge. Les nouvelles demandes apparaîtront ici.' : 'Essayez un autre filtre ou une autre recherche.'} />
        ) : null}

        <Rows>
          {visible.map((item) => {
            const meta = statusMeta(item.status)
            const current = selection[item.id] ?? item.conciergeId ?? ''
            const canResend = item.status === 'en_attente_activation' || item.status === 'concierge_affecte'
            return (
              <li key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 gap-3">
                  <Initial name={item.orgName || item.name} tone={item.status === 'actif' ? 'emerald' : isNew(item) ? 'amber' : 'sky'} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink-950">{item.orgName || 'Entreprise'}</p>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-600">{item.name}{item.city ? ` · ${item.city}` : ''}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1 hover:text-indigo-700"><Mail size={12} />{item.email}</a>
                      {item.phone ? <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 hover:text-indigo-700"><Phone size={12} />{item.phone}</a> : null}
                      {item.appointmentDate ? <span className="inline-flex items-center gap-1"><CalendarClock size={12} />{new Date(item.appointmentDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} {item.appointmentSlot}{item.appointmentStatus === 'valide' ? ' · confirmé' : ' · à confirmer'}</span> : null}
                      {item.concierge ? <span className="inline-flex items-center gap-1 font-medium text-ink-700"><UsersRound size={12} />{item.concierge.name}</span> : null}
                    </div>
                  </div>
                </div>

                {item.status === 'actif' ? (
                  <span className="inline-flex items-center gap-1.5 justify-self-start rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 lg:justify-self-end"><CheckCircle2 size={15} />Compte actif</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Select aria-label={`Concierge pour ${item.orgName}`} className="w-full sm:w-52" value={current} onChange={(e) => setSelection((prev) => ({ ...prev, [item.id]: e.target.value }))}>
                      <option value="">Choisir un concierge…</option>
                      {concierges.map((concierge) => <option key={concierge.id} value={concierge.id}>{concierge.name}</option>)}
                    </Select>
                    <Button size="sm" disabled={busy === item.id || !current || current === item.conciergeId} onClick={() => void assign(item.id)}>
                      <UserPlus size={14} />{busy === item.id ? 'Envoi…' : item.conciergeId ? 'Réaffecter' : 'Affecter'}
                    </Button>
                    {canResend ? <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void resend(item.id)}><Mail size={14} />Renvoyer le lien</Button> : null}
                  </div>
                )}
              </li>
            )
          })}
        </Rows>
      </Panel>
    </>
  )
}

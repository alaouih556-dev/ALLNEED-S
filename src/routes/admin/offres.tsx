import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Banknote, CheckCircle2, Clock3, Package, RefreshCcw, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Select } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, Segmented, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { useApiResource } from '@/lib/useApiResource'
import { apiRequest, patchAdminOffer, formatOfferPrice, type OfferCatalogItem, type OfferRecord, type OfferStatus } from '@/lib/accompagnement'
import { longDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/offres')({
  component: AdminOffers,
  head: () => ({ meta: [{ title: 'Offres d’accompagnement — ALLNEEDS' }] }),
})

type ToneName = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
const OFFER_STATUS_META: Record<OfferStatus, { label: string; tone: ToneName }> = {
  disponible: { label: 'Disponible', tone: 'neutral' },
  selectionnee: { label: 'Sélectionnée', tone: 'info' },
  en_attente_validation: { label: 'En attente', tone: 'warning' },
  acceptee: { label: 'Acceptée', tone: 'success' },
  annulee: { label: 'Annulée', tone: 'danger' },
  refusee: { label: 'Refusée', tone: 'danger' },
  actif: { label: 'Active', tone: 'success' },
  expire: { label: 'Expirée', tone: 'neutral' },
  suspendu: { label: 'Suspendue', tone: 'warning' },
  refuse: { label: 'Refusée', tone: 'danger' },
  draft: { label: 'Brouillon', tone: 'neutral' },
}
/** Statuts proposés dans le menu (les doublons historiques restent affichables). */
const EDITABLE: OfferStatus[] = ['en_attente_validation', 'acceptee', 'actif', 'suspendu', 'refusee', 'annulee', 'expire']

const isActive = (o: OfferRecord) => o.status === 'actif' || o.status === 'acceptee'
const isPending = (o: OfferRecord) => o.status === 'en_attente_validation'
const isRefused = (o: OfferRecord) => o.status === 'refuse' || o.status === 'refusee' || o.status === 'annulee'

type View = 'en_attente' | 'actives' | 'refusees' | 'toutes'

function AdminOffers() {
  const { data, loading, error, refresh } = useApiResource<{ offers: OfferRecord[]; catalog: OfferCatalogItem[] }>('/api/admin/offers')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [view, setView] = useState<View>('en_attente')
  const [query, setQuery] = useState('')

  const offers = data?.offers ?? []
  const catalog = data?.catalog ?? []
  const revenue = offers.filter(isActive).reduce((s, o) => s + (Number(o.price) || 0), 0)

  const counts = { en_attente: offers.filter(isPending).length, actives: offers.filter(isActive).length, refusees: offers.filter(isRefused).length, toutes: offers.length }
  const visible = useMemo(
    () =>
      offers
        .filter((o) => (view === 'en_attente' ? isPending(o) : view === 'actives' ? isActive(o) : view === 'refusees' ? isRefused(o) : true))
        .filter((o) => matches(query, o.orgName, o.offerName, o.acceptedByName)),
    [offers, view, query],
  )

  /** Décision officielle (crée les missions, trace la décision) pour une offre en attente. */
  async function decide(offer: OfferRecord, decision: 'approve' | 'refuse') {
    setBusy(offer.id)
    setActionError('')
    try {
      await apiRequest(`/api/staff/requests/offer/${encodeURIComponent(offer.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Décision impossible.')
    } finally {
      setBusy(null)
    }
  }

  async function changeStatus(offer: OfferRecord, status: OfferStatus) {
    setBusy(offer.id)
    setActionError('')
    try {
      await patchAdminOffer(offer.id, { status })
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Mise à jour impossible.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Offres d’accompagnement"
        description="Validez les offres demandées par les clients et suivez celles en cours."
        actions={<Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>}
      />

      <StatGrid>
        <MiniStat icon={<Clock3 size={18} />} tone="amber" label="À valider" value={counts.en_attente} active={view === 'en_attente'} onClick={() => setView('en_attente')} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Actives" value={counts.actives} active={view === 'actives'} onClick={() => setView('actives')} />
        <MiniStat icon={<XCircle size={18} />} tone="slate" label="Refusées / annulées" value={counts.refusees} active={view === 'refusees'} onClick={() => setView('refusees')} />
        <MiniStat icon={<Banknote size={18} />} tone="indigo" label="Montant des offres actives" value={formatOfferPrice(revenue)} />
      </StatGrid>

      {error ? <Alert tone="danger" title="Offres indisponibles" className="mb-4">{error}</Alert> : null}
      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      <Panel className="mb-6">
        <Toolbar>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'en_attente', label: 'À valider', count: counts.en_attente },
              { value: 'actives', label: 'Actives', count: counts.actives },
              { value: 'refusees', label: 'Refusées', count: counts.refusees },
              { value: 'toutes', label: 'Toutes', count: counts.toutes },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Entreprise ou offre…" />
        </Toolbar>

        {loading ? <LoadingRows /> : null}
        {!loading && !visible.length ? (
          <EmptyBox icon={<Package size={20} />} title={view === 'en_attente' ? 'Aucune offre à valider' : 'Aucune offre dans cette vue'} text={view === 'en_attente' ? 'Quand un client choisit une offre après son diagnostic, elle apparaît ici.' : undefined} />
        ) : null}

        <Rows>
          {visible.map((offer) => {
            const meta = OFFER_STATUS_META[offer.status] ?? { label: offer.status, tone: 'neutral' as ToneName }
            const pending = isPending(offer)
            return (
              <li key={offer.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex min-w-0 gap-3">
                  <Initial name={offer.orgName || 'E'} tone={pending ? 'amber' : isActive(offer) ? 'emerald' : 'slate'} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink-950">{offer.orgName || offer.orgId.slice(0, 8)}</p>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-600">
                      Offre <b className="text-ink-900">{offer.offerName}</b> · {formatOfferPrice(offer.price)}
                      {offer.acceptedAt ? <span className="text-ink-400"> · acceptée le {longDate(offer.acceptedAt)}{offer.acceptedByName ? ` par ${offer.acceptedByName}` : ''}</span> : null}
                    </p>
                  </div>
                </div>
                {pending ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === offer.id} onClick={() => void decide(offer, 'approve')}><CheckCircle2 size={14} />Accepter</Button>
                    <Button size="sm" variant="outline" disabled={busy === offer.id} onClick={() => void decide(offer, 'refuse')}>Refuser</Button>
                  </div>
                ) : (
                  <Select aria-label="Changer le statut" value={offer.status} disabled={busy === offer.id} onChange={(e) => void changeStatus(offer, e.target.value as OfferStatus)} className="w-full md:w-44">
                    {[...new Set([offer.status, ...EDITABLE])].map((value) => <option key={value} value={value}>{OFFER_STATUS_META[value]?.label ?? value}</option>)}
                  </Select>
                )}
              </li>
            )
          })}
        </Rows>
      </Panel>

      {catalog.length ? (
        <Panel title="Catalogue" description="Les trois offres proposées aux clients après le diagnostic.">
          <div className="grid gap-4 p-5 md:grid-cols-3">
            {catalog.map((item) => (
              <div key={item.code} className={cn('rounded-2xl border p-5', item.code === 'PRO' ? 'border-indigo-200 bg-indigo-50/40' : 'border-ink-100')}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-extrabold tracking-tight text-ink-950">{item.name}</p>
                  <p className="font-display text-lg font-extrabold text-indigo-700">{formatOfferPrice(item.price)}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-600">{item.summary}</p>
                <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                  {item.missions.map((mission) => (
                    <li key={mission.key} className="flex items-start gap-2 text-xs text-ink-700">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />{mission.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  )
}

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeftRight, Boxes } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import {
  Alert, Badge, Card, CardHeader, Select, Stat,
  Tabs, TableWrap, Th, Td, Tr,
} from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import {
  patchAdminOffer,
  formatOfferPrice,
  type OfferCatalogItem,
  type OfferRecord,
  type OfferStatus,
} from '@/lib/accompagnement'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/admin/offres')({
  component: AdminOffers,
  head: () => ({
    meta: [{ title: 'Offres d’accompagnement — ALLNEEDS' }],
  }),
})

const OFFER_STATUS_META: Record<
  OfferStatus,
  {
    label: string
    tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
  }
> = {
  disponible: { label: 'Disponible', tone: 'neutral' },
  selectionnee: { label: 'Sélectionnée', tone: 'info' },
  en_attente_validation: { label: 'En attente de validation', tone: 'warning' },
  acceptee: { label: 'Acceptée', tone: 'success' },
  annulee: { label: 'Annulée', tone: 'danger' },
  refusee: { label: 'Refusée', tone: 'danger' },
  actif: { label: 'Active', tone: 'success' },
  expire: { label: 'Expirée', tone: 'neutral' },
  suspendu: { label: 'Suspendue', tone: 'warning' },
  refuse: { label: 'Refusée', tone: 'danger' },
  draft: { label: 'Brouillon', tone: 'neutral' },
}

function AdminOffers() {
  const { data, loading, error, refresh } = useApiResource<{
    offers: OfferRecord[]
    catalog: OfferCatalogItem[]
  }>('/api/admin/offers')

  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const offers = data?.offers ?? []
  const catalog = data?.catalog ?? []
  const accepted = offers.filter(
    (o) => o.status === 'acceptee' || o.status === 'actif'
  )

  async function changeStatus(offer: OfferRecord, status: OfferStatus) {
    setBusy(offer.id)
    setActionError('')
    try {
      await patchAdminOffer(offer.id, { status })
      await refresh()
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Mise à jour impossible.'
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Accompagnement"
        title="Offres d’accompagnement"
        description="Catalogue officiel et historique des offres par entreprise."
      />

      {loading ? (
        <p className="text-sm text-ink-500">Chargement des offres…</p>
      ) : null}

      {error ? (
        <Alert tone="danger" title="Offres indisponibles">{error}</Alert>
      ) : null}

      {actionError ? (
        <Alert tone="danger" className="mb-4">{actionError}</Alert>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Offres actives / acceptées"
              value={accepted.length}
              hint="Entreprises accompagnées"
              tone="success"
              icon={<Boxes size={16} />}
            />
            {catalog.map((item) => (
              <Stat
                key={item.code}
                label={item.name}
                value={formatOfferPrice(item.price)}
                hint={`${item.missions.length} missions`}
                tone="brand"
              />
            ))}
          </div>

          <CatalogCard catalog={catalog} />

          <OffersTable
            offers={offers}
            busy={busy}
            onChange={changeStatus}
          />
        </>
      ) : null}
    </>
  )
}

function CatalogCard({ catalog }: { catalog: OfferCatalogItem[] }) {
  if (!catalog.length) return null

  return (
    <Card className="mb-5">
      <CardHeader
        title="Catalogue officiel"
        description="Source de vérité backend. Les contenus « à valider » seront précisés."
      />
      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {catalog.map((item) => (
          <div
            key={item.code}
            className="rounded-xl border border-ink-100 p-4"
          >
            <div className="flex items-center justify-between">
              <Badge tone={item.code === 'PERFORMANCE' ? 'brand' : 'neutral'}>
                {item.name}
              </Badge>
              <strong className="text-ink-950">
                {formatOfferPrice(item.price)}
              </strong>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              {item.summary}
            </p>

            <ul className="mt-3 space-y-1.5">
              {item.missions.map((mission) => (
                <li key={mission.key} className="text-xs text-ink-600">
                  — {mission.title}
                  {mission.contentStatus === 'a_valider' ? (
                    <em className="ml-1 not-italic text-amber-700">
                      · à valider
                    </em>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

function OffersTable({
  offers,
  busy,
  onChange,
}: {
  offers: OfferRecord[]
  busy: string | null
  onChange: (offer: OfferRecord, status: OfferStatus) => void
}) {
  const [filter, setFilter] = useState('toutes')

  const visible = offers.filter((o) => {
    if (filter === 'toutes') return true
    if (filter === 'actives') {
      return o.status === 'actif' || o.status === 'acceptee'
    }
    if (filter === 'refusees') {
      return o.status === 'refuse' || o.status === 'refusee'
    }
    return o.status === filter
  })

  return (
    <Card>
      <CardHeader
        title="Historique des offres"
        description="Toutes les décisions sont conservées."
      />

      <div className="px-5 pt-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            {
              value: 'toutes',
              label: 'Toutes',
              count: offers.length,
            },
            {
              value: 'actives',
              label: 'Actives',
              count: offers.filter(
                (o) => o.status === 'actif' || o.status === 'acceptee'
              ).length,
            },
            {
              value: 'en_attente_validation',
              label: 'En attente',
              count: offers.filter(
                (o) => o.status === 'en_attente_validation'
              ).length,
            },
            {
              value: 'refusees',
              label: 'Refusées',
              count: offers.filter(
                (o) => o.status === 'refuse' || o.status === 'refusee'
              ).length,
            },
          ]}
        />
      </div>

      <div className="p-1">
        {visible.length === 0 ? (
          <p className="p-5 text-sm text-ink-500">
            Aucune offre dans cette vue.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Entreprise</Th>
                <Th>Offre</Th>
                <Th>Montant</Th>
                <Th>Statut</Th>
                <Th>Acceptée le</Th>
                <Th>Par</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((offer) => {
                const meta = OFFER_STATUS_META[offer.status]
                return (
                  <Tr key={offer.id}>
                    <Td>
                      <span className="font-medium text-ink-950">
                        {offer.orgName || offer.orgId.slice(0, 8)}
                      </span>
                    </Td>
                    <Td>{offer.offerName}</Td>
                    <Td>{formatOfferPrice(offer.price)}</Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                    <Td>
                      {offer.acceptedAt ? longDate(offer.acceptedAt) : '—'}
                    </Td>
                    <Td>{offer.acceptedByName || '—'}</Td>
                    <Td>
                      <Select
                        value={offer.status}
                        disabled={busy === offer.id}
                        onChange={(e) =>
                          onChange(offer, e.target.value as OfferStatus)
                        }
                        className="w-40"
                      >
                        {(Object.keys(OFFER_STATUS_META) as OfferStatus[]).map(
                          (value) => (
                            <option key={value} value={value}>
                              {OFFER_STATUS_META[value].label}
                            </option>
                          )
                        )}
                      </Select>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </TableWrap>
        )}
      </div>

      <p className="flex items-center gap-1.5 px-5 pb-5 text-xs text-ink-400">
        <ArrowLeftRight size={12} />
        L’historique des offres est conservé.
      </p>
    </Card>
  )
}

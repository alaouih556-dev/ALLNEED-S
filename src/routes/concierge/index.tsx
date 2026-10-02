import { Link, createFileRoute } from '@tanstack/react-router'
import { Building2, LockKeyhole, PlusCircle, ShieldCheck, UsersRound } from 'lucide-react'
import { Badge, Button, Card, SectionHeading } from '@/components/ui'
import { SECTOR_LABEL } from '@/data/catalog'
import { useDemo } from '@/store/store'

export const Route = createFileRoute('/concierge/' as any)({ component: ConciergeDashboard })

function ConciergeDashboard() {
  const { state } = useDemo()
  const concierge = state.concierges[0]
  const allowedIds = new Set([...(concierge?.assignedOrgIds ?? []), ...(concierge?.createdOrgIds ?? [])])
  const orgs = state.orgs.filter((org) => allowedIds.has(org.id) && (concierge?.sectors.includes(org.sector) ?? false))

  return (
    <div className="container-app py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="Espace concierge" title="Votre portefeuille autorisé" description="Vous voyez uniquement les entreprises et secteurs que l’administrateur vous a attribués, ainsi que les entreprises que vous avez vous-même apportées." />
        <Link to={"/concierge/entreprises" as any}><Button><PlusCircle className="h-4 w-4" /> Ajouter une entreprise</Button></Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-5"><UsersRound className="h-5 w-5 text-brand-700" /><p className="mt-3 text-3xl font-display text-ink-950">{orgs.length}</p><p className="text-xs text-ink-500">entreprises visibles</p></Card>
        <Card className="p-5"><ShieldCheck className="h-5 w-5 text-brand-700" /><p className="mt-3 text-3xl font-display text-ink-950">{concierge?.sectors.length ?? 0}</p><p className="text-xs text-ink-500">secteur(s) autorisé(s)</p></Card>
        <Card className="p-5"><LockKeyhole className="h-5 w-5 text-brand-700" /><p className="mt-3 text-sm font-semibold text-ink-950">Aucune vue globale</p><p className="mt-1 text-xs text-ink-500">Les autres entreprises ALLNEEDS restent invisibles.</p></Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {orgs.map((org) => (
          <Card key={org.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold text-ink-950">{org.name}</p><p className="mt-1 text-xs text-ink-500">{org.kind} · {org.city}</p></div>
              <Badge tone="brand">{SECTOR_LABEL[org.sector]}</Badge>
            </div>
            <div className="mt-5 grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
              <p><strong>Contact :</strong> {org.contactName}</p><p><strong>Fonction :</strong> {org.contactRole}</p><p><strong>Email :</strong> {org.contactEmail}</p><p><strong>Téléphone :</strong> {org.contactPhone}</p>
            </div>
          </Card>
        ))}
        {orgs.length === 0 ? <Card className="p-8 text-center"><Building2 className="mx-auto h-6 w-6 text-ink-400" /><p className="mt-3 font-semibold text-ink-900">Aucune entreprise attribuée</p><p className="mt-1 text-sm text-ink-500">L’administrateur doit vous donner un secteur et une entreprise.</p></Card> : null}
      </div>
    </div>
  )
}

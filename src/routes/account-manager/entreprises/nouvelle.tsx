import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, PlusCircle } from 'lucide-react'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { PageHeader } from '@/components/layouts'
import { Panel } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import type { Sector } from '@/types'
import { SECTOR_LABEL } from '@/data/catalog'

export const Route = createFileRoute('/account-manager/entreprises/nouvelle')({ component: NewConciergeCompany })

function NewConciergeCompany() {
  const auth = useAuth()
  const navigate = useNavigate()
  const allowedSectors: Sector[] = auth.user?.sectors?.length ? auth.user.sectors : (Object.keys(SECTOR_LABEL) as Sector[])
  const [sector, setSector] = useState<Sector>(allowedSectors[0] ?? 'sante')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allowedSectors.includes(sector)) return
    const data = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account-manager/orgs', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data.entries())) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Création impossible')
      navigate({ to: '/account-manager/entreprises/$id' as any, params: { id: body.id } as any })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création impossible')
    } finally { setBusy(false) }
  }

  return <div><PageHeader eyebrow="Nouvelle relation client" title="Ajouter une entreprise" description="L’entreprise sera créée et automatiquement rattachée à votre portefeuille." actions={<Link to={'/account-manager/entreprises' as any}><Button size="sm" variant="outline"><ArrowLeft size={14}/>Entreprises suivies</Button></Link>}/><Panel className="max-w-4xl" title="Informations de l’entreprise" description="Seuls le nom et le secteur sont obligatoires. Le reste peut être complété plus tard."><form onSubmit={submit} className="grid gap-5 p-5 md:grid-cols-2">{error?<Alert tone="danger" className="md:col-span-2">{error}</Alert>:null}<Field label="Nom de l’entreprise" required><Input name="name" required/></Field><Field label="Secteur autorisé" required><Select name="sector" value={sector} onChange={(event) => setSector(event.target.value as Sector)}>{allowedSectors.map((value) => <option key={value} value={value}>{SECTOR_LABEL[value]}</option>)}</Select></Field><Field label="Type de structure"><Input name="kind" placeholder="Cabinet, centre, laboratoire…"/></Field><Field label="Ville"><Input name="city"/></Field><Field label="Taille / activité"><Input name="size" placeholder="Effectif, capacité…"/></Field><Field label="Nom du contact dirigeant"><Input name="contactName"/></Field><Field label="Fonction"><Input name="contactRole" placeholder="Dirigeant, directrice…"/></Field><Field label="E-mail professionnel"><Input name="contactEmail" type="email"/></Field><Field label="Téléphone"><Input name="contactPhone" type="tel"/></Field><div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={busy || !allowedSectors.length}><PlusCircle size={16}/> {busy?'Création…':'Créer l’entreprise'}</Button></div></form></Panel></div>
}

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Mail, RefreshCcw, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, CardBody, CardHeader, Select, type Tone } from '@/components/ui'

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
  demande_recue: { label: 'Demande reçue', tone: 'warning' },
  en_attente_affectation: { label: 'En attente d’affectation', tone: 'warning' },
  concierge_affecte: { label: 'Concierge affecté', tone: 'info' },
  en_attente_activation: { label: 'En attente d’activation', tone: 'warning' },
  actif: { label: 'Actif', tone: 'success' },
  refusee: { label: 'Refusée', tone: 'danger' },
}
const APPOINTMENT: Record<string, string> = { demande: 'Demandé', valide: 'Validé' }
const statusMeta = (status: string) => STATUS[status] || { label: status.replaceAll('_', ' '), tone: 'neutral' as Tone }

export const Route = createFileRoute('/admin/inscriptions')({ component: AdminRegistrations })

function AdminRegistrations() {
  const [items, setItems] = useState<Registration[]>([])
  const [concierges, setConcierges] = useState<Concierge[]>([])
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState('')

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
      setItems(registrationsBody)
      if (conciergesRes.ok) setConcierges((conciergesBody.concierges || []).filter((c: Concierge) => c.active !== false))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    }
  }

  useEffect(() => { void load() }, [])

  async function assign(id: string) {
    const conciergeId = selection[id] || ''
    if (!conciergeId) { setError('Sélectionnez un concierge avant d’affecter.'); return }
    setBusy(id); setError(''); setInfo('')
    try {
      const r = await fetch(`/api/admin/registrations/${id}/assign`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conciergeId }) })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Affectation impossible')
      if (b.delivery && !b.delivery.sent) {
        setInfo('Concierge affecté. Attention : l’e-mail d’activation n’a pas pu être envoyé. Utilisez « Renvoyer le lien ».')
      } else if (b.registration?.status === 'actif') {
        setInfo('Concierge affecté. Le compte était déjà actif.')
      } else {
        setInfo('Concierge affecté et lien d’activation envoyé au dirigeant.')
      }
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

  return (
    <>
      <PageHeader
        eyebrow="Accès"
        title="Inscriptions & affectations"
        description="Affectez un concierge à chaque demande, puis suivez l’activation du compte par le dirigeant."
        actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCcw size={15} />Actualiser</Button>}
      />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      {info ? <Alert tone="success" className="mb-5">{info}</Alert> : null}
      <Card>
        <CardHeader
          title="Demandes reçues"
          description="Affecter un concierge crée l’entreprise, le lien d’activation du dirigeant et notifie le concierge."
        />
        <div className="divide-y divide-ink-100">
          {items.map((item) => {
            const meta = statusMeta(item.status)
            const isActive = item.status === 'actif'
            const current = selection[item.id] ?? item.conciergeId ?? ''
            return (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-[16rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-ink-950">{item.orgName}</strong>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {item.appointmentStatus ? <Badge tone={item.appointmentStatus === 'valide' ? 'success' : 'neutral'}>RDV : {APPOINTMENT[item.appointmentStatus] || item.appointmentStatus}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{item.name} · {item.email} · {item.sector} · {item.city}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    Téléphone : {item.phone || '—'} · Rendez-vous : {item.appointmentDate || '—'} {item.appointmentSlot || ''}
                    {item.concierge ? ` · Concierge : ${item.concierge.name}` : ' · Aucun concierge affecté'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} />Compte actif</span>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Select aria-label={`Concierge pour ${item.orgName}`} className="w-52" value={current} onChange={(e) => setSelection((prev) => ({ ...prev, [item.id]: e.target.value }))}>
                        <option value="">Choisir un concierge…</option>
                        {concierges.map((concierge) => (
                          <option key={concierge.id} value={concierge.id}>{concierge.name}{concierge.sectors?.length ? ` · ${concierge.sectors.join(', ')}` : ''}</option>
                        ))}
                      </Select>
                      <Button size="sm" disabled={busy === item.id || !current} onClick={() => void assign(item.id)}>
                        <UserPlus size={15} />{busy === item.id ? 'Affectation…' : item.conciergeId ? 'Réaffecter' : 'Affecter & envoyer le lien'}
                      </Button>
                      {item.status === 'en_attente_activation' || item.status === 'concierge_affecte' ? (
                        <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void resend(item.id)}><Mail size={15} />Renvoyer le lien</Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!items.length ? <CardBody><p className="text-sm text-ink-500">Aucune demande reçue.</p></CardBody> : null}
        </div>
      </Card>
    </>
  )
}

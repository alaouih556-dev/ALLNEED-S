import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { Alert, Badge, Button, Card, Input } from '@/components/ui'
import { apiRequest } from '@/lib/accompagnement'
import { longDate } from '@/lib/format'

type RawValidationRequest = {
  id?: string | number
  requestId?: string | number
  type?: string
  requestType?: string
  kind?: string
  orgName?: string
  organizationName?: string
  companyName?: string
  planName?: string
  offerName?: string
  name?: string
  price?: number | string
  requestedAt?: string
  createdAt?: string
  status?: string
}

export function ValidationRequests() {
  const [requests, setRequests] = useState<RawValidationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const payload = await apiRequest<{ requests?: RawValidationRequest[] }>('/api/staff/requests')
      setRequests(Array.isArray(payload.requests) ? payload.requests : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Demandes indisponibles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function decide(request: RawValidationRequest, decision: 'approve' | 'refuse') {
    const id = String(request.id ?? request.requestId ?? '')
    const type = String(request.type ?? request.requestType ?? request.kind ?? '')
    if (!id || !type) {
      setError('Cette demande ne contient pas les identifiants nécessaires à son traitement.')
      return
    }
    const key = `${type}:${id}`
    setBusy(key)
    setError('')
    try {
      await apiRequest(`/api/staff/requests/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, ...(decision === 'refuse' && reasons[key]?.trim() ? { reason: reasons[key].trim() } : {}) }),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Décision non enregistrée.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="mt-6" aria-labelledby="validation-requests-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-brand-700">Activation contrôlée</p><h2 id="validation-requests-title" className="mt-1 text-xl font-bold text-ink-950">Demandes à valider</h2><p className="mt-1 text-xs text-ink-500">Offres, abonnements Besoins et accès SaaS en attente d’une décision explicite.</p></div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>Actualiser</Button>
      </div>
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {loading ? <Card className="p-5 text-sm text-ink-500">Chargement des demandes…</Card> : null}
      {!loading && requests.length === 0 ? <Card className="p-5"><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={20}/><div><p className="font-semibold text-ink-900">Aucune demande en attente</p><p className="text-xs text-ink-500">Les nouvelles demandes apparaîtront ici.</p></div></div></Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {requests.map((request, index) => {
          const id = String(request.id ?? request.requestId ?? index)
          const type = String(request.type ?? request.requestType ?? request.kind ?? 'demande')
          const key = `${type}:${id}`
          const orgName = request.orgName ?? request.organizationName ?? request.companyName ?? 'Entreprise non renseignée'
          const planName = request.planName ?? request.offerName ?? request.name ?? 'Formule non renseignée'
          const numericPrice = Number(request.price)
          const date = request.requestedAt ?? request.createdAt
          return <Card key={key} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink-950">{orgName}</p><p className="mt-1 text-sm text-ink-700">{planName}</p></div><Badge tone="warning">{request.status ? request.status.replaceAll('_', ' ') : 'En attente'}</Badge></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><span className="text-ink-500">Type</span><p className="font-semibold text-ink-800">{type.replaceAll('_', ' ')}</p></div><div><span className="text-ink-500">Prix</span><p className="font-semibold text-ink-800">{Number.isFinite(numericPrice) ? `${numericPrice.toLocaleString('fr-FR')} MAD` : 'Non renseigné'}</p></div><div className="col-span-2 flex items-center gap-1 text-ink-500"><Clock3 size={13}/>{date ? longDate(date) : 'Date non renseignée'}</div></div>
            <Input className="mt-4" value={reasons[key] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))} placeholder="Motif du refus (facultatif)" aria-label={`Motif du refus pour ${orgName}`}/>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => void decide(request, 'approve')} disabled={busy === key}><CheckCircle2 size={14}/>Valider et activer</Button><Button size="sm" variant="danger" onClick={() => void decide(request, 'refuse')} disabled={busy === key}><XCircle size={14}/>Refuser</Button></div>
          </Card>
        })}
      </div>
    </section>
  )
}

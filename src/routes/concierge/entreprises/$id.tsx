import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Building2, CalendarCheck, ClipboardCheck, FileText, FolderOpen, MessageSquare, PhoneCall, Plus, Target } from 'lucide-react'
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui'
import { ConciergeGuard } from '@/features/concierge/ScopedSection'
import { PageHeader } from '@/components/layouts'
import { EmptyBox, LoadingRows, MiniStat, Panel, StatGrid } from '@/components/admin-kit'

const COLLECTION_LABEL: Record<string, string> = { needs: 'Besoins', missions: 'Missions', offers: 'Offres', messages: 'Messages', meetings: 'Rendez-vous', quotes: 'Devis', notifications: 'Notifications', consents: 'Consentements', needsSubscriptions: 'Abonnements Besoins', saasSubscriptions: 'Abonnements SaaS', conversations: 'Conversations', registrations: 'Inscriptions' }
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { createNeedProposal, fetchNeedProposals, patchProposal, transmitProposal, PROPOSAL_STATUS_META, type NeedProposal } from '@/lib/besoins'
import { money } from '@/lib/format'

export const Route = createFileRoute('/concierge/entreprises/$id')({ component: ConciergeCompanyDetail })

type Item = { id: string; title?: string; name?: string; status?: string }
type Registration = {
  id: string
  name: string
  email: string
  phone?: string
  sector: string
  city?: string
  appointmentDate?: string
  appointmentSlot?: string
  appointmentStatus?: string
  status?: string
  callStatus?: string
}
type Payload = {
  org: { id: string; name: string; sector: string; city?: string; contactName?: string; contactRole?: string; contactEmail?: string; contactPhone?: string }
  registration?: Registration | null
  collections: Record<string, Item[]>
}

const STATUS_LABEL: Record<string, string> = {
  demande_recue: 'Demande reçue',
  en_attente_affectation: 'En attente d’affectation',
  concierge_affecte: 'Concierge affecté',
  en_attente_activation: 'En attente d’activation',
  actif: 'Compte actif',
}

function ConciergeCompanyDetail() {
  const { id } = Route.useParams()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/concierge/orgs/${encodeURIComponent(id)}/data`, { credentials: 'same-origin', cache: 'no-store' })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Chargement impossible')
      setData(b)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function act(action: 'call' | 'validate-slot') {
    setBusy(action); setError(''); setInfo('')
    try {
      const r = await fetch(`/api/concierge/registrations/${encodeURIComponent(id)}/${action}`, { method: 'POST', credentials: 'same-origin' })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Action impossible')
      setInfo(action === 'call' ? 'Appel enregistré.' : 'Créneau validé et client notifié.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setBusy('')
    }
  }

  const registration = data?.registration || null
  const diagnostic = data?.collections.diagnostics?.[0]

  return (
    <ConciergeGuard>
      <div>
        {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
        {info ? <Alert tone="success" className="mb-4">{info}</Alert> : null}
        {!data && !error ? <Panel><LoadingRows /></Panel> : null}

        {data ? (
          <>
            <PageHeader
              eyebrow="Fiche entreprise"
              title={data.org.name}
              description={`${data.org.sector === 'sante' ? 'Santé' : data.org.sector} · ${data.org.city || 'Ville non renseignée'} · ${data.org.contactName || registration?.name || 'Contact non renseigné'}`}
              actions={
                <>
                  <Link to="/concierge/entreprises"><Button size="sm" variant="outline"><ArrowLeft size={14} />Entreprises</Button></Link>
                  {diagnostic ? <Link to="/concierge/diagnostics/$id" params={{ id: diagnostic.id }}><Button size="sm"><ClipboardCheck size={14} />Ouvrir le diagnostic</Button></Link> : null}
                </>
              }
            />

            <div className="cg-tabs mb-6">
              {diagnostic ? <Link to="/concierge/diagnostics/$id" params={{ id: diagnostic.id }} className="cg-filter-chip"><FileText size={14} />Rapport / restitution</Link> : <span className="cg-filter-chip is-muted"><ClipboardCheck size={14} />Diagnostic non envoyé</span>}
              <a href="#documents" className="cg-filter-chip"><FolderOpen size={14} />Documents</a>
              <Link to="/concierge/missions" className="cg-filter-chip">Missions</Link>
              <Link to="/concierge/besoins" className="cg-filter-chip">Besoins</Link>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Card className="p-5"><p className="eyebrow">Informations entreprise</p><dl className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-ink-500">Entreprise</dt><dd className="font-semibold">{data.org.name}</dd></div><div className="flex justify-between gap-4"><dt className="text-ink-500">Secteur</dt><dd className="font-semibold">{data.org.sector === 'sante' ? 'Santé' : data.org.sector}</dd></div><div className="flex justify-between gap-4"><dt className="text-ink-500">Ville</dt><dd className="font-semibold">{data.org.city || 'Non renseignée'}</dd></div></dl></Card>
              <Card className="p-5"><p className="eyebrow">Contact client</p><dl className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-ink-500">Nom</dt><dd className="font-semibold">{data.org.contactName || registration?.name || 'Non renseigné'}</dd></div><div className="flex justify-between gap-4"><dt className="text-ink-500">E-mail</dt><dd className="font-semibold">{data.org.contactEmail || registration?.email || 'Non renseigné'}</dd></div><div className="flex justify-between gap-4"><dt className="text-ink-500">Téléphone</dt><dd className="font-semibold">{data.org.contactPhone || registration?.phone || 'Non renseigné'}</dd></div></dl></Card>
            </div>

            {registration ? (
              <Card className="mb-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-ink-950">Demande d’inscription</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={registration.status === 'actif' ? 'success' : 'warning'}>{STATUS_LABEL[registration.status || ''] || registration.status || '—'}</Badge>
                    <Badge tone={registration.appointmentStatus === 'valide' ? 'success' : 'neutral'}>RDV : {registration.appointmentStatus === 'valide' ? 'validé' : 'demandé'}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Contact</dt><dd className="text-right font-medium text-ink-900">{registration.name}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Téléphone</dt><dd className="text-right font-medium text-ink-900">{registration.phone || '—'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Secteur</dt><dd className="text-right font-medium text-ink-900">{registration.sector === 'sante' ? 'Santé' : registration.sector}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-500">Créneau</dt><dd className="text-right font-medium text-ink-900">{registration.appointmentDate || '—'} {registration.appointmentSlot || ''}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy !== '' || registration.callStatus === 'effectue'} onClick={() => void act('call')}>
                    <PhoneCall size={15} />{registration.callStatus === 'effectue' ? 'Appel effectué' : 'Marquer l’appel effectué'}
                  </Button>
                  <Button size="sm" disabled={busy !== '' || registration.appointmentStatus === 'valide'} onClick={() => void act('validate-slot')}>
                    <CalendarCheck size={15} />{registration.appointmentStatus === 'valide' ? 'Créneau validé' : 'Valider le créneau'}
                  </Button>
                </div>
              </Card>
            ) : null}

            <StatGrid>
              <MiniStat icon={<Target size={18} />} tone="sky" label="Besoins" value={data.collections.needs?.length || 0} />
              <MiniStat icon={<FileText size={18} />} tone="emerald" label="Missions" value={data.collections.missions?.length || 0} />
              <MiniStat icon={<ClipboardCheck size={18} />} tone="amber" label="Offres" value={data.collections.offers?.length || 0} />
              <MiniStat icon={<MessageSquare size={18} />} tone="indigo" label="Messages" value={data.collections.messages?.length || 0} />
            </StatGrid>

            {(() => {
              const sections = (Object.entries(data.collections) as Array<[string, Item[]]>).filter(([key, rows]) => !['documents', 'diagnostics'].includes(key) && rows.length)
              return (
                <Panel title="Activité du dossier" description="Besoins, missions, offres, rendez-vous et échanges de cette entreprise.">
                  {!sections.length ? <EmptyBox icon={<FolderOpen size={20} />} title="Aucune activité pour le moment" text="Les besoins, offres, missions et rendez-vous de cette entreprise apparaîtront ici." /> : null}
                  <div className="grid gap-4 p-4 lg:grid-cols-2">
                    {sections.map(([key, rows]) => (
                      <section key={key} id={key} className="scroll-mt-6 rounded-xl border border-ink-100 p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-ink-950">{COLLECTION_LABEL[key] ?? key}</h3>
                          <Badge>{rows.length}</Badge>
                        </div>
                        <div className="mt-2 divide-y divide-ink-50">
                          {rows.map((row) => (
                            <div key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                              <span className="truncate font-medium text-ink-900">{row.title || row.name || 'Sans titre'}</span>
                              {row.status ? <Badge tone={row.status === 'valide' ? 'success' : 'neutral'}>{row.status}</Badge> : null}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </Panel>
              )
            })()}

            <div className="mt-8">
              <ConciergeProposalsPanel needs={data.collections.needs || []} />
            </div>

            <div id="documents" className="mt-8 scroll-mt-6">
              <DocumentsPanel orgId={id} variant="staff" />
            </div>
          </>
        ) : null}
      </div>
    </ConciergeGuard>
  )
}

const EMPTY_PROPOSAL = { providerName: '', title: '', description: '', deliveryDelay: '', amount: '', recommended: false, negotiated: false }

function ConciergeProposalsPanel({ needs }: { needs: Item[] }) {
  const [needId, setNeedId] = useState('')
  const [proposals, setProposals] = useState<NeedProposal[]>([])
  const [form, setForm] = useState(EMPTY_PROPOSAL)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const loadProposals = useCallback(async (id: string) => {
    if (!id) { setProposals([]); return }
    try {
      const result = await fetchNeedProposals(id)
      setProposals(result.proposals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement des propositions impossible')
    }
  }, [])

  useEffect(() => { void loadProposals(needId) }, [needId, loadProposals])

  useEffect(() => { if (!needId && needs.length) setNeedId(needs[0].id) }, [needs, needId])

  async function submit() {
    if (!needId || !form.providerName.trim() || !form.title.trim()) return
    setBusy(true); setError(''); setInfo('')
    try {
      await createNeedProposal(needId, {
        providerName: form.providerName.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        deliveryDelay: form.deliveryDelay.trim() || null,
        amount: form.amount === '' ? null : Number(form.amount),
        recommended: form.recommended,
        negotiated: form.negotiated,
      })
      setForm(EMPTY_PROPOSAL)
      setInfo('Brouillon enregistré. Transmettez-le lorsque la proposition est prête.')
      await loadProposals(needId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proposition non enregistrée')
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(id: string, status: NeedProposal['status']) {
    setBusy(true); setError('')
    try {
      await patchProposal(id, { status })
      await loadProposals(needId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible')
    } finally {
      setBusy(false)
    }
  }

  async function transmit(id: string) {
    setBusy(true); setError(''); setInfo('')
    try {
      await transmitProposal(id)
      setInfo('Proposition transmise au client. Le besoin attend maintenant sa décision.')
      await loadProposals(needId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transmission impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Plus size={16} className="text-brand-700" />
        <h2 className="font-semibold text-ink-950">Propositions prestataires</h2>
      </div>
      {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      {info ? <Alert tone="success" className="mt-3">{info}</Alert> : null}

      {needs.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">Aucun besoin pour cette entreprise. Le client doit d’abord déposer un besoin.</p>
      ) : (
        <>
          <div className="mt-3 space-y-4">
            <Field label="Besoin concerné">
              <Select value={needId} onChange={(e) => setNeedId(e.target.value)}>
                {needs.map((need) => <option key={need.id} value={need.id}>{need.title || 'Sans titre'}</option>)}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prestataire" required>
                <Input value={form.providerName} onChange={(e) => setForm((f) => ({ ...f, providerName: e.target.value }))} placeholder="Nom du prestataire" />
              </Field>
              <Field label="Intitulé de la proposition" required>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Prestation proposée" />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Périmètre, délai, points clés…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Montant (DH)">
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Facultatif" />
              </Field>
              <Field label="Délai">
                <Input value={form.deliveryDelay} onChange={(e) => setForm((f) => ({ ...f, deliveryDelay: e.target.value }))} placeholder="Ex. 3 semaines" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={form.recommended} onChange={(e) => setForm((f) => ({ ...f, recommended: e.target.checked }))} />
                Proposition recommandée
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={form.negotiated} onChange={(e) => setForm((f) => ({ ...f, negotiated: e.target.checked }))} />
                Proposition négociée
              </label>
            </div>
            <div className="flex justify-end">
              <Button disabled={busy || !form.providerName.trim() || !form.title.trim()} onClick={() => void submit()}>
                {busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}
              </Button>
            </div>
          </div>

          <div className="mt-5 divide-y divide-ink-50 border-t border-ink-100 pt-2">
            {proposals.length === 0 ? <p className="py-3 text-xs text-ink-500">Aucune proposition pour ce besoin.</p> : null}
            {proposals.map((proposal) => {
              const meta = PROPOSAL_STATUS_META[proposal.status] ?? PROPOSAL_STATUS_META.proposee
              return (
                <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{proposal.providerName} · {proposal.title}</p>
                    <p className="text-xs text-ink-500">{proposal.amount != null ? money(proposal.amount) : 'montant à préciser'}{proposal.deliveryDelay ? ` · ${proposal.deliveryDelay}` : ''}{proposal.recommended ? ' · recommandée' : ''}{proposal.negotiated ? ' · négociée' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {!proposal.sentAt && !['envoyee', 'acceptee', 'refusee'].includes(proposal.status) ? (
                      <>
                      <Select value={proposal.status} onChange={(e) => void updateStatus(proposal.id, e.target.value as NeedProposal['status'])}>
                        <option value="brouillon">Brouillon</option>
                        <option value="proposee">Proposée</option>
                        <option value="en_etude">En étude</option>
                      </Select>
                      <Button size="sm" disabled={busy} onClick={() => void transmit(proposal.id)}>Transmettre au client</Button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

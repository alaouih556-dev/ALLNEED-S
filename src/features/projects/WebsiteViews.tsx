import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Download, ExternalLink, Globe2, Hammer, Inbox, Loader2, PenLine, Plus, Rocket, Send, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, matches, MiniStat, Panel, Rows, SearchBox, Segmented, StatGrid, Toolbar } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import { apiRequest } from '@/lib/accompagnement'
import { getSectorLabel } from '@/lib/sectors'
import { formatDate, formatDateTime, postJson, STATUS_LABEL, type ImportedSite, type WebsiteDetail, type WebsiteMeta, type WebsiteStatus, type WebsiteSummary } from './api'
import { StatusPill, Timeline } from './shell'
import { LANGUAGES, SECTIONS, STYLES } from './WebsiteWizard'

function useList() {
  const [items, setItems] = useState<WebsiteSummary[] | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { setItems(await apiRequest<WebsiteSummary[]>('/api/websites')); setError('') } catch (cause) { setError((cause as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  return { items, error, load }
}

/* ---------- Client et commercial ---------- */
export function MyWebsites() {
  const { items, error } = useList()
  const [imports, setImports] = useState<ImportedSite[]>([])
  useEffect(() => { void apiRequest<ImportedSite[]>('/api/websites/imports').then(setImports).catch(() => undefined) }, [])
  return (
    <div>
      <PageHeader eyebrow="Sites web" title="Mes sites" description="Suivez vos demandes, vos aperçus et l’historique de vos projets." actions={<Link to={'/sites-web/nouveau' as never}><Button><Plus size={16} />Nouvelle demande</Button></Link>} />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      {!items ? <Panel><LoadingRows count={4} /></Panel> : items.length || imports.length ? (
        <div className="pj-site-grid">
          {items.map((item) => (
            <Link key={item.id} to={`/sites-web/${item.id}` as never} className="pj-site-card">
              <span className="pj-site-thumb"><Globe2 size={26} /></span>
              <div className="pj-site-body">
                <div className="flex items-start justify-between gap-2"><strong>{item.company}</strong><StatusPill status={item.status} /></div>
                <small>{item.reference}</small>
                <dl>
                  <div><dt>Envoyée</dt><dd>{formatDate(item.createdAt)}</dd></div>
                  <div><dt>Livrée</dt><dd>{formatDate(item.deliveredAt)}</dd></div>
                </dl>
              </div>
            </Link>
          ))}
          {imports.map((site) => (
            <a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer" className="pj-site-card">
              <span className="pj-site-thumb"><Globe2 size={26} /></span>
              <div className="pj-site-body">
                <div className="flex items-start justify-between gap-2"><strong>{site.name}</strong><ExternalLink size={15} /></div>
                <small>{site.organizationName}</small>
                <dl><div><dt>Livrée</dt><dd>{formatDate(site.deliveredAt)}</dd></div></dl>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Panel><EmptyBox icon={<Globe2 size={20} />} title="Aucun site pour le moment" text="Décrivez votre activité et notre équipe préparera votre aperçu." action={<Link to={'/sites-web/nouveau' as never}><Button>Créer mon site</Button></Link>} /></Panel>
      )}
    </div>
  )
}

/* ---------- Administration ---------- */
export function AdminWebsites() {
  const { items, error } = useList()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | WebsiteStatus>('all')
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const item of items ?? []) result[item.status] = (result[item.status] ?? 0) + 1
    return result
  }, [items])
  const rows = (items ?? []).filter((item) => (filter === 'all' || item.status === filter) && matches(query, item.reference, item.company, item.clientName, item.commercialName, item.developerName))
  const options: Array<{ value: 'all' | WebsiteStatus; label: string; count: number }> = [{ value: 'all', label: 'Toutes', count: items?.length ?? 0 }, ...(Object.keys(STATUS_LABEL) as WebsiteStatus[]).map((id) => ({ value: id, label: STATUS_LABEL[id], count: counts[id] ?? 0 }))]
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Demandes de sites web" description="Assignez, suivez, validez et publiez les sites de vos clients." />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <StatGrid>
        <MiniStat icon={<Inbox size={17} />} label="Nouvelles" value={(counts.new ?? 0) + (counts.pending_review ?? 0)} />
        <MiniStat icon={<Hammer size={17} />} tone="sky" label="En production" value={(counts.assigned ?? 0) + (counts.in_progress ?? 0)} />
        <MiniStat icon={<PenLine size={17} />} tone="amber" label="À valider" value={(counts.ready_for_review ?? 0) + (counts.revision_requested ?? 0)} />
        <MiniStat icon={<Rocket size={17} />} tone="emerald" label="Livrées" value={counts.delivered ?? 0} />
      </StatGrid>
      <Panel>
        <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Rechercher une demande…" /><Segmented value={filter} onChange={setFilter} options={options} /></Toolbar>
        {!items ? <LoadingRows count={5} /> : rows.length ? (
          <div className="pj-table-wrap">
            <table className="pj-table">
              <thead><tr><th>Référence</th><th>Entreprise</th><th>Client</th><th>Commercial</th><th>Date</th><th>Secteur</th><th>Statut</th><th>Développeur</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs">{item.reference}</td><td className="font-semibold">{item.company}</td><td>{item.clientName ?? '—'}</td><td>{item.commercialName ?? '—'}</td>
                    <td>{formatDate(item.createdAt)}</td><td>{getSectorLabel(item.sector)}</td><td><StatusPill status={item.status} /></td><td>{item.developerName ?? '—'}</td>
                    <td><Link to={`/admin/sites-web/${item.id}` as never}><Button size="sm" variant="outline">Ouvrir</Button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBox icon={<Inbox size={20} />} title="Aucune demande" text="Les demandes envoyées par vos clients apparaîtront ici." />}
      </Panel>
      <ImportQueue />
    </div>
  )
}

function ImportQueue() {
  const [rows, setRows] = useState<ImportedSite[]>([])
  const [orgs, setOrgs] = useState<WebsiteMeta['organizations']>([])
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const load = useCallback(async () => { setRows(await apiRequest<ImportedSite[]>('/api/websites/imports').catch(() => [])) }, [])
  useEffect(() => { void load(); void apiRequest<WebsiteMeta>('/api/websites/meta').then((meta) => setOrgs(meta.organizations)).catch(() => undefined) }, [load])
  const pending = rows.filter((row) => row.reviewStatus === 'pending')
  if (!pending.length) return null
  const assign = async (id: string) => {
    setError('')
    try { await postJson(`/api/websites/imports/${id}`, { orgId: picks[id] }, 'PATCH'); await load() } catch (cause) { setError((cause as Error).message) }
  }
  return (
    <Panel title="Sites importés à affecter" description="Invisibles pour les clients tant qu’ils ne sont pas affectés à une entreprise." className="mt-5">
      <div className="space-y-3 p-5">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {pending.map((row) => (
          <div key={row.id} className="pj-import-row">
            <div className="min-w-0"><strong>{row.name}</strong><small className="truncate">{row.url}</small></div>
            <Select value={picks[row.id] ?? ''} onChange={(event) => setPicks((all) => ({ ...all, [row.id]: event.target.value }))}>
              <option value="">Entreprise…</option>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </Select>
            <Button size="sm" disabled={!picks[row.id]} onClick={() => void assign(row.id)}>Affecter</Button>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ---------- Développeur ---------- */
export function DeveloperWebsites() {
  const { items, error } = useList()
  return (
    <div>
      <PageHeader eyebrow="Développeur" title="Mes sites à réaliser" description="Uniquement les demandes qui vous sont assignées." />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <Panel>
        {!items ? <LoadingRows count={4} /> : items.length ? (
          <Rows>
            {items.map((item) => (
              <li key={item.id}>
                <Link to={`/developpeur/sites-web/${item.id}` as never} className="flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-ink-50">
                  <Initial name={item.company} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm text-ink-950">{item.company}</b><small className="text-xs text-ink-500">{item.reference} · {formatDate(item.createdAt)}</small></span>
                  {item.status === 'in_progress' ? <span className="pj-mini-progress"><i style={{ width: `${item.progress ?? 0}%` }} /></span> : null}
                  <StatusPill status={item.status} />
                </Link>
              </li>
            ))}
          </Rows>
        ) : <EmptyBox icon={<Hammer size={20} />} title="Aucun site assigné" text="Vous serez notifié dès qu’une demande vous sera confiée." />}
      </Panel>
    </div>
  )
}

/* ---------- Détail, commun à tous les rôles ---------- */
export function WebsiteDetailPage({ id, mode }: { id: string; mode: 'client' | 'admin' | 'developer' }) {
  const auth = useAuth()
  const [request, setRequest] = useState<WebsiteDetail | null>(null)
  const [meta, setMeta] = useState<WebsiteMeta | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { setRequest(await apiRequest<WebsiteDetail>(`/api/websites/${id}`)); setError('') } catch (cause) { setError((cause as Error).message) }
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (mode === 'admin') void apiRequest<WebsiteMeta>('/api/websites/meta').then(setMeta).catch(() => undefined) }, [mode])
  const act = async (action: string, body: unknown) => {
    setBusy(true)
    setError('')
    try { setRequest(await postJson<WebsiteDetail>(`/api/websites/${id}/${action}`, body)); return true } catch (cause) { setError((cause as Error).message); return false } finally { setBusy(false) }
  }
  const back = mode === 'admin' ? '/admin/sites-web' : mode === 'developer' ? '/developpeur/sites-web' : '/sites-web/mes-sites'
  if (!request) return <div><BackLink to={back} />{error ? <Alert tone="danger">{error}</Alert> : <Panel><LoadingRows count={5} /></Panel>}</div>
  const canRevise = mode === 'client' && request.canRevise && auth.user?.tools?.websites
  return (
    <div>
      <BackLink to={back} />
      <PageHeader eyebrow={request.reference} title={request.company} description={<span className="pj-hero-status">{STATUS_LABEL[request.status]}</span>} />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <div className="pj-detail">
        <div className="space-y-5">
          {request.websiteUrl ? <Delivery request={request} canRevise={Boolean(canRevise)} busy={busy} onRevise={(message) => act('revisions', { message })} /> : null}
          {mode !== 'client' ? <TeamActions request={request} mode={mode} meta={meta} busy={busy} act={act} /> : null}
          <BriefView request={request} />
        </div>
        <aside className="space-y-5">
          <Panel title="Suivi"><div className="p-5"><Timeline events={request.events} /></div></Panel>
          {request.revisions.length ? <Panel title="Modifications demandées"><ul className="pj-notes">{request.revisions.map((item) => <li key={item.id}><p>{item.message}</p><small>{formatDateTime(item.createdAt)}{item.authorName ? ` · ${item.authorName}` : ''}</small></li>)}</ul></Panel> : null}
          {request.notes ? <Notes request={request} busy={busy} act={act} /> : null}
        </aside>
      </div>
    </div>
  )
}

const BackLink = ({ to }: { to: string }) => <Link to={to as never} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-950"><ArrowLeft size={15} />Retour</Link>

function Delivery({ request, canRevise, busy, onRevise }: { request: WebsiteDetail; canRevise: boolean; busy: boolean; onRevise: (message: string) => Promise<boolean> }) {
  const [revising, setRevising] = useState(false)
  const [message, setMessage] = useState('')
  const url = request.websiteUrl as string
  return (
    <Panel title="Votre aperçu de site est prêt !" description="Votre aperçu personnalisé est maintenant disponible.">
      {request.embeddable ? <iframe title={`Aperçu de ${request.company}`} src={url} className="pj-preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" loading="lazy" /> : null}
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer"><Button><ExternalLink size={16} />Voir mon site</Button></a>
          {canRevise ? <Button variant="outline" onClick={() => setRevising((value) => !value)}><PenLine size={16} />Demander une modification</Button> : null}
        </div>
        {revising ? (
          <div className="space-y-2">
            <Textarea rows={3} maxLength={3000} placeholder="Décrivez la modification souhaitée…" value={message} onChange={(event) => setMessage(event.target.value)} />
            <Button disabled={busy || !message.trim()} onClick={async () => { if (await onRevise(message)) { setMessage(''); setRevising(false) } }}><Send size={15} />Envoyer</Button>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

function TeamActions({ request, mode, meta, busy, act }: { request: WebsiteDetail; mode: 'admin' | 'developer'; meta: WebsiteMeta | null; busy: boolean; act: (action: string, body: unknown) => Promise<boolean> }) {
  const [developerId, setDeveloperId] = useState(request.developerId ?? '')
  const [progress, setProgress] = useState(request.progress ?? 0)
  const [previewUrl, setPreviewUrl] = useState(request.previewUrl ?? '')
  const [reason, setReason] = useState('')
  useEffect(() => { setProgress(request.progress ?? 0); setPreviewUrl(request.previewUrl ?? ''); setDeveloperId(request.developerId ?? '') }, [request.progress, request.previewUrl, request.developerId])
  const closed = ['delivered', 'cancelled'].includes(request.status)
  return (
    <Panel title="Production" description={mode === 'admin' ? 'Visible uniquement par l’équipe.' : 'Mettez à jour votre avancement.'}>
      <div className="space-y-5 p-5">
        {mode === 'admin' && !closed ? (
          <div className="pj-inline">
            <Field label="Développeur assigné" className="flex-1">
              <Select value={developerId} onChange={(event) => setDeveloperId(event.target.value)}>
                <option value="">Choisir…</option>
                {meta?.developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}
              </Select>
            </Field>
            <Button variant="outline" disabled={busy || !developerId || developerId === request.developerId} onClick={() => void act('assign', { developerId })}>Assigner</Button>
          </div>
        ) : null}
        {mode === 'admin' && meta && !meta.developers.length ? <Alert tone="warning">Aucun développeur : ajoutez un membre à l’équipe Dev — AI — Automation.</Alert> : null}
        {request.allowedStatuses.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Changer le statut</p>
            <div className="flex flex-wrap gap-2">{request.allowedStatuses.map((status) => <Button key={status} size="sm" variant="outline" disabled={busy} onClick={() => void act('status', { status })}>{STATUS_LABEL[status]}</Button>)}</div>
          </div>
        ) : null}
        {request.status === 'in_progress' ? (
          <>
            <div className="pj-inline">
              <Field label={`Progression : ${progress} %`} className="flex-1"><input type="range" min={0} max={100} step={5} value={progress} onChange={(event) => setProgress(Number(event.target.value))} className="w-full" /></Field>
              <Button variant="outline" disabled={busy || progress === request.progress} onClick={() => void act('progress', { progress })}>Enregistrer</Button>
            </div>
            <div className="pj-inline">
              <Field label="Lien de l’aperçu" hint="Adresse https:// publique." className="flex-1"><Input type="url" placeholder="https://" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} /></Field>
              <Button disabled={busy || !previewUrl.trim()} onClick={() => void act('submit', { previewUrl: previewUrl.trim() })}><Send size={15} />Soumettre</Button>
            </div>
          </>
        ) : null}
        {request.previewUrl ? <a href={request.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"><ExternalLink size={14} />Ouvrir l’aperçu soumis</a> : null}
        {mode === 'admin' && request.status === 'ready_for_review' ? (
          <div className="pj-review-box">
            <Button disabled={busy} onClick={() => void act('publish', {})}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}Approuver et publier</Button>
            <Textarea rows={2} placeholder="Motif du renvoi au développeur…" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button variant="outline" disabled={busy || !reason.trim()} onClick={async () => { if (await act('return', { message: reason })) setReason('') }}><Undo2 size={15} />Renvoyer au développeur</Button>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

function Notes({ request, busy, act }: { request: WebsiteDetail; busy: boolean; act: (action: string, body: unknown) => Promise<boolean> }) {
  const [text, setText] = useState('')
  return (
    <Panel title="Notes internes" description="Jamais visibles par le client.">
      <div className="space-y-2 border-b border-ink-100 p-4">
        <Textarea rows={2} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Ajouter une note…" />
        <Button size="sm" variant="outline" disabled={busy || !text.trim()} onClick={async () => { if (await act('notes', { text })) setText('') }}>Ajouter</Button>
      </div>
      <ul className="pj-notes">{request.notes?.map((note) => <li key={note.id}><p>{note.text}</p><small>{formatDateTime(note.createdAt)}{note.authorName ? ` · ${note.authorName}` : ''}</small></li>)}</ul>
    </Panel>
  )
}

const Info = ({ label, children }: { label: string; children: ReactNode }) => (children ? <div><dt>{label}</dt><dd>{children}</dd></div> : null)
const linkList = (urls: string[]) => (urls.length ? urls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-brand-700">{url}</a>) : null)
const labelList = (options: ReadonlyArray<readonly [string, string]>, ids: string[]) => ids.map((id) => options.find(([key]) => key === id)?.[1] ?? id).join(', ')

function BriefView({ request }: { request: WebsiteDetail }) {
  const b = request.brief
  const features = [b.whatsapp && 'WhatsApp', b.contactForm && 'Formulaire de contact', b.googleMaps && 'Google Maps'].filter(Boolean).join(', ')
  return (
    <Panel title="Brief du projet">
      <div className="space-y-5 p-5">
        <section className="pj-review"><header><h3>Entreprise</h3></header><dl>
          <Info label="Secteur">{getSectorLabel(b.sector)}</Info><Info label="Description">{b.description}</Info><Info label="Contact">{[b.contactName, b.phone, b.email].filter(Boolean).join(' · ')}</Info>
          <Info label="Adresse">{[b.address, b.city, b.country].filter(Boolean).join(', ')}</Info><Info label="Réseaux sociaux">{linkList(b.socialLinks)}</Info><Info label="Site existant">{b.existingUrl ? linkList([b.existingUrl]) : null}</Info>
        </dl></section>
        <section className="pj-review"><header><h3>Identité visuelle</h3></header><dl>
          <Info label="Style">{STYLES.find(([id]) => id === b.style)?.[1]}{b.styleOther ? ` · ${b.styleOther}` : ''}</Info><Info label="Couleurs">{b.colors}</Info><Info label="Inspirations">{linkList(b.inspirationUrls)}</Info><Info label="Instructions">{b.designNotes}</Info>
        </dl>
          {request.files.length ? <div className="pj-file-grid mt-3">{request.files.map((file) => <figure key={file.id} className="pj-file"><img src={file.url} alt={file.name} loading="lazy" /><a href={file.downloadUrl} download aria-label={`Télécharger ${file.name}`}><Download size={13} /></a></figure>)}</div> : null}
        </section>
        <section className="pj-review"><header><h3>Contenu</h3></header><dl>
          <Info label="Sections">{labelList(SECTIONS, b.sections)}</Info><Info label="Section personnalisée">{b.customSections}</Info><Info label="Présentation">{b.introduction}</Info><Info label="Services">{b.servicesDescription}</Info><Info label="Produits">{b.productInfo}</Info>
          <Info label="Langues">{labelList(LANGUAGES, b.languages)}</Info><Info label="Fonctionnalités">{[features, b.extraFeatures].filter(Boolean).join(' · ')}</Info>
        </dl></section>
        {b.objective || b.audience || b.marketingMessage || b.competitors || b.comments ? (
          <section className="pj-review"><header><h3>Objectifs</h3></header><dl>
            <Info label="Objectif">{b.objective}</Info><Info label="Public cible">{b.audience}</Info><Info label="Message">{b.marketingMessage}</Info><Info label="Concurrents">{b.competitors}</Info><Info label="Commentaires">{b.comments}</Info>
          </dl></section>
        ) : null}
      </div>
    </Panel>
  )
}

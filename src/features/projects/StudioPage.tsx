import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Box, Download, ImagePlus, Images, Loader2, Megaphone, Orbit, RefreshCcw, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { EmptyBox, LoadingRows, Panel } from '@/components/admin-kit'
import { apiRequest } from '@/lib/accompagnement'
import { cn } from '@/lib/utils'
import { formatDateTime, GENERATION_STATUS, newKey, postJson, uploadImage, type StudioAsset, type StudioGeneration, type StudioInput, type StudioPayload, type StudioWorkflow } from './api'

const FLOW_ICONS: Record<string, typeof Wand2> = { 'photo-image': Wand2, 'product-ads': Megaphone, 'photo-3d-ad': Box, 'photo-3d-360': Orbit }
const ACTIVE = new Set(['submitting', 'running'])
type Upload = { id: string; name: string; url: string }

export function StudioPage() {
  const [data, setData] = useState<StudioPayload | null>(null)
  const [history, setHistory] = useState<StudioGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [payload, generations] = await Promise.all([apiRequest<StudioPayload>('/api/studio/workflows'), apiRequest<StudioGeneration[]>('/api/studio/generations')])
      setData(payload)
      setHistory(generations)
      setSelected((current) => current ?? payload.workflows.find((flow) => flow.state === 'available')?.key ?? payload.workflows[0]?.key ?? null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const activeIds = history.filter((item) => ACTIVE.has(item.status) || item.assets.some((asset) => asset.temporary && asset.available)).map((item) => item.id).join(',')
  useEffect(() => {
    if (!activeIds) return
    const timer = window.setInterval(async () => {
      for (const id of activeIds.split(',')) {
        const fresh = await apiRequest<StudioGeneration>(`/api/studio/generations/${id}`).catch(() => null)
        if (fresh) setHistory((rows) => rows.map((row) => (row.id === id ? fresh : row)))
      }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [activeIds])

  const workflow = data?.workflows.find((flow) => flow.key === selected) ?? null
  const upsert = (generation: StudioGeneration) => setHistory((rows) => [generation, ...rows.filter((row) => row.id !== generation.id)])

  return (
    <div>
      <PageHeader eyebrow="Studio IA" title="Créez vos visuels avec l’IA" description="Choisissez un workflow, ajoutez votre photo et lancez la génération. Vos résultats restent privés et disponibles dans votre historique." />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      {loading ? <Panel><LoadingRows count={4} /></Panel> : null}
      {data && !data.configured ? (
        <Alert tone="warning" className="mb-5" title="Studio IA pas encore connecté">Les workflows sont prêts, mais aucune génération ne peut être lancée tant que l’accès à l’API Magnific n’est pas activé par l’administration.</Alert>
      ) : null}
      {data ? (
        <>
          <div className="pj-flow-grid">
            {data.workflows.map((flow) => {
              const Icon = FLOW_ICONS[flow.key] ?? Sparkles
              return (
                <button key={flow.key} type="button" className={cn('pj-flow-card', selected === flow.key && 'is-on')} aria-pressed={selected === flow.key} onClick={() => setSelected(flow.key)}>
                  <span className="pj-flow-icon"><Icon size={19} /></span>
                  <strong>{flow.name}</strong>
                  <small>{flow.description}</small>
                  {flow.state !== 'available' ? <em>{flow.state === 'not_configured' ? 'Non connecté' : 'Indisponible'}</em> : flow.cost != null ? <em className="is-ok">{flow.cost} crédits</em> : null}
                </button>
              )
            })}
          </div>
          <div className="pj-studio-layout">
            {workflow ? <RunForm key={workflow.key} workflow={workflow} organizations={data.organizations} onCreated={upsert} /> : null}
            <Panel title="Historique" description="Vos générations et leurs résultats." action={<Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCcw size={14} />Actualiser</Button>}>
              {history.length ? <div className="pj-gen-list">{history.map((item) => <GenerationCard key={item.id} generation={item} />)}</div> : <EmptyBox icon={<Images size={20} />} title="Aucune génération" text="Vos créations apparaîtront ici." />}
            </Panel>
          </div>
          {data.canImport ? <ImportPanel generations={history.filter((item) => item.reviewStatus === 'pending')} orgs={data.organizations} onChange={load} /> : null}
        </>
      ) : null}
    </div>
  )
}

function RunForm({ workflow, organizations, onCreated }: { workflow: StudioWorkflow; organizations: StudioPayload['organizations']; onCreated: (item: StudioGeneration) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(workflow.inputs.filter((input) => input.type !== 'creation' && input.defaultValue != null).map((input) => [input.id, String(input.defaultValue)])))
  const [uploads, setUploads] = useState<Record<string, Upload>>({})
  const [orgId, setOrgId] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Conservée si le réseau échoue : renvoyer le formulaire ne relance pas une seconde génération.
  const submissionKey = useRef(newKey())
  const available = workflow.state === 'available'
  const missing = useMemo(() => workflow.inputs.some((input) => input.required && input.defaultValue == null && !(input.type === 'creation' ? uploads[input.id] : values[input.id]?.trim())), [workflow, uploads, values])

  const addFile = async (input: StudioInput, file?: File) => {
    if (!file) return
    setError('')
    setUploading(input.id)
    try {
      const uploaded = await uploadImage<Upload>('/api/studio/uploads', file)
      setUploads((current) => ({ ...current, [input.id]: uploaded }))
    } catch (cause) { setError((cause as Error).message) } finally { setUploading(null) }
  }
  const removeFile = async (input: StudioInput) => {
    const file = uploads[input.id]
    setUploads(({ [input.id]: _removed, ...rest }) => rest)
    if (file) await apiRequest(file.url, { method: 'DELETE' }).catch(() => undefined)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !available || missing) return
    setBusy(true)
    setError('')
    try {
      const inputs = Object.fromEntries(workflow.inputs.flatMap((input) => {
        const value = input.type === 'creation' ? uploads[input.id]?.id : values[input.id]
        return value ? [[input.id, value]] : []
      }))
      const generation = await postJson<StudioGeneration>('/api/studio/generations', { submissionKey: submissionKey.current, workflowKey: workflow.key, orgId: orgId || undefined, inputs })
      onCreated(generation)
      submissionKey.current = newKey()
      setUploads({})
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={workflow.name} description={workflow.description} className="pj-run-panel">
      <form onSubmit={submit} className="space-y-4 p-5">
        {!available ? <Alert tone="warning">{workflow.state === 'not_configured' ? 'Ce workflow sera disponible dès que l’API Magnific sera connectée.' : workflow.reason || 'Ce workflow est momentanément indisponible.'}</Alert> : null}
        {workflow.inputs.map((input) => input.type === 'creation' ? (
          <div key={input.id}>
            <p className="mb-1.5 text-xs font-semibold text-ink-700">{input.label}{input.required ? <span className="text-red-500"> *</span> : null}</p>
            {uploads[input.id] ? (
              <div className="pj-upload-preview">
                <img src={uploads[input.id].url} alt={uploads[input.id].name} />
                <span>{uploads[input.id].name}</span>
                <button type="button" aria-label="Retirer l’image" onClick={() => void removeFile(input)}><Trash2 size={15} /></button>
              </div>
            ) : (
              <label className={cn('pj-drop', !available && 'is-off')}>
                {uploading === input.id ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                <span>{uploading === input.id ? 'Envoi de l’image…' : 'Choisir une image'}</span>
                <small>JPG, PNG ou WebP · 4 Mo maximum</small>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!available || Boolean(uploading)} onChange={(event) => { void addFile(input, event.target.files?.[0]); event.target.value = '' }} />
              </label>
            )}
          </div>
        ) : (
          <Field key={input.id} label={input.label} required={input.required}>
            {input.type === 'select' && input.options.length ? (
              <Select value={values[input.id] ?? ''} onChange={(event) => setValues((v) => ({ ...v, [input.id]: event.target.value }))}>
                <option value="">Choisir…</option>
                {input.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            ) : input.type === 'number' ? (
              <Input type="number" value={values[input.id] ?? ''} onChange={(event) => setValues((v) => ({ ...v, [input.id]: event.target.value }))} />
            ) : input.multiline || input.type === 'text' ? (
              <Textarea rows={3} maxLength={4000} value={values[input.id] ?? ''} onChange={(event) => setValues((v) => ({ ...v, [input.id]: event.target.value }))} />
            ) : (
              <Input maxLength={300} value={values[input.id] ?? ''} onChange={(event) => setValues((v) => ({ ...v, [input.id]: event.target.value }))} />
            )}
          </Field>
        ))}
        {organizations.length ? (
          <Field label="Pour le client" hint="Facultatif. Le résultat sera visible par les personnes autorisées sur ce client.">
            <Select value={orgId} onChange={(event) => setOrgId(event.target.value)}>
              <option value="">Usage interne</option>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </Select>
          </Field>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" fullWidth disabled={!available || missing || busy || Boolean(uploading)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? 'Lancement…' : 'Générer'}
        </Button>
      </form>
    </Panel>
  )
}

function AssetView({ asset }: { asset: StudioAsset }) {
  if (!asset.available) return <div className="pj-asset-expired">Fichier expiré</div>
  return (
    <figure className="pj-asset">
      {asset.type === 'image' ? <img src={asset.url} alt="Résultat généré" loading="lazy" /> : asset.type === 'video' ? <video src={asset.url} controls playsInline preload="metadata" /> : <audio src={asset.url} controls />}
      <a href={asset.downloadUrl} download aria-label="Télécharger" className="pj-asset-dl"><Download size={15} /></a>
    </figure>
  )
}

function GenerationCard({ generation }: { generation: StudioGeneration }) {
  const status = GENERATION_STATUS[generation.status] ?? { label: generation.status, tone: 'neutral' as const }
  const active = ACTIVE.has(generation.status)
  return (
    <article className="pj-gen-card">
      <header>
        <div className="min-w-0">
          <strong>{generation.workflowName}</strong>
          <small>{formatDateTime(generation.createdAt)}{generation.organizationName ? ` · ${generation.organizationName}` : ''}{generation.ownerName ? ` · ${generation.ownerName}` : ''}</small>
        </div>
        <Badge tone={status.tone}>{active ? <Loader2 size={11} className="mr-1 animate-spin" /> : null}{status.label}</Badge>
      </header>
      {generation.prompt ? <p className="pj-gen-prompt">{generation.prompt}</p> : null}
      {generation.error ? <p className="pj-gen-error"><AlertTriangle size={13} />{generation.error}</p> : null}
      {generation.assets.length ? <div className="pj-asset-grid">{generation.assets.map((asset) => <AssetView key={asset.id} asset={asset} />)}</div> : null}
      {generation.assets.some((asset) => asset.temporary && asset.available) ? <p className="pj-gen-note">Copie sécurisée en cours. Téléchargez ce fichier si elle n’aboutit pas : le lien expire après 12 heures.</p> : null}
    </article>
  )
}

function ImportPanel({ generations, orgs, onChange }: { generations: StudioGeneration[]; orgs: StudioPayload['organizations']; onChange: () => Promise<void> }) {
  const [runId, setRunId] = useState('')
  const [error, setError] = useState('')
  const [picks, setPicks] = useState<Record<string, { orgId: string; ownerId: string }>>({})

  const importRun = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try { await postJson('/api/studio/imports', { runId: runId.trim() }); setRunId(''); await onChange() } catch (cause) { setError((cause as Error).message) }
  }
  const assign = async (id: string) => {
    setError('')
    try { await postJson(`/api/studio/imports/${id}`, picks[id], 'PATCH'); await onChange() } catch (cause) { setError((cause as Error).message) }
  }

  return (
    <Panel title="Importer une génération" description="Magnific ne fournit pas de liste des exécutions : l’import se fait par identifiant. Rien n’est visible par un client avant votre affectation." className="mt-5">
      <div className="space-y-4 p-5">
        <form onSubmit={importRun} className="flex flex-col gap-2 sm:flex-row">
          <Input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="Identifiant d’exécution" />
          <Button type="submit" variant="outline" disabled={!runId.trim()}>Importer</Button>
        </form>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {generations.map((item) => {
          const pick = picks[item.id] ?? { orgId: '', ownerId: '' }
          const users = orgs.find((org) => org.id === pick.orgId)?.users ?? []
          return (
            <div key={item.id} className="pj-import-row">
              <div className="min-w-0"><strong>{item.workflowName}</strong><small>{item.assets.length} fichier(s) · à affecter</small></div>
              <Select value={pick.orgId} onChange={(event) => setPicks((all) => ({ ...all, [item.id]: { orgId: event.target.value, ownerId: '' } }))}>
                <option value="">Entreprise…</option>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </Select>
              <Select value={pick.ownerId} disabled={!pick.orgId} onChange={(event) => setPicks((all) => ({ ...all, [item.id]: { ...pick, ownerId: event.target.value } }))}>
                <option value="">Utilisateur…</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </Select>
              <Button size="sm" disabled={!pick.orgId || !pick.ownerId} onClick={() => void assign(item.id)}>Valider</Button>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

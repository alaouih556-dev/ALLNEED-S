import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, FileText, FileUp, Plus, Trash2, X } from 'lucide-react'
import {
  createDocument,
  deleteDocument,
  documentCategoryLabel,
  documentOpenUrl,
  documentStatus,
  documentDownloadUrl,
  documentTypeLabel,
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  fileToDataUrl,
  formatFileSize,
  updateDocument,
  useDocuments,
  type ClientDocument,
} from '@/lib/documents'
import { DOCUMENT_FILE_ACCEPT, imagesToPdf, isAcceptedImage, isPdfFile, isValidPdfFile, MAX_DOCUMENT_DATA_URL_CHARS } from '@/lib/imagePdf'
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Progress, Select, Textarea } from '@/components/ui'

type Variant = 'client' | 'staff'

export function DocumentsPanel({
  orgId,
  variant = 'client',
  compact = false,
}: {
  orgId?: string | null
  variant?: Variant
  compact?: boolean
}) {
  const { documents, loading, error, refresh } = useDocuments(orgId, true)
  const [busy, setBusy] = useState('')

  async function toggleVisibility(doc: ClientDocument) {
    setBusy(`vis:${doc.id}`)
    try {
      await updateDocument(doc.id, { visibleToClient: !doc.visibleToClient })
      await refresh()
    } catch {
      /* erreur silencieuse : l'état reste tel quel */
    } finally {
      setBusy('')
    }
  }

  async function changeStatus(doc: ClientDocument, status: string) {
    setBusy(`st:${doc.id}`)
    try {
      await updateDocument(doc.id, { status })
      await refresh()
    } catch {
      /* erreur silencieuse */
    } finally {
      setBusy('')
    }
  }

  async function remove(doc: ClientDocument) {
    if (!window.confirm(`Supprimer « ${doc.title} » ? Cette action est définitive.`)) return
    setBusy(`del:${doc.id}`)
    try {
      await deleteDocument(doc.id)
      await refresh()
    } catch {
      /* erreur silencieuse */
    } finally {
      setBusy('')
    }
  }

  return (
    <section aria-label="Mes documents">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{variant === 'client' ? 'Nos documents' : 'Documents'}</p>
        {documents.length > 0 ? <Badge tone="neutral">{documents.length} document{documents.length > 1 ? 's' : ''}</Badge> : null}
      </div>

      {error ? (
        <Alert tone="danger" className="mb-4" title="Impossible de charger vos documents">
          {error}
        </Alert>
      ) : null}

      <Card>
        {loading && documents.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">Chargement de vos documents…</p>
          </CardBody>
        ) : documents.length === 0 ? (
          <CardBody className="flex flex-col items-center justify-center py-10 text-center">
            <span className="rounded-xl bg-ink-100 p-3 text-ink-400">
              <FileText className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-semibold text-ink-800">
              Aucun document n’est disponible pour le moment.
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-500">
              {variant === 'client'
                ? 'Déposez vos pièces (identité, factures, contrats…) et retrouvez ici celles transmises par votre équipe ALLNEEDS.'
                : 'Contrats, propositions, comptes rendus ou livrables vous seront déposés ici dès qu’ils seront prêts.'}
            </p>
          </CardBody>
        ) : (
          <div className="divide-y divide-ink-50">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                variant={variant}
                compact={compact}
                busy={busy}
                canDelete={variant === 'staff' || doc.origin === 'client'}
                onToggle={() => void toggleVisibility(doc)}
                onDelete={() => void remove(doc)}
                onStatusChange={(s) => void changeStatus(doc, s)}
              />
            ))}
          </div>
        )}
      </Card>

      {variant === 'staff' ? <AddDocumentForm orgId={orgId} onDone={() => void refresh()} /> : <ClientUploadForm orgId={orgId} onDone={() => void refresh()} />}
    </section>
  )
}

function DocumentRow({
  doc,
  variant,
  compact,
  busy,
  canDelete,
  onToggle,
  onDelete,
  onStatusChange,
}: {
  doc: ClientDocument
  variant: Variant
  compact: boolean
  busy: string
  canDelete: boolean
  onToggle: () => void
  onDelete: () => void
  onStatusChange: (status: string) => void
}) {
  const status = documentStatus(doc.status)
  const hasContent = Boolean(doc.content || doc.fileUrl)
  const meta = [variant === 'staff' && doc.orgName ? doc.orgName : null, documentTypeLabel(doc.type), documentCategoryLabel(doc.category)].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-ink-100 p-2 text-ink-500">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-950">{doc.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {meta ? `${meta} · ` : ''}
            {new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ''}
            {variant === 'staff' && doc.createdByName ? ` · ajouté par ${doc.createdByName}` : ''}
          </p>
          {doc.notes ? <p className="mt-1 text-xs italic text-ink-500">{doc.notes}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {hasContent ? (
          <>
            <a href={documentDownloadUrl(doc.id)} title="Télécharger le document">
              <Button size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </Button>
            </a>
            <a href={documentOpenUrl(doc.id)} title="Ouvrir le document" target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost">
                Ouvrir
              </Button>
            </a>
          </>
        ) : (
          <Badge tone="neutral">Fichier en préparation</Badge>
        )}
        {variant === 'staff' && !compact ? (
          <>
            <Select
              value={doc.status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={busy === `st:${doc.id}`}
              title="Changer le statut du document"
              className="h-8 w-28 text-xs"
            >
              <option value="demande">Manquant</option>
              <option value="recu">Déposé</option>
              <option value="valide">Déposé (validé)</option>
            </Select>
            <Button size="sm" variant={doc.visibleToClient ? 'secondary' : 'ghost'} onClick={onToggle} disabled={busy === `vis:${doc.id}`}>
              {doc.visibleToClient ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {doc.visibleToClient ? 'Visible client' : 'Masqué client'}
            </Button>
          </>
        ) : null}
        {canDelete ? (
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy === `del:${doc.id}`} title="Supprimer le document">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function AddDocumentForm({
  orgId,
  onDone,
}: {
  orgId?: string | null
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('contrat')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('valide')
  const [visibleToClient, setVisibleToClient] = useState(true)
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [content, setContent] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!orgId) {
      setError('Entreprise introuvable.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await createDocument({
        orgId,
        title,
        type,
        category: category || undefined,
        status,
        visibleToClient,
        fileName: fileName || undefined,
        fileUrl: fileUrl || undefined,
        content: content || undefined,
        mimeType: content && !fileUrl ? 'text/plain; charset=utf-8' : undefined,
        notes: notes || undefined,
      })
      setTitle('')
      setCategory('')
      setFileName('')
      setFileUrl('')
      setContent('')
      setNotes('')
      setOpen(false)
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’ajouter le document.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        <Plus className="h-3.5 w-3.5" />
        Ajouter un document
      </Button>
      {open ? (
        <Card className="mt-3">
          <CardHeader title="Nouveau document" description="Le document sera rattaché à cette entreprise et visible selon le réglage ci-dessous." />
          <CardBody>
            <form onSubmit={submit} className="grid gap-4">
              <Field label="Titre du document" required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Contrat PRO-2026-014" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type / catégorie">
                  <Select value={type} onChange={(e) => setType(e.target.value)}>
                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sous-catégorie">
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. Juridique, RH…" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Statut">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="demande">À fournir</option>
                    <option value="recu">Disponible</option>
                    <option value="valide">Validé</option>
                  </Select>
                </Field>
                <Field label="Nom du fichier">
                  <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="document.pdf" />
                </Field>
              </div>
              <Field label="Lien du fichier (URL ou data:)" hint="Optionnel si vous saisissez un contenu ci-dessous.">
                <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://… ou data:…" />
              </Field>
              <Field label="Contenu (texte)" hint="Compte rendu, note ou document préparatoire. Ignoré si un lien est fourni.">
                <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenu du document…" />
              </Field>
              <Field label="Note interne">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible par l’équipe ALLNEEDS" />
              </Field>
              <Checkbox
                label="Visible par le client"
                description="Si actif, ce document apparaît dans l’espace client de l’entreprise."
                checked={visibleToClient}
                onChange={(e) => setVisibleToClient(e.target.checked)}
              />
              {error ? <Alert tone="danger">{error}</Alert> : null}
              {!orgId ? (
                <Alert tone="info" title="Sélectionnez une entreprise">
                  Choisissez une entreprise dans le filtre ci-dessus avant d’ajouter un document.
                </Alert>
              ) : null}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={busy || !title.trim() || !orgId}>
                  {busy ? 'Enregistrement…' : 'Enregistrer le document'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

export function ClientUploadForm({
  orgId,
  onDone,
}: {
  orgId?: string | null
  onDone: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORY_OPTIONS[0].value)
  const [pdfName, setPdfName] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'converting' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const pdfs = files.filter(isPdfFile)
  const images = files.filter(isAcceptedImage)
  const rejected = files.filter((file) => !isPdfFile(file) && !isAcceptedImage(file))

  function pick(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []))
    setError('')
    setStatus('idle')
  }

  function move(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function removeAt(index: number) {
    setFiles((current) => current.filter((_, position) => position !== index))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!orgId) {
      setError('Entreprise introuvable.')
      setStatus('error')
      return
    }
    if (files.length === 0) {
      setError('Sélectionnez au moins un fichier.')
      setStatus('error')
      return
    }
    if (rejected.length > 0) {
      setError(`Format non autorisé : ${rejected.map((file) => file.name).join(', ')}. Formats acceptés : PDF, JPG, JPEG, PNG.`)
      setStatus('error')
      return
    }
    setError('')
    setBusy(true)
    setProgress(0)
    setStatus('idle')
    try {
      const total = pdfs.length + (images.length > 0 ? 1 : 0)
      let done = 0
      for (const file of pdfs) {
        if (!(await isValidPdfFile(file))) throw new Error(`« ${file.name} » n’est pas un PDF valide.`)
        const dataUrl = await fileToDataUrl(file)
        if (dataUrl.length > MAX_DOCUMENT_DATA_URL_CHARS) throw new Error(`« ${file.name} » est trop volumineux (650 Ko maximum).`)
        await createDocument({
          orgId,
          title: file.name.replace(/\.pdf$/i, ''),
          type: 'autre',
          category,
          status: 'recu',
          visibleToClient: true,
          fileName: file.name,
          fileUrl: dataUrl,
          mimeType: 'application/pdf',
          sizeLabel: formatFileSize(file.size),
        })
        done += 1
        setProgress(Math.round((done / total) * 100))
      }
      if (images.length > 0) {
        setStatus('converting')
        const result = await imagesToPdf(images, pdfName || images[0].name)
        await createDocument({
          orgId,
          title: result.fileName.replace(/\.pdf$/i, ''),
          type: 'autre',
          category,
          status: 'recu',
          visibleToClient: true,
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          mimeType: 'application/pdf',
          sizeLabel: result.sizeLabel,
        })
        done += 1
        setProgress(Math.round((done / total) * 100))
        setStatus('ready')
      }
      setFiles([])
      setPdfName('')
      if (inputRef.current) inputRef.current.value = ''
      onDone()
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Le dépôt a échoué.')
    } finally {
      setBusy(false)
    }
  }

  const buttonLabel = busy
    ? status === 'converting'
      ? 'Conversion en cours…'
      : 'Envoi…'
    : images.length > 0
      ? images.length > 1
        ? `Créer le PDF (${images.length} pages)`
        : 'Créer le PDF'
      : pdfs.length > 1
        ? `Déposer ${pdfs.length} PDF`
        : 'Déposer le document'

  return (
    <Card className="mt-4">
      <CardHeader
        title="Déposer un document"
        description="Ajoutez un PDF, ou des images JPG/PNG que nous assemblons en un PDF unique (1 image = 1 page)."
      />
      <CardBody>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Catégorie" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
              {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fichiers" hint="PDF, JPG, JPEG ou PNG. Plusieurs images sélectionnées sont fusionnées en un seul PDF, dans l’ordre choisi." required>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={DOCUMENT_FILE_ACCEPT}
              onChange={pick}
              disabled={busy}
              className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            />
          </Field>
          {files.length > 0 ? (
            <ul className="grid gap-2">
              {files.map((file, index) => {
                const kind = isPdfFile(file) ? 'PDF' : isAcceptedImage(file) ? 'Image' : 'Refusé'
                return (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone={kind === 'Refusé' ? 'danger' : kind === 'Image' ? 'info' : 'neutral'}>{kind}</Badge>
                      <span className="truncate text-xs text-ink-700">{file.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 text-xs tabular-nums text-ink-400">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        title="Monter"
                        className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={busy || index === files.length - 1}
                        title="Descendre"
                        className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(index)}
                        disabled={busy}
                        title="Retirer"
                        className="rounded p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {images.length > 0 ? (
            <Field
              label="Nom du PDF"
              hint={`${images.length} image${images.length > 1 ? 's' : ''} → 1 PDF de ${images.length} page${images.length > 1 ? 's' : ''}.`}
            >
              <Input value={pdfName} onChange={(e) => setPdfName(e.target.value)} placeholder="Ex. Pièces d’identité" disabled={busy} />
            </Field>
          ) : null}
          {busy ? <Progress value={progress} label={status === 'converting' ? 'Conversion en cours…' : 'Envoi en cours'} tone="brand" /> : null}
          {status === 'ready' ? <Alert tone="success" title="PDF prêt">Votre PDF a été créé et déposé dans vos documents.</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {!orgId ? (
            <Alert tone="info" title="Entreprise introuvable">
              Impossible d’identifier votre entreprise pour le moment. Reconnectez-vous ou contactez votre concierge.
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || files.length === 0 || !orgId}>
              <FileUp className="h-3.5 w-3.5" />
              {buttonLabel}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

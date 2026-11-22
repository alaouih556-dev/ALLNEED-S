import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ImagePlus, Loader2, Pencil, Send, X } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui'
import { LoadingRows, Panel } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import { useLang } from '@/i18n'
import { apiRequest } from '@/lib/accompagnement'
import { SECTORS_CONFIG } from '@/lib/sectors'
import { cn } from '@/lib/utils'
import { newKey, postJson, uploadImage, type WebsiteFile, type WebsiteMeta, type WebsiteSummary } from './api'

const STEPS = ['Votre activité', 'Image de marque', 'Contenu', 'Vos exigences', 'Relecture finale']
export const STYLES = [['modern', 'Moderne'], ['luxury', 'Luxe'], ['minimalist', 'Minimaliste'], ['corporate', 'Corporate'], ['creative', 'Créatif'], ['other', 'Autre']] as const
export const SECTIONS = [['home', 'Accueil'], ['about', 'À propos'], ['services', 'Services'], ['products', 'Produits / Catalogue'], ['gallery', 'Galerie'], ['testimonials', 'Témoignages'], ['contact', 'Contact'], ['faq', 'FAQ'], ['custom', 'Section personnalisée']] as const
export const LANGUAGES = [['fr', 'Français'], ['ar', 'Arabe'], ['en', 'Anglais'], ['multilingual', 'Multilingue']] as const
const FILE_GROUPS = [['logo', 'Logo', 'Votre logo, si possible sur fond transparent.'], ['business', 'Photos de l’entreprise', 'Locaux, équipe, ambiance.'], ['product', 'Images produits ou services', 'Ce que vous souhaitez mettre en avant.']] as const

const EMPTY = {
  company: '', sector: '', description: '', contactName: '', phone: '', email: '', address: '', city: '', country: 'Maroc', socialLinks: '', existingUrl: '',
  colors: '', style: 'modern', styleOther: '', inspirationUrls: '', designNotes: '',
  sections: ['home', 'about', 'services', 'contact'] as string[], customSections: '', introduction: '', servicesDescription: '', productInfo: '', languages: ['fr'] as string[], whatsapp: false, contactForm: true, googleMaps: false, extraFeatures: '',
  objective: '', audience: '', marketingMessage: '', competitors: '', comments: '',
}
type Form = typeof EMPTY
const lines = (value: string) => value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
const looksLikeUrl = (value: string) => { try { const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') } catch { return false } }

export function WebsiteWizard() {
  const auth = useAuth()
  const lang = useLang()
  const [meta, setMeta] = useState<WebsiteMeta | null>(null)
  const [orgId, setOrgId] = useState('')
  const [form, setForm] = useState<Form>(EMPTY)
  const [files, setFiles] = useState<WebsiteFile[]>([])
  const [uploading, setUploading] = useState(0)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<WebsiteSummary | null>(null)
  const submissionKey = useRef(newKey())
  const top = useRef<HTMLDivElement>(null)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }))

  const applyOrg = (id: string, source: WebsiteMeta) => {
    setOrgId(id)
    const org = source.organizations.find((item) => item.id === id)
    if (org) setForm((current) => ({ ...current, company: org.name, sector: org.sector || current.sector, city: org.city || current.city, contactName: org.contactName || current.contactName, email: org.contactEmail || current.email, phone: org.contactPhone || current.phone }))
  }
  useEffect(() => {
    apiRequest<WebsiteMeta>('/api/websites/meta').then((payload) => {
      setMeta(payload)
      if (payload.organizations.length === 1) applyOrg(payload.organizations[0].id, payload)
    }).catch((cause) => setError((cause as Error).message))
  }, [])

  const stepError = (index: number) => {
    if (index === 0) {
      if (!orgId) return 'Choisissez l’entreprise concernée.'
      if (!form.company.trim()) return 'Indiquez le nom de l’entreprise.'
      if (!form.sector) return 'Choisissez un secteur.'
      if (!form.description.trim()) return 'Décrivez votre activité.'
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Adresse e-mail invalide.'
      if (form.existingUrl && !looksLikeUrl(form.existingUrl)) return 'Lien du site existant invalide.'
      if (lines(form.socialLinks).some((item) => !looksLikeUrl(item))) return 'Un lien de réseau social est invalide.'
    }
    if (index === 1 && lines(form.inspirationUrls).some((item) => !looksLikeUrl(item))) return 'Un lien d’inspiration est invalide.'
    if (index === 2) {
      if (!form.sections.length) return 'Choisissez au moins une section.'
      if (!form.languages.length) return 'Choisissez au moins une langue.'
    }
    return ''
  }
  const goTo = (next: number) => {
    if (next > step) {
      for (let index = step; index < next; index++) {
        const problem = stepError(index)
        if (problem) { setError(problem); setStep(index); return }
      }
    }
    setError('')
    setStep(next)
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const addFiles = async (kind: WebsiteFile['kind'], list: FileList | null) => {
    if (!list?.length) return
    if (!orgId) { setError('Choisissez d’abord l’entreprise concernée.'); return }
    setError('')
    const chosen = kind === 'logo' ? [list[0]] : Array.from(list)
    setUploading((count) => count + chosen.length)
    for (const file of chosen) {
      try {
        const uploaded = await uploadImage<WebsiteFile>(`/api/websites/files?orgId=${encodeURIComponent(orgId)}&kind=${kind}`, file)
        setFiles((current) => [...current, uploaded])
      } catch (cause) {
        setError(`${file.name} : ${(cause as Error).message}`)
      } finally {
        setUploading((count) => count - 1)
      }
    }
  }
  const removeFile = async (file: WebsiteFile) => {
    setFiles((current) => current.filter((item) => item.id !== file.id))
    await apiRequest(file.url, { method: 'DELETE' }).catch(() => undefined)
  }

  const submit = async () => {
    if (busy || uploading) return
    for (let index = 0; index < 4; index++) {
      const problem = stepError(index)
      if (problem) { setError(problem); setStep(index); return }
    }
    setBusy(true)
    setError('')
    try {
      const brief = { ...form, socialLinks: lines(form.socialLinks), inspirationUrls: lines(form.inspirationUrls) }
      setDone(await postJson<WebsiteSummary>('/api/websites', { submissionKey: submissionKey.current, orgId, brief, fileIds: files.map((file) => file.id) }))
      window.scrollTo({ top: 0 })
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Confirmation request={done} />
  if (!meta) return error ? <Alert tone="danger">{error}</Alert> : <Panel><LoadingRows count={5} /></Panel>
  const isClient = ['dirigeant', 'manager', 'collaborateur'].includes(auth.user?.role ?? '')

  return (
    <div ref={top} className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Sites web" title="Créez votre site web" description="Parlez-nous de votre activité : notre équipe préparera un aperçu personnalisé de votre site." />
      <ol className="pj-stepper" aria-label="Étapes">
        {STEPS.map((label, index) => (
          <li key={label} className={cn(index === step && 'is-on', index < step && 'is-done')}>
            <button type="button" onClick={() => goTo(index)} aria-current={index === step ? 'step' : undefined}>
              <span>{index < step ? <Check size={13} /> : index + 1}</span><b>{label}</b>
            </button>
          </li>
        ))}
      </ol>
      <Panel className="pj-wizard">
        <div className="space-y-5 p-5 sm:p-7">
          {step === 0 ? (
            <>
              {!isClient ? (
                <Field label="Client" required>
                  <Select value={orgId} onChange={(event) => { setFiles([]); applyOrg(event.target.value, meta) }}>
                    <option value="">Choisir une entreprise…</option>
                    {meta.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Grid>
                <Field label="Nom de l’entreprise" required><Input maxLength={180} value={form.company} onChange={(e) => set('company', e.target.value)} /></Field>
                <Field label="Secteur" required>
                  <Select value={form.sector} onChange={(e) => set('sector', e.target.value)}>
                    <option value="">Choisir…</option>
                    {SECTORS_CONFIG.map((sector) => <option key={sector.key} value={sector.key}>{sector.label[lang]}</option>)}
                  </Select>
                </Field>
              </Grid>
              <Field label="Description de l’activité" required><Textarea rows={4} maxLength={3000} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
              <Grid>
                <Field label="Personne à contacter"><Input maxLength={160} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
                <Field label="Téléphone"><Input type="tel" maxLength={40} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
                <Field label="E-mail"><Input type="email" maxLength={200} value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
                <Field label="Adresse"><Input maxLength={300} value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
                <Field label="Ville"><Input maxLength={120} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
                <Field label="Pays"><Input maxLength={120} value={form.country} onChange={(e) => set('country', e.target.value)} /></Field>
              </Grid>
              <Field label="Réseaux sociaux" hint="Un lien par ligne."><Textarea rows={2} value={form.socialLinks} onChange={(e) => set('socialLinks', e.target.value)} /></Field>
              <Field label="Site web existant"><Input maxLength={500} placeholder="https://" value={form.existingUrl} onChange={(e) => set('existingUrl', e.target.value)} /></Field>
            </>
          ) : null}
          {step === 1 ? (
            <>
              {FILE_GROUPS.map(([kind, label, hint]) => (
                <div key={kind}>
                  <p className="text-xs font-semibold text-ink-700">{label}</p>
                  <p className="mb-2 text-xs text-ink-500">{hint}</p>
                  <div className="pj-file-grid">
                    {files.filter((file) => file.kind === kind).map((file) => (
                      <figure key={file.id} className="pj-file">
                        <img src={file.url} alt={file.name} />
                        <button type="button" aria-label={`Retirer ${file.name}`} onClick={() => void removeFile(file)}><X size={13} /></button>
                      </figure>
                    ))}
                    {kind !== 'logo' || !files.some((file) => file.kind === 'logo') ? (
                      <label className="pj-file-add">
                        <ImagePlus size={18} /><span>Ajouter</span>
                        <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple={kind !== 'logo'} onChange={(event) => { void addFiles(kind, event.target.files); event.target.value = '' }} />
                      </label>
                    ) : null}
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-500">JPG, PNG ou WebP · 4 Mo maximum par image.{uploading ? ' Envoi en cours…' : ''}</p>
              <Field label="Couleurs souhaitées"><Input maxLength={300} placeholder="Bleu marine, doré…" value={form.colors} onChange={(e) => set('colors', e.target.value)} /></Field>
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-700">Style</p>
                <div className="pj-chips">{STYLES.map(([id, label]) => <button key={id} type="button" aria-pressed={form.style === id} className={cn(form.style === id && 'is-on')} onClick={() => set('style', id)}>{label}</button>)}</div>
              </div>
              {form.style === 'other' ? <Field label="Précisez le style"><Input maxLength={200} value={form.styleOther} onChange={(e) => set('styleOther', e.target.value)} /></Field> : null}
              <Field label="Sites d’inspiration" hint="Un lien par ligne."><Textarea rows={2} value={form.inspirationUrls} onChange={(e) => set('inspirationUrls', e.target.value)} /></Field>
              <Field label="Instructions de design"><Textarea rows={3} maxLength={3000} value={form.designNotes} onChange={(e) => set('designNotes', e.target.value)} /></Field>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-700">Sections du site <span className="text-red-500">*</span></p>
                <Toggles options={SECTIONS} value={form.sections} onChange={(value) => set('sections', value)} />
              </div>
              {form.sections.includes('custom') ? <Field label="Section personnalisée"><Input maxLength={1000} value={form.customSections} onChange={(e) => set('customSections', e.target.value)} /></Field> : null}
              <Field label="Présentation de l’entreprise"><Textarea rows={3} maxLength={3000} value={form.introduction} onChange={(e) => set('introduction', e.target.value)} /></Field>
              <Field label="Description des services"><Textarea rows={3} maxLength={4000} value={form.servicesDescription} onChange={(e) => set('servicesDescription', e.target.value)} /></Field>
              <Field label="Informations produits"><Textarea rows={3} maxLength={4000} value={form.productInfo} onChange={(e) => set('productInfo', e.target.value)} /></Field>
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-700">Langues du site <span className="text-red-500">*</span></p>
                <Toggles options={LANGUAGES} value={form.languages} onChange={(value) => set('languages', value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Checkbox label="Bouton WhatsApp" checked={form.whatsapp} onChange={(event) => set('whatsapp', event.target.checked)} />
                <Checkbox label="Formulaire de contact" checked={form.contactForm} onChange={(event) => set('contactForm', event.target.checked)} />
                <Checkbox label="Google Maps" checked={form.googleMaps} onChange={(event) => set('googleMaps', event.target.checked)} />
              </div>
              <Field label="Fonctionnalités supplémentaires"><Textarea rows={2} maxLength={2000} value={form.extraFeatures} onChange={(e) => set('extraFeatures', e.target.value)} /></Field>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Field label="Objectif principal du site"><Textarea rows={2} maxLength={1000} value={form.objective} onChange={(e) => set('objective', e.target.value)} /></Field>
              <Field label="Public cible"><Textarea rows={2} maxLength={1000} value={form.audience} onChange={(e) => set('audience', e.target.value)} /></Field>
              <Field label="Message marketing principal"><Textarea rows={2} maxLength={1000} value={form.marketingMessage} onChange={(e) => set('marketingMessage', e.target.value)} /></Field>
              <Field label="Concurrents ou sites de référence"><Textarea rows={2} maxLength={2000} value={form.competitors} onChange={(e) => set('competitors', e.target.value)} /></Field>
              <Field label="Commentaires"><Textarea rows={3} maxLength={3000} value={form.comments} onChange={(e) => set('comments', e.target.value)} /></Field>
            </>
          ) : null}
          {step === 4 ? <Review form={form} files={files} sectorLabel={SECTORS_CONFIG.find((sector) => sector.key === form.sector)?.label[lang] ?? form.sector} onEdit={goTo} /> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="pj-wizard-actions">
            {step > 0 ? <Button variant="outline" onClick={() => goTo(step - 1)}><ArrowLeft size={16} />Retour</Button> : <span />}
            {step < 4 ? (
              <Button onClick={() => goTo(step + 1)}>Continuer<ArrowRight size={16} /></Button>
            ) : (
              <Button onClick={() => void submit()} disabled={busy || uploading > 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Envoyer ma demande de site</Button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}

const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>

function Toggles({ options, value, onChange }: { options: ReadonlyArray<readonly [string, string]>; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="pj-chips">
      {options.map(([id, label]) => {
        const on = value.includes(id)
        return <button key={id} type="button" aria-pressed={on} className={cn(on && 'is-on')} onClick={() => onChange(on ? value.filter((item) => item !== id) : [...value, id])}>{on ? <Check size={13} /> : null}{label}</button>
      })}
    </div>
  )
}

const labelsOf = (options: ReadonlyArray<readonly [string, string]>, ids: string[]) => ids.map((id) => options.find(([key]) => key === id)?.[1] ?? id).join(', ')

function Review({ form, files, sectorLabel, onEdit }: { form: Form; files: WebsiteFile[]; sectorLabel: string; onEdit: (step: number) => void }) {
  const features = [form.whatsapp && 'WhatsApp', form.contactForm && 'Formulaire de contact', form.googleMaps && 'Google Maps'].filter(Boolean).join(', ')
  const groups: Array<[string, number, Array<[string, string]>]> = [
    ['Entreprise', 0, [['Nom', form.company], ['Secteur', sectorLabel], ['Description', form.description], ['Contact', [form.contactName, form.phone, form.email].filter(Boolean).join(' · ')], ['Adresse', [form.address, form.city, form.country].filter(Boolean).join(', ')]]],
    ['Identité visuelle', 1, [['Style', STYLES.find(([id]) => id === form.style)?.[1] ?? form.style], ['Couleurs', form.colors], ['Fichiers', files.length ? String(files.length) : ''], ['Instructions', form.designNotes]]],
    ['Contenu', 2, [['Sections', labelsOf(SECTIONS, form.sections)], ['Langues', labelsOf(LANGUAGES, form.languages)], ['Fonctionnalités', features], ['Présentation', form.introduction]]],
    ['Objectifs', 3, [['Objectif', form.objective], ['Public cible', form.audience], ['Message', form.marketingMessage], ['Commentaires', form.comments]]],
  ]
  return (
    <div className="space-y-4">
      {groups.map(([title, index, rows]) => (
        <section key={title} className="pj-review">
          <header><h3>{title}</h3><button type="button" onClick={() => onEdit(index)}><Pencil size={13} />Modifier</button></header>
          <dl>{rows.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
      ))}
    </div>
  )
}

function Confirmation({ request }: { request: WebsiteSummary }) {
  return (
    <div className="mx-auto max-w-xl py-6">
      <Panel>
        <div className="p-7 text-center sm:p-10">
          <span className="pj-success"><CheckCircle2 size={30} /></span>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-ink-950">Votre demande de site web a bien été reçue !</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">Merci d’avoir choisi ALLNEEDS. Notre équipe prépare votre aperçu personnalisé.</p>
          <p className="pj-estimate"><Clock3 size={15} />Temps de préparation estimé : environ 30 minutes.</p>
          <p className="text-sm leading-relaxed text-ink-600">Vous recevrez une notification dans votre compte ALLNEEDS dès que votre aperçu sera disponible.</p>
          <p className="mt-4 text-xs text-ink-500">Référence {request.reference}</p>
          <Link to={`/sites-web/${request.id}` as never} className="mt-6 inline-block"><Button size="lg">Suivre ma demande<ArrowRight size={16} /></Button></Link>
        </div>
      </Panel>
    </div>
  )
}

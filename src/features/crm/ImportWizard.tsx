/*
 * Import de contacts CSV / Excel : lecture du fichier dans le navigateur, correspondance des colonnes,
 * validation serveur (erreurs, doublons), choix de la stratégie, import par lots avec progression.
 * Le serveur revalide chaque ligne : rien n'est enregistré sans contrôle côté backend.
 */
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { Alert, Badge, Button, Field, Modal, Select, Steps } from '@/components/ui'
import { crmSend, errorText, useCrm } from './core'

export const CRM_FIELDS: Array<{ key: string; label: string; synonyms: string[] }> = [
  { key: 'firstName', label: 'Prénom', synonyms: ['prenom', 'prénom', 'first name', 'firstname', 'first', 'given name'] },
  { key: 'lastName', label: 'Nom', synonyms: ['nom', 'last name', 'lastname', 'surname', 'nom de famille', 'family name'] },
  { key: 'fullName', label: 'Nom complet', synonyms: ['nom complet', 'full name', 'fullname', 'name', 'contact', 'raison sociale', 'entreprise', 'societe', 'société', 'company', 'etablissement', 'établissement'] },
  { key: 'phone', label: 'Téléphone', synonyms: ['telephone', 'téléphone', 'tel', 'tél', 'phone', 'mobile', 'gsm', 'portable', 'numero', 'numéro', 'phone number'] },
  { key: 'phone2', label: 'Téléphone 2', synonyms: ['telephone 2', 'téléphone 2', 'tel 2', 'phone 2', 'fixe', 'autre telephone', 'second phone'] },
  { key: 'email', label: 'E-mail', synonyms: ['email', 'e-mail', 'mail', 'courriel', 'adresse email', 'adresse e-mail'] },
  { key: 'address', label: 'Adresse', synonyms: ['adresse', 'address', 'rue', 'street', 'adresse postale'] },
  { key: 'city', label: 'Ville', synonyms: ['ville', 'city', 'commune', 'localite', 'localité', 'town'] },
  { key: 'region', label: 'Région', synonyms: ['region', 'région', 'province', 'state', 'departement', 'département'] },
  { key: 'postalCode', label: 'Code postal', synonyms: ['code postal', 'cp', 'postal code', 'zip', 'zipcode', 'code_postal'] },
  { key: 'country', label: 'Pays', synonyms: ['pays', 'country'] },
  { key: 'mainSector', label: 'Main_Sector', synonyms: ['main sector', 'mainsector', 'secteur principal', 'secteur', 'sector'] },
  { key: 'businessCategory', label: 'Business_Category', synonyms: ['business category', 'businesscategory', 'categorie business', 'categorie d activite', 'catégorie d’activité'] },
  { key: 'lat', label: 'Latitude', synonyms: ['latitude', 'lat'] },
  { key: 'lng', label: 'Longitude', synonyms: ['longitude', 'lng', 'lon', 'long'] },
  { key: 'notes', label: 'Notes', synonyms: ['notes', 'note', 'commentaire', 'commentaires', 'remarque', 'remarques', 'comment'] },
  { key: 'tags', label: 'Tags', synonyms: ['tags', 'tag', 'etiquettes', 'étiquettes', 'labels', 'categorie', 'catégorie'] },
]
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
const MAX_FILE_BYTES = 15 * 1024 * 1024

/** Analyse CSV tolérante : séparateur détecté (; , tabulation), guillemets, retours à la ligne. */
export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] || ''
  const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

async function readFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Fichier trop volumineux (15 Mo maximum).')
  const name = file.name.toLowerCase()
  let table: string[][]
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    const buf = await file.arrayBuffer()
    let text = new TextDecoder('utf-8').decode(buf)
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf)
    table = parseCsv(text.replace(/^﻿/, ''))
  } else if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    const data = (await readSheet(file)) as unknown as unknown[][]
    table = data.map((r) => r.map((c) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))))
  } else if (name.endsWith('.xls')) {
    throw new Error('Format .xls (Excel 97-2003) non pris en charge : enregistrez le fichier en .xlsx ou en .csv.')
  } else throw new Error('Format non pris en charge : utilisez un fichier .csv ou .xlsx.')
  if (table.length < 2) throw new Error('Le fichier doit contenir une ligne d’en-têtes et au moins une ligne de données.')
  const headers = table[0].map((h, i) => h.trim() || `Colonne ${i + 1}`)
  return { headers, rows: table.slice(1).map((r) => headers.map((_, i) => (r[i] ?? '').trim())) }
}

function guessMapping(headers: string[]): Record<number, string> {
  const used = new Set<string>()
  const out: Record<number, string> = {}
  headers.forEach((h, i) => {
    const n = norm(h)
    const f = CRM_FIELDS.find((f) => !used.has(f.key) && (norm(f.label) === n || f.synonyms.some((s) => norm(s) === n)))
    if (f) { out[i] = f.key; used.add(f.key) } else out[i] = `custom:${h}`
  })
  return out
}
const phoneKey = (v: string) => v.replace(/[^0-9]/g, '').replace(/^(00212|212|0)/, '')

/** Nom de base issu du nom du fichier, sans son extension. */
const baseNameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)

/** Crée la base au nom du fichier ; si ce nom est pris, ajoute (2), (3)… */
async function createBaseFromFile(fileName: string) {
  const base = baseNameFromFile(fileName)
  for (let n = 1; n <= 100; n++) {
    const suffix = n === 1 ? '' : ` (${n})`
    try {
      return await crmSend<{ id: string; name: string }>('/databases', 'POST', { name: `${base.slice(0, 120 - suffix.length).trim()}${suffix}`, source: fileName.slice(0, 120) })
    } catch (e) {
      if ((e as { status?: number }).status !== 409) throw e
    }
  }
  throw new Error('Impossible de trouver un nom disponible pour cette base.')
}

type CheckResult = { index: number; errors: string[]; warnings?: string[]; duplicateOf: { id: string; name: string; databaseName: string } | null }
type Summary = { inserted: number; updated: number; skipped: number; invalid: number; duplicates: number; status: string }

/** Sans `databaseId`, la base est créée au nom du fichier, seulement au moment de lancer l'import. */
export function ImportWizard({ databaseId, databaseName, onClose, onDone }: { databaseId?: string; databaseName?: string; onClose: () => void; onDone: () => void }) {
  const { me } = useCrm()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [strategy, setStrategy] = useState<'skip' | 'update' | 'create'>('skip')
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [createdName, setCreatedName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const mapped = useMemo(() => rows.map((r) => {
    const o: Record<string, unknown> = {}
    const custom: Record<string, string> = {}
    Object.entries(mapping).forEach(([i, key]) => {
      const v = r[Number(i)] ?? ''
      if (!key || key === 'ignore' || v === '') return
      if (key.startsWith('custom:')) custom[key.slice(7)] = v
      else o[key] = v
    })
    if (Object.keys(custom).length) o.custom = custom
    return o
  }), [rows, mapping])

  const inFileDuplicates = useMemo(() => {
    const seen = new Map<string, number>()
    const dups = new Set<number>()
    mapped.forEach((r, i) => {
      for (const k of [r.phone ? `p:${phoneKey(String(r.phone))}` : '', r.email ? `e:${String(r.email).toLowerCase()}` : ''].filter((k) => k.length > 4)) {
        if (seen.has(k)) dups.add(i)
        else seen.set(k, i)
      }
    })
    return dups
  }, [mapped])

  async function pick(f: File | undefined) {
    if (!f) return
    setError('')
    setBusy(true)
    try {
      if (!databaseId && !baseNameFromFile(f.name)) throw new Error('Le nom du fichier ne permet pas de nommer la base.')
      const { headers, rows } = await readFile(f)
      setFile(f); setHeaders(headers); setRows(rows); setMapping(guessMapping(headers)); setChecks(null); setStep(1)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function validate() {
    const keys = new Set(Object.values(mapping))
    if (!keys.has('phone') && !keys.has('email')) { setError('Associez au moins une colonne au téléphone ou à l’e-mail.'); return }
    if (!keys.has('fullName') && !keys.has('firstName') && !keys.has('lastName')) { setError('Associez au moins une colonne au nom du contact.'); return }
    setError('')
    setBusy(true)
    setProgress(0)
    try {
      const out: CheckResult[] = []
      for (let i = 0; i < mapped.length; i += 500) {
        const r = await crmSend<{ results: CheckResult[] }>('/imports/check', 'POST', { databaseId, rows: mapped.slice(i, i + 500), offset: i })
        out.push(...r.results)
        setProgress(Math.round(((i + 500) / mapped.length) * 100))
      }
      setChecks(out)
      setStep(2)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const invalid = checks?.filter((c) => c.errors.length) || []
  const existingDup = checks?.filter((c) => !c.errors.length && c.duplicateOf) || []
  const adjusted = checks?.filter((c) => !c.errors.length && c.warnings?.length) || []
  const importable = mapped.map((r, i) => ({ r, i })).filter(({ i }) => !checks?.[i]?.errors.length && !inFileDuplicates.has(i))

  // Une nouvelle base ne doit pas rester vide quand tout le fichier existe déjà.
  const nothingNew = !databaseId && strategy !== 'create' && importable.length > 0 && importable.every(({ i }) => checks?.[i]?.duplicateOf)

  async function runImport() {
    setBusy(true)
    setError('')
    setProgress(0)
    let jobId = ''
    let targetId = databaseId
    let createdId = ''
    let sentRows = false
    try {
      if (!targetId && file) {
        const created = await createBaseFromFile(file.name)
        targetId = createdId = created.id
        setCreatedName(created.name)
      }
      const job = await crmSend<{ id: string }>('/imports', 'POST', { databaseId: targetId, fileName: file?.name, total: importable.length, duplicateStrategy: strategy, mapping: Object.fromEntries(Object.entries(mapping).map(([i, k]) => [headers[Number(i)], k])) })
      jobId = job.id
      setStep(3)
      for (let i = 0; i < importable.length; i += 300) {
        sentRows = true
        await crmSend(`/imports/${job.id}/rows`, 'POST', { rows: importable.slice(i, i + 300).map((x) => x.r), offset: i })
        setProgress(Math.min(100, Math.round(((i + 300) / importable.length) * 100)))
      }
      const done = await crmSend<Summary>(`/imports/${job.id}/complete`, 'POST', {})
      setSummary(done)
      onDone()
    } catch (e) {
      setError(errorText(e))
      if (jobId) await crmSend(`/imports/${jobId}/fail`, 'POST', { error: errorText(e) }).catch(() => undefined)
      if (createdId && !sentRows) {
        await crmSend(`/databases/${createdId}?hard=1`, 'DELETE').catch(() => undefined)
        setCreatedName('')
        setStep(2)
      }
    } finally {
      setBusy(false)
    }
  }

  const preview = mapped.slice(0, 8)
  const usedFields = [...new Set(Object.values(mapping).filter((k) => k && k !== 'ignore'))]

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={databaseId ? `Importer des contacts · ${databaseName}` : 'Nouvelle base depuis un fichier Excel'} description={databaseId ? 'CSV ou Excel (.xlsx). L’ordre des colonnes n’a pas d’importance.' : 'La base prendra automatiquement le nom du fichier.'} size="lg">
      <div className="space-y-5">
        <Steps steps={['Fichier', 'Colonnes', 'Vérification', 'Import']} current={step} />
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {!databaseId && file && step > 0 ? <p className="text-sm text-ink-600">{createdName ? 'Base créée :' : 'Nom de la nouvelle base :'} <b className="text-ink-950">{createdName || baseNameFromFile(file.name)}</b></p> : null}

        {step === 0 ? (
          <div
            className="crm-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]) }}
          >
            <FileSpreadsheet size={28} />
            <p className="font-semibold text-ink-900">Glissez votre fichier ici</p>
            <p className="text-xs text-ink-500">.csv (séparateur ; , ou tabulation) ou .xlsx · 15 Mo maximum · 1re ligne = en-têtes</p>
            <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
            <Button disabled={busy} onClick={() => inputRef.current?.click()}><Upload size={15} />{busy ? 'Lecture…' : 'Choisir un fichier'}</Button>
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-sm text-ink-600"><b>{rows.length}</b> ligne(s) lue(s) dans <b>{file?.name}</b>. Vérifiez à quel champ du CRM correspond chaque colonne.</p>
            <div className="crm-mapping">
              {headers.map((h, i) => (
                <div key={i} className="crm-mapping-row">
                  <span className="truncate"><b>{h}</b><small>{rows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ') || 'vide'}</small></span>
                  <Select aria-label={`Champ pour ${h}`} value={mapping[i] || 'ignore'} onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}>
                    <option value="ignore">Ignorer cette colonne</option>
                    {CRM_FIELDS.map((f) => <option key={f.key} value={f.key} disabled={usedFields.includes(f.key) && mapping[i] !== f.key}>{f.label}</option>)}
                    <option value={`custom:${h}`}>Champ personnalisé « {h} »</option>
                  </Select>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-ink-100">
              <table className="crm-table crm-table-compact">
                <thead><tr>{usedFields.map((k) => <th key={k}>{k.startsWith('custom:') ? k.slice(7) : CRM_FIELDS.find((f) => f.key === k)?.label}</th>)}</tr></thead>
                <tbody>{preview.map((r, i) => <tr key={i}>{usedFields.map((k) => <td key={k}>{k.startsWith('custom:') ? (r.custom as Record<string, string>)?.[k.slice(7)] : String(r[k] ?? '')}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>Changer de fichier</Button>
              <Button disabled={busy} onClick={() => void validate()}>{busy ? `Vérification… ${progress} %` : 'Vérifier les données'}</Button>
            </div>
          </>
        ) : null}

        {step === 2 && checks ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="crm-import-stat is-ok"><b>{importable.length}</b><span>lignes importables</span></div>
              <div className="crm-import-stat is-bad"><b>{invalid.length}</b><span>lignes invalides</span></div>
              <div className="crm-import-stat is-warn"><b>{existingDup.length}</b><span>déjà dans le CRM</span></div>
              <div className="crm-import-stat is-warn"><b>{inFileDuplicates.size}</b><span>doublons dans le fichier</span></div>
            </div>
            {invalid.length ? (
              <details className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm" open={invalid.length <= 10}>
                <summary className="cursor-pointer font-semibold text-red-700"><AlertTriangle size={14} className="mr-1 inline" />{invalid.length} ligne(s) seront ignorées</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-800">{invalid.slice(0, 200).map((c) => <li key={c.index}>Ligne {c.index + 2} : {c.errors.join(', ')}</li>)}</ul>
              </details>
            ) : null}
            {adjusted.length ? (
              <details className="rounded-xl border border-ink-200 p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-ink-800">{adjusted.length} ligne(s) importée(s) avec ajustement</summary>
                <p className="mt-2 text-xs text-ink-600">Les e-mails invalides restent visibles dans le champ « E-mail à vérifier ».</p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink-700">{adjusted.slice(0, 200).map((c) => <li key={c.index}>Ligne {c.index + 2} : {c.warnings?.join(', ')}</li>)}</ul>
              </details>
            ) : null}
            {inFileDuplicates.size ? <Alert tone="info">Les doublons internes au fichier (même téléphone ou e-mail) ne sont importés qu’une fois : la première ligne est conservée.</Alert> : null}
            {existingDup.length ? (
              <Field label={`Que faire des ${existingDup.length} contact(s) déjà présents dans le CRM ?`}>
                <Select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
                  <option value="skip">Les ignorer (recommandé)</option>
                  <option value="update">Mettre à jour la fiche existante avec les nouvelles informations</option>
                  {me?.isAdmin ? <option value="create">Les importer quand même (créer des doublons)</option> : null}
                </Select>
              </Field>
            ) : null}
            {existingDup.length ? <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-ink-600">{existingDup.slice(0, 50).map((c) => <li key={c.index}>Ligne {c.index + 2} ≈ <b>{c.duplicateOf?.name}</b> ({c.duplicateOf?.databaseName})</li>)}</ul> : null}
            {nothingNew ? <Alert tone="warning">Tous ces contacts existent déjà dans le CRM. Aucune base n’a été créée : importez un autre fichier.</Alert> : null}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Revoir les colonnes</Button>
              <Button disabled={busy || !importable.length || nothingNew} onClick={() => void runImport()}>Importer {importable.length} contact(s)</Button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          summary ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
              <p className="font-display text-xl font-bold text-ink-950">Import terminé</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge tone="success">{summary.inserted} ajoutés</Badge>
                <Badge tone="info">{summary.updated} mis à jour</Badge>
                <Badge tone="neutral">{summary.skipped} doublons ignorés</Badge>
                {summary.invalid || invalid.length ? <Badge tone="danger">{summary.invalid + invalid.length} invalides</Badge> : null}
                {inFileDuplicates.size ? <Badge tone="warning">{inFileDuplicates.size} doublons du fichier</Badge> : null}
              </div>
              <Button onClick={onClose}>Fermer</Button>
            </div>
          ) : (
            <div className="space-y-3 py-6 text-center">
              <p className="font-semibold text-ink-900">Import en cours… {progress} %</p>
              <div className="crm-progress"><i style={{ width: `${progress}%` }} /></div>
              <p className="text-xs text-ink-500">Ne fermez pas cette fenêtre.</p>
            </div>
          )
        ) : null}
      </div>
    </Modal>
  )
}

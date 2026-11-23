import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, ArrowLeft, Contact as ContactIcon, History, Pencil, PhoneCall, Trash2, Upload, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button } from '@/components/ui'
import { EmptyBox, LoadingRows, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { ConfirmDialog, ExportButtons, Info, RequirePermission, StatusPill, crmGet, crmSend, errorText, fmtDate, fmtDateTime, useCrm, useCrmQuery, useNotify, type Contact } from '@/features/crm/core'
import { ImportWizard } from '@/features/crm/ImportWizard'
import { DatabaseModal, type DatabaseRow } from './index'

export const Route = createFileRoute('/crm/bases/$id')({ component: () => <RequirePermission perm="contacts.view"><DatabaseDetail /></RequirePermission> })

type Detail = DatabaseRow & { history: Array<{ at: string; byName: string; action: string }>; imports: Array<{ id: string; fileName: string; status: string; total: number; inserted: number; updated: number; skipped: number; invalid: number; duplicates: number; createdAt: string; errors: Array<{ row: number; error: string }> }> }

function DatabaseDetail() {
  const { id } = Route.useParams()
  const { me, can, refreshLookups } = useCrm()
  const navigate = useNavigate()
  const notify = useNotify()
  const isAdmin = Boolean(me?.isAdmin)
  const { data, loading, error, reload } = useCrmQuery<Detail>(`/databases/${id}`)
  const [editing, setEditing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <LoadingRows count={6} />
  if (error || !data) return <EmptyBox icon={<ContactIcon size={20} />} title="Base introuvable" text={error} action={<Link to={'/crm/bases' as any}><Button size="sm" variant="outline">Retour aux bases</Button></Link>} />

  async function runConfirm() {
    setBusy(true)
    try {
      await crmSend(`/databases/${id}${confirm === 'delete' ? '?hard=1' : ''}`, 'DELETE')
      notify(confirm === 'delete' ? 'Base supprimée' : 'Base archivée')
      await refreshLookups()
      if (confirm === 'delete') void navigate({ to: '/crm/bases' as any })
      else { setConfirm(null); await reload() }
    } catch (e) {
      notify('Action impossible', 'warning', errorText(e))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }
  const progress = data.totalContacts ? Math.round((data.contactsCalled / data.totalContacts) * 100) : 0

  return (
    <div>
      <PageHeader
        eyebrow="Base de contacts"
        title={data.name}
        description={data.description || [data.source, data.campaignName && `Campagne ${data.campaignName}`].filter(Boolean).join(' · ') || 'Aucune description.'}
        actions={
          <>
            <Link to={'/crm/bases' as any}><Button size="sm" variant="outline"><ArrowLeft size={14} />Bases</Button></Link>
            <Link to={'/crm/contacts' as any} search={{ databaseId: id } as any}><Button size="sm" variant="outline"><ContactIcon size={14} />Contacts</Button></Link>
            {data.canImport && data.status !== 'archived' ? <Button size="sm" onClick={() => setImporting(true)}><Upload size={14} />Importer</Button> : null}
          </>
        }
      />
      <StatGrid>
        <MiniStat icon={<ContactIcon size={18} />} tone="indigo" label="Contacts" value={data.totalContacts} hint={`${data.contactsRemaining} restant(s) à appeler`} />
        <MiniStat icon={<PhoneCall size={18} />} tone="sky" label="Contacts appelés" value={data.contactsCalled} ratio={data.totalContacts ? data.contactsCalled / data.totalContacts : 0} hint={`${progress} % de la base`} />
        <MiniStat icon={<UsersRound size={18} />} tone="emerald" label="Contacts joints" value={data.contactsReached} ratio={data.contactsCalled ? data.contactsReached / data.contactsCalled : 0} />
        <MiniStat icon={<History size={18} />} tone="amber" label="Rendez-vous" value={data.appointmentsBooked} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Informations" action={isAdmin ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={13} />Modifier</Button> : undefined}>
          <dl className="crm-info-grid p-5">
            <Info label="Statut"><StatusPill kind="database" value={data.status} /></Info>
            <Info label="Source">{data.source}</Info>
            <Info label="Campagne">{data.campaignName}</Info>
            <Info label="Zone">{data.zoneName}</Info>
            <Info label="Agents assignés">{data.agentNames.join(', ')}</Info>
            <Info label="Dernier import">{data.importedAt ? fmtDateTime(data.importedAt) : ''}</Info>
            <Info label="Créée par">{data.createdByName}</Info>
            <Info label="Créée le">{fmtDate(data.createdAt)}</Info>
            <Info label="Mise à jour">{fmtDateTime(data.updatedAt)}</Info>
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-ink-100 p-4">
            {can('contacts.export') ? <ExportButtons name={`contacts-${data.name}`} getData={async () => { const r = await crmGet<{ rows: Contact[] }>('/contacts/export', { databaseId: id }); return { columns: EXPORT_COLUMNS.map((c) => c[1]), rows: r.rows.map((c) => EXPORT_COLUMNS.map(([k]) => exportValue(c, k))) } }} /> : null}
            {isAdmin && data.status !== 'archived' ? <Button size="sm" variant="ghost" onClick={() => setConfirm('archive')}><Archive size={14} />Archiver</Button> : null}
            {data.canDelete ? <Button size="sm" variant="ghost" onClick={() => setConfirm('delete')}><Trash2 size={14} className="text-red-600" />Supprimer</Button> : null}
          </div>
        </Panel>

        <div className="space-y-5">
          {can('imports.run') ? (
            <Panel title="Imports" description="Historique des fichiers importés dans cette base.">
              {!data.imports.length ? <EmptyBox icon={<Upload size={20} />} title="Aucun import" text="Importez un fichier CSV ou Excel." action={data.canImport && data.status !== 'archived' ? <Button size="sm" onClick={() => setImporting(true)}><Upload size={14} />Importer</Button> : undefined} /> : null}
              <Rows>
                {data.imports.map((i) => (
                  <li key={i.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-ink-950">{i.fileName}</span><Badge tone={i.status === 'completed' ? 'success' : i.status === 'failed' ? 'danger' : 'warning'}>{i.status === 'completed' ? 'Terminé' : i.status === 'failed' ? 'Échec' : i.status === 'running' ? 'En cours' : 'Partiel'}</Badge></div>
                    <p className="text-xs text-ink-500">{fmtDateTime(i.createdAt)} · {i.inserted} ajoutés · {i.updated} mis à jour · {i.skipped} ignorés · {i.invalid} invalides</p>
                    {i.errors?.length ? <details className="mt-1 text-xs text-red-700"><summary className="cursor-pointer">{i.errors.length} erreur(s)</summary><ul className="mt-1 max-h-28 overflow-y-auto">{i.errors.slice(0, 100).map((e) => <li key={e.row}>Ligne {e.row} : {e.error}</li>)}</ul></details> : null}
                  </li>
                ))}
              </Rows>
            </Panel>
          ) : null}
          <Panel title="Historique" description="Création, modifications, imports et archivage.">
            {!data.history.length ? <EmptyBox icon={<History size={20} />} title="Aucun historique" /> : null}
            <Rows>
              {[...data.history].reverse().slice(0, 40).map((h, i) => <li key={i} className="px-5 py-2.5 text-sm"><span className="text-ink-900">{h.action}</span><span className="block text-xs text-ink-500">{fmtDateTime(h.at)} · {h.byName}</span></li>)}
            </Rows>
          </Panel>
        </div>
      </div>

      {editing ? <DatabaseModal database={data} onClose={() => setEditing(false)} onSaved={async () => { await reload(); await refreshLookups() }} /> : null}
      {importing ? <ImportWizard databaseId={id} databaseName={data.name} onClose={() => setImporting(false)} onDone={() => void reload()} /> : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        busy={busy}
        danger
        title={confirm === 'delete' ? 'Supprimer définitivement cette base ?' : 'Archiver cette base ?'}
        confirmLabel={confirm === 'delete' ? 'Supprimer' : 'Archiver'}
        text={confirm === 'delete' ? <><b>{data.name}</b> · {data.totalContacts} contact(s)<br />Cette base et ses contacts seront supprimés définitivement. Cette action est irréversible. Si des appels ou rendez-vous existent, la suppression sera refusée.</> : <>La base <b>{data.name}</b> ne sera plus proposée aux agents. Ses contacts et son historique sont conservés.</>}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />
      {data.status === 'archived' ? <Alert tone="info" className="mt-5">Cette base est archivée : elle reste consultable mais n’est plus proposée aux agents.</Alert> : null}
    </div>
  )
}

export const EXPORT_COLUMNS: Array<[keyof Contact | 'tagsText' | 'customText', string]> = [
  ['fullName', 'Nom complet'], ['firstName', 'Prénom'], ['lastName', 'Nom'], ['phone', 'Téléphone'], ['phone2', 'Téléphone 2'], ['email', 'E-mail'], ['address', 'Adresse'], ['city', 'Ville'], ['region', 'Région'], ['postalCode', 'Code postal'], ['country', 'Pays'], ['lat', 'Latitude'], ['lng', 'Longitude'],
  ['databaseName', 'Base de contacts'], ['campaignName', 'Campagne'], ['agentName', 'Agent'], ['status', 'Statut'], ['callStatus', 'Statut d’appel'], ['tagsText', 'Tags'], ['notes', 'Notes'], ['lastContactAt', 'Dernier contact'], ['nextCallbackAt', 'Prochain rappel'], ['createdAt', 'Créé le'], ['customText', 'Champs personnalisés'],
]
export function exportValue(c: Contact, k: string): unknown {
  if (k === 'tagsText') return (c.tags || []).join(', ')
  if (k === 'customText') return Object.entries(c.custom || {}).map(([a, b]) => `${a}: ${b}`).join(' | ')
  return (c as Record<string, unknown>)[k] ?? ''
}

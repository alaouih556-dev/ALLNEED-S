import { useEffect, useState } from 'react'
import { Building2, Copy, Mail, Pencil, Power, RefreshCcw, Send, UserPlus, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Avatar, Badge, Button, Checkbox, Field, Input, Modal } from '@/components/ui'
import { EmptyBox, MiniStat, Panel, Rows, SearchBox, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { isSectorActive } from '@/lib/active-sectors'
import { SECTOR_KEYS } from '@/lib/sectors'
import { SECTOR_LABEL } from '@/data/catalog'
import { cn } from '@/lib/utils'

type Org = { id: string; name: string; sector: string }
type Concierge = { id: string; name: string; email: string; active?: boolean; sectors?: string[]; orgIds?: string[] }
type Pending = { id: string; name: string; email: string; expiresAt: string; lastEmailStatus?: string; metadata?: { sectors?: string[]; assignedOrgIds?: string[] } }
type Payload = { concierges: Concierge[]; pending: Pending[]; orgs: Org[] }

export function AdminRealConcierges() {
  const [data, setData] = useState<Payload>({ concierges: [], pending: [], orgs: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<Concierge | null>(null)

  async function load() {
    setError('')
    try {
      const r = await fetch('/api/admin/account-managers', { credentials: 'same-origin', cache: 'no-store' })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Chargement impossible')
      setData({ ...b, orgs: (b.orgs ?? []).filter((o: Org) => isSectorActive(o.sector)) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    setError('')
    const r = await fetch(`/api/admin/account-managers/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const b = await r.json()
    if (!r.ok) { setError(b.error || 'Modification impossible'); return false }
    await load()
    return true
  }

  const active = data.concierges.filter((c) => c.active !== false)
  const visible = data.concierges.filter((c) => matches(query, c.name, c.email))
  const orgName = (id: string) => data.orgs.find((o) => o.id === id)?.name

  return (
    <>
      <PageHeader
        eyebrow="Équipe"
        title="Account Managers"
        description="Les Account Managers accompagnent les clients. Invitez-les, puis choisissez les entreprises qu’ils suivent."
        actions={<>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} />Inviter un Account Manager</Button>
        </>}
      />

      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Account Managers actifs" value={active.length} />
        <MiniStat icon={<Send size={18} />} tone="amber" label="Invitations en attente" value={data.pending.length} />
        <MiniStat icon={<Building2 size={18} />} tone="sky" label="Entreprises suivies" value={new Set(active.flatMap((c) => c.orgIds ?? [])).size} hint={`sur ${data.orgs.length}`} />
        <MiniStat icon={<Power size={18} />} tone="slate" label="Comptes désactivés" value={data.concierges.length - active.length} />
      </StatGrid>

      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {info ? <Alert tone="success" className="mb-4">{info}</Alert> : null}

      {data.pending.length ? (
        <Panel title="Invitations envoyées" description="Ces personnes n’ont pas encore créé leur mot de passe." className="mb-6">
          <Rows>
            {data.pending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Mail size={17} /></span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-950">{i.name}</p>
                    <p className="truncate text-xs text-ink-500">{i.email} · valable jusqu’au {new Date(i.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <Badge tone={i.lastEmailStatus === 'failed' ? 'danger' : 'warning'}>{i.lastEmailStatus === 'failed' ? 'E-mail en échec' : 'En attente'}</Badge>
              </li>
            ))}
          </Rows>
        </Panel>
      ) : null}

      <Panel>
        <Toolbar>
          <p className="text-sm font-semibold text-ink-900">Équipe <span className="font-normal text-ink-500">· {data.concierges.length}</span></p>
          <SearchBox value={query} onChange={setQuery} placeholder="Nom ou e-mail…" />
        </Toolbar>
        {!loading && !visible.length ? (
          <EmptyBox icon={<UsersRound size={20} />} title="Aucun Account Manager" text="Invitez votre premier Account Manager : il recevra un e-mail pour créer son mot de passe." action={<Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} />Inviter un Account Manager</Button>} />
        ) : null}
        <Rows>
          {visible.map((c) => {
            const off = c.active === false
            const orgs = (c.orgIds ?? []).map(orgName).filter(Boolean) as string[]
            return (
              <li key={c.id} className={cn('grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center', off && 'opacity-60')}>
                <div className="flex min-w-0 gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink-950">{c.name}</p>
                      <Badge tone={off ? 'neutral' : 'success'}>{off ? 'Désactivé' : 'Actif'}</Badge>
                    </div>
                    <p className="truncate text-sm text-ink-500">{c.email}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {orgs.length ? orgs.map((o) => <span key={o} className="rounded-md bg-ink-100 px-2 py-0.5 text-[0.7rem] font-medium text-ink-700">{o}</span>) : <span className="text-xs text-ink-400">Aucune entreprise attribuée</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil size={13} />Périmètre</Button>
                  <Button size="sm" variant="ghost" onClick={() => void patch(c.id, { active: off })}><Power size={13} />{off ? 'Réactiver' : 'Désactiver'}</Button>
                </div>
              </li>
            )
          })}
        </Rows>
      </Panel>

      <InviteModal
        open={inviteOpen}
        orgs={data.orgs}
        onClose={() => setInviteOpen(false)}
        onDone={async (email) => { setInviteOpen(false); setInfo(`Invitation envoyée à ${email}.`); await load() }}
      />
      {editing ? (
        <PerimeterModal
          concierge={editing}
          orgs={data.orgs}
          onClose={() => setEditing(null)}
          onSave={async (body) => { if (await patch(editing.id, body)) { setEditing(null); setInfo('Périmètre mis à jour.') } }}
        />
      ) : null}
    </>
  )
}

function OrgPicker({ orgs, value, onChange }: { orgs: Org[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!orgs.length) return <p className="rounded-xl bg-ink-50 px-3 py-3 text-sm text-ink-500">Aucune entreprise pour l’instant. Vous pourrez en attribuer plus tard.</p>
  return (
    <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-ink-100 p-3">
      {orgs.map((o) => <Checkbox key={o.id} label={o.name} checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...new Set([...value, o.id])] : value.filter((x) => x !== o.id))} />)}
    </div>
  )
}

function InviteModal({ open, orgs, onClose, onDone }: { open: boolean; orgs: Org[]; onClose: () => void; onDone: (email: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [orgIds, setOrgIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fallback, setFallback] = useState<{ email: string; setupUrl: string; reason: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const valid = name.trim().length > 1 && /.+@.+\..+/.test(email)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setBusy(true); setError('')
    try {
      const sectors = SECTOR_KEYS
      const r = await fetch('/api/admin/account-managers', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), sectors, assignedOrgIds: orgIds }) })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Création impossible')
      const sent = email.trim()
      if (!b.delivery?.sent) {
        // L’invitation existe : on donne le lien personnel à transmettre à la main.
        if (!b.delivery?.setupUrl) throw new Error(b.delivery?.error || 'Compte préparé, mais l’e-mail n’est pas parti. Vérifiez la configuration SMTP.')
        setName(''); setEmail(''); setOrgIds([])
        setFallback({ email: sent, setupUrl: b.delivery.setupUrl, reason: smtpReason(b.delivery.error) })
        return
      }
      setName(''); setEmail(''); setOrgIds([])
      await onDone(sent)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible')
    } finally {
      setBusy(false)
    }
  }

  if (fallback) {
    const finish = async () => { const done = fallback.email; setFallback(null); setCopied(false); await onDone(done) }
    return (
      <Modal open={open} onClose={() => void finish()} title="Invitation créée" description={`Le compte de ${fallback.email} est prêt, mais l’e-mail n’a pas pu partir.`}>
        <div className="space-y-4">
          <Alert tone="warning" title="E-mail non envoyé">{fallback.reason}</Alert>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Lien personnel de création du mot de passe (valable 48 h, usage unique)</p>
            <code className="block break-all rounded-xl border border-ink-100 bg-ink-50 p-3 text-xs" data-no-translate>{fallback.setupUrl}</code>
            <p className="mt-2 text-xs text-ink-500">Transmettez-le à l’Account Manager par un canal sûr (WhatsApp, SMS…). Ne le partagez avec personne d’autre.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button type="button" variant="outline" onClick={() => { void navigator.clipboard?.writeText(fallback.setupUrl).then(() => setCopied(true)) }}><Copy size={14} />{copied ? 'Lien copié' : 'Copier le lien'}</Button>
            <Button type="button" onClick={() => void finish()}>Terminé</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Inviter un Account Manager" description="Il recevra un e-mail pour créer son mot de passe.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom complet" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" autoFocus /></Field>
        <Field label="E-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@allneeds.ma" /></Field>
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-700">Entreprises à suivre <span className="font-normal text-ink-400">(facultatif)</span></p>
          <OrgPicker orgs={orgs} value={orgIds} onChange={setOrgIds} />
        </div>
        <p className="text-xs text-ink-500">Secteurs autorisés : <span>tous les secteurs</span></p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!valid || busy}><Send size={14} />{busy ? 'Envoi…' : 'Envoyer l’invitation'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Message lisible pour les erreurs SMTP les plus courantes. */
function smtpReason(error?: string) {
  if (!error) return 'Le serveur d’e-mail n’a pas répondu. Vérifiez la configuration SMTP.'
  if (/SMTP 535|BadCredentials/i.test(error)) return 'Gmail a refusé l’identifiant d’envoi (EMAIL_USER / EMAIL_PASS dans .env). Créez un nouveau mot de passe d’application Google, puis redémarrez le serveur.'
  if (/non configuré/i.test(error)) return 'L’envoi d’e-mails n’est pas configuré (EMAIL_HOST dans .env).'
  return error
}

function PerimeterModal({ concierge, orgs, onClose, onSave }: { concierge: Concierge; orgs: Org[]; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [orgIds, setOrgIds] = useState<string[]>(concierge.orgIds ?? [])
  const [sectors, setSectors] = useState<string[]>(concierge.sectors?.length ? concierge.sectors : SECTOR_KEYS)
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={onClose} title={`Périmètre de ${concierge.name}`} description="Choisissez les entreprises que cet Account Manager peut suivre.">
      <div className="space-y-4">
        <OrgPicker orgs={orgs} value={orgIds} onChange={setOrgIds} />
        <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Secteurs autorisés</p>
            <div className="flex flex-wrap gap-4">{SECTOR_KEYS.map((s) => <Checkbox key={s} label={SECTOR_LABEL[s]} checked={sectors.includes(s)} onChange={(e) => setSectors(e.target.checked ? [...new Set([...sectors, s])] : sectors.filter((x) => x !== s))} />)}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button disabled={busy} onClick={async () => { setBusy(true); await onSave({ orgIds: [...new Set([...(concierge.orgIds ?? []).filter((id) => !orgs.some((o) => o.id === id)), ...orgIds])], sectors: [...new Set([...(concierge.sectors ?? []).filter((s) => !isSectorActive(s)), ...sectors])] }); setBusy(false) }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </div>
    </Modal>
  )
}

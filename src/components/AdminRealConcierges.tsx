import { useEffect, useState } from 'react'
import { Building2, Mail, Pencil, Power, RefreshCcw, Send, UserPlus, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Avatar, Badge, Button, Checkbox, Field, Input, Modal } from '@/components/ui'
import { EmptyBox, MiniStat, Panel, Rows, SearchBox, StatGrid, Toolbar, matches } from '@/components/admin-kit'
import { ACTIVE_SECTORS, SINGLE_SECTOR, isSectorActive } from '@/lib/active-sectors'
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
      const r = await fetch('/api/admin/concierges', { credentials: 'same-origin', cache: 'no-store' })
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
    const r = await fetch(`/api/admin/concierges/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
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
        title="Concierges"
        description="Les concierges accompagnent les clients. Invitez-les, puis choisissez les entreprises qu’ils suivent."
        actions={<>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }}><RefreshCcw size={14} className={cn(loading && 'animate-spin')} />Actualiser</Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} />Inviter un concierge</Button>
        </>}
      />

      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Concierges actifs" value={active.length} />
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
          <EmptyBox icon={<UsersRound size={20} />} title="Aucun concierge" text="Invitez votre premier concierge : il recevra un e-mail pour créer son mot de passe." action={<Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} />Inviter un concierge</Button>} />
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
  const valid = name.trim().length > 1 && /.+@.+\..+/.test(email)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setBusy(true); setError('')
    try {
      // Le concierge est autorisé sur les secteurs actifs (aujourd’hui : Santé).
      const sectors = ACTIVE_SECTORS
      const r = await fetch('/api/admin/concierges', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), sectors, assignedOrgIds: orgIds }) })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Création impossible')
      if (!b.delivery?.sent) throw new Error(b.delivery?.error || 'Compte préparé, mais l’e-mail n’est pas parti. Vérifiez la configuration SMTP.')
      const sent = email.trim()
      setName(''); setEmail(''); setOrgIds([])
      await onDone(sent)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Inviter un concierge" description="Il recevra un e-mail pour créer son mot de passe.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom complet" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" autoFocus /></Field>
        <Field label="E-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@allneeds.ma" /></Field>
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-700">Entreprises à suivre <span className="font-normal text-ink-400">(facultatif)</span></p>
          <OrgPicker orgs={orgs} value={orgIds} onChange={setOrgIds} />
        </div>
        {!SINGLE_SECTOR ? <p className="text-xs text-ink-500">Secteurs autorisés : {ACTIVE_SECTORS.map((s) => SECTOR_LABEL[s]).join(', ')}</p> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!valid || busy}><Send size={14} />{busy ? 'Envoi…' : 'Envoyer l’invitation'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function PerimeterModal({ concierge, orgs, onClose, onSave }: { concierge: Concierge; orgs: Org[]; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [orgIds, setOrgIds] = useState<string[]>(concierge.orgIds ?? [])
  const [sectors, setSectors] = useState<string[]>(concierge.sectors?.length ? concierge.sectors : ACTIVE_SECTORS)
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={onClose} title={`Périmètre de ${concierge.name}`} description="Choisissez les entreprises que ce concierge peut suivre.">
      <div className="space-y-4">
        <OrgPicker orgs={orgs} value={orgIds} onChange={setOrgIds} />
        {!SINGLE_SECTOR ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-700">Secteurs autorisés</p>
            <div className="flex flex-wrap gap-4">{ACTIVE_SECTORS.map((s) => <Checkbox key={s} label={SECTOR_LABEL[s]} checked={sectors.includes(s)} onChange={(e) => setSectors(e.target.checked ? [...new Set([...sectors, s])] : sectors.filter((x) => x !== s))} />)}</div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button disabled={busy} onClick={async () => { setBusy(true); await onSave({ orgIds: [...new Set([...(concierge.orgIds ?? []).filter((id) => !orgs.some((o) => o.id === id)), ...orgIds])], sectors: [...new Set([...(concierge.sectors ?? []).filter((s) => !isSectorActive(s)), ...sectors])] }); setBusy(false) }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Activity, KeyRound, Mail, Pencil, Power, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Checkbox, Field, Input, Modal, Select } from '@/components/ui'
import { EmptyBox, MiniStat, StatGrid } from '@/components/admin-kit'
import { ConfirmDialog, DataTable, FilterBar, MultiPick, RequirePermission, StatusPill, crmGet, crmSend, errorText, fmtDateTime, useCrm, useCrmQuery, useFilterState, useNotify, type Column, type CrmUser, type Page } from '@/features/crm/core'
import { PERMISSION_LABELS } from '@/features/crm/permissions'
import { actionLabel } from './index'

export const Route = createFileRoute('/crm/utilisateurs')({ component: () => <RequirePermission perm="users.manage"><UsersPage /></RequirePermission> })

type UsersPage = Page<CrmUser> & { roles: Array<{ key: string; label: string }> }
type Delivery = { sent: boolean; setupUrl?: string; error?: string } | null

function UsersPage() {
  const { lookups, me, refreshLookups } = useCrm()
  const notify = useNotify()
  const [values, setValues] = useFilterState({ pageSize: '25' })
  const { data, loading, error, reload } = useCrmQuery<UsersPage>('/users', values)
  const [editing, setEditing] = useState<CrmUser | 'new' | null>(null)
  const [activityOf, setActivityOf] = useState<CrmUser | null>(null)
  const [resetOf, setResetOf] = useState<CrmUser | null>(null)
  const [confirm, setConfirm] = useState<{ user: CrmUser; action: 'toggle' | 'suspend' | 'delete' } | null>(null)
  const [busy, setBusy] = useState(false)
  const roles = data?.roles || [{ key: 'admin', label: 'Administrateur' }, { key: 'agent', label: 'Agent' }]
  const nameOf = (list: Array<{ id: string; name: string }> | undefined, ids: string[]) => ids.map((id) => list?.find((x) => x.id === id)?.name).filter(Boolean).join(', ')

  const filters = [
    { key: 'role', label: 'Rôle', options: roles.map((r) => ({ value: r.key, label: r.label })) },
    { key: 'status', label: 'Statut', options: [{ value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Désactivé' }, { value: 'suspended', label: 'Suspendu' }] },
    { key: 'campaignId', label: 'Campagne', options: (lookups?.campaigns || []).map((c) => ({ value: c.id, label: c.name })) },
    { key: 'databaseId', label: 'Base de contacts', options: (lookups?.databases || []).map((c) => ({ value: c.id, label: c.name })) },
  ]

  async function runConfirm() {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.action === 'delete') await crmSend(`/users/${confirm.user.id}`, 'DELETE')
      else await crmSend(`/users/${confirm.user.id}`, 'PATCH', { status: confirm.action === 'suspend' ? 'suspended' : confirm.user.status === 'active' ? 'inactive' : 'active' })
      notify(confirm.action === 'delete' ? 'Compte supprimé' : 'Statut mis à jour')
      setConfirm(null)
      await reload()
      await refreshLookups()
    } catch (e) {
      notify('Action impossible', 'warning', errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<CrmUser>[] = [
    { key: 'name', label: 'Utilisateur', sort: 'name', render: (u) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{u.name}{u.id === me?.user.id ? <span className="ml-1.5 text-xs font-normal text-ink-400">(vous)</span> : null}</p><p className="truncate text-xs text-ink-500">{u.email}</p></div> },
    { key: 'role', label: 'Rôle', sort: 'role', render: (u) => <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'}>{u.roleLabel}</Badge> },
    { key: 'status', label: 'Statut', sort: 'status', render: (u) => <div className="flex flex-col gap-1"><StatusPill kind="user" value={u.status} />{!u.passwordConfigured ? <span className="text-[0.68rem] text-amber-700">Invitation en attente</span> : null}</div> },
    { key: 'dbs', label: 'Bases', hideOn: 'lg', render: (u) => <span className="text-xs text-ink-600">{u.role === 'admin' ? 'Toutes' : nameOf(lookups?.databases, u.databaseIds) || '—'}</span> },
    { key: 'camps', label: 'Campagnes', hideOn: 'lg', render: (u) => <span className="text-xs text-ink-600">{u.role === 'admin' ? 'Toutes' : nameOf(lookups?.campaigns, u.campaignIds) || '—'}</span> },
    { key: 'contacts', label: 'Contacts', hideOn: 'md', render: (u) => u.contactsAssigned ?? 0 },
    { key: 'calls', label: 'Appels', sort: 'calls', hideOn: 'md', render: (u) => u.callsMade ?? 0 },
    { key: 'appointments', label: 'RDV', sort: 'appointments', hideOn: 'md', render: (u) => u.appointmentsBooked ?? 0 },
    { key: 'last', label: 'Dernière activité', sort: 'lastActivity', hideOn: 'lg', render: (u) => <span className="text-xs text-ink-500">{fmtDateTime(u.lastActivityAt)}{u.lastLoginAt ? <span className="block">Connexion : {fmtDateTime(u.lastLoginAt)}</span> : null}</span> },
  ]

  const total = data?.total ?? 0
  return (
    <div>
      <PageHeader eyebrow="CRM · Équipe" title="Utilisateurs" description="Créez les comptes administrateurs et agents, gérez leurs accès et leurs affectations. Les droits sont vérifiés par le serveur." actions={<Button size="sm" onClick={() => setEditing('new')}><UserPlus size={14} />Créer un utilisateur</Button>} />
      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Comptes (filtre actuel)" value={total} />
        <MiniStat icon={<ShieldCheck size={18} />} tone="sky" label="Administrateurs" value={(data?.rows || []).filter((u) => u.role === 'admin').length} hint="Sur cette page" />
        <MiniStat icon={<Activity size={18} />} tone="emerald" label="Actifs" value={(data?.rows || []).filter((u) => u.status === 'active').length} hint="Sur cette page" />
        <MiniStat icon={<Mail size={18} />} tone="amber" label="Invitations en attente" value={(data?.rows || []).filter((u) => !u.passwordConfigured).length} hint="Sur cette page" />
      </StatGrid>
      <FilterBar values={values} onChange={setValues} filters={filters} searchPlaceholder="Nom, e-mail, téléphone…" />
      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={error}
        values={values}
        onChange={setValues}
        onRowClick={(u) => setEditing(u)}
        empty={{ icon: <UsersRound size={20} />, title: 'Aucun utilisateur', text: 'Créez un premier compte agent pour commencer.', action: <Button size="sm" onClick={() => setEditing('new')}><UserPlus size={14} />Créer un utilisateur</Button> }}
        rowActions={(u) => (
          <>
            <Button size="sm" variant="ghost" title="Modifier" aria-label={`Modifier ${u.name}`} onClick={() => setEditing(u)}><Pencil size={14} /></Button>
            <Button size="sm" variant="ghost" title="Activité" aria-label={`Activité de ${u.name}`} onClick={() => setActivityOf(u)}><Activity size={14} /></Button>
            <Button size="sm" variant="ghost" title="Mot de passe" aria-label={`Réinitialiser le mot de passe de ${u.name}`} onClick={() => setResetOf(u)}><KeyRound size={14} /></Button>
            {u.id !== me?.user.id ? <Button size="sm" variant="ghost" title={u.status === 'active' ? 'Désactiver' : 'Réactiver'} aria-label={u.status === 'active' ? `Désactiver ${u.name}` : `Réactiver ${u.name}`} onClick={() => setConfirm({ user: u, action: 'toggle' })}><Power size={14} /></Button> : null}
            {u.id !== me?.user.id ? <Button size="sm" variant="ghost" title="Supprimer" aria-label={`Supprimer ${u.name}`} onClick={() => setConfirm({ user: u, action: 'delete' })}><Trash2 size={14} className="text-red-600" /></Button> : null}
          </>
        )}
      />

      {editing ? <UserModal user={editing === 'new' ? null : editing} roles={roles} onClose={() => setEditing(null)} onSaved={async () => { await reload(); await refreshLookups() }} onSuspend={(u) => setConfirm({ user: u, action: 'suspend' })} /> : null}
      {resetOf ? <ResetModal user={resetOf} onClose={() => setResetOf(null)} onDone={() => void reload()} /> : null}
      {activityOf ? <ActivityModal user={activityOf} onClose={() => setActivityOf(null)} /> : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        busy={busy}
        danger={confirm?.action !== 'toggle' || confirm.user.status === 'active'}
        title={confirm?.action === 'delete' ? 'Supprimer ce compte ?' : confirm?.action === 'suspend' ? 'Suspendre ce compte ?' : confirm?.user.status === 'active' ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}
        confirmLabel={confirm?.action === 'delete' ? 'Supprimer' : confirm?.action === 'suspend' ? 'Suspendre' : confirm?.user.status === 'active' ? 'Désactiver' : 'Réactiver'}
        text={confirm?.action === 'delete' ? <>Le compte de <b>{confirm.user.name}</b> sera supprimé définitivement. Si cet utilisateur a déjà passé des appels ou pris des rendez-vous, la suppression sera refusée : désactivez-le plutôt pour garder l’historique.</> : confirm?.user.status === 'active' || confirm?.action === 'suspend' ? <><b>{confirm?.user.name}</b> ne pourra plus se connecter et sa session en cours sera coupée immédiatement. Ses données restent conservées.</> : <><b>{confirm?.user.name}</b> pourra de nouveau se connecter.</>}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

function UserModal({ user, roles, onClose, onSaved, onSuspend }: { user: CrmUser | null; roles: Array<{ key: string; label: string }>; onClose: () => void; onSaved: () => Promise<void>; onSuspend: (u: CrmUser) => void }) {
  const { lookups, me } = useCrm()
  const notify = useNotify()
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', role: user?.role || 'agent', status: user?.status || 'active', mode: 'invite' as 'invite' | 'password', password: '', databaseIds: user?.databaseIds || [], campaignIds: user?.campaignIds || [], zoneIds: user?.zoneIds || [], customPerms: Boolean(user?.permissions), permissions: user?.permissions || user?.effectivePermissions || Object.keys(PERMISSION_LABELS) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  const [delivery, setDelivery] = useState<Delivery>(null)
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const isSelf = user?.id === me?.user.id

  function validate() {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = 'Indiquez le nom complet.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Adresse e-mail invalide.'
    if (form.phone && !/^[+0-9\s().-]{4,30}$/.test(form.phone)) e.phone = 'Numéro invalide.'
    if (!user && form.mode === 'password' && form.password.length < 12) e.password = '12 caractères minimum.'
    setErrors(e)
    return !Object.keys(e).length
  }
  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setBusy(true)
    setServerError('')
    const body: Record<string, unknown> = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role, status: form.status, databaseIds: form.role === 'admin' ? [] : form.databaseIds, campaignIds: form.role === 'admin' ? [] : form.campaignIds, zoneIds: form.role === 'admin' ? [] : form.zoneIds, permissions: form.role !== 'admin' && form.customPerms ? form.permissions : null }
    try {
      if (user) {
        if (isSelf) { delete body.role; delete body.status }
        await crmSend(`/users/${user.id}`, 'PATCH', body)
        notify('Compte mis à jour')
        await onSaved()
        onClose()
      } else {
        if (form.mode === 'password') body.password = form.password
        const r = await crmSend<{ delivery: Delivery }>('/users', 'POST', body)
        await onSaved()
        if (r.delivery && !r.delivery.sent) { setDelivery(r.delivery); return }
        notify('Compte créé', 'success', form.mode === 'invite' ? `Invitation envoyée à ${form.email}` : 'L’utilisateur peut se connecter.')
        onClose()
      }
    } catch (e) {
      setServerError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (delivery) return <InviteLinkModal email={form.email} delivery={delivery} onClose={onClose} />

  return (
    <Modal open onClose={onClose} title={user ? `Modifier · ${user.name}` : 'Créer un utilisateur'} description={user ? 'Les changements de rôle et d’accès s’appliquent immédiatement.' : 'Le compte utilise la connexion ALLNEEDS habituelle. Le mot de passe est toujours chiffré.'} size="lg">
      <form className="space-y-5" onSubmit={submit} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" required error={errors.name}><Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} autoFocus /></Field>
          <Field label="E-mail" required error={errors.email}><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} /></Field>
          <Field label="Téléphone" hint="Facultatif" error={errors.phone}><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} /></Field>
          <Field label="Rôle" required hint={isSelf ? 'Vous ne pouvez pas changer votre propre rôle.' : undefined}>
            <Select value={form.role} disabled={isSelf} onChange={(e) => set('role', e.target.value)}>{roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</Select>
          </Field>
          <Field label="Statut du compte">
            <Select value={form.status} disabled={isSelf} onChange={(e) => set('status', e.target.value)}><option value="active">Actif</option><option value="inactive">Désactivé</option><option value="suspended">Suspendu</option></Select>
          </Field>
          {!user ? (
            <Field label="Accès" hint={form.mode === 'invite' ? 'Un lien personnel (48 h, usage unique) est envoyé par e-mail.' : 'Communiquez-le par un canal sûr.'}>
              <Select value={form.mode} onChange={(e) => set('mode', e.target.value)}><option value="invite">Invitation sécurisée par e-mail</option><option value="password">Définir un mot de passe</option></Select>
            </Field>
          ) : null}
          {!user && form.mode === 'password' ? <Field label="Mot de passe" required error={errors.password} hint="12 caractères minimum."><Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} maxLength={1024} /></Field> : null}
        </div>

        {form.role === 'admin' ? (
          <Alert tone="info">Un administrateur a accès à toutes les bases, campagnes, zones et pages du CRM.</Alert>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Bases assignées"><MultiPick options={lookups?.databases || []} value={form.databaseIds} onChange={(v) => set('databaseIds', v)} empty="Aucune base créée." /></Field>
              <Field label="Campagnes assignées"><MultiPick options={lookups?.campaigns || []} value={form.campaignIds} onChange={(v) => set('campaignIds', v)} empty="Aucune campagne créée." /></Field>
              <Field label="Zones assignées"><MultiPick options={lookups?.zones || []} value={form.zoneIds} onChange={(v) => set('zoneIds', v)} empty="Aucune zone créée." /></Field>
            </div>
            <div className="rounded-xl border border-ink-100 p-4">
              <Checkbox label="Personnaliser les permissions de ce compte (sinon, celles du rôle Agent dans les réglages s’appliquent)" checked={form.customPerms} onChange={(e) => set('customPerms', e.target.checked)} />
              {form.customPerms ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(PERMISSION_LABELS).map(([key, p]) => (
                    <label key={key} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-ink-50">
                      <input type="checkbox" className="mt-1" checked={form.permissions.includes(key)} onChange={(e) => set('permissions', e.target.checked ? [...new Set([...form.permissions, key])] : form.permissions.filter((x) => x !== key))} />
                      <span><b className="text-ink-900">{p.label}</b><span className="block text-xs text-ink-500">{p.hint}</span></span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
          {user && !isSelf && user.status !== 'suspended' ? <Button type="button" variant="ghost" onClick={() => { onClose(); onSuspend(user) }}>Suspendre le compte</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : user ? 'Enregistrer' : 'Créer le compte'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function InviteLinkModal({ email, delivery, onClose }: { email: string; delivery: NonNullable<Delivery>; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal open onClose={onClose} title="Compte créé" description={`L’e-mail d’invitation n’a pas pu être envoyé à ${email}.`}>
      <div className="space-y-4">
        <Alert tone="warning" title="E-mail non envoyé">{/535|BadCredentials/.test(delivery.error || '') ? 'Gmail a refusé l’identifiant d’envoi (EMAIL_USER / EMAIL_PASS dans .env).' : delivery.error || 'Le serveur d’e-mail n’a pas répondu.'}</Alert>
        <div>
          <p className="mb-2 text-xs font-semibold text-ink-700">Lien personnel de création du mot de passe (48 h, usage unique)</p>
          <code className="block break-all rounded-xl border border-ink-100 bg-ink-50 p-3 text-xs" data-no-translate>{delivery.setupUrl}</code>
          <p className="mt-2 text-xs text-ink-500">Transmettez-le uniquement à cette personne, par un canal sûr.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(delivery.setupUrl || '').then(() => setCopied(true))}>{copied ? 'Lien copié' : 'Copier le lien'}</Button>
          <Button onClick={onClose}>Terminé</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResetModal({ user, onClose, onDone }: { user: CrmUser; onClose: () => void; onDone: () => void }) {
  const notify = useNotify()
  const [mode, setMode] = useState<'invite' | 'password'>('invite')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [delivery, setDelivery] = useState<Delivery>(null)
  async function submit() {
    if (mode === 'password' && password.length < 12) { setError('12 caractères minimum.'); return }
    setBusy(true)
    setError('')
    try {
      const r = await crmSend<{ delivery?: Delivery }>(`/users/${user.id}/reset`, 'POST', mode === 'password' ? { mode, password } : { mode })
      onDone()
      if (r.delivery && !r.delivery.sent) { setDelivery(r.delivery); return }
      notify(mode === 'password' ? 'Mot de passe modifié' : 'Lien de réinitialisation envoyé')
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  if (delivery) return <InviteLinkModal email={user.email} delivery={delivery} onClose={onClose} />
  return (
    <Modal open onClose={onClose} title={`Mot de passe · ${user.name}`} description="Le mot de passe n’est jamais affiché ni stocké en clair.">
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Méthode"><Select value={mode} onChange={(e) => setMode(e.target.value as 'invite' | 'password')}><option value="invite">Envoyer un lien de réinitialisation (recommandé)</option><option value="password">Définir un nouveau mot de passe</option></Select></Field>
        {mode === 'password' ? <Field label="Nouveau mot de passe" hint="12 caractères minimum."><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field> : null}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? 'Patientez…' : 'Valider'}</Button></div>
      </div>
    </Modal>
  )
}

type ActivityRow = { id: string; at: string; action: string; entityType: string; details: Record<string, unknown> }
function ActivityModal({ user, onClose }: { user: CrmUser; onClose: () => void }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { crmGet<Page<ActivityRow>>(`/users/${user.id}/activity`, { pageSize: 100 }).then((p) => setRows(p.rows), (e) => setError(errorText(e))) }, [user.id])
  return (
    <Modal open onClose={onClose} title={`Activité · ${user.name}`} description={`Dernière connexion : ${fmtDateTime(user.lastLoginAt)}`} size="lg">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {rows && !rows.length ? <EmptyBox icon={<Activity size={20} />} title="Aucune action enregistrée" /> : null}
      <ul className="max-h-[60vh] divide-y divide-ink-100 overflow-y-auto">
        {(rows || []).map((a) => <li key={a.id} className="py-2.5 text-sm"><span className="text-ink-900">{actionLabel(a.action)}</span><span className="block text-xs text-ink-500">{fmtDateTime(a.at)} · {a.entityType}</span></li>)}
      </ul>
    </Modal>
  )
}

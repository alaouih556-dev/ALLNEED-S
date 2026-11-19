import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BadgeCheck, Mail, Presentation, RefreshCcw, UserPlus, UserRoundCog, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { apiRequest } from '@/lib/accompagnement'

export const Route = createFileRoute('/admin/commerciaux')({ component: AdminSalesAccess })

type Member = { id: string; email: string; name: string; role: string; active: boolean; passwordConfigured: boolean; salesAccess: boolean }
type Pending = { id: string; email: string; name: string; expiresAt: string }
type Payload = { accounts: Member[]; concierges: Member[]; pending: Pending[] }
type Delivery = { sent: boolean; setupUrl?: string; error?: string }

/** Gestion des accès à la présentation commerciale (administrateur uniquement, contrôlé par le serveur). */
function AdminSalesAccess() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [invite, setInvite] = useState({ name: '', email: '' })
  const [inviteResult, setInviteResult] = useState<{ email: string; delivery: Delivery } | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(await apiRequest<Payload>('/api/admin/sales-access'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(member: Member, enabled: boolean) {
    setBusy(member.id)
    setError('')
    try {
      await apiRequest(`/api/admin/sales-access/${encodeURIComponent(member.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible.')
    } finally {
      setBusy(null)
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault()
    setBusy('invite')
    setError('')
    setInviteResult(null)
    try {
      const result = await apiRequest<{ delivery: Delivery }>('/api/admin/sales-access/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invite) })
      setInviteResult({ email: invite.email, delivery: result.delivery })
      setInvite({ name: '', email: '' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invitation impossible.')
    } finally {
      setBusy(null)
    }
  }

  const accounts = data?.accounts ?? []
  const concierges = data?.concierges ?? []
  const activeAccounts = accounts.filter((a) => a.active).length
  const conciergesWithAccess = concierges.filter((c) => c.salesAccess).length

  return (
    <div>
      <PageHeader
        eyebrow="Équipe"
        title="Accès commerciaux"
        description="Choisissez qui peut ouvrir la Sales Presentation. Les comptes commerciaux n’ont accès qu’à la présentation : aucune donnée client, aucune page d’administration."
        actions={
          <>
            <Link to={'/sales-presentation' as any}><Button size="sm"><Presentation size={14} />Ouvrir la présentation</Button></Link>
            <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCcw size={14} />Actualiser</Button>
          </>
        }
      />

      <StatGrid>
        <MiniStat icon={<BadgeCheck size={18} />} tone="indigo" label="Comptes commerciaux actifs" value={activeAccounts} hint={`${accounts.length} compte(s) au total`} />
        <MiniStat icon={<UserRoundCog size={18} />} tone="teal" label="Concierges autorisés" value={conciergesWithAccess} hint={`sur ${concierges.length} concierge(s)`} />
        <MiniStat icon={<Mail size={18} />} tone="amber" label="Invitations en attente" value={data?.pending.length ?? 0} />
        <MiniStat icon={<UsersRound size={18} />} tone="emerald" label="Administrateurs" value="Toujours" hint="Accès inclus avec le rôle admin" />
      </StatGrid>

      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Comptes commerciaux" description="Rôle « sales » : accès limité à la présentation. Désactiver un compte le déconnecte immédiatement.">
            {!data ? <LoadingRows /> : null}
            {data && !accounts.length ? <EmptyBox icon={<BadgeCheck size={20} />} title="Aucun compte commercial" text="Invitez un commercial ou configurez le compte de présentation partagé (voir .env.example)." /> : null}
            <Rows>
              {accounts.map((m) => (
                <MemberRow key={m.id} member={m} busy={busy === m.id} on={m.active} onToggle={(v) => void toggle(m, v)} labelOn="Actif" labelOff="Désactivé" />
              ))}
            </Rows>
          </Panel>

          <Panel title="Concierges" description="Accordez l’accès à un concierge sans changer son rôle ni son portefeuille.">
            {!data ? <LoadingRows /> : null}
            {data && !concierges.length ? <EmptyBox icon={<UserRoundCog size={20} />} title="Aucun concierge" /> : null}
            <Rows>
              {concierges.map((m) => (
                <MemberRow key={m.id} member={m} busy={busy === m.id} on={m.salesAccess} onToggle={(v) => void toggle(m, v)} labelOn="Accès accordé" labelOff="Sans accès" disabled={!m.active} />
              ))}
            </Rows>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Inviter un commercial" description="Il reçoit un lien pour créer son mot de passe (12 caractères minimum).">
            <form className="space-y-4 p-5" onSubmit={sendInvite}>
              <Field label="Nom" required><Input value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} required maxLength={160} placeholder="Prénom Nom" /></Field>
              <Field label="Adresse e-mail" required><Input type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} required maxLength={200} placeholder="commercial@exemple.ma" /></Field>
              <Button type="submit" fullWidth disabled={busy === 'invite'}><UserPlus className="h-4 w-4" />{busy === 'invite' ? 'Envoi…' : 'Envoyer l’invitation'}</Button>
              {inviteResult ? (
                inviteResult.delivery.sent ? (
                  <Alert tone="success">Invitation envoyée à {inviteResult.email}.</Alert>
                ) : (
                  <Alert tone="warning" title="E-mail non envoyé">
                    Transmettez ce lien personnel au commercial, par un canal sûr :
                    {inviteResult.delivery.setupUrl ? <code className="mt-2 block break-all text-xs">{inviteResult.delivery.setupUrl}</code> : null}
                  </Alert>
                )
              ) : null}
            </form>
          </Panel>

          {data?.pending.length ? (
            <Panel title="Invitations en attente">
              <Rows>
                {data.pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <Initial name={p.name || p.email} tone="amber" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-950">{p.name}</p>
                      <p className="truncate text-xs text-ink-500">{p.email}</p>
                    </div>
                    <Badge tone="warning">Expire le {new Date(p.expiresAt).toLocaleDateString('fr-FR')}</Badge>
                  </li>
                ))}
              </Rows>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MemberRow({ member, on, busy, disabled, labelOn, labelOff, onToggle }: { member: Member; on: boolean; busy: boolean; disabled?: boolean; labelOn: string; labelOff: string; onToggle: (value: boolean) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <Initial name={member.name || member.email} tone={on ? 'emerald' : 'slate'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-950">{member.name || member.email}</p>
        <p className="truncate text-xs text-ink-500">{member.email}{!member.passwordConfigured ? ' · mot de passe non défini' : ''}{!member.active && member.role === 'concierge' ? ' · compte désactivé' : ''}</p>
      </div>
      <Badge tone={on ? 'success' : 'neutral'}>{on ? labelOn : labelOff}</Badge>
      <Button size="sm" variant={on ? 'outline' : 'primary'} disabled={busy || disabled} onClick={() => onToggle(!on)}>
        {busy ? '…' : on ? 'Retirer l’accès' : 'Donner l’accès'}
      </Button>
    </li>
  )
}

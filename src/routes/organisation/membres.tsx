import { useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Copy, Pencil, UserPlus, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Checkbox, Field, Input, Modal, Select } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, Panel, Rows, SearchBox, matches } from '@/components/admin-kit'
import { orgApi, teamNameOf, useOrg, useOrgResource } from '@/features/organization/core'

export const Route = createFileRoute('/organisation/membres')({ component: MembersPage })

type Member = { id: string; name: string; email: string; role: string; active: boolean; level: string; levelLabel: string; departmentId: string | null; teamId: string | null; strategyManager: boolean }
type Pending = { id: string; name: string; email: string; departmentId: string; teamId: string | null; level: string }
type Payload = { members: Member[]; pending: Pending[]; unplaced: Array<{ id: string; name: string; role: string }> }
type Delivery = { sent?: boolean; setupUrl?: string }

function MembersPage() {
  const { me, can } = useOrg()
  const { data, loading, error, reload } = useOrgResource<Payload>('/members')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Member | 'new' | null>(null)
  const [link, setLink] = useState('')
  const manage = can('members.manage')
  const list = (data?.members ?? []).filter((m) => matches(query, m.name, m.email, m.levelLabel, teamNameOf(me?.structure, m.teamId)))

  if (!can('members.view')) return <Alert tone="warning">Cette page est réservée aux responsables.</Alert>
  return (
    <div>
      <PageHeader eyebrow="Organisation" title="Membres" description="Rattachez chaque collaborateur à un service, une équipe et un niveau de responsabilité." actions={manage ? <Button size="sm" onClick={() => setEditing('new')}><UserPlus size={14} />Inviter</Button> : null} />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      {link ? (
        <Alert tone="warning" className="mb-5" title="E-mail non envoyé">
          <span className="block">Transmettez ce lien personnel par un canal sûr.</span>
          <span className="mt-2 flex flex-wrap items-center gap-2"><code className="max-w-full truncate text-xs">{link}</code><Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(link)}><Copy size={13} />Copier</Button></span>
        </Alert>
      ) : null}
      <Panel title="Équipe interne" description={`${data?.members.length ?? 0} collaborateur(s)`} action={<SearchBox value={query} onChange={setQuery} placeholder="Rechercher un membre…" />}>
        {loading && !data ? <LoadingRows /> : null}
        {data && !list.length ? <EmptyBox icon={<UsersRound size={20} />} title="Aucun membre" text="Invitez un collaborateur pour commencer." /> : null}
        <Rows>
          {list.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Initial name={member.name} />
              <span className="min-w-[180px] flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{member.name}</span><span className="block truncate text-xs text-ink-500">{member.email}</span></span>
              <span className="min-w-[180px] flex-1 text-xs text-ink-500">{me?.structure.find((d) => d.id === member.departmentId)?.name}{member.teamId ? <span className="block font-semibold text-ink-700">{teamNameOf(me?.structure, member.teamId)}</span> : null}</span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={member.level === 'department_manager' ? 'brand' : member.level === 'team_manager' ? 'info' : 'neutral'}>{member.levelLabel}</Badge>
                {member.strategyManager ? <Badge tone="violet">Responsable stratégies</Badge> : null}
                {!member.active ? <Badge tone="warning">Désactivé</Badge> : null}
                {manage ? <button type="button" className="og-icon" aria-label={`Modifier ${member.name}`} onClick={() => setEditing(member)}><Pencil size={14} /></button> : null}
              </span>
            </li>
          ))}
        </Rows>
      </Panel>
      {data?.pending.length ? (
        <Panel className="mt-5" title="Invitations en attente">
          <Rows>{data.pending.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink-950">{p.name}</span><span className="block truncate text-xs text-ink-500">{p.email}</span></span><Badge tone="warning">{teamNameOf(me?.structure, p.teamId) ?? me?.structure.find((d) => d.id === p.departmentId)?.name}</Badge></li>)}</Rows>
        </Panel>
      ) : null}
      {editing ? <MemberModal member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(delivery) => { setEditing(null); setLink(delivery && delivery.sent === false && delivery.setupUrl ? delivery.setupUrl : ''); void reload() }} /> : null}
    </div>
  )
}

function MemberModal({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: (delivery?: Delivery) => void }) {
  const { me } = useOrg()
  const pdg = me?.position.level === 'pdg'
  const departments = pdg ? me!.structure : me!.structure.filter((d) => d.id === me!.position.departmentId)
  const [form, setForm] = useState({ name: member?.name ?? '', email: member?.email ?? '', departmentId: member?.departmentId ?? departments[0]?.id ?? '', teamId: member?.teamId ?? '', level: member?.level ?? 'member', strategyManager: member?.strategyManager ?? false, active: member?.active ?? true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const teams = departments.find((d) => d.id === form.departmentId)?.teams ?? []
  const needsTeam = form.level !== 'department_manager'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const position: Record<string, unknown> = { departmentId: form.departmentId, teamId: needsTeam ? form.teamId : null, level: form.level }
      if (pdg) position.strategyManager = form.departmentId === 'marketing' && form.strategyManager
      if (member) {
        await orgApi(`/members/${member.id}`, { method: 'PATCH', body: pdg ? { ...position, active: form.active } : position })
        onSaved()
      } else {
        const result = await orgApi<{ delivery?: Delivery }>('/members', { method: 'POST', body: { ...position, name: form.name, email: form.email } })
        onSaved(result.delivery)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={member ? `Modifier ${member.name}` : 'Inviter un collaborateur'} description={member ? undefined : 'Un lien personnel lui permettra de créer son mot de passe.'}>
      <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={submit}>
        {!member ? <>
          <Field label="Nom complet" required><Input required maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="E-mail" required><Input required type="email" maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </> : null}
        <Field label="Service"><Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, teamId: '', strategyManager: false })}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Niveau">
          <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            {pdg ? <option value="department_manager">Responsable de service</option> : null}
            <option value="team_manager">Responsable d’équipe</option>
            <option value="member">Membre d’équipe</option>
          </Select>
        </Field>
        {needsTeam ? <Field label="Équipe" required className="sm:col-span-2"><Select required value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}><option value="">Choisir une équipe</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field> : null}
        {pdg && form.departmentId === 'marketing' ? <div className="sm:col-span-2"><Checkbox label="Responsable des stratégies marketing" checked={form.strategyManager} onChange={(e) => setForm({ ...form, strategyManager: e.target.checked })} /></div> : null}
        {pdg && member ? <div className="sm:col-span-2"><Checkbox label="Compte actif" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /></div> : null}
        {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : member ? 'Enregistrer' : 'Envoyer l’invitation'}</Button></div>
      </form>
    </Modal>
  )
}

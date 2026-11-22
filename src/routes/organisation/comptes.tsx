import { useMemo, useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, CheckCircle2, KeyRound, Save, Settings2, ShieldCheck, UserRoundX, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Checkbox, Field, Modal, Select, type Tone } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, StatGrid, matches } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import { PERMISSION_LABELS } from '@/features/crm/permissions'
import { orgApi, useOrgResource } from '@/features/organization/core'
import { CLIENT_MODULE_LABELS, ORG_PERMISSION_LABELS } from '@/features/organization/labels'
import { t } from '@/i18n'

export const Route = createFileRoute('/organisation/comptes')({
  component: AccountsPage,
  head: () => ({ meta: [{ title: 'Comptes & accès — ALLNEEDS' }, { name: 'robots', content: 'noindex' }] }),
})

type Position = { level: string; levelLabel?: string; departmentId: string | null; teamId: string | null; strategyManager: boolean }
type Account = {
  id: string; name: string; email: string; role: string; roleLabel: string; active: boolean; passwordConfigured: boolean; lastLoginAt: string | null; isSelf: boolean
  organization: { id: string; name: string; modules: Record<string, boolean> } | null
  portfolio: number | null
  position: Position | null
  access: { orgPermissions: string[]; orgCustom: boolean; crmPermissions: string[]; crmCustom: boolean; crmFull: boolean; salesPresentation: boolean }
}
type Catalog = {
  roles: Array<{ id: string; label: string }>
  structure: Array<{ id: string; name: string; teams: Array<{ id: string; name: string }> }>
  teamsByRole: Record<string, string[]>
  orgPermissions: string[]
  crmPermissions: string[]
  modules: string[]
}
type Payload = { accounts: Account[]; catalog: Catalog; organizations: Array<{ id: string; name: string }> }

const INTERNAL = new Set(['staff', 'concierge', 'agent', 'crm'])
const CLIENT = new Set(['dirigeant', 'manager', 'collaborateur'])
const CRM_FIELD = new Set(['agent', 'crm'])
const SALES_TOGGLE = new Set(['staff', 'concierge'])
const ROLE_TONE: Record<string, Tone> = { admin: 'violet', staff: 'brand', concierge: 'info', agent: 'info', crm: 'info', sales: 'warning', dirigeant: 'success', manager: 'success', collaborateur: 'success' }
const GROUPS = [
  { id: 'all', label: 'Tous' },
  { id: 'direction', label: 'Direction' },
  { id: 'internal', label: 'Équipe interne' },
  { id: 'client', label: 'Clients' },
  { id: 'inactive', label: 'Désactivés' },
]

function inGroup(account: Account, group: string) {
  if (group === 'direction') return account.role === 'admin'
  if (group === 'internal') return INTERNAL.has(account.role) || account.role === 'sales'
  if (group === 'client') return CLIENT.has(account.role)
  if (group === 'inactive') return !account.active
  return true
}
const shortDate = (value: string | null) => (value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Jamais connecté')

function AccountsPage() {
  const auth = useAuth()
  const isAdmin = auth.user?.role === 'admin'
  const { data, loading, error, reload } = useOrgResource<Payload>(isAdmin ? '/accounts' : null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saved, setSaved] = useState('')
  const accounts = data?.accounts ?? []
  const structure = data?.catalog.structure
  const teamName = (id: string | null) => structure?.flatMap((d) => d.teams).find((team) => team.id === id)?.name
  const departmentName = (id: string | null) => structure?.find((d) => d.id === id)?.name
  const scope = (account: Account) => account.organization?.name ?? (account.position ? teamName(account.position.teamId) ?? departmentName(account.position.departmentId) : account.role === 'admin' ? 'Toute l’organisation' : 'Présentation commerciale')
  const list = useMemo(() => accounts.filter((account) => inGroup(account, group) && matches(query, account.name, account.email, account.roleLabel, account.organization?.name)), [accounts, group, query])
  const editing = accounts.find((account) => account.id === editingId) ?? null

  if (!isAdmin) return <Alert tone="warning">Cette page est réservée au PDG.</Alert>
  return (
    <div>
      <PageHeader eyebrow="Direction générale" title="Comptes & accès" description="Tous les comptes ALLNEEDS au même endroit : rôle, service, statut et ce que chacun peut voir." />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      {saved ? <Alert tone="success" className="mb-5">{saved}</Alert> : null}
      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Comptes" value={loading && !data ? '–' : accounts.length} hint={`${accounts.filter((a) => a.active).length} actif(s)`} />
        <MiniStat icon={<ShieldCheck size={18} />} tone="sky" label="Équipe interne" value={accounts.filter((a) => a.role === 'admin' || INTERNAL.has(a.role) || a.role === 'sales').length} />
        <MiniStat icon={<Building2 size={18} />} tone="emerald" label="Comptes clients" value={accounts.filter((a) => CLIENT.has(a.role)).length} />
        <MiniStat icon={<UserRoundX size={18} />} tone="amber" label="Désactivés" value={accounts.filter((a) => !a.active).length} />
      </StatGrid>
      <Panel title="Tous les comptes" description={`${list.length} compte(s) affiché(s)`} action={<SearchBox value={query} onChange={setQuery} placeholder="Nom, e-mail, rôle, entreprise…" />}>
        <div className="ac-tabs" role="group" aria-label="Filtrer les comptes">
          {GROUPS.map((item) => <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>{item.label}</button>)}
        </div>
        {loading && !data ? <LoadingRows count={6} /> : null}
        {data && !list.length ? <EmptyBox icon={<UsersRound size={20} />} title="Aucun compte" text="Modifiez la recherche ou le filtre." /> : null}
        <Rows>
          {list.map((account) => (
            <li key={account.id} className="ac-row">
              <Initial name={account.name} tone={account.active ? 'indigo' : 'slate'} />
              <span className="ac-person"><strong>{account.name}{account.isSelf ? <em>Vous</em> : null}</strong><small>{account.email}</small></span>
              <span className="ac-scope"><Badge tone={ROLE_TONE[account.role] ?? 'neutral'}>{account.roleLabel}</Badge><small>{scope(account)}</small></span>
              <span className="ac-state"><Badge tone={account.active ? 'success' : 'warning'}>{account.active ? 'Actif' : 'Désactivé'}</Badge><small>{account.passwordConfigured ? shortDate(account.lastLoginAt) : 'Mot de passe à créer'}</small></span>
              <Button size="sm" variant="outline" onClick={() => { setSaved(''); setEditingId(account.id) }} aria-label={`Gérer ${account.name}`}><Settings2 size={14} />Gérer</Button>
            </li>
          ))}
        </Rows>
      </Panel>
      {editing && data ? <AccountEditor key={editing.id} account={editing} payload={data} onClose={() => setEditingId(null)} onSaved={async () => { setEditingId(null); setSaved('Accès mis à jour. Le changement s’applique immédiatement.'); await reload() }} /> : null}
    </div>
  )
}

function AccessGrid({ items, value, disabled, onToggle }: { items: Array<{ id: string; label: string; hint?: string }>; value: string[]; disabled?: boolean; onToggle: (id: string, on: boolean) => void }) {
  return <div className="ac-grid">{items.map((item) => <div key={item.id} className="ac-check"><Checkbox label={item.label} description={item.hint} checked={value.includes(item.id)} disabled={disabled} onChange={(event) => onToggle(item.id, event.target.checked)} /></div>)}</div>
}

function Section({ title, text, action, children }: { title: string; text?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="ac-section"><header><span><strong>{title}</strong>{text ? <small>{text}</small> : null}</span>{action}</header>{children}</section>
}

function AccountEditor({ account, payload, onClose, onSaved }: { account: Account; payload: Payload; onClose: () => void; onSaved: () => Promise<void> }) {
  const { catalog, organizations } = payload
  const [role, setRole] = useState(account.role)
  const [organizationId, setOrganizationId] = useState(account.organization?.id ?? '')
  const [departmentId, setDepartmentId] = useState(account.position?.departmentId ?? (account.role === 'staff' ? 'marketing' : 'commercial'))
  const [teamId, setTeamId] = useState(account.position?.teamId ?? '')
  const [level, setLevel] = useState(account.position?.level ?? 'member')
  const [strategyManager, setStrategyManager] = useState(account.position?.strategyManager ?? false)
  const [active, setActive] = useState(account.active)
  const [orgPermissions, setOrgPermissions] = useState(account.access.orgPermissions)
  const [orgTouched, setOrgTouched] = useState(false)
  const [orgReset, setOrgReset] = useState(false)
  const [crmPermissions, setCrmPermissions] = useState(account.access.crmPermissions)
  const [crmTouched, setCrmTouched] = useState(false)
  const [crmReset, setCrmReset] = useState(false)
  const [sales, setSales] = useState(account.access.salesPresentation)
  const [modules, setModules] = useState(account.organization?.modules ?? {})
  const [modulesTouched, setModulesTouched] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const roleChanged = role !== account.role
  const internal = INTERNAL.has(role)
  const client = CLIENT.has(role)
  const fixedCommercial = role !== 'staff'
  const departments = fixedCommercial ? catalog.structure.filter((d) => d.id === 'commercial') : catalog.structure
  const effectiveDepartment = fixedCommercial ? 'commercial' : departmentId
  const allowedTeams = catalog.structure.find((d) => d.id === effectiveDepartment)?.teams.filter((team) => catalog.teamsByRole[role]?.includes(team.id)) ?? []
  const needsTeam = level !== 'department_manager'
  const managerCrm = effectiveDepartment === 'commercial' && (level === 'department_manager' || (level === 'team_manager' && teamId === 'teleprospection'))
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((item) => item !== id))

  function changeRole(next: string) {
    setRole(next)
    setError('')
    const teams = catalog.teamsByRole[next] ?? []
    if (next !== 'staff') setDepartmentId('commercial')
    if (!teams.includes(teamId)) setTeamId(teams.length === 1 ? teams[0] : '')
    if (next !== 'staff') setStrategyManager(false)
  }

  async function submit() {
    setError('')
    if (client && !organizationId) return setError('Choisissez l’entreprise de ce compte.')
    if (internal && needsTeam && !teamId) return setError('Choisissez une équipe.')
    if (roleChanged && role === 'admin' && !window.confirm(t('Donner à ce compte un accès complet PDG à toute l’application ?'))) return
    if (account.active && !active && !window.confirm(t('Désactiver ce compte ? La personne ne pourra plus se connecter.'))) return
    const body: Record<string, unknown> = {}
    if (roleChanged) body.role = role
    if (active !== account.active) body.active = active
    if (client && organizationId !== account.organization?.id) body.organizationId = organizationId
    if (internal) body.position = { level, departmentId: effectiveDepartment, teamId: needsTeam ? teamId : null, strategyManager: effectiveDepartment === 'marketing' && strategyManager }
    if (!roleChanged) {
      if (orgReset) body.orgPermissions = null
      else if (orgTouched) body.orgPermissions = orgPermissions
      if (crmReset) body.crmPermissions = null
      else if (crmTouched) body.crmPermissions = crmPermissions
      if (modulesTouched) body.companyModules = modules
    }
    if (SALES_TOGGLE.has(role) && sales !== account.access.salesPresentation) body.salesPresentation = sales
    setSaving(true)
    try {
      await orgApi(`/accounts/${account.id}`, { method: 'PATCH', body })
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={account.name} description={account.email}>
      <div className="ac-editor">
        {account.isSelf ? <Alert tone="info">Vous ne pouvez pas retirer vos propres droits PDG ni désactiver votre compte.</Alert> : null}

        <Section title="Rôle et statut" text="Le rôle décide quels espaces la personne ouvre.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rôle">
              <Select value={role} disabled={account.isSelf} onChange={(event) => changeRole(event.target.value)}>
                {!catalog.roles.some((item) => item.id === account.role) ? <option value={account.role}>{account.roleLabel}</option> : null}
                {catalog.roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>
            </Field>
            {client ? (
              <Field label="Entreprise" required>
                <Select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
                  <option value="">Choisir une entreprise</option>
                  {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </Select>
              </Field>
            ) : <div className="ac-active"><Checkbox label="Compte actif" description="Peut se connecter à ALLNEEDS." checked={active} disabled={account.isSelf} onChange={(event) => setActive(event.target.checked)} /></div>}
            {client ? <div className="ac-active sm:col-span-2"><Checkbox label="Compte actif" description="Peut se connecter à ALLNEEDS." checked={active} onChange={(event) => setActive(event.target.checked)} /></div> : null}
          </div>
        </Section>

        {internal ? (
          <Section title="Place dans l’organisation">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Service"><Select value={effectiveDepartment} disabled={fixedCommercial} onChange={(event) => { setDepartmentId(event.target.value); setTeamId(''); setStrategyManager(false); if (event.target.value === 'commercial') setLevel('department_manager') }}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
              <Field label="Niveau">
                <Select value={level} onChange={(event) => setLevel(event.target.value)}>
                  <option value="department_manager">Responsable de service</option>
                  {allowedTeams.length ? <option value="team_manager">Responsable d’équipe</option> : null}
                  {allowedTeams.length ? <option value="member">Membre d’équipe</option> : null}
                </Select>
              </Field>
              {needsTeam ? <Field label="Équipe" required><Select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Choisir</option>{allowedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></Field> : null}
            </div>
            {effectiveDepartment === 'marketing' ? <div className="mt-3"><Checkbox label="Responsable des stratégies marketing" checked={strategyManager} onChange={(event) => setStrategyManager(event.target.checked)} /></div> : null}
          </Section>
        ) : null}

        <h3 className="ac-heading">Ce que ce compte peut voir</h3>
        {roleChanged ? <Alert tone="info">Le nouveau rôle reçoit ses accès par défaut. Enregistrez, puis rouvrez ce compte pour les personnaliser.</Alert> : null}
        {role === 'admin' ? <Alert tone="success" icon={<CheckCircle2 size={16} />}>Accès complet à toute l’application.</Alert> : null}
        {role === 'sales' ? <Alert tone="info">Accès limité à la Sales Presentation.</Alert> : null}

        {!roleChanged && internal ? (
          <Section title="Espace Organisation" text="Toujours limité à son service ou à son équipe." action={account.access.orgCustom || orgTouched ? <button type="button" className="ac-reset" onClick={() => { setOrgReset(true); setOrgTouched(false); setOrgPermissions(account.access.orgPermissions) }}>Revenir au niveau</button> : <Badge tone="neutral">Selon le niveau</Badge>}>
            {orgReset ? <p className="ac-note">Les droits par défaut du niveau seront rétablis à l’enregistrement.</p> : null}
            <AccessGrid items={catalog.orgPermissions.map((id) => ({ id, label: ORG_PERMISSION_LABELS[id]?.label ?? id, hint: ORG_PERMISSION_LABELS[id]?.text }))} value={orgPermissions} onToggle={(id, on) => { setOrgReset(false); setOrgTouched(true); setOrgPermissions((list) => toggle(list, id, on)) }} />
          </Section>
        ) : null}

        {!roleChanged && CRM_FIELD.has(role) && !managerCrm ? (
          <Section title="CRM" text="Modules CRM ouverts à ce compte." action={account.access.crmCustom || crmTouched ? <button type="button" className="ac-reset" onClick={() => { setCrmReset(true); setCrmTouched(false); setCrmPermissions(account.access.crmPermissions) }}>Revenir au rôle</button> : <Badge tone="neutral">Selon le rôle</Badge>}>
            {crmReset ? <p className="ac-note">Les droits CRM par défaut seront rétablis à l’enregistrement.</p> : null}
            <AccessGrid items={catalog.crmPermissions.map((id) => ({ id, label: PERMISSION_LABELS[id]?.label ?? id, hint: PERMISSION_LABELS[id]?.hint }))} value={crmPermissions} onToggle={(id, on) => { setCrmReset(false); setCrmTouched(true); setCrmPermissions((list) => toggle(list, id, on)) }} />
          </Section>
        ) : null}
        {internal && managerCrm ? <Alert tone="info" icon={<KeyRound size={16} />}>Ce niveau administre le CRM commercial.</Alert> : null}

        {SALES_TOGGLE.has(role) ? <div className="ac-active"><Checkbox label="Sales Presentation" description="Ouvrir la présentation commerciale." checked={sales} onChange={(event) => setSales(event.target.checked)} /></div> : null}
        {role === 'crm' ? <Alert tone="info">Ce rôle inclut la Sales Presentation.</Alert> : null}

        {!roleChanged && client && account.organization && organizationId === account.organization.id ? (
          <Section title={`Modules de ${account.organization.name}`} text="Attention : ce réglage s’applique à tous les comptes de cette entreprise.">
            <AccessGrid items={catalog.modules.map((id) => ({ id, label: CLIENT_MODULE_LABELS[id] ?? id }))} value={catalog.modules.filter((id) => modules[id])} onToggle={(id, on) => { setModulesTouched(true); setModules((current) => ({ ...current, [id]: on })) }} />
          </Section>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="ac-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}><Save size={15} />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </div>
    </Modal>
  )
}

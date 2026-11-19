import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { History, MapPinned, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Checkbox, Field, Input, Select, Tabs } from '@/components/ui'
import { LoadingRows, Panel } from '@/components/admin-kit'
import { DataTable, ExportButtons, FilterBar, RequirePermission, crmGet, crmSend, errorText, fmtDateTime, periodParams, useCrm, useCrmQuery, useFilterState, useNotify, type Column, type Page } from '@/features/crm/core'
import { NOTIFICATION_LABELS, PERMISSION_LABELS } from '@/features/crm/permissions'
import { actionLabel } from './index'

export const Route = createFileRoute('/crm/reglages')({ component: () => <RequirePermission perm="settings.manage"><SettingsPage /></RequirePermission> })

type Settings = {
  general: { crmName: string; defaultCountry: string; timezone: string; currency: string }
  appointments: { defaultDurationMin: number; types: string[]; agentsCanCreate: boolean; workdayStart: string; workdayEnd: string }
  calls: { callbackReminderMinutes: number; requireNotesOnFailure: boolean; inactivityAlertDays: number }
  campaigns: { types: string[]; defaultGoalAppointments: number }
  imports: { duplicateKey: string; defaultStrategy: string; maxRows: number }
  labels: Record<'contact' | 'call' | 'appointment', Record<string, string>>
  rolePermissions: Record<string, string[]>
  notifications: Record<string, boolean>
  integrations: { geocoding: string; telephony: string }
  updatedAt: string | null
}
type Payload = { settings: Settings; agentPermissions: string[]; roles: Array<{ key: string; label: string; admin: boolean }>; notificationTypes: string[]; statuses: Record<'contact' | 'call' | 'appointment', string[]> }

const SECTIONS = [
  { value: 'general', label: 'Général' }, { value: 'users', label: 'Utilisateurs et rôles' }, { value: 'permissions', label: 'Permissions' }, { value: 'appointments', label: 'Rendez-vous' }, { value: 'calls', label: 'Appels' }, { value: 'campaigns', label: 'Campagnes' }, { value: 'imports', label: 'Import' }, { value: 'labels', label: 'Statuts' }, { value: 'zones', label: 'Zones' }, { value: 'notifications', label: 'Notifications' }, { value: 'integrations', label: 'Intégrations' }, { value: 'audit', label: 'Journal d’audit' },
]

function SettingsPage() {
  const { refresh } = useCrm()
  const notify = useNotify()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'general')
  const { data, loading, error, reload } = useCrmQuery<Payload>('/settings')
  const [draft, setDraft] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => { if (data) setDraft(JSON.parse(JSON.stringify(data.settings))) }, [data])
  const changeTab = (t: string) => { setTab(t); setFormError(''); window.history.replaceState(window.history.state, '', `${window.location.pathname}?tab=${t}`) }

  async function save(section: string, values: unknown) {
    setBusy(true)
    setFormError('')
    try {
      await crmSend('/settings', 'PATCH', { section, values })
      notify('Réglages enregistrés')
      await reload()
      await refresh()
    } catch (e) { setFormError(errorText(e)) } finally { setBusy(false) }
  }
  const s = draft
  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const SaveBar = ({ section, values }: { section: string; values: unknown }) => <div className="flex justify-end border-t border-ink-100 pt-4"><Button disabled={busy} onClick={() => void save(section, values)}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button></div>

  return (
    <div>
      <PageHeader eyebrow="CRM · Administration" title="Réglages" description={`Configuration du CRM. Chaque modification est vérifiée par le serveur et tracée dans le journal d’audit.${data?.settings.updatedAt ? ` Dernière modification : ${fmtDateTime(data.settings.updatedAt)}.` : ''}`} />
      <Tabs className="mb-5" value={tab} onChange={changeTab} tabs={SECTIONS} />
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
      {formError ? <Alert tone="danger" className="mb-4">{formError}</Alert> : null}
      {loading && !s ? <LoadingRows count={5} /> : null}

      {s && tab === 'general' ? (
        <Panel title="Général"><div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du CRM" required><Input value={s.general.crmName} onChange={(e) => upd('general', { ...s.general, crmName: e.target.value })} maxLength={80} /></Field>
            <Field label="Pays par défaut" hint="Utilisé pour le géocodage des adresses"><Input value={s.general.defaultCountry} onChange={(e) => upd('general', { ...s.general, defaultCountry: e.target.value })} /></Field>
            <Field label="Fuseau horaire"><Input value={s.general.timezone} onChange={(e) => upd('general', { ...s.general, timezone: e.target.value })} /></Field>
            <Field label="Devise"><Input value={s.general.currency} onChange={(e) => upd('general', { ...s.general, currency: e.target.value })} maxLength={8} /></Field>
          </div>
          <SaveBar section="general" values={s.general} />
        </div></Panel>
      ) : null}

      {s && data && tab === 'users' ? (
        <Panel title="Utilisateurs et rôles"><div className="space-y-4 p-5 text-sm text-ink-700">
          <ul className="space-y-2">{data.roles.map((r) => <li key={r.key} className="rounded-xl border border-ink-100 p-3"><b className="text-ink-950">{r.label}</b> — {r.admin ? 'accès complet à toutes les pages, données et réglages du CRM.' : `accès limité à son périmètre (bases, contacts assignés, campagnes et zones), avec les permissions définies dans l’onglet Permissions.`}</li>)}</ul>
          <p>Les rôles sont déclarés côté serveur : un nouveau rôle (par exemple « Superviseur ») s’ajoute avec ses permissions par défaut, sans changer l’authentification.</p>
          <Link to={'/crm/utilisateurs' as any}><Button size="sm"><UsersRound size={14} />Gérer les utilisateurs</Button></Link>
        </div></Panel>
      ) : null}

      {s && data && tab === 'permissions' ? (
        <Panel title="Permissions par rôle" description="Les administrateurs ont toujours tous les droits. Chaque permission est vérifiée par le serveur sur chaque requête.">
          <div className="space-y-4 p-5">
            {data.roles.filter((r) => !r.admin).map((role) => (
              <div key={role.key}>
                <p className="crm-subtitle">{role.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.agentPermissions.map((p) => {
                    const on = (s.rolePermissions[role.key] || []).includes(p)
                    return <label key={p} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-ink-50"><input type="checkbox" className="mt-1" checked={on} onChange={(e) => upd('rolePermissions', { ...s.rolePermissions, [role.key]: e.target.checked ? [...new Set([...(s.rolePermissions[role.key] || []), p])] : (s.rolePermissions[role.key] || []).filter((x) => x !== p) })} /><span><b className="text-ink-900">{PERMISSION_LABELS[p]?.label || p}</b><span className="block text-xs text-ink-500">{PERMISSION_LABELS[p]?.hint}</span></span></label>
                  })}
                </div>
              </div>
            ))}
            <Alert tone="info">Réservé aux administrateurs, jamais attribuable à un agent : gestion des utilisateurs, des bases et des imports, des campagnes et des zones, réglages, journal d’audit et géocodage. Une personnalisation par utilisateur reste possible depuis sa fiche.</Alert>
            <SaveBar section="permissions" values={s.rolePermissions} />
          </div>
        </Panel>
      ) : null}

      {s && tab === 'appointments' ? (
        <Panel title="Rendez-vous"><div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Durée par défaut (minutes)"><Input type="number" min={5} max={480} value={s.appointments.defaultDurationMin} onChange={(e) => upd('appointments', { ...s.appointments, defaultDurationMin: Number(e.target.value) })} /></Field>
            <Field label="Début de journée"><Input type="time" value={s.appointments.workdayStart} onChange={(e) => upd('appointments', { ...s.appointments, workdayStart: e.target.value })} /></Field>
            <Field label="Fin de journée"><Input type="time" value={s.appointments.workdayEnd} onChange={(e) => upd('appointments', { ...s.appointments, workdayEnd: e.target.value })} /></Field>
          </div>
          <Field label="Types de rendez-vous" hint="Séparés par des virgules"><Input value={s.appointments.types.join(', ')} onChange={(e) => upd('appointments', { ...s.appointments, types: e.target.value.split(',').map((t) => t.trim()) })} /></Field>
          <Checkbox label="Les agents peuvent créer des rendez-vous" checked={s.appointments.agentsCanCreate} onChange={(e) => upd('appointments', { ...s.appointments, agentsCanCreate: e.target.checked })} />
          <SaveBar section="appointments" values={{ ...s.appointments, types: s.appointments.types.filter(Boolean) }} />
        </div></Panel>
      ) : null}

      {s && tab === 'calls' ? (
        <Panel title="Appels"><div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rappel envoyé avant un rappel programmé (minutes)"><Input type="number" min={0} max={1440} value={s.calls.callbackReminderMinutes} onChange={(e) => upd('calls', { ...s.calls, callbackReminderMinutes: Number(e.target.value) })} /></Field>
            <Field label="Alerte d’inactivité d’un agent (jours)"><Input type="number" min={1} max={60} value={s.calls.inactivityAlertDays} onChange={(e) => upd('calls', { ...s.calls, inactivityAlertDays: Number(e.target.value) })} /></Field>
          </div>
          <Checkbox label="Exiger une note pour « pas de réponse », « occupé », « numéro invalide » et « pas intéressé »" checked={s.calls.requireNotesOnFailure} onChange={(e) => upd('calls', { ...s.calls, requireNotesOnFailure: e.target.checked })} />
          <SaveBar section="calls" values={s.calls} />
        </div></Panel>
      ) : null}

      {s && tab === 'campaigns' ? (
        <Panel title="Campagnes"><div className="space-y-4 p-5">
          <Field label="Types de campagne" hint="Séparés par des virgules"><Input value={s.campaigns.types.join(', ')} onChange={(e) => upd('campaigns', { ...s.campaigns, types: e.target.value.split(',').map((t) => t.trim()) })} /></Field>
          <Field label="Objectif de rendez-vous proposé par défaut"><Input type="number" min={0} value={s.campaigns.defaultGoalAppointments} onChange={(e) => upd('campaigns', { ...s.campaigns, defaultGoalAppointments: Number(e.target.value) })} /></Field>
          <SaveBar section="campaigns" values={{ ...s.campaigns, types: s.campaigns.types.filter(Boolean) }} />
        </div></Panel>
      ) : null}

      {s && tab === 'imports' ? (
        <Panel title="Import des bases"><div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Détection des doublons"><Select value={s.imports.duplicateKey} onChange={(e) => upd('imports', { ...s.imports, duplicateKey: e.target.value })}><option value="phone_or_email">Téléphone ou e-mail</option><option value="phone">Téléphone seulement</option><option value="email">E-mail seulement</option></Select></Field>
            <Field label="Stratégie par défaut"><Select value={s.imports.defaultStrategy} onChange={(e) => upd('imports', { ...s.imports, defaultStrategy: e.target.value })}><option value="skip">Ignorer les doublons</option><option value="update">Mettre à jour</option><option value="create">Créer quand même</option></Select></Field>
            <Field label="Lignes maximum par import"><Input type="number" min={100} max={100000} value={s.imports.maxRows} onChange={(e) => upd('imports', { ...s.imports, maxRows: Number(e.target.value) })} /></Field>
          </div>
          <SaveBar section="imports" values={s.imports} />
        </div></Panel>
      ) : null}

      {s && data && tab === 'labels' ? (
        <Panel title="Statuts" description="Les statuts sont fixes (pour garder des statistiques cohérentes) ; vous pouvez renommer leur libellé.">
          <div className="space-y-6 p-5">
            {(['contact', 'call', 'appointment'] as const).map((kind) => (
              <div key={kind}>
                <p className="crm-subtitle">{kind === 'contact' ? 'Statuts des contacts' : kind === 'call' ? 'Statuts des appels' : 'Statuts des rendez-vous'}</p>
                <div className="grid gap-3 sm:grid-cols-3">{data.statuses[kind].map((k) => <Field key={k} label={k}><Input value={s.labels[kind][k] || ''} maxLength={40} onChange={(e) => upd('labels', { ...s.labels, [kind]: { ...s.labels[kind], [k]: e.target.value } })} /></Field>)}</div>
              </div>
            ))}
            <SaveBar section="labels" values={s.labels} />
          </div>
        </Panel>
      ) : null}

      {s && tab === 'zones' ? (
        <Panel title="Zones géographiques"><div className="space-y-3 p-5 text-sm text-ink-700"><p>Les zones se dessinent et s’assignent directement sur la carte : cercle, polygone, ou liste de villes et régions, avec les agents, bases et campagnes concernés.</p><Link to={'/crm/carte' as any}><Button size="sm"><MapPinned size={14} />Gérer les zones sur la carte</Button></Link></div></Panel>
      ) : null}

      {s && data && tab === 'notifications' ? (
        <Panel title="Notifications" description="Désactiver un type ici le coupe pour tout le monde. Chaque utilisateur peut aussi choisir les siennes.">
          <div className="space-y-4 p-5">
            <div className="grid gap-2 sm:grid-cols-2">{data.notificationTypes.map((t) => <Checkbox key={t} label={NOTIFICATION_LABELS[t] || t} checked={s.notifications[t] !== false} onChange={(e) => upd('notifications', { ...s.notifications, [t]: e.target.checked })} />)}</div>
            <SaveBar section="notifications" values={s.notifications} />
          </div>
        </Panel>
      ) : null}

      {s && tab === 'integrations' ? (
        <Panel title="Intégrations"><div className="space-y-5 p-5">
          <Field label="Géocodage des adresses" hint="Convertit une adresse en coordonnées pour la carte. Désactivé par défaut.">
            <Select value={s.integrations.geocoding} onChange={(e) => upd('integrations', { ...s.integrations, geocoding: e.target.value })}><option value="disabled">Désactivé (placement manuel uniquement)</option><option value="nominatim">OpenStreetMap Nominatim</option></Select>
          </Field>
          {s.integrations.geocoding === 'nominatim' ? <Alert tone="warning" title="Données envoyées à un service externe">Quand un administrateur lance une localisation, l’adresse du contact (rue, ville, région, pays) est envoyée à OpenStreetMap Nominatim. Aucun nom, téléphone ni e-mail n’est transmis. Limite : environ 1 adresse par seconde.</Alert> : null}
          <div className="rounded-xl border border-ink-100 p-4 text-sm text-ink-700"><b className="text-ink-950">Téléphonie</b><p className="mt-1">Aucune intégration téléphonique n’est connectée : les agents composent le numéro, puis consignent l’appel. Les appels sont structurés (durée, résultat, enregistrement) pour accueillir un connecteur plus tard.</p></div>
          <SaveBar section="integrations" values={s.integrations} />
        </div></Panel>
      ) : null}

      {tab === 'audit' ? <AuditLog /> : null}
    </div>
  )
}

type Act = { id: string; at: string; userId: string | null; userName: string; action: string; entityType: string; entityId: string | null; details: Record<string, unknown> }
function AuditLog() {
  const { lookups } = useCrm()
  const [values, setValues] = useFilterState({ period: 'month', pageSize: '50', tab: 'audit' })
  const params = { ...values, ...periodParams(values), period: undefined, tab: undefined }
  const { data, loading, error } = useCrmQuery<Page<Act>>('/activity', params)
  const filters = [
    { key: 'userId', label: 'Utilisateur', options: (lookups?.agents || []).map((a) => ({ value: a.id, label: a.name })) },
    { key: 'entityType', label: 'Élément', options: [['user', 'Utilisateurs'], ['database', 'Bases'], ['contact', 'Contacts'], ['call', 'Appels'], ['appointment', 'Rendez-vous'], ['campaign', 'Campagnes'], ['zone', 'Zones'], ['settings', 'Réglages']].map(([value, label]) => ({ value, label })) },
    { key: 'action', label: 'Action', options: ['user.created', 'user.updated', 'user.deactivated', 'database.created', 'database.imported', 'database.updated', 'contact.created', 'contact.updated', 'contact.assigned', 'call.recorded', 'appointment.created', 'appointment.updated', 'appointment.cancelled', 'campaign.created', 'campaign.updated', 'zone.created', 'settings.changed'].map((a) => ({ value: a, label: actionLabel(a) })) },
  ]
  const columns: Column<Act>[] = [
    { key: 'at', label: 'Date', render: (a) => <span className="whitespace-nowrap text-xs">{fmtDateTime(a.at)}</span> },
    { key: 'user', label: 'Utilisateur', render: (a) => <b className="text-sm">{a.userName}</b> },
    { key: 'action', label: 'Action', render: (a) => <span className="text-sm">{actionLabel(a.action)}</span> },
    { key: 'entity', label: 'Élément', render: (a) => <span className="text-xs text-ink-600">{a.entityType}{a.entityId ? ` · ${a.entityId}` : ''}</span> },
    { key: 'details', label: 'Détails', hideOn: 'md', render: (a) => <code className="line-clamp-2 max-w-md text-[0.68rem] text-ink-500">{JSON.stringify(a.details)}</code> },
  ]
  return (
    <Panel title="Journal d’audit" description="Toutes les actions importantes du CRM : qui, quoi, quand." action={<ExportButtons name="journal-audit" getData={async () => { const r = await crmGet<Page<Act>>('/activity', { ...params, page: 1, pageSize: 200 }); return { columns: ['Date', 'Utilisateur', 'Action', 'Élément', 'Identifiant', 'Détails'], rows: r.rows.map((a) => [a.at, a.userName, actionLabel(a.action), a.entityType, a.entityId || '', JSON.stringify(a.details)]) } }} />}>
      <div className="p-4"><FilterBar values={values} onChange={setValues} filters={filters} period searchPlaceholder="Rechercher dans le journal…" /></div>
      <DataTable columns={columns} page={data} loading={loading} error={error} values={values} onChange={setValues} empty={{ icon: <History size={20} />, title: 'Aucune action sur cette période' }} />
    </Panel>
  )
}


import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Bell, CheckCheck, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Badge, Button, Checkbox, Modal } from '@/components/ui'
import { EmptyBox, LoadingRows, Panel, Rows, Segmented } from '@/components/admin-kit'
import { Pagination, crmGet, crmSend, errorText, fmtDateTime, useCrm, useCrmQuery, useNotify, type Page } from '@/features/crm/core'
import { NOTIFICATION_LABELS } from '@/features/crm/permissions'

export const Route = createFileRoute('/crm/notifications')({ component: NotificationsPage })

type Notif = { id: string; type: string; title: string; message: string; meta: Record<string, string>; readAt: string | null; createdAt: string }

function NotificationsPage() {
  const { setUnread } = useCrm()
  const navigate = useNavigate()
  const notify = useNotify()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useCrmQuery<Page<Notif> & { unread: number }>('/notifications', { unread: filter === 'unread' ? 1 : undefined, page, pageSize: 25 })
  const [prefsOpen, setPrefsOpen] = useState(false)
  useEffect(() => { if (data) setUnread(data.unread) }, [data, setUnread])

  async function open(n: Notif) {
    if (!n.readAt) await crmSend(`/notifications/${n.id}/read`, 'POST').catch(() => undefined)
    if (n.meta?.contactId) void navigate({ to: '/crm/contacts/$id' as any, params: { id: n.meta.contactId } as any })
    else if (n.meta?.appointmentId) void navigate({ to: '/crm/rendez-vous' as any, search: { appointment: n.meta.appointmentId } as any })
    else if (n.meta?.campaignId) void navigate({ to: '/crm/campagnes/$id' as any, params: { id: n.meta.campaignId } as any })
    else if (n.meta?.databaseId) void navigate({ to: '/crm/bases/$id' as any, params: { id: n.meta.databaseId } as any })
    else void reload()
  }

  return (
    <div>
      <PageHeader eyebrow="CRM · Compte" title="Notifications" description="Rendez-vous, rappels, affectations, campagnes et imports. Cliquez sur une notification pour ouvrir l’élément concerné." actions={<><Button size="sm" variant="outline" onClick={() => setPrefsOpen(true)}><Settings2 size={14} />Préférences</Button><Button size="sm" disabled={!data?.unread} onClick={() => void crmSend('/notifications/read-all', 'POST').then(() => { notify('Tout est marqué comme lu'); void reload() }, (e) => notify('Action impossible', 'warning', errorText(e)))}><CheckCheck size={14} />Tout marquer comme lu</Button></>} />
      <div className="mb-4"><Segmented value={filter} onChange={(v) => { setFilter(v); setPage(1) }} options={[{ value: 'all', label: 'Toutes' }, { value: 'unread', label: 'Non lues', count: data?.unread ?? 0 }]} /></div>
      <Panel>
        {error ? <p className="p-4 text-sm text-red-600">{error}</p> : null}
        {loading && !data ? <LoadingRows /> : null}
        {data && !data.rows.length ? <EmptyBox icon={<Bell size={20} />} title={filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'} /> : null}
        <Rows>
          {(data?.rows || []).map((n) => (
            <li key={n.id}>
              <button type="button" className={`crm-notif ${n.readAt ? '' : 'is-unread'}`} onClick={() => void open(n)}>
                <span className="crm-notif-dot" />
                <span className="min-w-0 flex-1 text-left"><span className="flex flex-wrap items-center gap-2"><b className="text-sm text-ink-950">{n.title}</b><Badge tone="neutral">{NOTIFICATION_LABELS[n.type.replace(/^crm\./, '')] || n.type}</Badge></span><span className="block text-sm text-ink-600">{n.message}</span><span className="block text-xs text-ink-400">{fmtDateTime(n.createdAt)}</span></span>
              </button>
            </li>
          ))}
        </Rows>
        {data && data.total > 0 ? <Pagination page={data} values={{}} onChange={(v) => setPage(Number(v.page) || 1)} /> : null}
      </Panel>
      {prefsOpen ? <PreferencesModal onClose={() => setPrefsOpen(false)} /> : null}
    </div>
  )
}

function PreferencesModal({ onClose }: { onClose: () => void }) {
  const notify = useNotify()
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null)
  const [disabled, setDisabled] = useState<string[]>([])
  useEffect(() => { crmGet<{ preferences: Record<string, boolean>; globallyDisabled: string[] }>('/notifications/preferences').then((r) => { setPrefs(r.preferences); setDisabled(r.globallyDisabled) }, () => undefined) }, [])
  return (
    <Modal open onClose={onClose} title="Préférences de notification" description="Choisissez les notifications que vous souhaitez recevoir.">
      {!prefs ? <LoadingRows /> : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">{Object.entries(prefs).map(([k, v]) => <Checkbox key={k} label={`${NOTIFICATION_LABELS[k] || k}${disabled.includes(k) ? ' (désactivée par l’administrateur)' : ''}`} checked={v && !disabled.includes(k)} disabled={disabled.includes(k)} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />)}</div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={() => void crmSend('/notifications/preferences', 'PUT', prefs).then(() => { notify('Préférences enregistrées'); onClose() }, (e) => notify('Enregistrement impossible', 'warning', errorText(e)))}>Enregistrer</Button></div>
        </div>
      )}
    </Modal>
  )
}

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Bell, Check, CircleDot } from 'lucide-react'
import { AppShell } from '@/components/layouts'
import { Badge, Button } from '@/components/ui'
import { GateMessage } from '@/features/auth/WorkspaceGate'
import { useAuth, type AuthUser } from '@/features/auth/AuthContext'
import { CrmProvider } from '@/features/crm/core'
import { OrgProvider } from '@/features/organization/core'
import { apiRequest } from '@/lib/accompagnement'
import { cn } from '@/lib/utils'
import { formatDateTime, STATUS_LABEL, STATUS_TONE, type WebsiteEvent, type WebsiteStatus } from './api'

type ToolKey = keyof NonNullable<AuthUser['tools']>

/** Ouvre l'outil dans l'espace habituel du compte. Le serveur revérifie chaque droit. */
export function ToolShell({ tool, children }: { tool: ToolKey | ToolKey[]; children: ReactNode }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <GateMessage title="Vérification de votre session" detail="Nous vérifions votre accès avant d’ouvrir cet espace." />
  if (auth.status !== 'authenticated' || !auth.user) return <GateMessage title="Connexion requise" detail="Cet espace nécessite un compte ALLNEEDS actif."><Link to="/connexion"><Button>Se connecter</Button></Link></GateMessage>
  const keys = Array.isArray(tool) ? tool : [tool]
  if (!keys.some((key) => auth.user?.tools?.[key])) return <GateMessage title="Accès non autorisé" detail="Votre compte ne donne pas accès à cet espace." />
  const { role } = auth.user
  if (role === 'admin') return <AppShell variant="admin">{children}</AppShell>
  if (role === 'concierge') return <AppShell variant="concierge">{children}</AppShell>
  if (role === 'agent' || role === 'crm') return <CrmProvider><AppShell variant="crm">{children}</AppShell></CrmProvider>
  if (role === 'staff') return <OrgProvider><AppShell variant="org">{children}</AppShell></OrgProvider>
  return <AppShell variant="client">{children}</AppShell>
}

export const StatusPill = ({ status }: { status: WebsiteStatus }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>

const EVENT_LABEL: Record<string, string> = { created: 'Demande envoyée', assigned: 'Développeur assigné', progress: 'Progression mise à jour' }

export function Timeline({ events }: { events: WebsiteEvent[] }) {
  return (
    <ol className="pj-timeline">
      {events.map((event, index) => (
        <li key={event.id} className={cn(index === events.length - 1 && 'is-last')}>
          <span className="pj-timeline-dot">{index === events.length - 1 ? <CircleDot size={13} /> : <Check size={12} />}</span>
          <div>
            <strong>{event.type === 'status' && event.to ? STATUS_LABEL[event.to] : EVENT_LABEL[event.type] ?? event.type}</strong>
            <small>{formatDateTime(event.createdAt)}{event.actorName ? ` · ${event.actorName}` : ''}</small>
            {event.message ? <p>{event.message}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

type Notice = { id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string; meta?: { requestId?: string } }

/** Notifications des sites web, enregistrées côté serveur pour le compte connecté. */
export function ProjectBell() {
  const auth = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [items, setItems] = useState<Notice[]>([])
  const [open, setOpen] = useState(false)
  const tools = auth.user?.tools
  const enabled = Boolean(tools?.websites || tools?.developer || tools?.websiteAdmin)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const rows = await apiRequest<Notice[]>('/api/notifications')
      setItems(rows.filter((row) => row.type.startsWith('website.')).slice(0, 15))
    } catch { /* la cloche reste vide si le service ne répond pas */ }
  }, [enabled])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60_000)
    return () => window.clearInterval(timer)
  }, [load, pathname])

  if (!enabled) return null
  const unread = items.filter((item) => !item.readAt).length
  const base = tools?.websiteAdmin ? '/admin/sites-web' : tools?.developer ? '/developpeur/sites-web' : '/sites-web'

  const openNotice = async (item: Notice) => {
    setOpen(false)
    if (!item.readAt) {
      setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)))
      await apiRequest(`/api/notifications/${item.id}/read`, { method: 'POST' }).catch(() => undefined)
    }
    if (item.meta?.requestId) void navigate({ to: `${base}/${item.meta.requestId}` as never })
  }

  return (
    <div className="pj-bell relative">
      <button type="button" className="an-icon-btn relative" aria-label="Notifications des sites web" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={17} />
        {unread ? <span className="crm-bell-count">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pj-bell-menu" role="menu">
            <p className="pj-bell-title">Notifications</p>
            {items.length ? items.map((item) => (
              <button key={item.id} type="button" role="menuitem" className={cn('pj-bell-item', !item.readAt && 'is-unread')} onClick={() => void openNotice(item)}>
                <strong>{item.title}</strong>
                <span>{item.message}</span>
                <small>{formatDateTime(item.createdAt)}</small>
              </button>
            )) : <p className="pj-bell-empty">Aucune notification pour le moment.</p>}
          </div>
        </>
      ) : null}
    </div>
  )
}

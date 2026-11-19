import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState, type LinkProps } from '@tanstack/react-router'
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Check,
  Monitor,
  Moon,
  Palette,
  Sun,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Receipt,
  RefreshCcw,
  Settings2,
  UserRoundCog,
  UsersRound,
  X,
  BadgeCheck,
  Presentation,
} from 'lucide-react'
import { useDemo } from '@/store/store'
import { canAccessSalesPresentation, useAuth } from '@/features/auth/AuthContext'
import { clientModules, orgSaasActive, type AccessModule } from '@/lib/access'
import { cn } from '@/lib/utils'
import { THEMES, useWorkspaceTheme, type ThemeMode } from '@/lib/theme'
import { Avatar } from '@/components/ui'
import { LanguageSwitch } from '@/i18n/LanguageSwitch'

/* ------------------------------------------------------------------ */
/* Toaster                                                             */
/* ------------------------------------------------------------------ */

export function Toaster() {
  const { state, dispatch } = useDemo()

  useEffect(() => {
    if (state.toasts.length === 0) return
    const timers = state.toasts.map((toast) =>
      window.setTimeout(() => dispatch({ type: 'TOAST_REMOVE', id: toast.id }), 5200),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [state.toasts, dispatch])

  if (state.toasts.length === 0) return null

  const tones = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {state.toasts.map((toast) => (
        <div key={toast.id} className={cn('pointer-events-auto animate-fade-up rounded-2xl border px-4 py-3 shadow-[0_18px_40px_-12px_rgba(16,36,76,.25)]', tones[toast.tone])}>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-0.5 text-xs opacity-80">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string
  to: LinkProps['to']
  icon: ReactNode
  badge?: number
  disabled?: boolean
  disabledHint?: string
  group: string
}

/** Nav client : uniquement Accueil, Diagnostic et Profil par défaut. Chaque module n'apparaît que s'il a été activé par ALLNEEDS — jamais grisé, jamais verrouillé. Le SaaS (abonnement + activation) est géré séparément. */
function buildClientNav(
  modules: Record<AccessModule, boolean>,
  unreadMessages: number,
  pendingDocs: number,
  _saasAccess: boolean,
): NavItem[] {
  const items: NavItem[] = [
    { group: 'Espace', label: 'Accueil', to: '/app', icon: <LayoutDashboard className="h-4 w-4" /> },
    { group: 'Espace', label: 'Diagnostic 360°', to: '/app/diagnostic-auto' as any, icon: <Gauge className="h-4 w-4" /> },
    { group: 'Compte', label: 'Offres', to: '/app/offres' as any, icon: <Receipt className="h-4 w-4" /> },
    { group: 'Compte', label: 'Abonnement Besoins', to: '/app/mon-abonnement-besoins' as any, icon: <Inbox className="h-4 w-4" /> },
  ]

  const optional: Array<{ key: AccessModule; group: string; label: string; to: string; icon: ReactNode; badge?: number }> = [
    { key: 'besoins', group: 'Piloter', label: 'Besoins', to: '/app/besoins', icon: <Inbox className="h-4 w-4" /> },
    { key: 'missions', group: 'Piloter', label: 'Missions', to: '/app/missions', icon: <Briefcase className="h-4 w-4" /> },
    { key: 'results', group: 'Piloter', label: 'Résultats', to: '/app/performance', icon: <LineChart className="h-4 w-4" /> },
    { key: 'documents', group: 'Collaborer', label: 'Documents', to: '/app/documents', icon: <FileText className="h-4 w-4" />, badge: pendingDocs },
    { key: 'messages', group: 'Collaborer', label: 'Messages', to: '/app/messages', icon: <MessageSquare className="h-4 w-4" />, badge: unreadMessages },
    { key: 'rendezVous', group: 'Collaborer', label: 'Rendez-vous', to: '/app/rendez-vous', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'equipe', group: 'Collaborer', label: 'Équipe', to: '/app/equipe', icon: <UsersRound className="h-4 w-4" /> },
    { key: 'notifications', group: 'Collaborer', label: 'Notifications', to: '/app/notifications', icon: <Bell className="h-4 w-4" /> },
    { key: 'prestataires', group: 'Réseau', label: 'Prestataires', to: '/app/prestataires', icon: <Network className="h-4 w-4" /> },
    { key: 'devis', group: 'Compte', label: 'Devis', to: '/app/devis', icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'abonnement', group: 'Compte', label: 'Offres & abonnement', to: '/app/abonnement', icon: <Receipt className="h-4 w-4" /> },
  ]

  for (const def of optional) {
    if (modules[def.key]) items.push({ group: def.group, label: def.label, to: def.to as any, icon: def.icon, badge: def.badge })
  }

  items.push({ group: 'Réseau', label: 'Espace métier', to: '/app/espace-metier' as any, icon: <Building2 className="h-4 w-4" /> })

  items.push({ group: 'Compte', label: 'Profil & activité', to: '/app/parametres' as any, icon: <Settings2 className="h-4 w-4" /> })
  return items
}


function buildConciergeNav(salesAccess = false): NavItem[] {
  return [
    { group: 'Portefeuille', label: 'Mon portefeuille', to: '/concierge' as any, icon: <LayoutDashboard className="h-4 w-4" /> },
    { group: 'Portefeuille', label: 'Entreprises suivies', to: '/concierge/entreprises' as any, icon: <Building2 className="h-4 w-4" /> },
    { group: 'Suivi', label: 'Besoins', to: '/concierge/besoins' as any, icon: <Inbox className="h-4 w-4" /> },
    { group: 'Suivi', label: 'Diagnostics', to: '/concierge/diagnostics' as any, icon: <Gauge className="h-4 w-4" /> },
    { group: 'Suivi', label: 'Missions', to: '/concierge/missions' as any, icon: <Briefcase className="h-4 w-4" /> },
    { group: 'Développement client', label: 'Offres complémentaires', to: '/concierge/suivi-commercial' as any, icon: <BarChart3 className="h-4 w-4" /> },
    { group: 'Coordination', label: 'Prestataires', to: '/concierge/prestataires' as any, icon: <Network className="h-4 w-4" /> },
    { group: 'Coordination', label: 'Rendez-vous', to: '/concierge/rendez-vous' as any, icon: <CalendarDays className="h-4 w-4" /> },
    { group: 'Coordination', label: 'Documents', to: '/concierge/documents' as any, icon: <FileText className="h-4 w-4" /> },
    { group: 'Coordination', label: 'Messages', to: '/concierge/messages' as any, icon: <MessageSquare className="h-4 w-4" /> },
    ...(salesAccess ? [{ group: 'Développement client', label: 'Sales Presentation', to: '/sales-presentation' as any, icon: <Presentation className="h-4 w-4" /> }] : []),
  ]
}

/** Groupe replié en bas du menu : pages encore basées sur des données de démonstration. */
const PREVIEW_GROUP = 'En préparation'

function buildAdminNav(): NavItem[] {
  return [
    { group: 'Pilotage', label: 'Tableau de bord', to: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { group: 'Pilotage', label: 'Sales Presentation', to: '/sales-presentation' as any, icon: <Presentation className="h-4 w-4" /> },
    { group: 'Clients', label: 'Inscriptions', to: '/admin/inscriptions' as any, icon: <ClipboardCheck className="h-4 w-4" /> },
    { group: 'Clients', label: 'Clients & accès', to: '/admin/clients', icon: <Building2 className="h-4 w-4" /> },
    { group: 'Clients', label: 'Diagnostics', to: '/admin/diagnostics/reel' as any, icon: <Gauge className="h-4 w-4" /> },
    { group: 'Commercial', label: 'Offres', to: '/admin/offres' as any, icon: <Receipt className="h-4 w-4" /> },
    { group: 'Commercial', label: 'Abonnements Besoins', to: '/admin/abonnements' as any, icon: <RefreshCcw className="h-4 w-4" /> },
    { group: 'Commercial', label: 'Besoins', to: '/admin/besoins', icon: <Inbox className="h-4 w-4" /> },
    { group: 'Commercial', label: 'Missions', to: '/admin/missions', icon: <Briefcase className="h-4 w-4" /> },
    { group: 'Équipe', label: 'Concierges', to: '/admin/concierges' as any, icon: <UserRoundCog className="h-4 w-4" /> },
    { group: 'Équipe', label: 'Accès commerciaux', to: '/admin/commerciaux' as any, icon: <BadgeCheck className="h-4 w-4" /> },
    { group: 'Équipe', label: 'Grille STARTER', to: '/admin/grille', icon: <ClipboardList className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Pipeline', to: '/admin/pipeline', icon: <BarChart3 className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Relances', to: '/admin/relances', icon: <Bell className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Qualification', to: '/admin/qualification', icon: <MessageSquare className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Prestataires', to: '/admin/prestataires', icon: <Network className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Quotas', to: '/admin/quotas', icon: <LineChart className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Autoévaluations', to: '/admin/diagnostics-auto', icon: <FileText className="h-4 w-4" /> },
    { group: PREVIEW_GROUP, label: 'Diagnostics internes', to: '/admin/diagnostics', icon: <ClipboardList className="h-4 w-4" /> },
  ]
}

/* ------------------------------------------------------------------ */
/* App shell                                                           */
/* ------------------------------------------------------------------ */

const VARIANT_META = {
  admin: { label: 'Administration', badge: 'Admin', palette: 'indigo' },
  concierge: { label: 'Concierge', badge: 'Concierge', palette: 'ocean' },
  client: { label: 'Espace client', badge: 'Client', palette: 'allneeds' },
} as const

function readCollapsed() {
  try {
    return window.localStorage.getItem('an-sidebar-collapsed') === '1'
  } catch {
    return false
  }
}

export function AppShell({
  children,
  variant,
}: {
  children: ReactNode
  variant: 'client' | 'admin' | 'concierge'
}) {
  const { state, user } = useDemo()
  const auth = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = VARIANT_META[variant]
  const theme = useWorkspaceTheme(meta.palette)
  const [themeOpen, setThemeOpen] = useState(false)

  const displayUser = auth.status === 'authenticated' && auth.user ? {
    ...user,
    id: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    roleLabel: auth.user.role === 'admin' ? 'Administrateur' : auth.user.role === 'concierge' ? 'Concierge' : auth.user.role === 'manager' ? 'Responsable' : auth.user.role === 'collaborateur' ? 'Collaborateur' : user.roleLabel,
  } : user

  const unread = auth.status === 'authenticated' ? 0 : state.threads.reduce((acc, t) => acc + t.unread, 0)
  const pendingDocs = auth.status === 'authenticated' ? 0 : state.documents.filter((d) => d.status !== 'valide').length
  const clientOrg = auth.status === 'authenticated' ? auth.user?.organization : state.orgs.find((org) => org.id === user.orgId)
  const modules = clientModules(auth.user?.organization ?? null)
  const saasAccess = orgSaasActive(auth.user?.organization ?? null)
  const nav = variant === 'admin' ? buildAdminNav() : variant === 'concierge' ? buildConciergeNav(canAccessSalesPresentation(auth.user)) : buildClientNav(modules, unread, pendingDocs, saasAccess)
  const current = [...nav].sort((a, b) => String(b.to).length - String(a.to).length).find((item) => {
    const to = String(item.to).replace(/\/$/, '')
    return pathname === to || pathname === `${to}/` || (to.split('/').length > 2 && pathname.startsWith(`${to}/`))
  })

  useEffect(() => {
    try {
      window.localStorage.setItem('an-sidebar-collapsed', collapsed ? '1' : '0')
    } catch {
      /* stockage indisponible */
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setMenuOpen(false)
        setMobileNavOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
    setMenuOpen(false)
  }, [pathname])

  const logout = () => {
    void auth.logout().catch(() => undefined)
    void navigate({ to: '/' })
  }

  const subtitle = variant === 'admin' ? 'Pilotage ALLNEEDS' : variant === 'concierge' ? 'Entreprises attribuées' : clientOrg ? `${clientOrg.sector ?? 'Entreprise'} · accès sécurisé` : 'Votre espace ALLNEEDS'
  const orgName = variant === 'client' ? (clientOrg?.name ?? 'Espace client') : null

  return (
    <div
      className={cn('an-shell', `workspace-${variant}`, collapsed && 'is-collapsed')}
      data-mode={theme.dark ? 'dark' : 'light'}
      style={{ ['--an-accent' as string]: theme.palette.accent, ['--an-accent-2' as string]: theme.palette.accent2, colorScheme: theme.dark ? 'dark' : 'light' }}
    >
      <div className="an-shell-sidebar-wrap">
        <aside className="an-sidebar" aria-label="Barre latérale">
          <SidebarContent
            nav={nav}
            meta={meta}
            collapsed={collapsed}
            orgName={orgName}
            user={displayUser}
            onLogout={logout}
            onToggle={() => setCollapsed((c) => !c)}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </aside>
      </div>

      {mobileNavOpen ? (
        <div className="an-drawer-backdrop" onClick={() => setMobileNavOpen(false)}>
          <aside className="an-sidebar an-drawer" onClick={(event) => event.stopPropagation()}>
            <SidebarContent nav={nav} meta={meta} collapsed={false} orgName={orgName} user={displayUser} onLogout={logout} onNavigate={() => setMobileNavOpen(false)} onClose={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="an-shell-main">
        <header className="an-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileNavOpen(true)} aria-label="Ouvrir le menu" className="an-icon-btn an-mobile-only">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="an-crumb truncate">
                <span>{meta.label}</span>
                <ChevronRight size={13} />
                <b>{current?.label ?? 'Espace'}</b>
              </p>
              <p className="an-topbar-sub truncate">{orgName ?? subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitch className="hidden sm:inline-flex" />
            <div className="relative">
              <button type="button" onClick={() => setThemeOpen((o) => !o)} className="an-icon-btn" aria-label="Changer le thème" aria-expanded={themeOpen} title="Thème">
                {theme.dark ? <Moon size={17} /> : <Palette size={17} />}
              </button>
              {themeOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
                  <ThemeMenu theme={theme} />
                </>
              ) : null}
            </div>

            <button type="button" onClick={() => setPaletteOpen(true)} className="an-search-trigger" aria-label="Rechercher une page">
              <Search size={15} />
              <span className="hidden md:inline">Rechercher…</span>
              <kbd className="hidden md:inline">Ctrl K</kbd>
            </button>

            {variant === 'client' && modules.messages ? (
              <Link to="/app/messages" className="an-icon-btn relative" aria-label="Messages">
                <Bell size={17} />
                {unread > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> : null}
              </Link>
            ) : null}

            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((o) => !o)} className="an-user-trigger" aria-expanded={menuOpen} aria-haspopup="menu">
                <Avatar name={displayUser.name} size="sm" />
                <span className="hidden text-left leading-tight md:block">
                  <span className="block text-xs font-semibold text-ink-900">{displayUser.name}</span>
                  <span className="block text-[0.68rem] text-ink-500">{displayUser.roleLabel}</span>
                </span>
                <ChevronDown size={14} className="hidden text-ink-400 md:block" />
              </button>
              {menuOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div role="menu" className="an-menu">
                    <div className="border-b border-ink-100 px-3 pb-3 pt-2">
                      <p className="truncate text-sm font-semibold text-ink-950">{displayUser.name}</p>
                      <p className="truncate text-xs text-ink-500">{displayUser.email}</p>
                      <span className="an-role-chip mt-2">{meta.badge}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 sm:hidden"><span className="text-xs font-semibold text-ink-500">Langue</span><LanguageSwitch /></div>
                    <Link to="/" role="menuitem" className="an-menu-item"><Home size={15} />Site public</Link>
                    {variant === 'client' ? <Link to={'/app/parametres' as any} role="menuitem" className="an-menu-item"><Settings2 size={15} />Profil & activité</Link> : null}
                    <button type="button" role="menuitem" onClick={logout} className="an-menu-item text-red-600"><LogOut size={15} />Se déconnecter</button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="an-main">{children}</main>
      </div>

      {paletteOpen ? <CommandPalette items={nav} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  )
}

function SidebarContent({
  nav,
  meta,
  collapsed,
  orgName,
  user,
  onLogout,
  onToggle,
  onNavigate,
  onClose,
}: {
  nav: NavItem[]
  meta: (typeof VARIANT_META)[keyof typeof VARIANT_META]
  collapsed: boolean
  orgName: string | null
  user: { name: string; email?: string; roleLabel: string }
  onLogout: () => void
  onToggle?: () => void
  onNavigate: () => void
  onClose?: () => void
}) {
  return (
    <>
      <div className="an-sidebar-head">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={onNavigate}>
          <span className="an-logo-mark"><img src="/allneeds-icon.svg" alt="" /></span>
          {!collapsed ? (
            <span className="min-w-0 leading-none">
              <span className="an-logo-text">all<em>needs</em></span>
              <span className="an-logo-sub">{meta.label}</span>
            </span>
          ) : null}
        </Link>
        {onClose ? <button type="button" onClick={onClose} className="an-side-icon" aria-label="Fermer le menu"><X size={17} /></button> : null}
      </div>

      {orgName && !collapsed ? (
        <div className="an-org-card">
          <span>{orgName.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0"><b className="truncate">{orgName}</b><small>Organisation</small></div>
        </div>
      ) : null}

      <WorkspaceNavigation items={nav} collapsed={collapsed} onNavigate={onNavigate} />

      <div className="an-sidebar-foot">
        {!collapsed ? (
          <div className="an-side-user">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0 flex-1"><b className="truncate">{user.name}</b><small className="truncate">{user.roleLabel}</small></div>
            <button type="button" onClick={onLogout} className="an-side-icon" title="Se déconnecter" aria-label="Se déconnecter"><LogOut size={15} /></button>
          </div>
        ) : (
          <button type="button" onClick={onLogout} className="an-side-icon mx-auto" title="Se déconnecter" aria-label="Se déconnecter"><LogOut size={16} /></button>
        )}
        {onToggle ? (
          <button type="button" onClick={onToggle} className="an-collapse-btn" aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /><span>Replier</span></>}
          </button>
        ) : null}
      </div>
    </>
  )
}

function NavLinkItem({ item, collapsed, exact, onNavigate }: { item: NavItem; collapsed: boolean; exact: boolean; onNavigate: () => void }) {
  if (item.disabled) {
    return (
      <div title={item.disabledHint} className="an-nav-link is-disabled">
        <span className="an-nav-icon">{item.icon}</span>
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </div>
    )
  }
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className="an-nav-link"
      activeOptions={{ exact }}
      activeProps={{ className: 'is-active' }}
    >
      <span className="an-nav-icon">{item.icon}</span>
      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
      {item.badge && !collapsed ? <span className="an-nav-badge">{item.badge}</span> : null}
    </Link>
  )
}

function WorkspaceNavigation({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed: boolean; onNavigate: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const main = items.filter((item) => item.group !== PREVIEW_GROUP)
  const preview = items.filter((item) => item.group === PREVIEW_GROUP)
  const previewActive = preview.some((item) => pathname === String(item.to) || pathname.startsWith(`${String(item.to)}/`) && !main.some((m) => pathname.startsWith(String(m.to)) && String(m.to).length > String(item.to).length))
  const groups = [...new Set(main.map((item) => item.group))]
  // Un lien qui est le préfixe d’un autre (ex. /admin, /admin/diagnostics) n’est actif que sur sa page exacte.
  const isExact = (item: NavItem) => items.some((other) => other !== item && String(other.to).startsWith(`${String(item.to).replace(/\/$/, '')}/`))
  return <nav aria-label="Navigation de l’espace" className="an-nav">
    {groups.map((group) => (
      <div key={group}>
        {collapsed ? <hr className="an-nav-sep" /> : <p className="an-nav-group">{group}</p>}
        {main.filter((item) => item.group === group).map((item) => <NavLinkItem key={String(item.to)} item={item} collapsed={collapsed} exact={isExact(item)} onNavigate={onNavigate} />)}
      </div>
    ))}
    {preview.length && !collapsed ? (
      <details className="an-nav-preview" open={previewActive || undefined}>
        <summary>
          <span>{PREVIEW_GROUP}</span>
          <ChevronDown size={14} />
        </summary>
        <p className="an-nav-preview-note">Pages de démonstration, pas encore reliées aux données réelles.</p>
        {preview.map((item) => <NavLinkItem key={String(item.to)} item={item} collapsed={false} exact={isExact(item)} onNavigate={onNavigate} />)}
      </details>
    ) : null}
  </nav>
}

function ThemeMenu({ theme }: { theme: ReturnType<typeof useWorkspaceTheme> }) {
  const modes: Array<{ id: ThemeMode; label: string; icon: ReactNode }> = [
    { id: 'light', label: 'Clair', icon: <Sun size={15} /> },
    { id: 'dark', label: 'Sombre', icon: <Moon size={15} /> },
    { id: 'auto', label: 'Auto', icon: <Monitor size={15} /> },
  ]
  return (
    <div role="dialog" aria-label="Thème" className="an-menu an-theme-menu">
      <p className="an-theme-label">Apparence</p>
      <div className="an-theme-modes">
        {modes.map((m) => (
          <button key={m.id} type="button" onClick={() => theme.setMode(m.id)} className={cn(theme.mode === m.id && 'is-on')} aria-pressed={theme.mode === m.id}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>
      <p className="an-theme-label">Couleur</p>
      <div className="an-theme-swatches">
        {THEMES.map((t) => (
          <button key={t.id} type="button" onClick={() => theme.setPalette(t.id)} aria-pressed={theme.palette.id === t.id} className={cn(theme.palette.id === t.id && 'is-on')} title={t.label}>
            <span style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})` }}>{theme.palette.id === t.id ? <Check size={14} /> : null}</span>
            <small>{t.label}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

function CommandPalette({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const q = query.trim().toLowerCase()
  const results = items.filter((item) => !item.disabled && (!q || `${item.label} ${item.group}`.toLowerCase().includes(q)))

  const go = (item?: NavItem) => {
    if (!item) return
    onClose()
    void navigate({ to: item.to as any })
  }

  return (
    <div className="an-palette-backdrop" onClick={onClose}>
      <div className="an-palette" role="dialog" aria-label="Recherche rapide" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ink-100 px-4">
          <Search size={17} className="text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
              if (event.key === 'Enter') go(results[active])
            }}
            placeholder="Aller à une page…"
            className="h-14 flex-1 bg-transparent text-[0.95rem] text-ink-900 outline-none placeholder:text-ink-400"
          />
          <kbd className="an-kbd">Échap</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.map((item, index) => (
            <li key={String(item.to)}>
              <button type="button" onMouseEnter={() => setActive(index)} onClick={() => go(item)} className={cn('an-palette-item', index === active && 'is-active')}>
                <span className="an-palette-icon">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                <small>{item.group}</small>
              </button>
            </li>
          ))}
          {results.length === 0 ? <li className="px-3 py-8 text-center text-sm text-ink-500">Aucune page ne correspond à « {query} ».</li> : null}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page header (used inside app + admin)                               */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('an-page-header an-hero-banner mb-6', className)}>
      <div className="relative z-[1] flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? <span className="an-hero-chip"><Sparkles size={12} />{eyebrow}</span> : null}
          <h1 className="mt-3.5 font-display text-2xl font-extrabold tracking-tight sm:text-[1.9rem]">{title}</h1>
          {description ? <div className="an-hero-desc mt-2 text-sm leading-relaxed">{description}</div> : null}
        </div>
        {actions ? <div className="an-hero-actions flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

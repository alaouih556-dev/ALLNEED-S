/*
 * CRM — socle commun : session (permissions, libellés), appels API, filtres, tableaux,
 * statuts, confirmations et exports. Toutes les données viennent de /api/crm/*.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, FileSpreadsheet, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/accompagnement'
import { useDemo } from '@/store/store'
import { Badge, Button, Checkbox, Input, Modal, Select } from '@/components/ui'
import { EmptyBox, LoadingRows } from '@/components/admin-kit'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Labels = { contact: Record<string, string>; call: Record<string, string>; appointment: Record<string, string> }
export type CrmUser = { id: string; name: string; email: string; phone: string; role: string; roleLabel: string; status: 'active' | 'inactive' | 'suspended'; active: boolean; passwordConfigured: boolean; lastLoginAt: string | null; createdAt: string | null; databaseIds: string[]; campaignIds: string[]; zoneIds: string[]; permissions: string[] | null; effectivePermissions: string[]; lastActivityAt: string | null; contactsAssigned?: number; callsMade?: number; appointmentsBooked?: number; contactsReached?: number; conversionRate?: number; callsToday?: number; contactRate?: number; confirmedAppointments?: number; completedAppointments?: number; callbacks?: number; avgCallDurationSec?: number | null }
export type CrmMe = { user: CrmUser; isAdmin: boolean; permissions: string[]; labels: Labels; appointmentTypes: string[]; campaignTypes: string[]; defaultDurationMin: number; geocoding: string; crmName: string; unread: number }
export type Lookups = { agents: Array<{ id: string; name: string; role: string; active: boolean }>; databases: Array<{ id: string; name: string; status: string }>; campaigns: Array<{ id: string; name: string; status: string }>; zones: Array<{ id: string; name: string; color: string }>; cities: string[]; regions: string[] }
export type Page<T> = { rows: T[]; page: number; pageSize: number; total: number; pages: number }
export type Contact = { id: string; databaseId: string; databaseName: string; campaignId: string | null; campaignName: string; agentId: string | null; agentName: string; firstName: string; lastName: string; fullName: string; phone: string; phone2: string; email: string; address: string; city: string; region: string; postalCode: string; country: string; mainSector: string; businessCategory: string; lat: number | null; lng: number | null; status: string; callStatus: string | null; appointmentStatus?: string | null; notes: string; tags: string[]; custom?: Record<string, string>; createdAt: string; updatedAt: string; lastContactAt: string | null; nextCallbackAt: string | null; archived?: boolean; locationSource?: string | null; geocodeError?: string | null; noteLog?: Array<{ id: string; at: string; byName: string; text: string }> }
export type Call = { id: string; contactId: string; contactName: string; agentId: string; agentName: string; phone: string; at: string; durationSec: number | null; status: string; result: string; notes: string; callbackAt: string | null; campaignId: string | null; campaignName: string; databaseId: string; databaseName: string; appointmentId: string | null }
export type Appointment = { id: string; title: string; contactId: string; contactName: string; phone: string; agentId: string | null; agentName: string; date: string; start: string; end: string; address: string; city: string; region: string; lat: number | null; lng: number | null; type: string; status: string; notes: string; campaignId: string | null; campaignName: string; databaseId: string; databaseName: string; createdAt: string; history?: Array<{ at: string; byName: string; action: string }> }

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function crmGet<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, String(v))
  const s = qs.toString()
  return apiRequest<T>(`/api/crm${path}${s ? `?${s}` : ''}`)
}
export function crmSend<T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  return apiRequest<T>(`/api/crm${path}`, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
}
export const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Une erreur est survenue.')

/** Charge une ressource CRM et la recharge quand ses paramètres changent. */
export function useCrmQuery<T>(path: string | null, params?: Record<string, string | number | boolean | null | undefined>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify([path, params])
  const seq = useRef(0)
  const reload = useCallback(async () => {
    if (!path) return
    const n = ++seq.current
    setLoading(true)
    setError('')
    try {
      const d = await crmGet<T>(path, params)
      if (n === seq.current) setData(d)
    } catch (e) {
      if (n === seq.current) setError(errorText(e))
    } finally {
      if (n === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, error, loading, reload, setData }
}

export function useNotify() {
  const { dispatch } = useDemo()
  return useCallback((title: string, tone: 'success' | 'info' | 'warning' = 'success', description?: string) => dispatch({ type: 'TOAST_ADD', toast: { title, tone, description } }), [dispatch])
}

/* ------------------------------------------------------------------ */
/* Session CRM                                                         */
/* ------------------------------------------------------------------ */

type CrmCtx = { me: CrmMe | null; lookups: Lookups | null; error: string; loading: boolean; can: (perm: string) => boolean; refresh: () => Promise<void>; refreshLookups: () => Promise<void>; setUnread: (n: number) => void }
const Ctx = createContext<CrmCtx | null>(null)

export function CrmProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<CrmMe | null>(null)
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refreshLookups = useCallback(async () => {
    try { setLookups(await crmGet<Lookups>('/lookups')) } catch { /* filtres indisponibles : les pages restent utilisables */ }
  }, [])
  const refresh = useCallback(async () => {
    try {
      setMe(await crmGet<CrmMe>('/me'))
      setError('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    void refreshLookups()
    const t = window.setInterval(() => void refresh(), 60000)
    return () => window.clearInterval(t)
  }, [refresh, refreshLookups])
  const setUnread = useCallback((n: number) => setMe((m) => (m && m.unread !== n ? { ...m, unread: n } : m)), [])
  const value = useMemo<CrmCtx>(() => ({
    me, lookups, error, loading, refresh, refreshLookups, setUnread,
    can: (perm) => Boolean(me?.permissions.includes(perm)),
  }), [me, lookups, error, loading, refresh, refreshLookups, setUnread])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useCrm() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCrm doit être utilisé dans CrmProvider')
  return v
}
export const useCrmOptional = () => useContext(Ctx)

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'
const TONES: Record<string, Record<string, Tone>> = {
  contact: { new: 'info', not_contacted: 'neutral', contacted: 'brand', interested: 'success', not_interested: 'neutral', callback_requested: 'warning', appointment_booked: 'success', invalid_number: 'danger', completed: 'success' },
  call: { new: 'info', called: 'neutral', answered: 'brand', no_answer: 'warning', busy: 'warning', invalid_number: 'danger', callback_requested: 'warning', interested: 'success', not_interested: 'neutral', appointment_booked: 'success', completed: 'success' },
  appointment: { pending: 'warning', confirmed: 'success', completed: 'brand', cancelled: 'danger', rescheduled: 'info', no_show: 'danger' },
  database: { draft: 'neutral', active: 'success', completed: 'brand', archived: 'neutral' },
  campaign: { draft: 'neutral', active: 'success', paused: 'warning', completed: 'brand', archived: 'neutral' },
  user: { active: 'success', inactive: 'neutral', suspended: 'danger' },
}
export const STATUS_HEX: Record<string, string> = { pending: '#f59e0b', confirmed: '#10b981', completed: '#6366f1', cancelled: '#ef4444', rescheduled: '#0ea5e9', no_show: '#be123c', new: '#0ea5e9', not_contacted: '#94a3b8', contacted: '#6366f1', interested: '#10b981', not_interested: '#64748b', callback_requested: '#f59e0b', appointment_booked: '#059669', invalid_number: '#ef4444' }
export const FIXED_LABELS: Record<string, Record<string, string>> = {
  database: { draft: 'Brouillon', active: 'Active', completed: 'Terminée', archived: 'Archivée' },
  campaign: { draft: 'Brouillon', active: 'Active', paused: 'En pause', completed: 'Terminée', archived: 'Archivée' },
  user: { active: 'Actif', inactive: 'Désactivé', suspended: 'Suspendu' },
}
export function useStatusLabel() {
  const crm = useCrmOptional()
  return useCallback((kind: string, key: string | null | undefined) => {
    if (!key) return '—'
    const custom = crm?.me?.labels?.[kind as keyof Labels]?.[key]
    return custom || FIXED_LABELS[kind]?.[key] || key
  }, [crm?.me?.labels])
}
export function StatusPill({ kind, value }: { kind: 'contact' | 'call' | 'appointment' | 'database' | 'campaign' | 'user'; value: string | null | undefined }) {
  const label = useStatusLabel()
  if (!value) return <span className="text-xs text-ink-400">—</span>
  return <Badge tone={TONES[kind]?.[value] || 'neutral'}>{label(kind, value)}</Badge>
}
export function statusOptions(labels: Labels | undefined, kind: 'contact' | 'call' | 'appointment') {
  return Object.entries(labels?.[kind] || {}).map(([value, label]) => ({ value, label }))
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0')
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function addDays(day: string, n: number) { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d) }
export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | 'all'
export function periodRange(p: Period, custom?: { from: string; to: string }): { from: string; to: string } {
  const t = localDay()
  const d = new Date()
  if (p === 'today') return { from: t, to: t }
  if (p === 'yesterday') { const y = addDays(t, -1); return { from: y, to: y } }
  if (p === 'week') { const dow = (d.getDay() + 6) % 7; return { from: addDays(t, -dow), to: t } }
  if (p === 'month') return { from: `${t.slice(0, 7)}-01`, to: t }
  if (p === 'year') return { from: `${t.slice(0, 4)}-01-01`, to: t }
  if (p === 'custom' && custom?.from && custom?.to) return custom
  return { from: '', to: '' }
}
export const PERIOD_LABELS: Record<Period, string> = { today: 'Aujourd’hui', yesterday: 'Hier', week: 'Cette semaine', month: 'Ce mois-ci', year: 'Cette année', custom: 'Période personnalisée', all: 'Tout' }
export function fmtDate(v?: string | null) { if (!v) return '—'; const d = new Date(v.length === 10 ? `${v}T12:00:00` : v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
export function fmtDateTime(v?: string | null) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
export function fmtDuration(sec?: number | null) { if (sec === null || sec === undefined) return '—'; const m = Math.floor(sec / 60); return m ? `${m} min ${pad(sec % 60)} s` : `${sec} s` }
export function toLocalInput(iso?: string | null) { if (!iso) return ''; const d = new Date(iso); return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
export function fromLocalInput(v: string) { return v ? new Date(v).toISOString() : null }

/* ------------------------------------------------------------------ */
/* Filtres                                                             */
/* ------------------------------------------------------------------ */

export type FilterDef = { key: string; label: string; options: Array<{ value: string; label: string }> }
export function useLookupFilters(keys: Array<'agent' | 'campaign' | 'database' | 'zone' | 'city' | 'region' | 'contactStatus' | 'callStatus' | 'appointmentStatus'>): FilterDef[] {
  const { lookups, me } = useCrm()
  return keys.flatMap<FilterDef>((k) => {
    switch (k) {
      case 'agent': return me?.isAdmin ? [{ key: 'agentId', label: 'Agent', options: (lookups?.agents || []).map((a) => ({ value: a.id, label: a.name })) }] : []
      case 'campaign': return [{ key: 'campaignId', label: 'Campagne', options: (lookups?.campaigns || []).map((c) => ({ value: c.id, label: c.name })) }]
      case 'database': return [{ key: 'databaseId', label: 'Base de contacts', options: (lookups?.databases || []).map((d) => ({ value: d.id, label: d.name })) }]
      case 'zone': return [{ key: 'zoneId', label: 'Zone', options: (lookups?.zones || []).map((z) => ({ value: z.id, label: z.name })) }]
      case 'city': return [{ key: 'city', label: 'Ville', options: (lookups?.cities || []).map((c) => ({ value: c, label: c })) }]
      case 'region': return [{ key: 'region', label: 'Région', options: (lookups?.regions || []).map((c) => ({ value: c, label: c })) }]
      case 'contactStatus': return [{ key: 'status', label: 'Statut contact', options: statusOptions(me?.labels, 'contact') }]
      case 'callStatus': return [{ key: 'callStatus', label: 'Statut d’appel', options: statusOptions(me?.labels, 'call') }]
      case 'appointmentStatus': return [{ key: 'appointmentStatus', label: 'Statut RDV', options: statusOptions(me?.labels, 'appointment') }]
    }
  })
}

/** Barre de filtres : recherche, listes déroulantes, période et réinitialisation. */
export function FilterBar({ values, onChange, filters, search = true, searchPlaceholder = 'Rechercher…', period, children }: { values: Record<string, string>; onChange: (next: Record<string, string>) => void; filters: FilterDef[]; search?: boolean; searchPlaceholder?: string; period?: boolean; children?: ReactNode }) {
  const [q, setQ] = useState(values.q || '')
  useEffect(() => setQ(values.q || ''), [values.q])
  useEffect(() => {
    if (!search || q === (values.q || '')) return
    const t = window.setTimeout(() => onChange({ ...values, q, page: '1' }), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  const set = (k: string, v: string) => onChange({ ...values, [k]: v, page: '1' })
  // Réglages d'affichage (vue, échelle, onglet…) : conservés, jamais comptés comme filtres.
  const DISPLAY_KEYS = ['page', 'pageSize', 'sort', 'dir', 'period', 'view', 'scale', 'date', 'tab', 'type', 'compare', 'layer', 'appointment']
  const active = Object.entries(values).filter(([k, v]) => v && !DISPLAY_KEYS.includes(k)).length
  const keep = Object.fromEntries(Object.entries(values).filter(([k]) => DISPLAY_KEYS.includes(k) && k !== 'page'))
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className={cn('crm-filters', mobileOpen && 'is-open')}>
      {filters.length || period || children ? (
        <button type="button" className="crm-filters-toggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen((o) => !o)}>
          <SlidersHorizontal size={14} />Filtres{active ? ` (${active})` : ''}
        </button>
      ) : null}
      {search ? (
        <label className="crm-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          {q ? <button type="button" onClick={() => setQ('')} aria-label="Effacer la recherche"><X size={14} /></button> : null}
        </label>
      ) : null}
      {period ? (
        <>
          <Select aria-label="Période" value={values.period || 'month'} onChange={(e) => onChange({ ...values, period: e.target.value, page: '1' })} className="crm-filter-select">
            {(['today', 'yesterday', 'week', 'month', 'year', 'all', 'custom'] as Period[]).map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </Select>
          {values.period === 'custom' ? (
            <span className="crm-daterange">
              <Input type="date" aria-label="Du" value={values.from || ''} onChange={(e) => set('from', e.target.value)} />
              <span>→</span>
              <Input type="date" aria-label="Au" value={values.to || ''} min={values.from || undefined} onChange={(e) => set('to', e.target.value)} />
            </span>
          ) : null}
        </>
      ) : null}
      {filters.map((f) => (
        <Select key={f.key} aria-label={f.label} value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} className="crm-filter-select">
          <option value="">{f.label} : tous</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ))}
      {children}
      {active ? (
        <button type="button" className="crm-clear" onClick={() => onChange({ ...keep, page: '1' })}>
          <RotateCcw size={13} />Effacer les filtres ({active})
        </button>
      ) : null}
    </div>
  )
}

/** Paramètres de période envoyés à l'API (from/to/today). */
export function periodParams(values: Record<string, string>) {
  const p = (values.period || 'month') as Period
  const r = periodRange(p, { from: values.from || '', to: values.to || '' })
  return { from: r.from, to: r.to, today: localDay() }
}

/* ------------------------------------------------------------------ */
/* Tableau                                                             */
/* ------------------------------------------------------------------ */

export type Column<T> = { key: string; label: string; sort?: string; render: (row: T) => ReactNode; className?: string; hideOn?: 'md' | 'lg' }
export function DataTable<T extends { id: string }>({ columns, page, loading, error, values, onChange, onRowClick, selectable, selected, onSelect, empty, rowActions }: {
  columns: Column<T>[]
  page: Page<T> | null
  loading: boolean
  error?: string
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
  onRowClick?: (row: T) => void
  selectable?: boolean
  selected?: Set<string>
  onSelect?: (next: Set<string>) => void
  empty: { icon: ReactNode; title: string; text?: string; action?: ReactNode }
  rowActions?: (row: T) => ReactNode
}) {
  const rows = page?.rows || []
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected?.has(r.id))
  const toggleAll = () => {
    const next = new Set(selected)
    if (allSelected) rows.forEach((r) => next.delete(r.id))
    else rows.forEach((r) => next.add(r.id))
    onSelect?.(next)
  }
  const sortBy = (key?: string) => {
    if (!key) return
    const dir = values.sort === key && values.dir === 'desc' ? 'asc' : 'desc'
    onChange({ ...values, sort: key, dir })
  }
  return (
    <div className="crm-table-wrap">
      {error ? <div className="crm-table-error">{error}</div> : null}
      <div className="overflow-x-auto">
        <table className="crm-table">
          <thead>
            <tr>
              {selectable ? <th className="w-10"><input type="checkbox" aria-label="Tout sélectionner" checked={Boolean(allSelected)} onChange={toggleAll} /></th> : null}
              {columns.map((c) => (
                <th key={c.key} className={cn(c.className, c.hideOn === 'md' && 'hidden md:table-cell', c.hideOn === 'lg' && 'hidden lg:table-cell')}>
                  {c.sort ? (
                    <button type="button" className="crm-sort" onClick={() => sortBy(c.sort)} aria-label={`Trier par ${c.label}`}>
                      {c.label}
                      {values.sort === c.sort ? (values.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
                    </button>
                  ) : c.label}
                </th>
              ))}
              {rowActions ? <th className="crm-actions-cell text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn(onRowClick && 'is-clickable', selected?.has(r.id) && 'is-selected')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {selectable ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Sélectionner" checked={Boolean(selected?.has(r.id))} onChange={() => { const next = new Set(selected); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); onSelect?.(next) }} />
                  </td>
                ) : null}
                {columns.map((c) => <td key={c.key} className={cn(c.className, c.hideOn === 'md' && 'hidden md:table-cell', c.hideOn === 'lg' && 'hidden lg:table-cell')}>{c.render(r)}</td>)}
                {rowActions ? <td className="crm-actions-cell text-right" onClick={(e) => e.stopPropagation()}><div className="inline-flex items-center justify-end gap-1">{rowActions(r)}</div></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && !rows.length ? <LoadingRows count={4} /> : null}
      {!loading && !rows.length && !error ? <EmptyBox icon={empty.icon} title={empty.title} text={empty.text} action={empty.action} /> : null}
      {page && page.total > 0 ? <Pagination page={page} values={values} onChange={onChange} /> : null}
    </div>
  )
}

export function Pagination({ page, values, onChange }: { page: Page<unknown>; values: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  const first = (page.page - 1) * page.pageSize + 1
  const last = Math.min(page.total, page.page * page.pageSize)
  return (
    <div className="crm-pagination">
      <span>{first}–{last} sur {page.total}</span>
      <div className="flex items-center gap-2">
        <Select aria-label="Lignes par page" value={String(page.pageSize)} onChange={(e) => onChange({ ...values, pageSize: e.target.value, page: '1' })} className="w-24">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </Select>
        <Button size="sm" variant="outline" disabled={page.page <= 1} onClick={() => onChange({ ...values, page: String(page.page - 1) })} aria-label="Page précédente"><ChevronLeft size={14} /></Button>
        <span className="text-xs font-semibold text-ink-600">{page.page} / {page.pages}</span>
        <Button size="sm" variant="outline" disabled={page.page >= page.pages} onClick={() => onChange({ ...values, page: String(page.page + 1) })} aria-label="Page suivante"><ChevronRight size={14} /></Button>
      </div>
    </div>
  )
}

/** État de filtres d'une page (mémorisé dans l'URL pour pouvoir partager ou revenir). */
export function useFilterState(defaults: Record<string, string> = {}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const p = new URLSearchParams(window.location.search)
    const v: Record<string, string> = { ...defaults }
    p.forEach((val, key) => { v[key] = val })
    return v
  })
  const update = useCallback((next: Record<string, string>) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v !== undefined))
    setValues(clean)
    const qs = new URLSearchParams(clean).toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }, [])
  return [values, update] as const
}

/* ------------------------------------------------------------------ */
/* Confirmation                                                        */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({ open, title, text, confirmLabel = 'Confirmer', danger, busy, onConfirm, onClose }: { open: boolean; title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="text-sm leading-relaxed text-ink-600">{text}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{busy ? 'Patientez…' : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}

/** Sélecteur multiple compact (cases à cocher dans une liste défilante). */
export function MultiPick({ options, value, onChange, empty = 'Aucun élément disponible.' }: { options: Array<{ id: string; name: string }>; value: string[]; onChange: (v: string[]) => void; empty?: string }) {
  if (!options.length) return <p className="rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-500">{empty}</p>
  return (
    <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-ink-100 p-3">
      {options.map((o) => <Checkbox key={o.id} label={o.name} checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...new Set([...value, o.id])] : value.filter((x) => x !== o.id))} />)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
export function exportCsv(name: string, columns: string[], rows: unknown[][]) {
  const body = [columns, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
  download(`${name}.csv`, new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }))
}
export async function exportExcel(name: string, columns: string[], rows: unknown[][]) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const data = [
    columns.map((c) => ({ value: c, fontWeight: 'bold' as const })),
    ...rows.map((r) => r.map((v) => (typeof v === 'number' ? v : v === null || v === undefined ? '' : String(v)))),
  ]
  const blob = (await (writeExcelFile(data as never) as unknown as { toBlob: () => Promise<Blob> }).toBlob())
  download(`${name}.xlsx`, blob)
}
export function ExportButtons({ name, getData, disabled }: { name: string; getData: () => Promise<{ columns: string[]; rows: unknown[][] }>; disabled?: boolean }) {
  const [busy, setBusy] = useState<'' | 'csv' | 'xlsx'>('')
  const notify = useNotify()
  const run = async (kind: 'csv' | 'xlsx') => {
    setBusy(kind)
    try {
      const { columns, rows } = await getData()
      if (kind === 'csv') exportCsv(name, columns, rows)
      else await exportExcel(name, columns, rows)
      notify(`Export ${kind === 'csv' ? 'CSV' : 'Excel'} prêt`, 'success', `${rows.length} ligne(s)`)
    } catch (e) {
      notify('Export impossible', 'warning', errorText(e))
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" disabled={disabled || busy !== ''} onClick={() => void run('csv')}><Download size={14} />{busy === 'csv' ? 'Export…' : 'CSV'}</Button>
      <Button size="sm" variant="outline" disabled={disabled || busy !== ''} onClick={() => void run('xlsx')}><FileSpreadsheet size={14} />{busy === 'xlsx' ? 'Export…' : 'Excel'}</Button>
    </>
  )
}

/** Petit bloc « libellé : valeur » des fiches détail. */
export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="crm-info">
      <dt>{label}</dt>
      <dd>{children || <span className="text-ink-400">—</span>}</dd>
    </div>
  )
}

/** Interdit l'accès à une page sans la permission requise (le serveur refuse aussi). */
export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { me, can, loading } = useCrm()
  if (loading || !me) return <LoadingRows />
  if (!can(perm)) return <EmptyBox icon={<X size={20} />} title="Accès non autorisé" text="Votre rôle ne permet pas d’ouvrir cette page. Contactez un administrateur si vous en avez besoin." />
  return <>{children}</>
}

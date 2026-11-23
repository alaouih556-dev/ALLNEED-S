import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, List, Map as MapIcon, Maximize2 } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button } from '@/components/ui'
import { EmptyBox, LoadingRows, Panel, Segmented } from '@/components/admin-kit'
import { DataTable, ExportButtons, FilterBar, RequirePermission, STATUS_HEX, StatusPill, addDays, crmGet, fmtDate, localDay, useCrm, useCrmQuery, useFilterState, useLookupFilters, useStatusLabel, type Appointment, type Column, type Page } from '@/features/crm/core'
import { AppointmentModal } from '@/features/crm/forms'
import { CrmMap, esc } from '@/features/crm/CrmMap'

export const Route = createFileRoute('/crm/rendez-vous')({ component: () => <RequirePermission perm="appointments.view"><AppointmentsPage /></RequirePermission> })

type View = 'calendar' | 'list'
type Scale = 'day' | 'week' | 'month'
const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i)
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const mondayOf = (day: string) => { const d = new Date(`${day}T12:00:00`); return addDays(day, -((d.getDay() + 6) % 7)) }

function rangeFor(scale: Scale, anchor: string) {
  if (scale === 'day') return { from: anchor, to: anchor }
  if (scale === 'week') { const m = mondayOf(anchor); return { from: m, to: addDays(m, 6) } }
  const first = `${anchor.slice(0, 7)}-01`
  const gridStart = mondayOf(first)
  const d = new Date(`${first}T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0)
  const last = localDay(d)
  const gridEnd = addDays(mondayOf(last), 6)
  return { from: gridStart, to: gridEnd }
}

function AppointmentsPage() {
  const { can } = useCrm()
  const label = useStatusLabel()
  const [values, setValues] = useFilterState({ view: 'calendar', scale: 'week', pageSize: '25', sort: 'date', dir: 'asc' })
  const view: View = values.view === 'list' ? 'list' : 'calendar'
  const showMap = values.map !== '0'
  const scale = (values.scale || 'week') as Scale
  const anchor = values.date || localDay()
  const range = rangeFor(scale, anchor)
  const filters = useLookupFilters(['agent', 'campaign', 'database', 'appointmentStatus', 'city'])
  const filterParams = { agentId: values.agentId, campaignId: values.campaignId, databaseId: values.databaseId, appointmentStatus: values.appointmentStatus, city: values.city, q: values.q }
  const listFrom = values.from || '', listTo = values.to || ''
  const cal = useCrmQuery<{ rows: Appointment[]; total: number }>('/appointments', { ...filterParams, all: 1, ...(view === 'list' ? { from: listFrom || localDay(), to: listTo || addDays(localDay(), 60) } : range) })
  const list = useCrmQuery<Page<Appointment>>(view === 'list' ? '/appointments' : null, { ...filterParams, from: listFrom, to: listTo, page: values.page, pageSize: values.pageSize, sort: values.sort, dir: values.dir })
  const [open, setOpen] = useState<Appointment | null>(null)
  const [creating, setCreating] = useState<{ date?: string; start?: string } | null>(null)

  // Ouverture directe depuis un lien (?appointment=…)
  useEffect(() => {
    const id = values.appointment
    if (!id) return
    crmGet<Appointment>(`/appointments/${id}`).then(setOpen, () => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.appointment])
  const closeModal = () => { setOpen(null); if (values.appointment) setValues({ ...values, appointment: '' }) }
  const refresh = () => { void cal.reload(); void list.reload() }
  const move = (dir: -1 | 1) => setValues({ ...values, date: scale === 'day' ? addDays(anchor, dir) : scale === 'week' ? addDays(anchor, 7 * dir) : (() => { const d = new Date(`${anchor}T12:00:00`); d.setMonth(d.getMonth() + dir, 1); return localDay(d) })() })
  const title = scale === 'day' ? new Date(`${anchor}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : scale === 'week' ? `Semaine du ${fmtDate(range.from)}` : new Date(`${anchor}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>()
    for (const a of cal.data?.rows || []) m.set(a.date, [...(m.get(a.date) || []), a].sort((x, y) => x.start.localeCompare(y.start)))
    return m
  }, [cal.data])

  const columns: Column<Appointment>[] = [
    { key: 'date', label: 'Date', sort: 'date', render: (a) => <span className="whitespace-nowrap text-xs font-semibold">{fmtDate(a.date)}<span className="block font-normal text-ink-500">{a.start} – {a.end}</span></span> },
    { key: 'contact', label: 'Contact', sort: 'contact', render: (a) => <div className="min-w-0"><p className="truncate font-semibold text-ink-950">{a.contactName}</p><p className="truncate text-xs text-ink-500">{a.phone}</p></div> },
    { key: 'agent', label: 'Agent', sort: 'agent', hideOn: 'md', render: (a) => <span className="text-xs">{a.agentName || '—'}</span> },
    { key: 'address', label: 'Adresse', sort: 'city', hideOn: 'lg', render: (a) => <span className="text-xs text-ink-600">{[a.address, a.city].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'campaign', label: 'Campagne', hideOn: 'lg', render: (a) => <span className="text-xs text-ink-600">{a.campaignName || '—'}</span> },
    { key: 'status', label: 'Statut', sort: 'status', render: (a) => <StatusPill kind="appointment" value={a.status} /> },
  ]

  const mapPoints = (cal.data?.rows || []).filter((a) => a.lat !== null && a.lng !== null).map((a) => ({ id: a.id, lat: a.lat!, lng: a.lng!, kind: 'appointment' as const, color: STATUS_HEX[a.status] || '#6366f1', label: a.contactName, popup: `<b>${esc(a.contactName)}</b><br>${esc(fmtDate(a.date))} · ${esc(a.start)}–${esc(a.end)}<br>${esc(a.agentName || 'Sans agent')} · ${esc(label('appointment', a.status))}<br>${esc([a.address, a.city].filter(Boolean).join(', '))}${a.phone ? `<br><a href="tel:${esc(a.phone.replace(/\s+/g, ''))}">${esc(a.phone)}</a>` : ''}<div class="crm-popup-actions"><a href="#" data-nav="/crm/contacts/${esc(a.contactId)}">Fiche contact</a></div>` }))
  const missing = (cal.data?.rows || []).length - mapPoints.length

  return (
    <div>
      <PageHeader
        eyebrow="CRM · Activité"
        title="Rendez-vous"
        description="Calendrier, liste et carte des rendez-vous de toute l’équipe CRM. Confirmez, reportez ou annulez depuis chaque rendez-vous."
        actions={
          <>
            {can('appointments.create') ? <Button size="sm" onClick={() => setCreating({})}><CalendarPlus size={14} />Nouveau rendez-vous</Button> : null}
            <ExportButtons name="rendez-vous" getData={async () => { const r = await crmGet<{ rows: Appointment[] }>('/appointments', { ...filterParams, all: 1, from: view === 'list' ? listFrom : range.from, to: view === 'list' ? listTo : range.to }); return { columns: ['Date', 'Début', 'Fin', 'Titre', 'Contact', 'Téléphone', 'Agent', 'Adresse', 'Ville', 'Type', 'Statut', 'Campagne', 'Notes'], rows: r.rows.map((a) => [a.date, a.start, a.end, a.title, a.contactName, a.phone, a.agentName, a.address, a.city, a.type, label('appointment', a.status), a.campaignName, a.notes]) } }} />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={(v) => setValues({ ...values, view: v, page: '1' })} options={[{ value: 'calendar', label: 'Calendrier', icon: <CalendarDays size={14} /> }, { value: 'list', label: 'Liste', icon: <List size={14} /> }] as never} />
        {view === 'calendar' ? <Segmented value={scale} onChange={(v) => setValues({ ...values, scale: v })} options={[{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }] as never} /> : null}
      </div>
      <FilterBar values={values} onChange={setValues} filters={filters} searchPlaceholder="Contact, titre, adresse, agent…">
        {view === 'list' ? <span className="crm-daterange"><input className="crm-date" type="date" aria-label="Du" value={listFrom} onChange={(e) => setValues({ ...values, from: e.target.value, page: '1' })} /><span>→</span><input className="crm-date" type="date" aria-label="Au" value={listTo} onChange={(e) => setValues({ ...values, to: e.target.value, page: '1' })} /></span> : null}
      </FilterBar>

      <Panel
        className="mb-5"
        title={<span className="inline-flex items-center gap-2"><MapIcon size={15} />Carte géographique</span>}
        description={`${mapPoints.length} rendez-vous localisés${missing > 0 ? ` · ${missing} à placer` : ''}`}
        action={<div className="flex flex-wrap items-center gap-1"><Link to={'/crm/carte' as never}><Button size="sm" variant="outline"><Maximize2 size={13} />Ouvrir la grande carte</Button></Link><Button size="sm" variant="ghost" aria-expanded={showMap} onClick={() => setValues({ ...values, map: showMap ? '0' : '' })}>{showMap ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{showMap ? 'Masquer' : 'Afficher'}</Button></div>}
      >
        {showMap ? <div className="p-3">{cal.loading && !cal.data ? <LoadingRows /> : mapPoints.length ? <CrmMap points={mapPoints} fitKey={JSON.stringify([view, range.from, range.to, filterParams, listFrom, listTo, mapPoints.length])} height="min(42vh, 380px)" /> : <EmptyBox icon={<MapIcon size={20} />} title="Aucun rendez-vous localisé sur cette période" text="Ouvrez la grande carte pour placer vos rendez-vous en un clic." />}</div> : null}
      </Panel>

      {view === 'calendar' ? (
        <Panel
          title={<span className="capitalize">{title}</span>}
          action={<div className="flex items-center gap-1"><Button size="sm" variant="outline" onClick={() => move(-1)} aria-label="Période précédente"><ChevronLeft size={14} /></Button><Button size="sm" variant="outline" onClick={() => setValues({ ...values, date: localDay() })}>Aujourd’hui</Button><Button size="sm" variant="outline" onClick={() => move(1)} aria-label="Période suivante"><ChevronRight size={14} /></Button></div>}
        >
          {cal.error ? <Alert tone="danger" className="m-4">{cal.error}</Alert> : null}
          {cal.loading && !cal.data ? <LoadingRows /> : null}
          {scale === 'month' ? (
            <div className="crm-month">
              {WEEKDAYS.map((d) => <div key={d} className="crm-month-head">{d}</div>)}
              {Array.from({ length: Math.round((Date.parse(`${range.to}T12:00:00`) - Date.parse(`${range.from}T12:00:00`)) / 86400000) + 1 }, (_, i) => addDays(range.from, i)).map((day) => {
                const items = byDay.get(day) || []
                return (
                  <div key={day} className={`crm-month-cell ${day.slice(0, 7) !== anchor.slice(0, 7) ? 'is-out' : ''} ${day === localDay() ? 'is-today' : ''}`} onDoubleClick={() => can('appointments.create') && setCreating({ date: day })}>
                    <button type="button" className="crm-month-day" onClick={() => setValues({ ...values, scale: 'day', date: day })}>{Number(day.slice(8))}</button>
                    {items.slice(0, 3).map((a) => <button key={a.id} type="button" className="crm-event" style={{ ['--ev' as string]: STATUS_HEX[a.status] }} onClick={() => setOpen(a)}><b>{a.start}</b> {a.contactName}</button>)}
                    {items.length > 3 ? <button type="button" className="crm-more" onClick={() => setValues({ ...values, scale: 'day', date: day })}>+{items.length - 3} autre(s)</button> : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="crm-week" style={{ ['--cols' as string]: scale === 'day' ? 1 : 7 }}>
              <div className="crm-week-corner" />
              {Array.from({ length: scale === 'day' ? 1 : 7 }, (_, i) => addDays(range.from, i)).map((day) => <div key={day} className={`crm-week-head ${day === localDay() ? 'is-today' : ''}`}>{new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</div>)}
              <div className="crm-week-hours">{HOURS.map((h) => <span key={h}>{String(h).padStart(2, '0')}:00</span>)}</div>
              {Array.from({ length: scale === 'day' ? 1 : 7 }, (_, i) => addDays(range.from, i)).map((day) => (
                <div key={day} className="crm-week-col">
                  {HOURS.map((h) => <button key={h} type="button" className="crm-week-slot" aria-label={`Créer un rendez-vous le ${day} à ${h}h`} disabled={!can('appointments.create')} onClick={() => setCreating({ date: day, start: `${String(h).padStart(2, '0')}:00` })} />)}
                  {(byDay.get(day) || []).map((a) => {
                    const toMin = (t: string) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm }
                    const top = Math.max(0, (toMin(a.start) - 7 * 60) / (14 * 60)) * 100
                    const height = Math.max(4, ((toMin(a.end) - toMin(a.start)) / (14 * 60)) * 100)
                    return <button key={a.id} type="button" className="crm-week-event" style={{ top: `${top}%`, height: `${height}%`, ['--ev' as string]: STATUS_HEX[a.status] }} onClick={() => setOpen(a)}><b>{a.start} {a.contactName}</b><span>{[a.agentName, a.city].filter(Boolean).join(' · ')}</span></button>
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="crm-legend">{['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'].map((s) => <span key={s}><i style={{ background: STATUS_HEX[s] }} />{label('appointment', s)}</span>)}</div>
        </Panel>
      ) : null}

      {view === 'list' ? (
        <DataTable columns={columns} page={list.data} loading={list.loading} error={list.error} values={values} onChange={setValues} onRowClick={(a) => setOpen(a)} empty={{ icon: <CalendarDays size={20} />, title: 'Aucun rendez-vous', text: 'Modifiez les filtres ou prenez un rendez-vous depuis un contact.' }} />
      ) : null}

      {open ? <AppointmentModal appointment={open} onClose={closeModal} onSaved={refresh} /> : null}
      {creating ? <AppointmentModal defaultDate={creating.date} defaultStart={creating.start} onClose={() => setCreating(null)} onSaved={refresh} /> : null}
    </div>
  )
}

import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CalendarClock, CalendarPlus, Crosshair, History, Locate, MapPin, MessageSquarePlus, Pencil, PhoneCall, StickyNote, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Input, Select, Tabs, Textarea } from '@/components/ui'
import { EmptyBox, LoadingRows, Panel, Rows } from '@/components/admin-kit'
import { ConfirmDialog, Info, RequirePermission, STATUS_HEX, StatusPill, crmSend, errorText, fmtDate, fmtDateTime, fmtDuration, fromLocalInput, statusOptions, toLocalInput, useCrm, useCrmQuery, useNotify, type Appointment, type Call, type Contact } from '@/features/crm/core'
import { AppointmentModal, CallModal, ContactModal } from '@/features/crm/forms'
import { CrmMap } from '@/features/crm/CrmMap'

export const Route = createFileRoute('/crm/contacts/$id')({ component: () => <RequirePermission perm="contacts.view"><ContactDetail /></RequirePermission> })

type Detail = { contact: Contact; calls: Call[]; appointments: Appointment[]; timeline: Array<{ at: string; kind: string; title: string; detail: string; by: string }>; zones: Array<{ id: string; name: string; color: string }> }

function ContactDetail() {
  const { id } = Route.useParams()
  const { me, can } = useCrm()
  const notify = useNotify()
  const isAdmin = Boolean(me?.isAdmin)
  const { data, loading, error, reload } = useCrmQuery<Detail>(`/contacts/${id}`)
  const [tab, setTab] = useState('timeline')
  const [editing, setEditing] = useState(false)
  const [calling, setCalling] = useState<Call | 'new' | null>(null)
  const [booking, setBooking] = useState<{ appointment?: Appointment; callId?: string } | null>(null)
  const [note, setNote] = useState('')
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  if (loading && !data) return <LoadingRows count={6} />
  if (error || !data) return <EmptyBox icon={<MapPin size={20} />} title="Contact introuvable" text={error || 'Ce contact n’existe pas ou ne fait pas partie de votre périmètre.'} action={<Link to={'/crm/contacts' as any}><Button size="sm" variant="outline">Retour aux contacts</Button></Link>} />
  const c = data.contact

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true)
    try { await crmSend(`/contacts/${id}`, 'PATCH', body); notify(message); await reload() } catch (e) { notify('Modification impossible', 'warning', errorText(e)) } finally { setBusy(false) }
  }
  async function addNote() {
    if (!note.trim()) return
    setBusy(true)
    try { await crmSend(`/contacts/${id}/notes`, 'POST', { text: note.trim() }); setNote(''); notify('Note ajoutée'); await reload() } catch (e) { notify('Note non enregistrée', 'warning', errorText(e)) } finally { setBusy(false) }
  }
  async function setLocation(lat: number | null, lng: number | null) {
    setBusy(true)
    try { await crmSend(`/contacts/${id}/location`, 'POST', { lat, lng }); setPicking(false); notify(lat === null ? 'Localisation retirée' : 'Localisation enregistrée'); await reload() } catch (e) { notify('Localisation impossible', 'warning', errorText(e)) } finally { setBusy(false) }
  }
  async function geocode() {
    setBusy(true)
    try {
      const r = await crmSend<{ results: Array<{ ok: boolean; reason?: string }> }>('/geocode', 'POST', { contactIds: [id] })
      const res = r.results[0]
      if (res?.ok) notify('Adresse localisée')
      else notify('Adresse non localisée', 'warning', res?.reason || 'Aucun résultat : placez le point manuellement.')
      await reload()
    } catch (e) { notify('Géocodage impossible', 'warning', errorText(e)) } finally { setBusy(false) }
  }
  const located = c.lat !== null && c.lng !== null
  const nextAppt = data.appointments.filter((a) => !['cancelled', 'completed', 'no_show'].includes(a.status)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0]

  return (
    <div>
      <PageHeader
        eyebrow={c.databaseName ? `Contact · ${c.databaseName}` : 'Contact'}
        title={c.fullName}
        description={[c.phone, c.email, c.city].filter(Boolean).join(' · ')}
        actions={
          <>
            <Link to={'/crm/contacts' as any}><Button size="sm" variant="outline"><ArrowLeft size={14} />Contacts</Button></Link>
            {can('calls.create') ? <Button size="sm" onClick={() => setCalling('new')}><PhoneCall size={14} />Enregistrer un appel</Button> : null}
            {can('appointments.create') ? <Button size="sm" variant="outline" onClick={() => setBooking({})}><CalendarPlus size={14} />Rendez-vous</Button> : null}
          </>
        }
      />
      {c.archived ? <Alert tone="warning" className="mb-4">Ce contact est archivé.</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Panel title="Situation" action={can('contacts.edit') ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={13} />Modifier</Button> : undefined}>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2"><StatusPill kind="contact" value={c.status} /><StatusPill kind="call" value={c.callStatus} />{c.appointmentStatus ? <StatusPill kind="appointment" value={c.appointmentStatus} /> : null}{(c.tags || []).map((t) => <Badge key={t}>{t}</Badge>)}</div>
              {can('contacts.edit') ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-ink-600">Statut du contact
                    <Select className="mt-1" value={c.status} disabled={busy} onChange={(e) => void patch({ status: e.target.value }, 'Statut mis à jour')}>{statusOptions(me?.labels, 'contact').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                  </label>
                  <label className="text-xs font-semibold text-ink-600">Prochain rappel
                    <Input className="mt-1" type="datetime-local" disabled={busy} defaultValue={toLocalInput(c.nextCallbackAt)} onBlur={(e) => { if (e.target.value !== toLocalInput(c.nextCallbackAt)) void patch({ nextCallbackAt: fromLocalInput(e.target.value) }, e.target.value ? 'Rappel programmé' : 'Rappel retiré') }} />
                  </label>
                </div>
              ) : null}
              <dl className="crm-info-grid">
                <Info label="Téléphone">{c.phone ? <a className="font-semibold text-brand-700" href={`tel:${c.phone.replace(/\s+/g, '')}`}>{c.phone}</a> : ''}</Info>
                <Info label="Téléphone 2">{c.phone2}</Info>
                <Info label="E-mail">{c.email ? <a className="text-brand-700" href={`mailto:${c.email}`}>{c.email}</a> : ''}</Info>
                <Info label="Agent">{c.agentName || 'Non assigné'}</Info>
                <Info label="Base">{c.databaseName}</Info>
                <Info label="Campagne">{c.campaignName}</Info>
                <Info label="Dernier contact">{c.lastContactAt ? fmtDateTime(c.lastContactAt) : ''}</Info>
                <Info label="Prochain rappel">{c.nextCallbackAt ? <span className={new Date(c.nextCallbackAt) <= new Date() ? 'font-semibold text-red-600' : 'font-semibold text-amber-700'}>{fmtDateTime(c.nextCallbackAt)}</span> : ''}</Info>
                <Info label="Prochain RDV">{nextAppt ? `${fmtDate(nextAppt.date)} à ${nextAppt.start}` : ''}</Info>
                <Info label="Créé le">{fmtDate(c.createdAt)}</Info>
                <Info label="Mis à jour">{fmtDateTime(c.updatedAt)}</Info>
                <Info label="Zones">{data.zones.map((z) => z.name).join(', ')}</Info>
              </dl>
              {c.notes ? <p className="whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-sm text-ink-700">{c.notes}</p> : null}
              {c.custom && Object.keys(c.custom).length ? <dl className="crm-info-grid">{Object.entries(c.custom).map(([k, v]) => <Info key={k} label={k}>{v}</Info>)}</dl> : null}
              {isAdmin ? <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(true)}><Trash2 size={14} className="text-red-600" />{c.archived ? 'Supprimer définitivement' : 'Archiver le contact'}</Button> : null}
            </div>
          </Panel>

          <Panel title="Adresse et localisation" description={[c.address, c.postalCode, c.city, c.region, c.country].filter(Boolean).join(', ') || 'Aucune adresse renseignée.'}>
            <div className="space-y-3 p-4">
              {picking ? <Alert tone="info">Cliquez sur la carte à l’emplacement exact du contact.</Alert> : null}
              {located || picking ? <CrmMap height={260} cluster={false} fitKey={`${c.lat},${c.lng}`} points={located ? [{ id: c.id, lat: c.lat!, lng: c.lng!, color: STATUS_HEX[c.status] || '#6366f1', kind: 'contact', popup: c.fullName }] : []} onMapClick={picking ? (lat, lng) => void setLocation(lat, lng) : undefined} /> : <EmptyBox icon={<MapPin size={20} />} title="Pas de coordonnées" text="Le contact n’apparaît pas sur la carte tant que sa position n’est pas connue. Aucune position n’est inventée." />}
              {c.geocodeError ? <p className="text-xs text-amber-700">Dernier géocodage : {c.geocodeError}</p> : null}
              {can('contacts.edit') ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPicking((p) => !p)}><Crosshair size={14} />{picking ? 'Annuler' : located ? 'Déplacer sur la carte' : 'Placer sur la carte'}</Button>
                  {isAdmin && me?.geocoding === 'nominatim' && !located ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void geocode()}><Locate size={14} />Localiser l’adresse</Button> : null}
                  {located ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setLocation(null, null)}>Retirer la position</Button> : null}
                  {located ? <span className="self-center text-xs text-ink-400">{c.lat}, {c.lng}{c.locationSource ? ` · ${c.locationSource === 'manual' ? 'placé à la main' : 'géocodé'}` : ''}</span> : null}
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel>
          <Tabs className="px-4" value={tab} onChange={setTab} tabs={[{ value: 'timeline', label: 'Chronologie', count: data.timeline.length }, { value: 'calls', label: 'Appels', count: data.calls.length }, { value: 'appointments', label: 'Rendez-vous', count: data.appointments.length }, { value: 'notes', label: 'Notes', count: c.noteLog?.length || 0 }]} />
          {tab === 'timeline' ? (
            data.timeline.length ? (
              <ol className="crm-timeline">
                {data.timeline.map((t, i) => (
                  <li key={i} className={`is-${t.kind}`}>
                    <span className="crm-timeline-dot">{t.kind === 'call' ? <PhoneCall size={12} /> : t.kind === 'appointment' ? <CalendarClock size={12} /> : t.kind === 'note' ? <StickyNote size={12} /> : <History size={12} />}</span>
                    <div><p className="text-sm font-semibold text-ink-950">{t.title}</p>{t.detail ? <p className="whitespace-pre-wrap text-sm text-ink-600">{t.detail}</p> : null}<p className="text-xs text-ink-400">{fmtDateTime(t.at)}{t.by ? ` · ${t.by}` : ''}</p></div>
                  </li>
                ))}
              </ol>
            ) : <EmptyBox icon={<History size={20} />} title="Aucune activité pour le moment" />
          ) : null}
          {tab === 'calls' ? (
            data.calls.length ? (
              <Rows>
                {data.calls.map((call) => (
                  <li key={call.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-950">{fmtDateTime(call.at)} · {call.agentName}</span>
                      <span className="flex items-center gap-2"><StatusPill kind="call" value={call.status} />{can('calls.edit') && (isAdmin || call.agentId === me?.user.id) ? <Button size="sm" variant="ghost" aria-label="Modifier l’appel" onClick={() => setCalling(call)}><Pencil size={13} /></Button> : null}</span>
                    </div>
                    <p className="text-xs text-ink-500">Durée {fmtDuration(call.durationSec)}{call.result ? ` · ${call.result}` : ''}{call.callbackAt ? ` · Rappel ${fmtDateTime(call.callbackAt)}` : ''}</p>
                    {call.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{call.notes}</p> : null}
                  </li>
                ))}
              </Rows>
            ) : <EmptyBox icon={<PhoneCall size={20} />} title="Aucun appel" action={can('calls.create') ? <Button size="sm" onClick={() => setCalling('new')}><PhoneCall size={14} />Enregistrer un appel</Button> : undefined} />
          ) : null}
          {tab === 'appointments' ? (
            data.appointments.length ? (
              <Rows>
                {data.appointments.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="cg-org-row w-full text-left" onClick={() => setBooking({ appointment: a })}>
                      <span className="crm-time"><b>{a.start}</b><small>{fmtDate(a.date)}</small></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{a.title}</span><span className="block truncate text-xs text-ink-500">{[a.type, a.agentName, a.city].filter(Boolean).join(' · ')}</span></span>
                      <StatusPill kind="appointment" value={a.status} />
                    </button>
                  </li>
                ))}
              </Rows>
            ) : <EmptyBox icon={<CalendarClock size={20} />} title="Aucun rendez-vous" action={can('appointments.create') ? <Button size="sm" onClick={() => setBooking({})}><CalendarPlus size={14} />Prendre un rendez-vous</Button> : undefined} />
          ) : null}
          {tab === 'notes' ? (
            <div className="space-y-4 p-5">
              {can('contacts.edit') ? (
                <div className="space-y-2">
                  <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note sur ce contact…" maxLength={4000} />
                  <div className="flex justify-end"><Button size="sm" disabled={busy || !note.trim()} onClick={() => void addNote()}><MessageSquarePlus size={14} />Ajouter la note</Button></div>
                </div>
              ) : null}
              {(c.noteLog || []).length ? <ul className="space-y-3">{[...(c.noteLog || [])].reverse().map((n) => <li key={n.id} className="rounded-xl border border-ink-100 p-3"><p className="whitespace-pre-wrap text-sm text-ink-800">{n.text}</p><p className="mt-1 text-xs text-ink-400">{fmtDateTime(n.at)} · {n.byName}</p></li>)}</ul> : <p className="text-sm text-ink-500">Aucune note.</p>}
            </div>
          ) : null}
        </Panel>
      </div>

      {editing ? <ContactModal contact={c} onClose={() => setEditing(false)} onSaved={() => void reload()} /> : null}
      {calling ? <CallModal contact={c} call={calling === 'new' ? null : calling} onClose={() => setCalling(null)} onSaved={(call, book) => { void reload(); if (book) setBooking({ callId: call.id }) }} /> : null}
      {booking ? <AppointmentModal appointment={booking.appointment} contact={c} callId={booking.callId} onClose={() => setBooking(null)} onSaved={() => void reload()} /> : null}
      <ConfirmDialog open={confirmArchive} danger busy={busy} title={c.archived ? 'Supprimer définitivement ce contact ?' : 'Archiver ce contact ?'} confirmLabel={c.archived ? 'Supprimer' : 'Archiver'} text={c.archived ? 'La suppression est refusée si le contact a des appels ou des rendez-vous.' : 'Le contact disparaît des listes et des agents. Son historique est conservé.'} onClose={() => setConfirmArchive(false)} onConfirm={() => { setBusy(true); void crmSend(`/contacts/${id}${c.archived ? '?hard=1' : ''}`, 'DELETE').then(() => { notify(c.archived ? 'Contact supprimé' : 'Contact archivé'); setConfirmArchive(false); if (c.archived) window.history.back(); else void reload() }, (e) => notify('Action impossible', 'warning', errorText(e))).finally(() => setBusy(false)) }} />
    </div>
  )
}

/* Formulaires CRM partagés : contact, appel, rendez-vous, recherche de contact. */
import { useEffect, useState } from 'react'
import { CalendarCheck2, CalendarX2, CheckCircle2, Search, UserX } from 'lucide-react'
import { Alert, Button, Checkbox, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { addDays, crmGet, crmSend, errorText, fromLocalInput, localDay, statusOptions, toLocalInput, useCrm, useNotify, type Appointment, type Call, type Contact, type Page } from './core'

/* ---------- Contact ---------- */
/** Nom d'un membre du CRM avec son rôle, pour les listes d'assignation. */
export const crmMemberLabel = (member: { name: string; role?: string }) => `${member.name}${member.role === 'admin' ? ' · Administrateur' : member.role === 'crm' ? ' · CRM' : member.role === 'agent' ? ' · Agent' : ''}`

export function ContactModal({ contact, defaultDatabaseId, onClose, onSaved }: { contact: Contact | null; defaultDatabaseId?: string; onClose: () => void; onSaved: (c: Contact) => void }) {
  const { me, lookups } = useCrm()
  const notify = useNotify()
  const isAdmin = Boolean(me?.isAdmin)
  const [form, setForm] = useState({
    firstName: contact?.firstName || '', lastName: contact?.lastName || '', fullName: contact?.fullName || '', phone: contact?.phone || '', phone2: contact?.phone2 || '', email: contact?.email || '',
    address: contact?.address || '', city: contact?.city || '', region: contact?.region || '', postalCode: contact?.postalCode || '', country: contact?.country || '', mainSector: contact?.mainSector || '', businessCategory: contact?.businessCategory || '',
    lat: contact?.lat?.toString() || '', lng: contact?.lng?.toString() || '', status: contact?.status || 'new', notes: contact?.notes || '', tags: (contact?.tags || []).join(', '),
    databaseId: contact?.databaseId || defaultDatabaseId || lookups?.databases.find((d) => d.status !== 'archived')?.id || '', agentId: contact?.agentId || '', campaignId: contact?.campaignId || '', nextCallbackAt: toLocalInput(contact?.nextCallbackAt),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  function validate() {
    const e: Record<string, string> = {}
    if (!form.firstName.trim() && !form.lastName.trim() && !form.fullName.trim()) e.lastName = 'Indiquez au moins un nom.'
    const importedWithoutContact = Boolean(contact && !contact.phone && !contact.email)
    if (!importedWithoutContact && !form.phone.trim() && !form.email.trim()) e.phone = 'Un téléphone ou un e-mail est requis.'
    if (form.phone && !/^[+0-9\s().-]{4,30}$/.test(form.phone)) e.phone = 'Numéro invalide.'
    if (form.phone2 && !/^[+0-9\s().-]{4,30}$/.test(form.phone2)) e.phone2 = 'Numéro invalide.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail invalide.'
    if ((form.lat === '') !== (form.lng === '')) e.lat = 'Latitude et longitude vont ensemble.'
    if (form.lat && (Number.isNaN(Number(form.lat)) || Math.abs(Number(form.lat)) > 90)) e.lat = 'Latitude invalide (-90 à 90).'
    if (form.lng && (Number.isNaN(Number(form.lng)) || Math.abs(Number(form.lng)) > 180)) e.lng = 'Longitude invalide (-180 à 180).'
    if (!contact && !form.databaseId) e.databaseId = 'Choisissez une base.'
    setErrors(e)
    return !Object.keys(e).length
  }
  async function submit(allowDuplicate = false) {
    if (!validate()) return
    setBusy(true)
    setServerError('')
    const body: Record<string, unknown> = { ...form, lat: form.lat === '' ? null : Number(form.lat), lng: form.lng === '' ? null : Number(form.lng), tags: form.tags, nextCallbackAt: fromLocalInput(form.nextCallbackAt), allowDuplicate }
    if (!isAdmin) { delete body.agentId; delete body.campaignId; if (contact) delete body.databaseId }
    else { body.agentId = form.agentId || null; body.campaignId = form.campaignId || null }
    try {
      const saved = contact ? await crmSend<Contact>(`/contacts/${contact.id}`, 'PATCH', body) : await crmSend<Contact>('/contacts', 'POST', body)
      notify(contact ? 'Contact mis à jour' : 'Contact créé')
      onSaved(saved)
      onClose()
    } catch (e) {
      const err = e as { status?: number; message?: string }
      if (err.status === 409 && !contact) setDuplicate({ id: '', name: err.message || 'contact existant' })
      else setServerError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={contact ? `Modifier · ${contact.fullName}` : 'Nouveau contact'} size="lg">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
        {duplicate ? <Alert tone="warning" title="Doublon possible">{duplicate.name}. <button type="button" className="font-semibold underline" onClick={() => void submit(true)}>Créer quand même</button></Alert> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prénom"><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={80} autoFocus /></Field>
          <Field label="Nom" error={errors.lastName}><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={80} /></Field>
          <Field label="Nom complet / structure" hint="Si pas de prénom/nom"><Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} maxLength={160} /></Field>
          <Field label="Téléphone" error={errors.phone}><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} /></Field>
          <Field label="Téléphone 2" error={errors.phone2}><Input type="tel" value={form.phone2} onChange={(e) => set('phone2', e.target.value)} maxLength={30} /></Field>
          <Field label="E-mail" error={errors.email}><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} /></Field>
          <Field label="Main_Sector"><Input value={form.mainSector} onChange={(e) => set('mainSector', e.target.value)} maxLength={120} /></Field>
          <Field label="Business_Category"><Input value={form.businessCategory} onChange={(e) => set('businessCategory', e.target.value)} maxLength={120} /></Field>
          <Field label="Adresse" className="sm:col-span-2"><Input value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={240} /></Field>
          <Field label="Code postal"><Input value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} maxLength={20} /></Field>
          <Field label="Ville"><Input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={100} list="crm-cities" /></Field>
          <Field label="Région"><Input value={form.region} onChange={(e) => set('region', e.target.value)} maxLength={100} list="crm-regions" /></Field>
          <Field label="Pays"><Input value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={80} /></Field>
          <Field label="Latitude" error={errors.lat} hint="Coordonnées réelles uniquement"><Input inputMode="decimal" value={form.lat} onChange={(e) => set('lat', e.target.value)} /></Field>
          <Field label="Longitude" error={errors.lng}><Input inputMode="decimal" value={form.lng} onChange={(e) => set('lng', e.target.value)} /></Field>
          <Field label="Statut"><Select value={form.status} onChange={(e) => set('status', e.target.value)}>{statusOptions(me?.labels, 'contact').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          {!contact || isAdmin ? <Field label="Base" required error={errors.databaseId}><Select value={form.databaseId} onChange={(e) => set('databaseId', e.target.value)}><option value="">Choisir…</option>{(lookups?.databases || []).filter((d) => d.status !== 'archived' || d.id === form.databaseId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field> : null}
          {isAdmin ? <Field label="Agent"><Select value={form.agentId} onChange={(e) => set('agentId', e.target.value)}><option value="">Non assigné</option>{(lookups?.agents || []).filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field> : null}
          {isAdmin ? <Field label="Campagne" hint="Sinon celle de la base"><Select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}><option value="">Celle de la base</option>{(lookups?.campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field> : null}
          <Field label="Prochain rappel"><Input type="datetime-local" value={form.nextCallbackAt} onChange={(e) => set('nextCallbackAt', e.target.value)} /></Field>
          <Field label="Tags" hint="Séparés par des virgules" className="sm:col-span-2"><Input value={form.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} /></Field>
        <datalist id="crm-cities">{(lookups?.cities || []).map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="crm-regions">{(lookups?.regions || []).map((c) => <option key={c} value={c} />)}</datalist>
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : contact ? 'Enregistrer' : 'Créer le contact'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Appel ---------- */
export function CallModal({ contact, call, onClose, onSaved }: { contact: Pick<Contact, 'id' | 'fullName' | 'phone' | 'phone2'>; call?: Call | null; onClose: () => void; onSaved: (call: Call, bookAppointment: boolean) => void }) {
  const { me } = useCrm()
  const notify = useNotify()
  const [form, setForm] = useState({ status: call?.status || 'answered', phone: call?.phone || contact.phone || contact.phone2 || '', minutes: call?.durationSec ? String(Math.floor(call.durationSec / 60)) : '', seconds: call?.durationSec ? String(call.durationSec % 60) : '', result: call?.result || '', notes: call?.notes || '', callbackAt: toLocalInput(call?.callbackAt), book: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const needsCallback = form.status === 'callback_requested'
  async function submit() {
    if (needsCallback && !form.callbackAt) { setError('Indiquez la date du rappel.'); return }
    const m = Number(form.minutes || 0), s = Number(form.seconds || 0)
    if (Number.isNaN(m) || Number.isNaN(s) || m < 0 || s < 0 || s > 59) { setError('Durée invalide.'); return }
    setBusy(true)
    setError('')
    const durationSec = form.minutes === '' && form.seconds === '' ? null : m * 60 + s
    const body = { contactId: contact.id, status: form.status, phone: form.phone, durationSec, result: form.result, notes: form.notes, callbackAt: fromLocalInput(form.callbackAt) }
    try {
      const saved = call ? await crmSend<Call>(`/calls/${call.id}`, 'PATCH', body) : await crmSend<Call>('/calls', 'POST', body)
      notify(call ? 'Appel modifié' : 'Appel enregistré')
      onSaved(saved, form.book || form.status === 'appointment_booked')
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={call ? 'Modifier l’appel' : `Enregistrer un appel · ${contact.fullName}`} description="Aucun appel n’est passé automatiquement : composez le numéro, puis consignez le résultat ici.">
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {form.phone ? <a href={`tel:${form.phone.replace(/\s+/g, '')}`} className="crm-dial">Appeler le {form.phone}</a> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Résultat de l’appel" required><Select value={form.status} onChange={(e) => set('status', e.target.value)}>{statusOptions(me?.labels, 'call').filter((o) => o.value !== 'new').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Numéro composé">
            <Select value={form.phone} onChange={(e) => set('phone', e.target.value)}>{[contact.phone, contact.phone2].filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          </Field>
          <Field label="Durée" hint="Facultatif">
            <div className="flex items-center gap-2"><Input inputMode="numeric" value={form.minutes} onChange={(e) => set('minutes', e.target.value)} placeholder="min" aria-label="Minutes" /><span>:</span><Input inputMode="numeric" value={form.seconds} onChange={(e) => set('seconds', e.target.value)} placeholder="s" aria-label="Secondes" /></div>
          </Field>
          <Field label={needsCallback ? 'Date du rappel' : 'Programmer un rappel'} required={needsCallback}><Input type="datetime-local" value={form.callbackAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => set('callbackAt', e.target.value)} /></Field>
        </div>
        <Field label="Résultat en une phrase" hint="Ex. intéressé par une démo"><Input value={form.result} onChange={(e) => set('result', e.target.value)} maxLength={200} /></Field>
        <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} /></Field>
        {!call && me?.permissions.includes('appointments.create') && form.status !== 'appointment_booked' ? <Checkbox label="Prendre un rendez-vous juste après" checked={form.book} onChange={(e) => set('book', e.target.checked)} /> : null}
        {form.status === 'appointment_booked' && !call ? <Alert tone="info">Le formulaire de rendez-vous s’ouvrira après l’enregistrement.</Alert> : null}
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4"><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button></div>
      </div>
    </Modal>
  )
}

/* ---------- Recherche de contact ---------- */
export function ContactPicker({ value, onChange }: { value: Contact | null; onChange: (c: Contact | null) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Contact[]>([])
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return }
    const t = window.setTimeout(() => { crmGet<Page<Contact>>('/contacts', { q, pageSize: 8 }).then((p) => setRows(p.rows), () => setRows([])) }, 250)
    return () => window.clearTimeout(t)
  }, [q])
  if (value) return <div className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-2 text-sm"><span><b>{value.fullName}</b> · {value.phone || value.email}</span><button type="button" className="text-xs font-semibold text-brand-700" onClick={() => onChange(null)}>Changer</button></div>
  return (
    <div className="relative">
      <label className="crm-search w-full"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone ou e-mail du contact…" aria-label="Rechercher un contact" autoFocus /></label>
      {rows.length ? <ul className="crm-picker">{rows.map((c) => <li key={c.id}><button type="button" onClick={() => onChange(c)}><b>{c.fullName}</b><span>{[c.phone, c.city].filter(Boolean).join(' · ')}</span></button></li>)}</ul> : null}
    </div>
  )
}

/* ---------- Rendez-vous ---------- */
export function AppointmentModal({ appointment, contact, callId, defaultDate, defaultStart, onClose, onSaved }: { appointment?: Appointment | null; contact?: Contact | null; callId?: string; defaultDate?: string; defaultStart?: string; onClose: () => void; onSaved: (a: Appointment) => void }) {
  const { me, lookups } = useCrm()
  const notify = useNotify()
  const isAdmin = Boolean(me?.isAdmin)
  const duration = me?.defaultDurationMin || 60
  const endFrom = (start: string) => { const [h, m] = start.split(':').map(Number); const t = Math.min(23 * 60 + 59, h * 60 + m + duration); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
  const [picked, setPicked] = useState<Contact | null>(contact || null)
  const start0 = appointment?.start || defaultStart || '10:00'
  const [form, setForm] = useState({ title: appointment?.title || '', date: appointment?.date || defaultDate || addDays(localDay(), 1), start: start0, end: appointment?.end || endFrom(start0), type: appointment?.type || me?.appointmentTypes[0] || '', status: appointment?.status || 'pending', agentId: appointment?.agentId || contact?.agentId || '', address: appointment?.address ?? contact?.address ?? '', city: appointment?.city ?? contact?.city ?? '', region: appointment?.region ?? contact?.region ?? '', notes: appointment?.notes || '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  useEffect(() => { if (!appointment && picked) setForm((f) => ({ ...f, address: picked.address || '', city: picked.city || '', region: picked.region || '', agentId: f.agentId || picked.agentId || '' })) }, [picked, appointment])

  async function save(statusOverride?: string) {
    if (!appointment && !picked) { setError('Choisissez un contact.'); return }
    if (!form.date) { setError('Choisissez une date.'); return }
    if (!form.start || !form.end || form.end <= form.start) { setError('L’heure de fin doit suivre l’heure de début.'); return }
    setBusy(true)
    setError('')
    const body: Record<string, unknown> = { ...form, status: statusOverride || form.status }
    if (!isAdmin) delete body.agentId
    else body.agentId = form.agentId || null
    try {
      const saved = appointment ? await crmSend<Appointment>(`/appointments/${appointment.id}`, 'PATCH', body) : await crmSend<Appointment>('/appointments', 'POST', { ...body, contactId: picked!.id, callId })
      notify(appointment ? (statusOverride ? 'Statut du rendez-vous mis à jour' : 'Rendez-vous mis à jour') : 'Rendez-vous créé')
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const canEdit = !appointment || isAdmin || appointment.agentId === me?.user.id
  const statuses = appointment ? statusOptions(me?.labels, 'appointment') : statusOptions(me?.labels, 'appointment').filter((o) => ['pending', 'confirmed'].includes(o.value))
  return (
    <Modal open onClose={onClose} title={appointment ? appointment.title : 'Nouveau rendez-vous'} description={appointment ? `${appointment.contactName} · ${appointment.phone || ''}` : 'Le rendez-vous est rattaché au contact, à sa base et à sa campagne.'} size="lg">
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!canEdit ? <Alert tone="info">Ce rendez-vous est suivi par un autre agent : lecture seule.</Alert> : null}
        {!appointment ? <Field label="Contact" required><ContactPicker value={picked} onChange={setPicked} /></Field> : null}
        {appointment && canEdit ? (
          <div className="flex flex-wrap gap-2">
            {appointment.status !== 'confirmed' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void save('confirmed')}><CalendarCheck2 size={14} />Confirmer</Button> : null}
            {appointment.status !== 'completed' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void save('completed')}><CheckCircle2 size={14} />Marquer réalisé</Button> : null}
            {appointment.status !== 'no_show' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void save('no_show')}><UserX size={14} />Absent</Button> : null}
            {appointment.status !== 'cancelled' ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save('cancelled')}><CalendarX2 size={14} className="text-red-600" />Annuler le RDV</Button> : null}
          </div>
        ) : null}
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Titre" className="sm:col-span-2" hint="Facultatif"><Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} placeholder={picked ? `Rendez-vous · ${picked.fullName}` : ''} /></Field>
            <Field label="Type"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{(me?.appointmentTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
            <Field label="Date" required hint={appointment ? 'Changer la date ou l’heure reporte le rendez-vous.' : undefined}><Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Début" required><Input type="time" value={form.start} onChange={(e) => { set('start', e.target.value); if (!appointment && e.target.value) set('end', endFrom(e.target.value)) }} /></Field>
            <Field label="Fin" required><Input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} /></Field>
            <Field label="Statut"><Select value={form.status} onChange={(e) => set('status', e.target.value)}>{statuses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
            {isAdmin ? <Field label="Agent"><Select value={form.agentId} onChange={(e) => set('agentId', e.target.value)}><option value="">Non assigné</option>{(lookups?.agents || []).filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field> : null}
            <Field label="Adresse" className={isAdmin ? '' : 'sm:col-span-2'}><Input value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={240} /></Field>
            <Field label="Ville"><Input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={100} /></Field>
            <Field label="Région"><Input value={form.region} onChange={(e) => set('region', e.target.value)} maxLength={100} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} /></Field>
        </fieldset>
        {appointment?.history?.length ? (
          <details className="rounded-xl border border-ink-100 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-800">Historique ({appointment.history.length})</summary>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-600">{[...appointment.history].reverse().map((h, i) => <li key={i}><b className="text-ink-800">{h.action}</b> · {new Date(h.at).toLocaleString('fr-FR')} · {h.byName}</li>)}</ul>
          </details>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button variant="ghost" onClick={onClose}>{canEdit ? 'Annuler' : 'Fermer'}</Button>
          {canEdit ? <Button disabled={busy} onClick={() => void save()}>{busy ? 'Enregistrement…' : appointment ? 'Enregistrer' : 'Créer le rendez-vous'}</Button> : null}
        </div>
      </div>
    </Modal>
  )
}

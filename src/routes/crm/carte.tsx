import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Circle, Hexagon, Layers, Locate, MapPinned, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input, Textarea } from '@/components/ui'
import { EmptyBox, Panel, Rows } from '@/components/admin-kit'
import { ConfirmDialog, FilterBar, MultiPick, RequirePermission, STATUS_HEX, crmGet, crmSend, errorText, fmtDate, fmtDateTime, useCrm, useCrmQuery, useFilterState, useLookupFilters, useNotify, useStatusLabel } from '@/features/crm/core'
import { CrmMap, esc, type MapPoint, type MapZone } from '@/features/crm/CrmMap'

export const Route = createFileRoute('/crm/carte')({ component: () => <RequirePermission perm="map.view"><MapPage /></RequirePermission> })

type MapContact = { id: string; name: string; phone: string; address: string; lat: number; lng: number; status: string; callStatus: string | null; agentName: string; lastCallAt: string | null; lastCallStatus: string | null; nextCallbackAt: string | null; appointment: { id: string; date: string; start: string; status: string } | null }
type MapAppt = { id: string; title: string; contactId: string; contactName: string; phone: string; date: string; start: string; end: string; agentName: string; status: string; address: string; lat: number; lng: number }
type MapData = { contacts: MapContact[]; appointments: MapAppt[]; missing: { contacts: number; appointments: number }; zones: Zone[] }
type Zone = MapZone & { description?: string; cities: string[]; regions: string[]; databaseIds: string[]; campaignIds: string[]; agentIds?: string[]; contacts?: number; appointments?: number }

function MapPage() {
  const { me, can, lookups, refreshLookups } = useCrm()
  const notify = useNotify()
  const label = useStatusLabel()
  const isAdmin = Boolean(me?.isAdmin)
  const [values, setValues] = useFilterState({ layer: 'all' })
  const filters = useLookupFilters(['agent', 'database', 'campaign', 'zone', 'contactStatus', 'callStatus', 'appointmentStatus', 'city', 'region'])
  const { data, loading, error, reload } = useCrmQuery<MapData>('/map', { ...values, layer: values.layer === 'all' ? '' : values.layer })
  const zonesQ = useCrmQuery<{ rows: Zone[] }>('/zones')
  const [density, setDensity] = useState(false)
  const [cluster, setCluster] = useState(true)
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [editing, setEditing] = useState<Zone | 'new' | null>(null)
  const [draft, setDraft] = useState<{ mode: 'circle' | 'polygon'; lat: number | null; lng: number | null; radiusKm: number; points: [number, number][] }>({ mode: 'circle', lat: null, lng: null, radiusKm: 10, points: [] })
  const [toDelete, setToDelete] = useState<Zone | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  const points = useMemo<MapPoint[]>(() => [
    ...(data?.contacts || []).map((c) => ({
      id: c.id, lat: c.lat, lng: c.lng, kind: 'contact' as const, color: STATUS_HEX[c.status] || '#6366f1', label: c.name,
      popup: `<b>${esc(c.name)}</b><br>${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s+/g, ''))}">${esc(c.phone)}</a><br>` : ''}${esc(c.address)}<br>Agent : ${esc(c.agentName || 'non assigné')}<br>Statut : ${esc(label('contact', c.status))}<br>Dernier appel : ${c.lastCallAt ? `${esc(fmtDateTime(c.lastCallAt))} (${esc(label('call', c.lastCallStatus))})` : 'aucun'}<br>Rappel : ${c.nextCallbackAt ? esc(fmtDateTime(c.nextCallbackAt)) : '—'}<br>RDV : ${c.appointment ? `${esc(fmtDate(c.appointment.date))} ${esc(c.appointment.start)} (${esc(label('appointment', c.appointment.status))})` : '—'}<div class="crm-popup-actions"><a href="#" data-nav="/crm/contacts/${esc(c.id)}">Ouvrir la fiche</a>${c.appointment ? `<a href="#" data-nav="/crm/rendez-vous?appointment=${esc(c.appointment.id)}">Voir le RDV</a>` : ''}</div>`,
    })),
    ...(data?.appointments || []).map((a) => ({
      id: a.id, lat: a.lat, lng: a.lng, kind: 'appointment' as const, color: STATUS_HEX[a.status] || '#6366f1', label: a.contactName,
      popup: `<b>RDV · ${esc(a.contactName)}</b><br>${esc(fmtDate(a.date))} · ${esc(a.start)}–${esc(a.end)}<br>Agent : ${esc(a.agentName || '—')}<br>Statut : ${esc(label('appointment', a.status))}<br>${esc(a.address)}${a.phone ? `<br><a href="tel:${esc(a.phone.replace(/\s+/g, ''))}">${esc(a.phone)}</a>` : ''}<div class="crm-popup-actions"><a href="#" data-nav="/crm/rendez-vous?appointment=${esc(a.id)}">Ouvrir le RDV</a><a href="#" data-nav="/crm/contacts/${esc(a.contactId)}">Fiche contact</a></div>`,
    })),
  ], [data, label])

  async function findPlace() {
    const q = search.trim().toLowerCase()
    if (!q) return
    const local = [...(data?.contacts || []).map((c) => ({ name: c.name, text: `${c.name} ${c.address}`, lat: c.lat, lng: c.lng })), ...(data?.appointments || []).map((a) => ({ name: a.contactName, text: `${a.contactName} ${a.address}`, lat: a.lat, lng: a.lng }))].find((p) => p.text.toLowerCase().includes(q))
    if (local) { setFocus({ lat: local.lat, lng: local.lng, zoom: 15 }); return }
    if (me?.geocoding !== 'nominatim') { notify('Aucun point correspondant', 'info', 'La recherche de lieux externes est désactivée (Réglages → Intégrations).'); return }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(search)}`, { headers: { 'accept-language': 'fr' } })
      const rows = (await r.json()) as Array<{ lat: string; lon: string }>
      if (rows[0]) setFocus({ lat: Number(rows[0].lat), lng: Number(rows[0].lon), zoom: 12 })
      else notify('Lieu introuvable', 'info')
    } catch { notify('Recherche de lieu indisponible', 'warning') }
  }

  async function geocodeBatch() {
    setGeocoding(true)
    try {
      const page = await crmGet<{ rows: Array<{ id: string }> }>('/contacts', { hasLocation: '0', pageSize: 25, databaseId: values.databaseId, campaignId: values.campaignId })
      if (!page.rows.length) { notify('Tous les contacts filtrés sont déjà localisés', 'info'); return }
      const r = await crmSend<{ results: Array<{ ok: boolean }> }>('/geocode', 'POST', { contactIds: page.rows.map((c) => c.id) })
      notify(`${r.results.filter((x) => x.ok).length} contact(s) localisé(s) sur ${r.results.length}`, 'success', 'Les adresses introuvables restent sans position : placez-les à la main depuis la fiche.')
      await reload()
    } catch (e) { notify('Géocodage impossible', 'warning', errorText(e)) } finally { setGeocoding(false) }
  }

  const zones = zonesQ.data?.rows || []
  const drawing = editing !== null
  const draftShape = !drawing ? null : draft.mode === 'circle' ? (draft.lat !== null && draft.lng !== null ? { type: 'circle' as const, lat: draft.lat, lng: draft.lng, radiusKm: draft.radiusKm } : null) : { type: 'points' as const, points: draft.points }
  const startEdit = (z: Zone | 'new') => {
    setEditing(z)
    if (z !== 'new' && z.shape?.type === 'circle') setDraft({ mode: 'circle', lat: z.shape.lat, lng: z.shape.lng, radiusKm: z.shape.radiusKm, points: [] })
    else if (z !== 'new' && z.shape?.type === 'polygon') setDraft({ mode: 'polygon', lat: null, lng: null, radiusKm: 10, points: z.shape.points })
    else setDraft({ mode: 'circle', lat: null, lng: null, radiusKm: 10, points: [] })
  }

  return (
    <div>
      <PageHeader eyebrow="CRM · Activité" title="Carte géographique" description="Contacts et rendez-vous géolocalisés, zones géographiques et affectations. Seules les coordonnées réelles sont affichées." actions={isAdmin ? <Button size="sm" onClick={() => startEdit('new')}><Plus size={14} />Nouvelle zone</Button> : undefined} />
      <FilterBar values={values} onChange={setValues} filters={filters} search={false}>
        <select className="crm-native-select" aria-label="Calques" value={values.layer || 'all'} onChange={(e) => setValues({ ...values, layer: e.target.value })}><option value="all">Contacts et rendez-vous</option><option value="contacts">Contacts seulement</option><option value="appointments">Rendez-vous seulement</option></select>
        <span className="crm-daterange"><input className="crm-date" type="date" aria-label="Du" value={values.from || ''} onChange={(e) => setValues({ ...values, from: e.target.value })} /><span>→</span><input className="crm-date" type="date" aria-label="Au" value={values.to || ''} onChange={(e) => setValues({ ...values, to: e.target.value })} /></span>
      </FilterBar>
      {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3">
            <label className="crm-search min-w-[220px] flex-1"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void findPlace() }} placeholder="Chercher un contact, une adresse ou une ville…" aria-label="Rechercher sur la carte" /></label>
            <Button size="sm" variant="outline" onClick={() => void findPlace()}>Chercher</Button>
            <label className="crm-toggle"><input type="checkbox" checked={cluster} onChange={(e) => setCluster(e.target.checked)} />Regrouper</label>
            <label className="crm-toggle"><input type="checkbox" checked={density} onChange={(e) => setDensity(e.target.checked)} /><Layers size={13} />Densité</label>
          </div>
          {drawing ? <Alert tone="info" className="m-3">{draft.mode === 'circle' ? 'Cliquez sur la carte pour placer le centre de la zone, puis réglez le rayon.' : 'Cliquez sur la carte pour ajouter les points du polygone (3 minimum).'}</Alert> : null}
          <div className="p-3">
            <CrmMap points={drawing ? [] : points} zones={zones} density={density} cluster={cluster && !density} height="min(70vh, 640px)" focus={focus} fitKey={JSON.stringify([values, points.length])} draft={draftShape} onMapClick={drawing ? (lat, lng) => setDraft((d) => (d.mode === 'circle' ? { ...d, lat, lng } : { ...d, points: [...d.points, [lat, lng]] })) : undefined} />
          </div>
          <div className="crm-legend px-4 pb-4">
            <span><i className="is-dot" style={{ background: '#6366f1' }} />Contact</span>
            <span><i className="is-square" style={{ background: '#10b981' }} />Rendez-vous</span>
            {['new', 'callback_requested', 'interested', 'appointment_booked', 'invalid_number'].map((s) => <span key={s}><i style={{ background: STATUS_HEX[s] }} />{label('contact', s)}</span>)}
            {loading ? <span>Chargement…</span> : <span>{data?.contacts.length ?? 0} contact(s) · {data?.appointments.length ?? 0} RDV affichés</span>}
          </div>
        </Panel>

        <div className="space-y-5">
          {drawing ? (
            <ZoneEditor
              zone={editing === 'new' ? null : editing}
              draft={draft}
              setDraft={setDraft}
              onCancel={() => setEditing(null)}
              onSaved={async () => { setEditing(null); await zonesQ.reload(); await reload(); await refreshLookups() }}
            />
          ) : (
            <Panel title="Zones géographiques" description="Une zone regroupe une surface sur la carte et/ou des villes et régions.">
              {!zones.length ? <EmptyBox icon={<MapPinned size={20} />} title="Aucune zone" text={isAdmin ? 'Créez une zone pour répartir le terrain entre agents.' : 'Aucune zone ne vous est assignée.'} action={isAdmin ? <Button size="sm" onClick={() => startEdit('new')}><Plus size={14} />Nouvelle zone</Button> : undefined} /> : null}
              <Rows>
                {zones.map((z) => (
                  <li key={z.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: z.color }} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setValues({ ...values, zoneId: values.zoneId === z.id ? '' : z.id }); if (z.shape?.type === 'circle') setFocus({ lat: z.shape.lat, lng: z.shape.lng, zoom: 11 }) }}>
                      <span className="block truncate text-sm font-semibold text-ink-950">{z.name}{values.zoneId === z.id ? <Badge tone="brand" className="ml-2">Filtre actif</Badge> : null}</span>
                      <span className="block text-xs text-ink-500">{z.contacts ?? 0} contact(s) · {z.appointments ?? 0} RDV · {(z.agentIds || []).map((id) => lookups?.agents.find((a) => a.id === id)?.name).filter(Boolean).join(', ') || 'aucun agent'}</span>
                      {[...(z.cities || []), ...(z.regions || [])].length ? <span className="block truncate text-xs text-ink-400">{[...(z.cities || []), ...(z.regions || [])].join(', ')}</span> : null}
                    </button>
                    {isAdmin ? <><Button size="sm" variant="ghost" aria-label={`Modifier ${z.name}`} onClick={() => startEdit(z)}><Pencil size={13} /></Button><Button size="sm" variant="ghost" aria-label={`Supprimer ${z.name}`} onClick={() => setToDelete(z)}><Trash2 size={13} className="text-red-600" /></Button></> : null}
                  </li>
                ))}
              </Rows>
            </Panel>
          )}
          <Panel title="Positions manquantes" description="Ces éléments ne sont pas affichés : aucune position n’est inventée.">
            <div className="space-y-3 p-4 text-sm">
              <p><b>{data?.missing.contacts ?? 0}</b> contact(s) et <b>{data?.missing.appointments ?? 0}</b> rendez-vous sans coordonnées.</p>
              <Link to={'/crm/contacts' as any} search={{ hasLocation: '0' } as any} className="cg-link">Voir les contacts sans position</Link>
              {isAdmin && can('contacts.edit') ? (
                me?.geocoding === 'nominatim'
                  ? <Button size="sm" variant="outline" disabled={geocoding} onClick={() => void geocodeBatch()}><Locate size={14} />{geocoding ? 'Localisation… (≈ 1 s par adresse)' : 'Localiser 25 adresses'}</Button>
                  : <p className="text-xs text-ink-500">Géocodage automatique désactivé. Activez-le dans Réglages → Intégrations (envoi des adresses à OpenStreetMap), ou placez chaque contact à la main depuis sa fiche.</p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
      <ConfirmDialog open={Boolean(toDelete)} danger title="Supprimer cette zone ?" confirmLabel="Supprimer" text={<>La zone <b>{toDelete?.name}</b> sera supprimée et retirée des agents et des bases. Les contacts ne sont pas modifiés.</>} onClose={() => setToDelete(null)} onConfirm={() => void crmSend(`/zones/${toDelete!.id}`, 'DELETE').then(async () => { notify('Zone supprimée'); setToDelete(null); await zonesQ.reload(); await refreshLookups() }, (e) => notify('Suppression impossible', 'warning', errorText(e)))} />
    </div>
  )
}

function ZoneEditor({ zone, draft, setDraft, onCancel, onSaved }: { zone: Zone | null; draft: { mode: 'circle' | 'polygon'; lat: number | null; lng: number | null; radiusKm: number; points: [number, number][] }; setDraft: (d: typeof draft) => void; onCancel: () => void; onSaved: () => Promise<void> }) {
  const { lookups } = useCrm()
  const notify = useNotify()
  const [form, setForm] = useState({ name: zone?.name || '', description: zone?.description || '', color: zone?.color || '#6366f1', cities: (zone?.cities || []).join(', '), regions: (zone?.regions || []).join(', '), agentIds: zone?.agentIds || [], databaseIds: zone?.databaseIds || [], campaignIds: zone?.campaignIds || [], useShape: zone ? Boolean(zone.shape) : true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  async function save() {
    if (form.name.trim().length < 2) { setError('Donnez un nom à la zone.'); return }
    let shape: unknown = null
    if (form.useShape) {
      if (draft.mode === 'circle') { if (draft.lat === null || draft.lng === null) { setError('Placez le centre de la zone sur la carte.'); return } shape = { type: 'circle', lat: draft.lat, lng: draft.lng, radiusKm: draft.radiusKm } }
      else { if (draft.points.length < 3) { setError('Ajoutez au moins 3 points sur la carte.'); return } shape = { type: 'polygon', points: draft.points } }
    }
    setBusy(true)
    setError('')
    const body = { name: form.name.trim(), description: form.description, color: form.color, cities: form.cities, regions: form.regions, agentIds: form.agentIds, databaseIds: form.databaseIds, campaignIds: form.campaignIds, shape }
    try {
      if (zone) await crmSend(`/zones/${zone.id}`, 'PATCH', body)
      else await crmSend('/zones', 'POST', body)
      notify(zone ? 'Zone mise à jour' : 'Zone créée')
      await onSaved()
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <Panel title={zone ? `Modifier · ${zone.name}` : 'Nouvelle zone'}>
      <div className="space-y-4 p-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Nom" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} autoFocus /></Field>
          <Field label="Couleur"><input type="color" className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200" value={form.color} onChange={(e) => set('color', e.target.value)} aria-label="Couleur de la zone" /></Field>
        </div>
        <label className="crm-toggle"><input type="checkbox" checked={form.useShape} onChange={(e) => set('useShape', e.target.checked)} />Dessiner la zone sur la carte</label>
        {form.useShape ? (
          <div className="space-y-3 rounded-xl border border-ink-100 p-3">
            <div className="flex gap-2">
              <Button size="sm" variant={draft.mode === 'circle' ? 'primary' : 'outline'} onClick={() => setDraft({ ...draft, mode: 'circle' })}><Circle size={13} />Cercle</Button>
              <Button size="sm" variant={draft.mode === 'polygon' ? 'primary' : 'outline'} onClick={() => setDraft({ ...draft, mode: 'polygon' })}><Hexagon size={13} />Polygone</Button>
            </div>
            {draft.mode === 'circle' ? (
              <Field label={`Rayon : ${draft.radiusKm} km`}><input type="range" min={1} max={150} value={draft.radiusKm} onChange={(e) => setDraft({ ...draft, radiusKm: Number(e.target.value) })} className="w-full" aria-label="Rayon en kilomètres" /></Field>
            ) : (
              <div className="flex items-center justify-between text-xs text-ink-600"><span>{draft.points.length} point(s)</span><button type="button" className="font-semibold text-brand-700" onClick={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })} disabled={!draft.points.length}>Retirer le dernier point</button></div>
            )}
            <p className="text-xs text-ink-500">{draft.mode === 'circle' ? (draft.lat !== null ? `Centre : ${draft.lat}, ${draft.lng}` : 'Cliquez sur la carte pour placer le centre.') : 'Cliquez sur la carte pour tracer le contour.'}</p>
          </div>
        ) : null}
        <Field label="Villes" hint="Séparées par des virgules : les contacts de ces villes font partie de la zone."><Input value={form.cities} onChange={(e) => set('cities', e.target.value)} list="crm-zone-cities" /></Field>
        <datalist id="crm-zone-cities">{(lookups?.cities || []).map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Régions"><Input value={form.regions} onChange={(e) => set('regions', e.target.value)} /></Field>
        <Field label="Agents"><MultiPick options={(lookups?.agents || []).filter((a) => a.role === 'agent')} value={form.agentIds} onChange={(v) => set('agentIds', v)} empty="Aucun agent." /></Field>
        <Field label="Bases"><MultiPick options={lookups?.databases || []} value={form.databaseIds} onChange={(v) => set('databaseIds', v)} empty="Aucune base." /></Field>
        <Field label="Campagnes"><MultiPick options={lookups?.campaigns || []} value={form.campaignIds} onChange={(v) => set('campaignIds', v)} empty="Aucune campagne." /></Field>
        <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Annuler</Button><Button disabled={busy} onClick={() => void save()}>{busy ? 'Enregistrement…' : 'Enregistrer la zone'}</Button></div>
      </div>
    </Panel>
  )
}

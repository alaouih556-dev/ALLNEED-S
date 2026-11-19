/*
 * Carte CRM (Leaflet + regroupement des marqueurs). Seules les coordonnées réelles enregistrées
 * sont affichées : aucun point n'est inventé. Fond de carte OpenStreetMap.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

export type MapPoint = { id: string; lat: number; lng: number; color: string; kind: 'contact' | 'appointment'; popup: string; label?: string }
export type MapZone = { id: string; name: string; color: string; shape: null | { type: 'circle'; lat: number; lng: number; radiusKm: number } | { type: 'polygon'; points: [number, number][] } }

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const MOROCCO: L.LatLngExpression = [31.8, -7.1]

export function CrmMap({ points, zones = [], density = false, cluster = true, height = 520, draft, onMapClick, focus, fitKey }: {
  points: MapPoint[]
  zones?: MapZone[]
  density?: boolean
  cluster?: boolean
  height?: number | string
  /** Zone en cours de dessin (aperçu). */
  draft?: MapZone['shape'] | { type: 'points'; points: [number, number][] } | null
  onMapClick?: (lat: number, lng: number) => void
  focus?: { lat: number; lng: number; zoom?: number } | null
  /** Change cette clé pour recadrer la carte sur les points. */
  fitKey?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const zoneLayer = useRef<L.LayerGroup | null>(null)
  const draftLayer = useRef<L.LayerGroup | null>(null)
  const clickRef = useRef(onMapClick)
  const navigate = useNavigate()
  clickRef.current = onMapClick

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { center: MOROCCO, zoom: 5, scrollWheelZoom: true, worldCopyJump: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m)
    zoneLayer.current = L.layerGroup().addTo(m)
    draftLayer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => clickRef.current?.(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6))
    // Liens internes dans les infobulles : navigation sans rechargement.
    el.current.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('a[data-nav]') as HTMLAnchorElement | null
      if (!a) return
      e.preventDefault()
      void navigate({ to: a.dataset.nav as never })
    })
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Marqueurs
  useEffect(() => {
    const m = map.current
    if (!m) return
    layer.current?.remove()
    const group: L.LayerGroup = cluster ? (L as unknown as { markerClusterGroup: (o: object) => L.LayerGroup }).markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, chunkedLoading: true }) : L.layerGroup()
    for (const p of points) {
      if (density) {
        L.circleMarker([p.lat, p.lng], { radius: 22, stroke: false, fillColor: p.color, fillOpacity: 0.16 }).addTo(group)
        continue
      }
      const shape = p.kind === 'appointment' ? 'crm-pin is-appt' : 'crm-pin'
      const icon = L.divIcon({ className: '', html: `<span class="${shape}" style="--pin:${p.color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -8] })
      L.marker([p.lat, p.lng], { icon, title: p.label || '' }).bindPopup(p.popup, { maxWidth: 280 }).addTo(group)
    }
    group.addTo(m)
    layer.current = group
  }, [points, density, cluster])

  // Recadrage
  useEffect(() => {
    const m = map.current
    if (!m) return
    const coords: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng])
    for (const z of zones) if (z.shape?.type === 'circle') coords.push([z.shape.lat, z.shape.lng])
    if (coords.length === 1) m.setView(coords[0], 13)
    else if (coords.length > 1) m.fitBounds(L.latLngBounds(coords), { padding: [30, 30], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  useEffect(() => { if (focus && map.current) map.current.setView([focus.lat, focus.lng], focus.zoom ?? 14) }, [focus])

  // Zones
  useEffect(() => {
    const g = zoneLayer.current
    if (!g) return
    g.clearLayers()
    for (const z of zones) {
      if (z.shape?.type === 'circle') L.circle([z.shape.lat, z.shape.lng], { radius: z.shape.radiusKm * 1000, color: z.color, weight: 2, fillOpacity: 0.08 }).bindTooltip(esc(z.name)).addTo(g)
      if (z.shape?.type === 'polygon') L.polygon(z.shape.points, { color: z.color, weight: 2, fillOpacity: 0.08 }).bindTooltip(esc(z.name)).addTo(g)
    }
  }, [zones])

  // Aperçu de dessin
  useEffect(() => {
    const g = draftLayer.current
    if (!g) return
    g.clearLayers()
    if (!draft) return
    if (draft.type === 'circle' && draft.lat !== null) L.circle([draft.lat, draft.lng], { radius: draft.radiusKm * 1000, color: '#7c3aed', dashArray: '6 6', weight: 2, fillOpacity: 0.1 }).addTo(g)
    if ((draft.type === 'polygon' || draft.type === 'points') && draft.points.length) {
      for (const p of draft.points) L.circleMarker(p, { radius: 5, color: '#7c3aed', fillOpacity: 1 }).addTo(g)
      if (draft.points.length > 1) L.polygon(draft.points, { color: '#7c3aed', dashArray: '6 6', weight: 2, fillOpacity: 0.1 }).addTo(g)
    }
  }, [draft])

  useEffect(() => { if (el.current) el.current.style.cursor = onMapClick ? 'crosshair' : '' }, [onMapClick])

  return <div ref={el} className="crm-map" style={{ height }} role="application" aria-label="Carte géographique" />
}

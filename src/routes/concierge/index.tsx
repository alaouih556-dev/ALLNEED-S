import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Gauge,
  Inbox,
  MapPin,
  MessageSquare,
  Plus,
  Presentation,
  RefreshCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, StatGrid, toneClass, type KitTone } from '@/components/admin-kit'
import { canAccessSalesPresentation, useAuth } from '@/features/auth/AuthContext'
import { ValidationRequests } from '@/components/ValidationRequests'

export const Route = createFileRoute('/concierge/')({ component: ConciergeDashboard })

type Org = {
  id: string
  name: string
  sector: string
  city?: string
  contactName?: string
  diagnosticStatus?: string | null
  restitutionPublished?: boolean
  offerStatus?: string | null
  missionsCount?: number
  needsCount?: number
}
type Registration = { id: string; orgId?: string; orgName?: string; name?: string; appointmentDate?: string; appointmentSlot?: string; appointmentStatus?: string; status?: string }
type Task = { id: string; tone: KitTone; icon: React.ReactNode; title: string; detail: string; to: string; params?: Record<string, string>; cta: string }

const DIAG_TO_ANALYSE = new Set(['soumis', 'en_analyse', 'pret_a_valider'])

/** Étape du parcours client, lisible en un coup d’œil. */
function orgStage(org: Org): { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' } {
  if (org.offerStatus === 'acceptee' || (org.missionsCount ?? 0) > 0) return { label: 'Accompagnement en cours', tone: 'success' }
  if (org.offerStatus) return { label: 'Offre en discussion', tone: 'info' }
  if (org.restitutionPublished) return { label: 'Restitution publiée', tone: 'success' }
  if (org.diagnosticStatus && DIAG_TO_ANALYSE.has(org.diagnosticStatus)) return { label: 'Diagnostic à analyser', tone: 'warning' }
  if (org.diagnosticStatus) return { label: 'Diagnostic en cours', tone: 'info' }
  return { label: 'Diagnostic non envoyé', tone: 'neutral' }
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

function ConciergeDashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [o, r] = await Promise.all([
        fetch('/api/concierge/orgs', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/concierge/registrations', { credentials: 'same-origin', cache: 'no-store' }),
      ])
      const ob = await o.json()
      if (!o.ok) throw new Error(ob.error || 'Chargement impossible')
      setOrgs(ob)
      setRegistrations(r.ok ? await r.json() : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user?.role === 'concierge') void load()
  }, [auth.status, auth.user?.id, auth.user?.role, load])

  const firstName = (auth.user?.name || '').split(' ')[0] || 'Concierge'
  const salesAccess = canAccessSalesPresentation(auth.user)

  const stats = useMemo(() => {
    const toAnalyse = orgs.filter((o) => o.diagnosticStatus && DIAG_TO_ANALYSE.has(o.diagnosticStatus))
    const published = orgs.filter((o) => o.restitutionPublished)
    const missions = orgs.reduce((n, o) => n + (o.missionsCount ?? 0), 0)
    const needs = orgs.reduce((n, o) => n + (o.needsCount ?? 0), 0)
    const slots = registrations.filter((r) => r.appointmentStatus !== 'valide' && r.status !== 'refusee')
    return { toAnalyse, published, missions, needs, slots }
  }, [orgs, registrations])

  const tasks = useMemo<Task[]>(() => {
    const list: Task[] = []
    for (const o of stats.toAnalyse) list.push({ id: `d-${o.id}`, tone: 'amber', icon: <FileSearch size={16} />, title: `Analyser le diagnostic de ${o.name}`, detail: 'Lire les réponses, préparer la restitution puis la publier.', to: '/concierge/diagnostics', cta: 'Analyser' })
    for (const r of stats.slots) list.push({ id: `s-${r.id}`, tone: 'sky', icon: <CalendarClock size={16} />, title: `Confirmer le créneau de ${r.orgName || r.name || 'l’entreprise'}`, detail: [r.appointmentDate, r.appointmentSlot].filter(Boolean).join(' · ') || 'Créneau demandé à confirmer avec le client.', to: r.orgId ? '/concierge/entreprises/$id' : '/concierge/entreprises', params: r.orgId ? { id: r.orgId } : undefined, cta: 'Confirmer' })
    for (const o of orgs) if (o.restitutionPublished && !o.offerStatus) list.push({ id: `o-${o.id}`, tone: 'teal', icon: <Send size={16} />, title: `Proposer la suite à ${o.name}`, detail: 'La restitution est publiée : présenter l’offre adaptée aux priorités.', to: '/concierge/suivi-commercial', cta: 'Préparer' })
    for (const o of orgs) if (!o.diagnosticStatus) list.push({ id: `n-${o.id}`, tone: 'slate', icon: <ClipboardCheck size={16} />, title: `Relancer ${o.name} pour son diagnostic`, detail: 'Le questionnaire n’a pas encore été envoyé par le client.', to: '/concierge/entreprises/$id', params: { id: o.id }, cta: 'Ouvrir' })
    return list.slice(0, 6)
  }, [orgs, stats])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <PageHeader
        eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
        title={`${greeting()}, ${firstName}`}
        description={
          loading
            ? 'Chargement de votre portefeuille…'
            : tasks.length
              ? `Vous avez ${tasks.length} action${tasks.length > 1 ? 's' : ''} à mener sur ${orgs.length} entreprise${orgs.length > 1 ? 's' : ''} suivie${orgs.length > 1 ? 's' : ''}.`
              : orgs.length
                ? 'Tout est à jour dans votre portefeuille. Beau travail.'
                : 'Votre portefeuille est vide pour le moment : ajoutez une entreprise ou demandez une affectation à l’administrateur.'
        }
        actions={
          <>
            <Link to="/concierge/entreprises/nouvelle"><Button size="sm"><Plus size={14} />Ajouter une entreprise</Button></Link>
            {salesAccess ? <Link to={'/sales-presentation' as any}><Button size="sm" variant="outline"><Presentation size={14} />Sales Presentation</Button></Link> : null}
            <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCcw size={14} />Actualiser</Button>
          </>
        }
      />

      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}

      <StatGrid>
        <MiniStat icon={<Building2 size={18} />} tone="indigo" label="Entreprises suivies" value={loading ? '–' : orgs.length} hint={`${stats.published.length} restitution(s) publiée(s)`} onClick={() => void navigate({ to: '/concierge/entreprises' as any })} />
        <MiniStat icon={<Gauge size={18} />} tone="amber" label="Diagnostics à analyser" value={loading ? '–' : stats.toAnalyse.length} hint="À lire puis restituer" onClick={() => void navigate({ to: '/concierge/diagnostics' as any })} />
        <MiniStat icon={<Inbox size={18} />} tone="sky" label="Besoins clients" value={loading ? '–' : stats.needs} hint="Dans votre portefeuille" onClick={() => void navigate({ to: '/concierge/besoins' as any })} />
        <MiniStat icon={<Briefcase size={18} />} tone="emerald" label="Missions" value={loading ? '–' : stats.missions} hint="Engagées après une offre" onClick={() => void navigate({ to: '/concierge/missions' as any })} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="À faire maintenant" description="Les actions les plus utiles, dans l’ordre conseillé." action={tasks.length ? <Badge tone="warning">{tasks.length}</Badge> : <Badge tone="success">À jour</Badge>}>
          {loading ? <LoadingRows /> : null}
          {!loading && !tasks.length ? (
            <EmptyBox icon={<CheckCircle2 size={20} />} title="Rien d’urgent" text="Les diagnostics à analyser, créneaux à confirmer et relances apparaîtront ici." />
          ) : null}
          <Rows>
            {tasks.map((t) => (
              <li key={t.id}>
                <Link to={t.to as any} params={t.params as any} className="cg-task">
                  <span className={`cg-task-icon ${toneClass(t.tone)}`}>{t.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-950 sm:truncate">{t.title}</span>
                    <span className="block text-xs text-ink-500 sm:truncate">{t.detail}</span>
                  </span>
                  <span className="cg-task-cta">{t.cta}<ArrowRight size={14} /></span>
                </Link>
              </li>
            ))}
          </Rows>
        </Panel>

        <Panel title="Raccourcis" description="Vos outils de suivi au quotidien.">
          <div className="grid gap-2 p-4">
            {[
              { to: '/concierge/diagnostics', icon: <Gauge size={16} />, tone: 'amber', label: 'Diagnostics', text: 'Analyser et restituer' },
              { to: '/concierge/besoins', icon: <Inbox size={16} />, tone: 'sky', label: 'Besoins', text: 'Faire avancer les demandes' },
              { to: '/concierge/rendez-vous', icon: <CalendarClock size={16} />, tone: 'teal', label: 'Rendez-vous', text: 'Préparer les échanges' },
              { to: '/concierge/documents', icon: <FileText size={16} />, tone: 'emerald', label: 'Documents', text: 'Pièces des entreprises' },
              { to: '/concierge/messages', icon: <MessageSquare size={16} />, tone: 'indigo', label: 'Messages', text: 'Répondre aux clients' },
            ].map((q) => (
              <Link key={q.to} to={q.to as any} className="cg-shortcut">
                <span className={`cg-task-icon ${toneClass(q.tone as KitTone)}`}>{q.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-950">{q.label}</span>
                  <span className="block truncate text-xs text-ink-500">{q.text}</span>
                </span>
                <ArrowRight size={14} className="text-ink-300" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title="Votre portefeuille"
        description="Les entreprises qui vous sont attribuées et l’étape où elles en sont."
        action={<Link to="/concierge/entreprises" className="cg-link">Tout voir<ArrowRight size={14} /></Link>}
      >
        {loading ? <LoadingRows /> : null}
        {!loading && !orgs.length ? (
          <EmptyBox
            icon={<Building2 size={20} />}
            title="Aucune entreprise attribuée"
            text="L’administrateur ALLNEEDS peut vous en attribuer, ou vous pouvez ajouter une nouvelle relation client."
            action={<Link to="/concierge/entreprises/nouvelle"><Button size="sm"><Plus size={14} />Ajouter une entreprise</Button></Link>}
          />
        ) : null}
        <Rows>
          {orgs.slice(0, 8).map((org) => {
            const stage = orgStage(org)
            return (
              <li key={org.id}>
                <Link to={'/concierge/entreprises/$id' as any} params={{ id: org.id } as any} className="cg-org-row">
                  <Initial name={org.name} tone="indigo" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-950 sm:truncate">{org.name}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-500 sm:truncate"><MapPin size={12} />{org.city || 'Ville non renseignée'}{org.contactName ? ` · ${org.contactName}` : ''}</span>
                  </span>
                  <span className="hidden text-xs text-ink-500 md:block">{org.needsCount ?? 0} besoin(s) · {org.missionsCount ?? 0} mission(s)</span>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                  <ArrowRight size={15} className="text-ink-300" />
                </Link>
              </li>
            )
          })}
        </Rows>
      </Panel>

      <div className="mt-5">
        <ValidationRequests />
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-400"><Sparkles size={12} />Données réelles de votre portefeuille · seules les entreprises qui vous sont attribuées sont visibles.</p>
    </div>
  )
}

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileSearch,
  FileText,
  Gauge,
  Handshake,
  Inbox,
  LineChart,
  Lock,
  Mail,
  MessageSquare,
  Network,
  Receipt,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Badge, Button } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, Panel, Rows, toneClass, type KitTone } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import { useDemo } from '@/store/store'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { useDiagnosticStatus } from '@/features/diagnostic/useDiagnosticStatus'
import { isDiagnosticSubmitted } from '@/lib/diagnostic-status'
import { readDiagnosticDraft } from '@/lib/diagnostic-draft'
import { toSector } from '@/lib/parcours'
import { clientModules, type AccessModule } from '@/lib/access'
import { SECTOR_LABEL } from '@/data/catalog'
import type { SectorKey } from '@/features/health360/packs'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/app/')({
  component: ClientHome,
  head: () => ({ meta: [{ title: 'Accueil — ALLNEEDS' }] }),
})

type Offer = { status?: string; plan?: string; name?: string; title?: string } | null
type Notification = { id: string; title: string; message?: string; readAt?: string | null; createdAt: string }

/** Étapes du parcours client, dans l'ordre. */
const JOURNEY = [
  { key: 'compte', label: 'Compte créé', hint: 'Votre espace est actif' },
  { key: 'diagnostic', label: 'Diagnostic 360°', hint: 'Vous répondez au questionnaire' },
  { key: 'analyse', label: 'Analyse', hint: 'Votre concierge étudie vos réponses' },
  { key: 'rapport', label: 'Rapport publié', hint: 'Vos priorités et recommandations' },
  { key: 'accompagnement', label: 'Accompagnement', hint: 'Offre acceptée, missions lancées' },
] as const

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

function ClientHome() {
  const auth = useAuth()
  const { orgId: fallbackOrgId } = useDemo()
  const { orgId, orgName, sector } = useOrgContext()
  const effectiveOrgId = orgId || fallbackOrgId
  const user = auth.user
  const org = user?.organization ?? null
  const modules = clientModules(org)
  const { info, loading } = useDiagnosticStatus(effectiveOrgId)
  const submitted = isDiagnosticSubmitted(info)
  const published = Boolean(info.restitutionPublished && info.publishedAt)

  const [offer, setOffer] = useState<Offer>(null)
  const [notifications, setNotifications] = useState<Notification[] | null>(null)

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    let cancelled = false
    void fetch('/api/offers/current', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { current: null }))
      .then((body) => { if (!cancelled) setOffer(body?.current ?? null) })
      .catch(() => undefined)
    void fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((body) => { if (!cancelled) setNotifications(Array.isArray(body) ? body : []) })
      .catch(() => { if (!cancelled) setNotifications([]) })
    return () => { cancelled = true }
  }, [auth.status, user?.id])

  const sectorKey = toSector(org?.sector ?? sector) as SectorKey | null
  const draft = sectorKey ? readDiagnosticDraft(sectorKey) : null
  const started = Boolean(draft?.started && draft.answered > 0)
  const questionsDone = Boolean(draft?.total && draft.completed === draft.total)
  const offerActive = Boolean(offer?.status && ['actif', 'acceptee'].includes(offer.status))
  const offerPending = Boolean(offer && !offerActive)

  /** Index de l'étape en cours dans JOURNEY. */
  const stage = offerActive ? 4 : published ? 3 : submitted ? 2 : 1

  const next = useMemo<{ tone: KitTone; icon: ReactNode; eyebrow: string; title: string; text: string; meta?: string; cta?: string; to?: string; progress?: number }>(() => {
    if (offerActive) return { tone: 'emerald', icon: <Handshake size={20} />, eyebrow: 'Accompagnement en cours', title: 'Suivez vos missions et vos résultats', text: 'Votre offre est active. Retrouvez l’avancement des missions, vos documents et vos échanges avec ALLNEEDS.', cta: modules.missions ? 'Voir mes missions' : 'Voir mon offre', to: modules.missions ? '/app/missions' : '/app/offres' }
    if (offerPending) return { tone: 'sky', icon: <Receipt size={20} />, eyebrow: 'Offre proposée', title: 'Une offre vous attend', text: 'Votre concierge vous a proposé un accompagnement adapté à votre rapport. Consultez-la pour l’accepter ou poser vos questions.', cta: 'Voir l’offre', to: '/app/offres' }
    if (published) return { tone: 'teal', icon: <FileSearch size={20} />, eyebrow: 'Rapport disponible', title: 'Découvrez votre rapport de diagnostic', meta: `Publié le ${longDate(info.publishedAt!)}`, text: 'Vos priorités et recommandations sont prêtes, ainsi que les offres adaptées à votre établissement.', cta: 'Lire mon rapport', to: '/app/diagnostics' }
    if (submitted) return { tone: 'amber', icon: <Sparkles size={20} />, eyebrow: 'Analyse en cours', title: 'Votre concierge analyse vos réponses', meta: info.submittedAt ? `Envoyé le ${longDate(info.submittedAt)}` : undefined, text: 'Vous serez notifié dès la publication de votre rapport : aucune action n’est requise de votre part.', cta: 'Suivre mon rapport', to: '/app/diagnostics' }
    if (questionsDone) return { tone: 'indigo', icon: <ClipboardCheck size={20} />, eyebrow: 'Dernière étape', title: 'Envoyez votre diagnostic', text: 'Toutes les questions sont renseignées. Relisez votre synthèse puis envoyez-la à ALLNEEDS pour lancer l’analyse.', cta: 'Finaliser et envoyer', to: '/app/diagnostic-auto', progress: 1 }
    if (started) return { tone: 'indigo', icon: <ClipboardCheck size={20} />, eyebrow: 'Diagnostic commencé', title: 'Reprenez votre diagnostic', text: 'Vos réponses sont enregistrées automatiquement : reprenez où vous en étiez.', cta: 'Continuer mon diagnostic', to: '/app/diagnostic-auto', progress: draft?.total ? (draft.answered ?? 0) / draft.total : 0 }
    return { tone: 'indigo', icon: <ClipboardCheck size={20} />, eyebrow: 'Première étape', title: 'Réalisez votre diagnostic 360°', text: 'Une question à la fois, à votre rythme : vos réponses sont enregistrées au fur et à mesure. C’est le point de départ de votre accompagnement.', cta: 'Commencer mon diagnostic', to: '/app/diagnostic-auto', progress: 0 }
  }, [offerActive, offerPending, published, submitted, questionsDone, started, draft, info.publishedAt, info.submittedAt, modules.missions])

  const spaces: Array<{ key: string; to: string; label: string; text: string; icon: ReactNode; tone: KitTone; open: boolean; lock: string }> = [
    { key: 'rapport', to: '/app/diagnostics', label: 'Rapport de diagnostic', text: 'Priorités et recommandations', icon: <FileSearch size={16} />, tone: 'teal', open: submitted, lock: 'Après l’envoi du diagnostic' },
    { key: 'offres', to: '/app/offres', label: 'Offres', text: 'BASIQUE, PRO, PERFORMANCE', icon: <Receipt size={16} />, tone: 'indigo', open: submitted, lock: 'Après l’envoi du diagnostic' },
    ...([
      ['missions', '/app/missions', 'Missions', 'Avancement et livrables', <Briefcase size={16} />, 'emerald'],
      ['besoins', '/app/besoins', 'Besoins', 'Vos demandes ponctuelles', <Inbox size={16} />, 'sky'],
      ['documents', '/app/documents', 'Documents', 'Pièces partagées', <FileText size={16} />, 'slate'],
      ['messages', '/app/messages', 'Messages', 'Échanges avec ALLNEEDS', <MessageSquare size={16} />, 'indigo'],
      ['rendezVous', '/app/rendez-vous', 'Rendez-vous', 'Vos prochains échanges', <CalendarDays size={16} />, 'teal'],
      ['equipe', '/app/equipe', 'Équipe', 'Invitez vos collaborateurs', <UsersRound size={16} />, 'amber'],
      ['results', '/app/performance', 'Résultats', 'Indicateurs de suivi', <LineChart size={16} />, 'emerald'],
      ['prestataires', '/app/prestataires', 'Prestataires', 'Experts du réseau', <Network size={16} />, 'rose'],
    ] as Array<[AccessModule, string, string, string, ReactNode, KitTone]>).map(([key, to, label, text, icon, tone]) => ({ key, to, label, text, icon, tone, open: modules[key], lock: 'Activé avec votre offre' })),
  ]
  const openCount = spaces.filter((s) => s.open).length

  const firstName = (user?.firstName || user?.name || '').split(' ')[0] || ''
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const concierge = org?.concierge ?? null
  const companyName = org?.name ?? orgName
  const sectorLabel = sectorKey ? SECTOR_LABEL[sectorKey as keyof typeof SECTOR_LABEL] ?? org?.sector : org?.sector

  return (
    <div className="cl-home">
      <PageHeader
        eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Voici où en est votre accompagnement ALLNEEDS et ce qui vous attend ensuite."
        actions={next.to ? <Link to={next.to as any}><Button size="sm">{next.cta}<ArrowRight size={14} /></Button></Link> : null}
      />

      <Panel title="Votre parcours" description="Les grandes étapes de votre accompagnement, de l’inscription aux résultats." className="mb-5">
        <ol className="cl-journey" aria-label="Étapes du parcours">
          {JOURNEY.map((step, index) => {
            const state = index < stage ? 'done' : index === stage ? 'current' : 'todo'
            return (
              <li key={step.key} className={`cl-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="cl-step-dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
                <span className="cl-step-text">
                  <span className="cl-step-label">{step.label}</span>
                  <span className="cl-step-hint">{state === 'current' ? 'Étape en cours' : step.hint}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="cl-next" style={{ ['--tone' as string]: `var(--cl-${next.tone})` }} aria-labelledby="cl-next-title">
          <div className="flex items-start gap-4">
            <span className={`cl-next-icon ${toneClass(next.tone)}`}>{next.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="cl-eyebrow">{loading ? 'Vérification de votre parcours…' : next.eyebrow}</p>
              <h2 id="cl-next-title" className="mt-1 font-display text-xl font-bold text-ink-950">{next.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">{next.text}</p>
              {next.meta ? <p className="mt-2 text-xs font-semibold text-ink-500">{next.meta}</p> : null}
              {next.progress !== undefined && started && draft?.total ? (
                <div className="mt-4 max-w-md">
                  <div className="flex justify-between text-xs font-semibold text-ink-500"><span>{draft.answered ?? 0}/{draft.total} questions</span><span>{Math.round(next.progress * 100)} %</span></div>
                  <div className="cl-progress mt-1.5"><i style={{ width: `${Math.max(3, Math.round(next.progress * 100))}%` }} /></div>
                </div>
              ) : null}
              {next.to ? (
                <Link to={next.to as any} className="mt-5 inline-block"><Button>{next.cta}<ArrowRight size={16} /></Button></Link>
              ) : null}
            </div>
          </div>
        </section>

        <Panel title="Votre concierge" description="Votre interlocuteur dédié chez ALLNEEDS.">
          {concierge ? (
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Initial name={concierge.name || concierge.email} tone="indigo" size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-950">{concierge.name || 'Votre concierge'}</p>
                  <p className="truncate text-xs text-ink-500">{concierge.email}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-600">Votre concierge vous accompagne à chaque étape : analyse du diagnostic, rapport, offre puis suivi des missions.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {modules.messages ? <Link to="/app/messages"><Button size="sm"><MessageSquare size={14} />Écrire un message</Button></Link> : null}
                {concierge.email ? <a href={`mailto:${concierge.email}`}><Button size="sm" variant="outline"><Mail size={14} />Envoyer un e-mail</Button></a> : null}
              </div>
            </div>
          ) : (
            <EmptyBox icon={<UserRound size={20} />} title="Attribution en cours" text="ALLNEEDS vous attribue un concierge dédié. Son nom apparaîtra ici dès qu’il sera affecté à votre établissement." />
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Vos espaces"
          description="Les modules de votre accompagnement. Ils s’ouvrent au fil du parcours."
          action={<Badge tone="info">{openCount}/{spaces.length} ouverts</Badge>}
        >
          <div className="cl-spaces">
            {spaces.map((space) =>
              space.open ? (
                <Link key={space.key} to={space.to as any} className="cl-space">
                  <span className={`cg-task-icon ${toneClass(space.tone)}`}>{space.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-950">{space.label}</span>
                    <span className="block truncate text-xs text-ink-500">{space.text}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-300" />
                </Link>
              ) : (
                <div key={space.key} className="cl-space is-locked" aria-disabled="true">
                  <span className="cg-task-icon bg-slate-100 text-slate-400"><Lock size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-500">{space.label}</span>
                    <span className="block truncate text-xs text-ink-400">{space.lock}</span>
                  </span>
                </div>
              ),
            )}
          </div>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel
            title="Mon établissement"
            action={<Link to={'/app/parametres' as any} className="cg-link">Gérer<ArrowRight size={14} /></Link>}
          >
            <div className="flex items-center gap-3 p-5 pb-3">
              <span className={`cg-task-icon ${toneClass('indigo')}`}><Building2 size={16} /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-950">{companyName || 'Établissement'}</p>
                <p className="truncate text-xs text-ink-500">{sectorLabel || org?.city ? <>{sectorLabel ? <span>{sectorLabel}</span> : null}{sectorLabel && org?.city ? ' · ' : null}{org?.city ? <span>{org.city}</span> : null}</> : 'Secteur et ville à compléter'}</p>
              </div>
            </div>
            <dl className="cl-facts">
              <div><dt>Type de structure</dt><dd>{org?.kind || <span className="text-ink-400">Non renseigné</span>}</dd></div>
              <div><dt>Taille</dt><dd>{org?.size || <span className="text-ink-400">Non renseigné</span>}</dd></div>
            </dl>
          </Panel>

          <Panel title="Dernières notifications" action={notifications?.some((n) => !n.readAt) ? <Badge tone="warning">{notifications.filter((n) => !n.readAt).length} non lue(s)</Badge> : null}>
            {notifications === null ? <LoadingRows count={2} /> : null}
            {notifications && !notifications.length ? <EmptyBox icon={<Bell size={20} />} title="Aucune notification" text="Vous serez prévenu ici à chaque étape de votre parcours." /> : null}
            {notifications?.length ? (
              <Rows>
                {notifications.slice(0, 3).map((n) => (
                  <li key={n.id} className="flex gap-3 px-5 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-slate-300' : 'bg-[var(--an-accent)]'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-950">{n.title}</span>
                      {n.message ? <span className="block text-xs leading-5 text-ink-500">{n.message}</span> : null}
                      <span className="mt-0.5 block text-[0.68rem] text-ink-400">{longDate(n.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </Rows>
            ) : null}
          </Panel>
        </div>
      </div>

      {submitted ? (
        <section className="mt-8" aria-labelledby="client-documents-title">
          <h2 id="client-documents-title" className="font-display text-xl font-bold text-ink-950">Mes documents</h2>
          <div className="mt-4"><DocumentsPanel orgId={effectiveOrgId} variant="client" /></div>
        </section>
      ) : null}

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400"><Gauge size={13} />Les étapes se mettent à jour automatiquement selon l’avancement de votre dossier.</p>
    </div>
  )
}

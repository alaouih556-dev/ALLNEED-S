import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, FileCheck2, Handshake, Search } from 'lucide-react'
import { MiniStat, StatGrid } from '@/components/admin-kit'
import { ConciergeGuard, ConciergeHeading, OrgIdentity, ScopedEmpty } from '@/features/concierge/ScopedSection'
import { conciergeScope, useDemo } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'
import { useOperationalNeeds } from '@/features/operations/useOperationalNeeds'
import { Alert, Badge, Button, Card, Progress, Select } from '@/components/ui'
import { NEED_FLOW, NEED_STATUS, URGENCY, normalizeNeedStatus } from '@/lib/status'
import type { Need, NeedStatus } from '@/types'

export const Route = createFileRoute('/concierge/besoins')({ component: ConciergeNeeds })

type Filter = 'a_suivre' | 'urgents' | 'decision' | 'tous'

const CLOSED_NEED_STATUSES = new Set(['valide', 'cloture', 'annule'])
function isClosed(status: NeedStatus) {
  const normalized = normalizeNeedStatus(status) ?? status
  return CLOSED_NEED_STATUSES.has(normalized)
}

function phase(status: NeedStatus) {
  const s = normalizeNeedStatus(status) ?? status
  if (s === 'nouveau' || s === 'en_analyse') return 0
  if (s === 'en_recherche') return 1
  if (s === 'propositions_disponibles' || s === 'en_attente_client') return 2
  return 3
}

function guidance(need: Need) {
  const s = normalizeNeedStatus(need.status) ?? need.status
  if (s === 'nouveau') return { title: 'Clarifier la demande avec le client', detail: 'Confirmer le besoin, la date souhaitée et ce qui fera une solution adaptée.', client: 'Une demande bien cadrée, sans mauvaise surprise.', allneeds: 'Une mission cadrée que le bon prestataire peut chiffrer.', action: 'Contacter le client' }
  if (s === 'en_analyse') return { title: 'Valider le périmètre et le délai', detail: 'Vérifier que la demande et les critères de choix sont compris avant la recherche.', client: 'Des propositions qui répondent à son vrai besoin.', allneeds: 'Une comparaison plus pertinente et un meilleur suivi.', action: 'Vérifier le cadrage' }
  if (s === 'en_recherche') return { title: 'Trouver et qualifier les prestataires', detail: 'Vérifier la disponibilité et l’adéquation des prestataires, puis saisir les propositions depuis la fiche entreprise.', client: 'Des options sérieuses et adaptées à son activité.', allneeds: 'Une mise en relation suivie, avec des critères vérifiables.', action: 'Suivre la recherche' }
  if (s === 'propositions_disponibles') return { title: 'Présenter les options et obtenir un choix', detail: 'Les propositions sont transmises au client. L’aider à comparer périmètre, délai et coût.', client: 'Comprendre les options avant d’engager son budget.', allneeds: 'Une décision tracée et une demande qui avance.', action: 'Faire le point sur les propositions' }
  if (s === 'en_attente_client') return { title: 'Sécuriser les derniers points', detail: 'Confirmer les conditions, le périmètre et la prochaine date de suivi avant validation.', client: 'Un accord clair avant de démarrer.', allneeds: 'Un dossier documenté et une transition vers l’exécution.', action: 'Suivre la décision client' }
  if (s === 'valide') return { title: 'Organiser le démarrage et vérifier le résultat', detail: 'Confirmer le lancement, le responsable et la première échéance.', client: 'Savoir qui intervient et à quoi s’attendre.', allneeds: 'Une mission qui tient la promesse faite au client.', action: 'Confirmer le démarrage' }
  return { title: 'Faire le bilan du dossier', detail: 'Noter le résultat et les suites éventuelles.', client: 'Une demande clôturée avec un retour clair.', allneeds: 'Un historique utile pour améliorer le service.', action: 'Consulter le bilan' }
}

function ConciergeNeeds() {
  const { state, dispatch } = useDemo()
  const auth = useAuth()
  const operations = useOperationalNeeds(state.needs)
  const demoScope = conciergeScope(state)
  const liveOrgIds = useMemo(() => new Set(auth.user?.orgIds ?? []), [auth.user?.orgIds])
  const { orgs } = demoScope
  const orgIds = auth.status === 'authenticated' ? liveOrgIds : demoScope.orgIds
  const [filter, setFilter] = useState<Filter>('a_suivre')
  const [query, setQuery] = useState('')
  const items = useMemo(() => operations.needs.filter((need) => orgIds.has(need.orgId)), [operations.needs, orgIds])
  const urgent = items.filter((need) => need.urgency === 'haute' && !isClosed(need.status))
  const waitingDecision = items.filter((need) => ['propositions_disponibles', 'en_attente_client'].includes(normalizeNeedStatus(need.status) ?? need.status))
  const active = items.filter((need) => !isClosed(need.status))
  const visible = useMemo(() => items.filter((need) => {
    if (filter === 'a_suivre' && isClosed(need.status)) return false
    if (filter === 'urgents' && need.urgency !== 'haute') return false
    if (filter === 'decision' && !['propositions_disponibles', 'en_attente_client'].includes(normalizeNeedStatus(need.status) ?? need.status)) return false
    const company = orgs.find((org) => org.id === need.orgId)?.name ?? ''
    return `${company} ${need.title} ${need.categoryLabel}`.toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => Number(b.urgency === 'haute') - Number(a.urgency === 'haute') || phase(b.status) - phase(a.status) || a.submittedAt.localeCompare(b.submittedAt)), [items, filter, query, orgs])

  return <ConciergeGuard><div className="concierge-needs-page">
    <ConciergeHeading eyebrow="Suivi" title="Besoins clients" description="De la demande à une solution suivie : cadrez, coordonnez et relancez jusqu’à une décision puis un démarrage clair."/>

    {operations.loading ? <Alert tone="info" className="mb-4" title="Actualisation de la file">Chargement des dossiers du serveur…</Alert> : null}
    {operations.error ? <Alert tone="danger" className="mb-4" title="Chargement des besoins impossible">{operations.error}</Alert> : null}

    <StatGrid>
      <MiniStat icon={<Clock3 size={18}/>} tone="indigo" label="À accompagner" value={active.length} hint="Dossiers ouverts" active={filter === 'a_suivre'} onClick={() => setFilter('a_suivre')}/>
      <MiniStat icon={<CircleAlert size={18}/>} tone="rose" label="Urgents" value={urgent.length} hint="À traiter en priorité" active={filter === 'urgents'} onClick={() => setFilter('urgents')}/>
      <MiniStat icon={<Handshake size={18}/>} tone="amber" label="En attente d’une décision" value={waitingDecision.length} hint="Propositions transmises" active={filter === 'decision'} onClick={() => setFilter('decision')}/>
      <MiniStat icon={<FileCheck2 size={18}/>} tone="emerald" label="Tous les besoins" value={items.length} hint="Dans votre portefeuille" active={filter === 'tous'} onClick={() => setFilter('tous')}/>
    </StatGrid>

    <div className="concierge-needs-toolbar"><div><h2>À traiter dans cet ordre</h2><p>Urgence déclarée d’abord, puis dossiers proches d’une décision.</p></div><div className="concierge-needs-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Entreprise ou besoin" aria-label="Rechercher une entreprise ou un besoin"/></div></div>
    <div className="concierge-needs-filters">{([['a_suivre', 'À suivre'], ['urgents', `Urgents (${urgent.length})`], ['decision', `Décision (${waitingDecision.length})`], ['tous', `Tous (${items.length})`]] as const).map(([key, label]) => <button type="button" key={key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>

    <div className="concierge-needs-list">{visible.map((item) => {
      const company = orgs.find((org) => org.id === item.orgId)
      const status = NEED_STATUS[normalizeNeedStatus(item.status) ?? item.status] ?? NEED_STATUS.nouveau
      const urgency = URGENCY[item.urgency]
      const next = guidance(item)
      const index = phase(item.status)
      const closed = isClosed(item.status)
      return <Card key={item.id} className={`concierge-need-card ${item.urgency === 'haute' && !closed ? 'is-urgent' : ''}`}>
        <div className="concierge-need-head"><div><OrgIdentity orgId={item.orgId}/><h3>{item.title}</h3><p>{item.categoryLabel} · {item.location}</p></div><div className="concierge-need-badges"><Badge tone={urgency.tone}>{urgency.label === 'Haute' && !closed ? 'À traiter en priorité' : urgency.label}</Badge><Badge tone={status.tone}>{status.label}</Badge></div></div>
        <div className="concierge-need-flow" aria-label="Avancement de la demande">{['Cadrer', 'Rechercher', 'Choisir', 'Démarrer'].map((step, stepIndex) => <div key={step} className={stepIndex < index ? 'is-done' : stepIndex === index ? 'is-current' : ''}><span>{stepIndex < index ? <CheckCircle2 size={13}/> : String(stepIndex + 1).padStart(2, '0')}</span><small>{step}</small></div>)}</div>
        <div className="concierge-need-work"><div className="concierge-next-work"><small>VOTRE PROCHAIN GESTE</small><strong>{next.title}</strong><p>{next.detail}</p></div><div className="concierge-outcome-pair"><div><small>LE CLIENT Y GAGNE</small><p>{next.client}</p></div><div><small>ALLNEEDS Y GAGNE</small><p>{next.allneeds}</p></div></div></div>
        <div className="concierge-need-footer"><div><strong>{company?.contactName ?? 'Contact à confirmer'}</strong><small>{item.assignedTo ? `Suivi interne : ${item.assignedTo}` : 'Suivi interne à attribuer'}</small><small>{operations.live ? `${item.candidateIds.length} proposition(s) · ${item.quoteIds.length} devis` : `${item.candidateIds.length} prestataire${item.candidateIds.length === 1 ? '' : 's'} · ${item.quoteIds.length} devis`}</small></div><div className="concierge-need-actions"><Select aria-label={`Mettre à jour l’étape de ${item.title}`} value={normalizeNeedStatus(item.status) ?? item.status} onChange={(event) => { const status = event.target.value as NeedStatus; const label = `Étape mise à jour par le concierge : ${(NEED_STATUS[status] ?? NEED_STATUS.nouveau).label}`; if (auth.status === 'authenticated') void operations.setStatus(item.id, status, label).catch((cause) => dispatch({ type: 'TOAST_ADD', toast: { title: 'Étape non enregistrée', description: cause instanceof Error ? cause.message : 'Réessayez.', tone: 'warning' } })); else dispatch({ type: 'NEED_SET_STATUS', id: item.id, status, label }) }}>{[...NEED_FLOW, 'annule' as const].map((value) => <option key={value} value={value}>{(NEED_STATUS[value] ?? NEED_STATUS.nouveau).label}</option>)}</Select><Link to={'/concierge/entreprises/$id' as any} params={{ id: item.orgId } as any}>{next.action} <ArrowRight size={14}/></Link></div></div>
      </Card>
    })}{!visible.length ? <ScopedEmpty icon={<CheckCircle2 size={20}/>} title={items.length ? 'Aucun besoin pour ce filtre' : 'Aucun besoin pour le moment'} description={items.length ? 'Choisissez un autre filtre ci-dessus.' : 'Les besoins déposés par vos entreprises apparaîtront ici, avec la prochaine étape à mener.'}/> : null}</div>
  </div></ConciergeGuard>
}

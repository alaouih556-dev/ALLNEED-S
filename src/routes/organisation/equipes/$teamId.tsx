import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, CalendarDays, ContactRound, Inbox, ListChecks, Map as MapIcon, PhoneCall, Target, TriangleAlert, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge } from '@/components/ui'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import { TaskBoard, useOrg, useOrgResource, type TaskStats } from '@/features/organization/core'

export const Route = createFileRoute('/organisation/equipes/$teamId')({ component: TeamPage })

type Member = { id: string; name: string; email: string; levelLabel: string; active: boolean }
type Team = { id: string; name: string; departmentId: string; departmentName: string; members: number; tasks: TaskStats; kpis?: Record<string, number>; memberList: Member[] }
type Account = { id: string; name: string; city: string; accountManagers: string[]; openNeeds: number; missions: number }
type Tool = { to: string; label: string; text: string; icon: ReactNode }

const RESPONSIBILITIES: Record<string, string[]> = {
  'dev-ai': ['Développement web et logiciel', 'Solutions et intégrations IA', 'Automatisation des processus', 'Outils internes', 'Projets techniques'],
  community: ['Gestion des réseaux sociaux', 'Planification et publication', 'Animation de la communauté', 'Veille sociale', 'Comptes et campagnes'],
  design: ['Design graphique', 'Identité visuelle', 'Infographies', 'Photographie', 'Visuels de campagne'],
  strategies: ['Stratégies marketing', 'Plans marketing', 'Planification des campagnes', 'Études de marché', 'Objectifs et performance'],
  teleprospection: ['Bases de prospects', 'Qualification des leads', 'Appels et statuts', 'Rendez-vous et relances', 'Pipeline et zones géographiques'],
  'account-manager': ['Clients et comptes', 'Relation client', 'Demandes et suivis', 'Rendez-vous', 'Projets, services et historique'],
}

function TeamPage() {
  const { teamId } = Route.useParams()
  const auth = useAuth()
  const { can, me } = useOrg()
  const { data, loading, error, reload } = useOrgResource<Team>(`/teams/${teamId}`)
  const showAccounts = teamId === 'account-manager' && can('accounts.view')
  const accounts = useOrgResource<Account[]>(showAccounts ? '/accounts' : null)
  if (loading && !data) return <LoadingRows count={5} />
  if (error || !data) return <Alert tone="danger">{error || 'Équipe introuvable.'}</Alert>

  const tools: Tool[] = []
  if (teamId === 'teleprospection' && auth.user?.crmAccess) {
    tools.push(
      { to: '/crm/contacts', label: 'Prospects', text: 'Bases et fiches contacts', icon: <ContactRound size={16} /> },
      { to: '/crm/appels', label: 'Appels', text: 'Journal et statuts', icon: <PhoneCall size={16} /> },
      { to: '/crm/rendez-vous', label: 'Rendez-vous', text: 'Calendrier et relances', icon: <CalendarDays size={16} /> },
      { to: '/crm/carte', label: 'Carte', text: 'Zones géographiques', icon: <MapIcon size={16} /> },
    )
  }
  if (teamId === 'account-manager' && auth.user?.role === 'concierge') {
    tools.push(
      { to: '/account-manager', label: 'Mon portefeuille', text: 'Tableau de bord client', icon: <Building2 size={16} /> },
      { to: '/account-manager/besoins', label: 'Demandes clients', text: 'Besoins à traiter', icon: <Inbox size={16} /> },
      { to: '/account-manager/rendez-vous', label: 'Rendez-vous', text: 'Échanges à préparer', icon: <CalendarDays size={16} /> },
    )
  }
  if (teamId === 'strategies' && can('strategies.view')) tools.push({ to: '/organisation/strategies', label: 'Stratégies', text: 'Plans, objectifs et résultats', icon: <Target size={16} /> })

  const k = data.kpis
  const manages = can('tasks.manage') && (me?.position.level !== 'member' || me.position.strategyManager)
  return (
    <div>
      <PageHeader eyebrow={data.departmentName} title={data.name} description="Votre espace d’équipe : missions, outils, membres et tâches." />
      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Membres" value={data.members} />
        <MiniStat icon={<ListChecks size={18} />} tone="sky" label="Tâches ouvertes" value={data.tasks.open} hint={`${data.tasks.total} au total`} />
        <MiniStat icon={<Target size={18} />} tone="emerald" label="Avancement" value={`${data.tasks.completion} %`} ratio={data.tasks.completion / 100} />
        <MiniStat icon={<TriangleAlert size={18} />} tone="amber" label="En retard" value={data.tasks.overdue} hint={`${data.tasks.blocked} bloquée(s)`} />
      </StatGrid>

      {k && teamId === 'teleprospection' ? <Kpis items={[['Prospects', k.contacts], ['Appels', k.calls], ['Joints', k.reached], ['Rendez-vous', k.appointments], ['Relances', k.callbacks], ['Conversion', `${k.conversion} %`]]} /> : null}
      {k && teamId === 'account-manager' ? <Kpis items={[['Clients', k.clients], ['Suivis', k.assigned], ['Demandes ouvertes', k.needsOpen], ['Missions en cours', k.missions], ['Diagnostics', k.diagnostics]]} /> : null}
      {k && teamId === 'strategies' ? <Kpis items={[['Stratégies', k.strategies], ['Actives', k.active], ['Objectifs', k.objectives]]} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={tools.length ? 'Outils de l’équipe' : 'Missions de l’équipe'} description={tools.length ? 'Accédez directement à vos modules de travail.' : 'Les responsabilités confiées à cette équipe.'}>
          {tools.length ? (
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <Link key={tool.to} to={tool.to as any} className="cg-shortcut">
                  <span className="cg-task-icon bg-sky-50 text-sky-600">{tool.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink-950">{tool.label}</span><span className="block truncate text-xs text-ink-500">{tool.text}</span></span>
                  <ArrowRight size={14} className="text-ink-300" />
                </Link>
              ))}
            </div>
          ) : (
            <ul className="og-resp">{(RESPONSIBILITIES[teamId] ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
          )}
        </Panel>
        <Panel title="Membres" action={<Badge tone="info">{data.memberList.length}</Badge>}>
          {!data.memberList.length ? <EmptyBox icon={<UsersRound size={20} />} title={can('members.view') ? 'Aucun membre' : 'Liste réservée aux responsables'} text={can('members.manage') ? 'Invitez des collaborateurs depuis la page Membres.' : undefined} /> : null}
          <Rows>
            {data.memberList.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                <Initial name={member.name} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{member.name}</span><span className="block truncate text-xs text-ink-500">{member.email}</span></span>
                <Badge tone={member.active ? 'neutral' : 'warning'}>{member.active ? member.levelLabel : 'Désactivé'}</Badge>
              </li>
            ))}
          </Rows>
        </Panel>
      </div>

      {showAccounts ? (
        <Panel className="mt-5" title="Comptes clients" description="Portefeuille, demandes ouvertes et missions en cours.">
          {accounts.loading && !accounts.data ? <LoadingRows /> : null}
          {accounts.error ? <div className="p-4"><Alert tone="danger">{accounts.error}</Alert></div> : null}
          {accounts.data && !accounts.data.length ? <EmptyBox icon={<Building2 size={20} />} title="Aucun compte" text="Les clients qui vous sont attribués apparaîtront ici." /> : null}
          <Rows>
            {accounts.data?.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink-950">{account.name}</span><span className="block truncate text-xs text-ink-500">{account.accountManagers.join(', ') || 'Sans Account Manager'}{account.city ? ` · ${account.city}` : ''}</span></span>
                <span className="flex gap-2"><Badge tone="info">{account.openNeeds} demande(s)</Badge><Badge tone="success">{account.missions} mission(s)</Badge></span>
              </li>
            ))}
          </Rows>
        </Panel>
      ) : null}

      <Panel className="mt-5" title={manages ? 'Tâches de l’équipe' : 'Mes tâches'} description="Organisez et suivez le travail, du lancement à la livraison.">
        <TaskBoard departmentId={data.departmentId} teamId={data.id} canCreate={manages} onChanged={() => void reload()} />
      </Panel>
    </div>
  )
}

function Kpis({ items }: { items: Array<[string, number | string]> }) {
  return <section className="an-panel mb-5"><div className="og-kpis">{items.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>
}

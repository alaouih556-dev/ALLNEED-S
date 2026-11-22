import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, ListChecks, Target, TriangleAlert, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert } from '@/components/ui'
import { LoadingRows, MiniStat, Panel, StatGrid } from '@/components/admin-kit'
import { ProgressBar, TaskBoard, useOrg, useOrgResource, type TaskStats } from '@/features/organization/core'

export const Route = createFileRoute('/organisation/services/$departmentId')({ component: DepartmentPage })

type Department = { id: string; name: string; members: number; tasks?: TaskStats; kpis?: Record<string, number>; teams: Array<{ id: string; name: string; members: number; tasks: TaskStats }> }

const TEAM_MISSIONS: Record<string, string> = {
  'dev-ai': 'Développement, solutions IA, automatisation et outils internes.',
  community: 'Réseaux sociaux, planning éditorial, communauté et veille.',
  design: 'Identité visuelle, infographies, photographie et création.',
  strategies: 'Stratégies, plans marketing, campagnes, études et objectifs.',
  teleprospection: 'Prospects, appels, rendez-vous, relances, pipeline et carte.',
  'account-manager': 'Clients, demandes, suivis, rendez-vous et historique.',
}

function DepartmentPage() {
  const { departmentId } = Route.useParams()
  const { can } = useOrg()
  const { data, loading, error, reload } = useOrgResource<Department>(`/departments/${departmentId}`)
  if (loading && !data) return <LoadingRows count={5} />
  if (error || !data) return <Alert tone="danger">{error || 'Service introuvable.'}</Alert>
  const tasks = data.tasks
  const marketing = data.id === 'marketing'
  return (
    <div>
      <PageHeader eyebrow="Service" title={data.name} description={marketing ? 'Stratégie, création, communauté et solutions digitales.' : 'Prospection, relation client et performance commerciale.'} />
      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Collaborateurs" value={data.members} hint={`${data.teams.length} équipes`} />
        {marketing
          ? <MiniStat icon={<Target size={18} />} tone="teal" label="Stratégies actives" value={data.kpis?.active ?? 0} hint={`${data.kpis?.objectives ?? 0} objectif(s)`} />
          : <MiniStat icon={<Target size={18} />} tone="teal" label="Conversion" value={`${data.kpis?.conversion ?? 0} %`} ratio={(data.kpis?.conversion ?? 0) / 100} hint={`${data.kpis?.contacts ?? 0} prospect(s) · ${data.kpis?.clients ?? 0} client(s)`} />}
        <MiniStat icon={<ListChecks size={18} />} tone="sky" label="Tâches ouvertes" value={tasks?.open ?? 0} hint={`${tasks?.total ?? 0} au total`} />
        <MiniStat icon={<TriangleAlert size={18} />} tone="amber" label="En retard" value={tasks?.overdue ?? 0} hint={`${tasks?.blocked ?? 0} bloquée(s)`} />
      </StatGrid>

      <Panel title="Équipes" description="Chaque équipe dispose de son propre espace de travail.">
        <div className="og-teams">
          {data.teams.map((team) => (
            <Link key={team.id} to="/organisation/equipes/$teamId" params={{ teamId: team.id }} className="og-team">
              <span className="flex items-start justify-between gap-2"><strong>{team.name}</strong><ArrowRight size={15} /></span>
              <small>{TEAM_MISSIONS[team.id]}</small>
              <ProgressBar value={team.tasks.completion} />
              <span className="og-team-meta"><span>{team.members} membre(s)</span><span>{team.tasks.open} ouverte(s)</span><span><CheckCircle2 size={12} />{team.tasks.completion} %</span></span>
            </Link>
          ))}
        </div>
      </Panel>

      {can('tasks.view') ? (
        <Panel className="mt-5" title="Tâches du service" description="Suivez l’avancement de toutes les équipes.">
          <TaskBoard departmentId={data.id} canCreate={can('tasks.manage')} onChanged={() => void reload()} />
        </Panel>
      ) : null}
    </div>
  )
}

import { Link, Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Briefcase, CheckCircle2, ListChecks, Megaphone, TriangleAlert, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge } from '@/components/ui'
import { EmptyBox, LoadingRows, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { ProgressBar, TASK_STATUS, useOrg, useOrgResource, type OrgTask, type TaskStats } from '@/features/organization/core'

export const Route = createFileRoute('/organisation/')({ component: OrganisationHome })

type TeamSummary = { id: string; name: string; members: number; tasks: TaskStats }
type DepartmentSummary = { id: string; name: string; members: number; tasks: TaskStats; teams: TeamSummary[]; kpis: Record<string, number> }
type Overview = { members: number; pendingInvitations: number; tasks: TaskStats; departments: DepartmentSummary[]; recentTasks: OrgTask[] }

function OrganisationHome() {
  const { me } = useOrg()
  const position = me!.position
  if (position.level === 'department_manager') return <Navigate to="/organisation/services/$departmentId" params={{ departmentId: position.departmentId! }} replace />
  if (position.level !== 'pdg' && position.teamId) return <Navigate to="/organisation/equipes/$teamId" params={{ teamId: position.teamId }} replace />
  return <PdgOverview />
}

function PdgOverview() {
  const navigate = useNavigate()
  const { data, loading, error } = useOrgResource<Overview>('/overview')
  const dash = loading && !data ? '–' : undefined
  return (
    <div>
      <PageHeader eyebrow="Direction générale" title="Vue d’ensemble de l’organisation" description="Vos deux services, leurs équipes, leur activité et leurs résultats en un coup d’œil." />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      <StatGrid>
        <MiniStat icon={<UsersRound size={18} />} tone="indigo" label="Collaborateurs actifs" value={dash ?? data?.members ?? 0} hint={`${data?.pendingInvitations ?? 0} invitation(s) en attente`} onClick={() => void navigate({ to: '/organisation/membres' })} />
        <MiniStat icon={<ListChecks size={18} />} tone="sky" label="Tâches ouvertes" value={dash ?? data?.tasks.open ?? 0} hint={`${data?.tasks.total ?? 0} au total`} onClick={() => void navigate({ to: '/organisation/taches' })} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Avancement" value={dash ?? `${data?.tasks.completion ?? 0} %`} ratio={(data?.tasks.completion ?? 0) / 100} hint="Tâches terminées" />
        <MiniStat icon={<TriangleAlert size={18} />} tone="amber" label="En retard" value={dash ?? data?.tasks.overdue ?? 0} hint={`${data?.tasks.blocked ?? 0} bloquée(s)`} />
      </StatGrid>

      {loading && !data ? <LoadingRows count={4} /> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {data?.departments.map((department) => <DepartmentCard key={department.id} department={department} />)}
      </div>

      <Panel className="mt-5" title="Activité récente" description="Les dernières tâches mises à jour dans l’organisation.">
        {data && !data.recentTasks.length ? <EmptyBox icon={<ListChecks size={20} />} title="Aucune activité" text="Les tâches créées par vos équipes apparaîtront ici." /> : null}
        <Rows>
          {data?.recentTasks.map((task) => {
            const status = TASK_STATUS.find((s) => s.id === task.status)!
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink-950">{task.title}</span><span className="block truncate text-xs text-ink-500">{task.assigneeName || 'Non assignée'}</span></span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </li>
            )
          })}
        </Rows>
      </Panel>
    </div>
  )
}

function DepartmentCard({ department }: { department: DepartmentSummary }) {
  const marketing = department.id === 'marketing'
  const kpis = marketing
    ? [['Stratégies actives', department.kpis?.active ?? 0], ['Objectifs', department.kpis?.objectives ?? 0]]
    : [['Prospects', department.kpis?.contacts ?? 0], ['Appels', department.kpis?.calls ?? 0], ['Conversion', `${department.kpis?.conversion ?? 0} %`], ['Clients', department.kpis?.clients ?? 0]]
  return (
    <Panel
      title={<span className="flex items-center gap-2">{marketing ? <Megaphone size={16} className="text-[var(--an-accent)]" /> : <Briefcase size={16} className="text-[var(--an-accent)]" />}{department.name}</span>}
      description={`${department.members} collaborateur(s) · ${department.teams.length} équipes`}
      action={<Link to="/organisation/services/$departmentId" params={{ departmentId: department.id }} className="cg-link">Ouvrir<ArrowRight size={14} /></Link>}
    >
      <div className="og-kpis">{kpis.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="px-5 pb-2">
        <div className="mb-1.5 flex justify-between text-xs font-semibold text-ink-500"><span>Avancement des tâches</span><span>{department.tasks.completion} %</span></div>
        <ProgressBar value={department.tasks.completion} />
      </div>
      <Rows>
        {department.teams.map((team) => (
          <li key={team.id}>
            <Link to="/organisation/equipes/$teamId" params={{ teamId: team.id }} className="cg-task">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{team.name}</span><span className="block text-xs text-ink-500">{team.members} membre(s) · {team.tasks.open} tâche(s) ouverte(s)</span></span>
              <ArrowRight size={14} className="text-ink-300" />
            </Link>
          </li>
        ))}
      </Rows>
    </Panel>
  )
}

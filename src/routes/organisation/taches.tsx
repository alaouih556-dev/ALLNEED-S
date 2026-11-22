import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layouts'
import { Panel } from '@/components/admin-kit'
import { TaskBoard, useOrg } from '@/features/organization/core'

export const Route = createFileRoute('/organisation/taches')({ component: MyTasks })

function MyTasks() {
  const { me, can } = useOrg()
  const pdg = me?.position.level === 'pdg'
  return (
    <div>
      <PageHeader eyebrow="Mon travail" title={pdg ? 'Toutes les tâches' : 'Mes tâches'} description={pdg ? 'L’ensemble des tâches de l’organisation.' : 'Les tâches qui vous sont assignées, par statut.'} />
      <Panel><TaskBoard mine={!pdg} canCreate={pdg && can('tasks.manage')} /></Panel>
    </div>
  )
}

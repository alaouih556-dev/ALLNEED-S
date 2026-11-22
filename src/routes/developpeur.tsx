import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ToolShell } from '@/features/projects/shell'

export const Route = createFileRoute('/developpeur')({
  head: () => ({ meta: [{ title: 'Développeur · ALLNEEDS' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <ToolShell tool="developer"><Outlet /></ToolShell>,
})

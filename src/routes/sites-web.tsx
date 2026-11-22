import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ToolShell } from '@/features/projects/shell'

export const Route = createFileRoute('/sites-web')({
  head: () => ({ meta: [{ title: 'Sites web · ALLNEEDS' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <ToolShell tool="websites"><Outlet /></ToolShell>,
})

import { createFileRoute } from '@tanstack/react-router'
import { StudioPage } from '@/features/projects/StudioPage'
import { ToolShell } from '@/features/projects/shell'

export const Route = createFileRoute('/studio-ia')({
  head: () => ({ meta: [{ title: 'Studio IA · ALLNEEDS' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <ToolShell tool="studio"><StudioPage /></ToolShell>,
})

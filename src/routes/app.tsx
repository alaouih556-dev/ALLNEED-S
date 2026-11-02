import { Outlet, createFileRoute } from '@tanstack/react-router'
import { WorkspaceGate } from '@/features/auth/WorkspaceGate'

export const Route = createFileRoute('/app')({
  component: ClientAppLayout,
})

function ClientAppLayout() {
  return <WorkspaceGate workspace="client"><Outlet /></WorkspaceGate>
}

import { Outlet, createFileRoute } from '@tanstack/react-router'
import { WorkspaceGate } from '@/features/auth/WorkspaceGate'

export const Route = createFileRoute('/account-manager')({
  component: () => (
    <WorkspaceGate workspace="concierge">
      <Outlet />
    </WorkspaceGate>
  ),
})

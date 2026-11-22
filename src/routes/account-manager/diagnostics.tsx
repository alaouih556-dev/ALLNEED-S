import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ConciergeGuard } from '@/features/account-manager/ScopedSection'

export const Route = createFileRoute('/account-manager/diagnostics')({
  component: ConciergeDiagnosticsLayout,
})

function ConciergeDiagnosticsLayout() {
  return (
    <ConciergeGuard>
      <Outlet />
    </ConciergeGuard>
  )
}

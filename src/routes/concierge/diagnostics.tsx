import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ConciergeGuard } from '@/features/concierge/ScopedSection'

export const Route = createFileRoute('/concierge/diagnostics')({
  component: ConciergeDiagnosticsLayout,
})

function ConciergeDiagnosticsLayout() {
  return (
    <ConciergeGuard>
      <Outlet />
    </ConciergeGuard>
  )
}

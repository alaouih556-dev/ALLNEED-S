import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ExpertShell } from '@/components/ExpertWorkspace'
import { syncIdentity } from '@/lib/auth-guard'
import { canAccessPath } from '@/lib/permissions'
import { verifySession } from '@/lib/session'

export const Route = createFileRoute('/expert')({
  beforeLoad: async () => {
    const session = await verifySession()
    if (!canAccessPath(session?.role ?? null, '/expert')) throw redirect({ to: '/connexion' })
    syncIdentity(session)
  },
  component: () => (
    <ExpertShell>
      <Outlet />
    </ExpertShell>
  ),
})

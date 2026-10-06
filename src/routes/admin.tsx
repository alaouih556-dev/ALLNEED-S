import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/layouts'
import { syncIdentity } from '@/lib/auth-guard'
import { canAccessPath } from '@/lib/permissions'
import { verifySession } from '@/lib/session'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await verifySession()
    if (!canAccessPath(session?.role ?? null, '/admin')) throw redirect({ to: '/connexion' })
    syncIdentity(session)
  },
  component: () => (
    <AppShell variant="admin">
      <Outlet />
    </AppShell>
  ),
})

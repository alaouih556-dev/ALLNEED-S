import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/layouts'
import { ClientContextBar } from '@/components/OperationalUX'
import { syncIdentity } from '@/lib/auth-guard'
import { canAccessPath } from '@/lib/permissions'
import { verifySession } from '@/lib/session'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const session = await verifySession()
    if (!canAccessPath(session?.role ?? null, '/app')) throw redirect({ to: '/connexion' })
    syncIdentity(session)
  },
  component: () => (
    <AppShell variant="client">
      <ClientContextBar />
      <Outlet />
    </AppShell>
  ),
})

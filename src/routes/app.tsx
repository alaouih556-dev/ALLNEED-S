import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/layouts'
import { ClientContextBar } from '@/components/OperationalUX'

export const Route = createFileRoute('/app')({
  component: () => (
    <AppShell variant="client">
      <ClientContextBar />
      <Outlet />
    </AppShell>
  ),
})

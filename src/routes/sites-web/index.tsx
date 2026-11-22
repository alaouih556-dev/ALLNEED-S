import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sites-web/')({
  component: () => <Navigate to="/sites-web/mes-sites" replace />,
})

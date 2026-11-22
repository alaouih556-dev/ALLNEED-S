import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/developpeur/')({
  component: () => <Navigate to="/developpeur/sites-web" replace />,
})

import { createFileRoute } from '@tanstack/react-router'
import { WebsiteDetailPage } from '@/features/projects/WebsiteViews'

export const Route = createFileRoute('/admin/sites-web/$id')({ component: AdminWebsite })

function AdminWebsite() {
  const { id } = Route.useParams()
  return <WebsiteDetailPage key={id} id={id} mode="admin" />
}

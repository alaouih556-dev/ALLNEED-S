import { createFileRoute } from '@tanstack/react-router'
import { WebsiteDetailPage } from '@/features/projects/WebsiteViews'

export const Route = createFileRoute('/sites-web/$id')({ component: ClientWebsite })

function ClientWebsite() {
  const { id } = Route.useParams()
  return <WebsiteDetailPage key={id} id={id} mode="client" />
}

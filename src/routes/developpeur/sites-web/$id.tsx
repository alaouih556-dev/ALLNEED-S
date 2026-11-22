import { createFileRoute } from '@tanstack/react-router'
import { WebsiteDetailPage } from '@/features/projects/WebsiteViews'

export const Route = createFileRoute('/developpeur/sites-web/$id')({ component: DeveloperWebsite })

function DeveloperWebsite() {
  const { id } = Route.useParams()
  return <WebsiteDetailPage key={id} id={id} mode="developer" />
}

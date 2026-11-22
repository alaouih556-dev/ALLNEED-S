import { createFileRoute } from '@tanstack/react-router'
import { MyWebsites } from '@/features/projects/WebsiteViews'

export const Route = createFileRoute('/sites-web/mes-sites')({ component: MyWebsites })

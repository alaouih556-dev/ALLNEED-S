import { createFileRoute } from '@tanstack/react-router'
import { AdminWebsites } from '@/features/projects/WebsiteViews'

export const Route = createFileRoute('/admin/sites-web/')({ component: AdminWebsites })

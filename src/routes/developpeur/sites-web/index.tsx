import { createFileRoute } from '@tanstack/react-router'
import { DeveloperWebsites } from '@/features/projects/WebsiteViews'

export const Route = createFileRoute('/developpeur/sites-web/')({ component: DeveloperWebsites })

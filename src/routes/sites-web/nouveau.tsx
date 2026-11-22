import { createFileRoute } from '@tanstack/react-router'
import { WebsiteWizard } from '@/features/projects/WebsiteWizard'

export const Route = createFileRoute('/sites-web/nouveau')({ component: WebsiteWizard })

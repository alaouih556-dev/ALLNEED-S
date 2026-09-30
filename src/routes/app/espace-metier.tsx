import { createFileRoute } from '@tanstack/react-router'
import { Workspace } from '@/features/saas/Workspace'
export const Route = createFileRoute('/app/espace-metier')({ component: Workspace })

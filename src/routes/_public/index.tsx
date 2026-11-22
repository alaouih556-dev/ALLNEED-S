import { createFileRoute } from '@tanstack/react-router'
import { HomeLanding } from '@/components/HomeLanding'

export const Route = createFileRoute('/_public/')({
  component: HomeLanding,
  head: () => ({ meta: [
    { title: 'ALLNEEDS — Diagnostic gratuit et accompagnement entreprise' },
    { name: 'description', content: 'ALLNEEDS aide les entreprises à identifier leurs priorités, structurer leur développement et accéder aux bonnes solutions. Diagnostic gratuit de 30 min, sans engagement.' },
  ] }),
})

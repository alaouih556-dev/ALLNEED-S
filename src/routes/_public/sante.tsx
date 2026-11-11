import { createFileRoute } from '@tanstack/react-router'
import { SanteLanding } from '@/components/SanteLanding'

export const Route = createFileRoute('/_public/sante')({
  component: SanteLandingPage,
  head: () => ({
    meta: [
      { title: 'ALLNEEDS — Diagnostic gratuit 30 min' },
      {
        name: 'description',
        content:
          'Diagnostic gratuit de 30 min pour les structures de santé : cabinets, centres et laboratoires. Identifiez vos 3 priorités, sans engagement.',
      },
    ],
  }),
})

function SanteLandingPage() {
  return <SanteLanding />
}

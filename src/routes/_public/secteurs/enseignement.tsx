import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSectorActive } from '@/lib/active-sectors'
import { SectorPage } from '@/components/SectorPage'

export const Route = createFileRoute('/_public/secteurs/enseignement')({
  beforeLoad: () => {
    if (!isSectorActive('enseignement')) throw redirect({ to: '/', replace: true })
  },
  component: () => <SectorPage sector="enseignement" />,
  head: () => ({
    meta: [
      { title: 'ALLNEEDS ENSEIGNEMENT — Écoles privées, crèches et centres de formation' },
      {
        name: 'description',
        content:
          'Inscriptions, image, équipe et charges : diagnostic, structuration et accompagnement 30 jours pour les écoles privées, crèches et centres de formation.',
      },
    ],
  }),
})

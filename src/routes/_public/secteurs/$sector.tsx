import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { SectorPage } from '@/components/SectorPage'
import { SECTOR_PAGES } from '@/data/sector-pages'
import { getSector } from '@/lib/sectors'

export const Route = createFileRoute('/_public/secteurs/$sector')({
  beforeLoad: ({ params }) => {
    const sector = getSector(params.sector)
    if (!sector) throw notFound()
    // Anciennes URL (/secteurs/tourisme, /secteurs/enseignement) : redirection vers le slug actuel.
    if (sector.slug !== params.sector) throw redirect({ to: '/secteurs/$sector', params: { sector: sector.slug }, replace: true })
  },
  component: SectorRoute,
  head: ({ params }) => {
    const sector = getSector(params.sector)
    if (!sector) return { meta: [{ title: 'Page introuvable — ALLNEEDS' }] }
    const page = SECTOR_PAGES[sector.slug]
    return {
      meta: [
        { title: `ALLNEEDS ${sector.label.fr} — ${page.subtitle}` },
        { name: 'description', content: page.description },
      ],
    }
  },
})

function SectorRoute() {
  const { sector } = Route.useParams()
  const config = getSector(sector)
  if (!config) throw notFound()
  return <SectorPage sector={config} />
}

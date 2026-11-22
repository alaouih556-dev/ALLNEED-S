import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { CtaBand, PageHero } from '@/components/marketing'
import { SECTOR_PAGES } from '@/data/sector-pages'
import { SECTORS_CONFIG } from '@/lib/sectors'

export const Route = createFileRoute('/_public/secteurs/')({
  component: SecteursPage,
  head: () => ({
    meta: [
      { title: 'Nos secteurs — ALLNEEDS' },
      { name: 'description', content: 'Santé, commerce, enseignement, tourisme, industrie, BTP et services : un même cadre, adapté à votre activité.' },
    ],
  }),
})

function SecteursPage() {
  return (
    <div className="mk">
      <PageHero
        eyebrow="Nos secteurs"
        title="Chaque métier a ses urgences."
        highlight="Votre diagnostic doit le comprendre."
        lead="Nous partons de ce qui se passe vraiment dans votre établissement, avant de parler de solutions."
      />
      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap">
          <div className="mk-head" style={{ marginBottom: 40 }}>
            <p className="mk-eyebrow">Dites-nous où vous vous reconnaissez</p>
            <h2 className="mk-h2">Un point de départ adapté à votre réalité.</h2>
          </div>
          <div className="sx-sector-grid">
            {SECTORS_CONFIG.map((sector) => {
              const Icon = sector.icon
              const page = SECTOR_PAGES[sector.slug]
              return (
                <Link key={sector.slug} to="/secteurs/$sector" params={{ sector: sector.slug }} className="sx-sector-card">
                  <span className="mk-sector-icon"><Icon /></span>
                  <h3 className="mk-h3">{sector.label.fr}</h3>
                  <p className="mk-body">{page.question}</p>
                  <span className="sx-tags">{sector.establishmentTypes.map((type) => <span key={type.value}>{type.title.fr}</span>)}</span>
                  <span className="sx-card-link">Découvrir <ArrowRight /></span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
      <CtaBand
        title="Vous voulez y voir plus clair ?"
        description="Parlons de votre établissement pendant un diagnostic offert, sans engagement. Vous repartez avec trois priorités écrites."
        primary={{ label: 'Faire le point gratuitement', to: '/inscription' }}
        secondary={{ label: 'Nous contacter', to: '/contact' }}
      />
    </div>
  )
}

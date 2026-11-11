import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ArrowDown, ArrowRight, GraduationCap, HeartPulse, Plane, type LucideIcon } from 'lucide-react'
import { SECTORS, SECTOR_LABEL, SECTOR_ORDER } from '@/data/catalog'
import { CtaBand, PageHero } from '@/components/marketing'
import { cn } from '@/lib/utils'
import { selectSector, useSelectedSector } from '@/lib/sector-filter'
import type { Sector } from '@/types'

export const Route = createFileRoute('/_public/secteurs/')({
  component: SecteursPage,
  head: () => ({
    meta: [
      { title: 'Nos secteurs — ALLNEEDS' },
      { name: 'description', content: 'Enseignement, Santé, Tourisme : un même cadre, des leviers adaptés à votre établissement.' },
    ],
  }),
})

const EXTRA: Record<Sector, { signal: string; question: string; icon: LucideIcon }> = {
  enseignement: { signal: 'Les demandes d’inscription se perdent entre les appels, les messages et les visites.', question: 'Comment mieux suivre chaque famille jusqu’à sa décision ?', icon: GraduationCap },
  sante: { signal: 'L’accueil jongle entre appels, rendez-vous, annulations et demandes de patients.', question: 'Comment libérer du temps et rendre le parcours plus lisible ?', icon: HeartPulse },
  tourisme: { signal: 'Les demandes arrivent par plusieurs canaux, avec des pics d’activité difficiles à absorber.', question: 'Comment mieux organiser les réservations et préparer la saison ?', icon: Plane },
}

function SecteursPage() {
  const selectedSector = useSelectedSector()
  const navigate = useNavigate()
  useEffect(() => {
    if (selectedSector) navigate({ to: '/secteurs/$sector', params: { sector: selectedSector }, replace: true })
  }, [selectedSector, navigate])
  if (selectedSector) return <main className="container-page py-24 text-center text-sm text-ink-500">Ouverture de votre secteur…</main>

  return (
    <div className="mk">
      <PageHero
        eyebrow="Nos secteurs"
        title="Chaque métier a ses urgences."
        highlight="Votre diagnostic doit le comprendre."
        lead="Santé, enseignement ou tourisme : nous partons de ce qui se passe vraiment dans votre établissement, avant de parler de solutions."
      >
        <nav className="mk-jump" aria-label="Aller à un secteur">
          {SECTOR_ORDER.map((sector) => {
            const Icon = EXTRA[sector].icon
            return (
              <a key={sector} href={`#secteur-${sector}`}>
                <Icon /> {SECTOR_LABEL[sector]} <ArrowDown style={{ width: 16, height: 16, color: 'currentColor' }} />
              </a>
            )
          })}
        </nav>
      </PageHero>

      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap">
          <div className="mk-head" style={{ marginBottom: 72 }}>
            <p className="mk-eyebrow">Dites-nous où vous vous reconnaissez</p>
            <h2 className="mk-h2">Un point de départ adapté à votre réalité.</h2>
          </div>

          {SECTOR_ORDER.map((sector, i) => {
            const content = SECTORS[sector]
            const extra = EXTRA[sector]
            const Icon = extra.icon
            return (
              <article key={sector} id={`secteur-${sector}`} className={cn('mk-sector', i % 2 === 1 && 'flip')}>
                <div className="mk-sector-copy">
                  <span className="mk-sector-icon"><Icon /></span>
                  <p className="mk-eyebrow">ALLNEEDS {SECTOR_LABEL[sector]}</p>
                  <h3 className="mk-h2" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)' }}>{content.tagline}</h3>
                  <p className="mk-body" style={{ fontSize: '1.05rem' }}>{content.promise}</p>
                  <Link
                    to="/secteurs/$sector"
                    params={{ sector }}
                    onClick={() => selectSector(sector)}
                    className="mk-btn mk-btn-dark"
                  >
                    Comprendre notre approche {SECTOR_LABEL[sector]} <ArrowRight />
                  </Link>
                </div>

                <dl className="mk-sector-card">
                  <div>
                    <dt>La question à éclaircir</dt>
                    <dd className="q">{extra.question}</dd>
                  </div>
                  <div>
                    <dt>Ce qui se passe</dt>
                    <dd>{extra.signal}</dd>
                  </div>
                  <div>
                    <dt>Pour qui</dt>
                    <dd>{content.audience}</dd>
                  </div>
                  <div>
                    <dt>Pistes explorées avec vous</dt>
                    <dd className="mk-tags">
                      {content.levers.map((l) => <span key={l.id}>{l.name}</span>)}
                    </dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </section>

      <CtaBand
        title="Vous voulez y voir plus clair ?"
        description="Parlons de votre établissement pendant un diagnostic Express offert d’environ 2h15, sans engagement. Vous repartez avec trois priorités écrites."
        secondary={{ label: 'Nous contacter', to: '/contact' }}
      />
    </div>
  )
}

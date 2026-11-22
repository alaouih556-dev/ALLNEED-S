import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Check, FileCheck2, ShieldCheck } from 'lucide-react'
import { SECTOR_PAGES } from '@/data/sector-pages'
import { CtaBand, FaqList } from '@/components/marketing'
import type { SectorConfig } from '@/lib/sectors'
import { selectSector } from '@/lib/sector-filter'

const METHOD = [
  { title: 'On écoute', detail: 'Votre activité, vos objectifs et les échéances qui approchent.' },
  { title: 'On met à plat', detail: 'Les faits, les points d’appui et les difficultés sont examinés ensemble.' },
  { title: 'On priorise', detail: 'Vous validez trois priorités et choisissez la suite qui vous convient.' },
]

const TAKEAWAYS = [
  { icon: FileCheck2, title: 'Un état des lieux', detail: 'La situation observée, résumée clairement.' },
  { icon: ShieldCheck, title: 'Les points à éclaircir', detail: 'Ce qui fonctionne et ce qui mérite attention.' },
  { icon: Check, title: '3 priorités', detail: 'Des axes à valider ensemble avant toute suite.' },
]

export function SectorPage({ sector }: { sector: SectorConfig }) {
  useEffect(() => { selectSector(sector.slug) }, [sector.slug])
  const story = SECTOR_PAGES[sector.slug]
  const Icon = sector.icon
  const signup = { secteur: sector.slug }

  return (
    <div className="mk">
      <section className="mk-hero mk-bg-ink">
        <div className="mk-wrap mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill"><Icon /> Une réalité métier · ALLNEEDS <span>{sector.label.fr}</span></span>
            <h1 className="mk-h1" style={{ fontSize: 'clamp(2.3rem,4vw,3.7rem)' }}>{story.headline}</h1>
            <p className="mk-lead" style={{ maxWidth: 580 }}>{story.tension}</p>
            <div className="mk-cta-row">
              <Link to="/inscription" search={signup} className="mk-btn mk-btn-cyan">
                Faire le point gratuitement <ArrowRight />
              </Link>
              <a href="#methode" className="mk-btn mk-btn-line-light">Comment ça se passe</a>
            </div>
            <p className="mk-sub">Environ 2h15 · sans obligation de poursuivre</p>
          </div>

          <aside className="mk-hero-card">
            <p className="mk-eyebrow">Peut-être que vous vivez cela</p>
            <h2 className="mk-h3">Les symptômes sont visibles. La bonne priorité l’est moins.</h2>
            <ul className="mk-symptoms">
              {story.symptoms.map((item) => (
                <li key={item}><AlertTriangle /> {item}</li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section id="methode" className="mk-sec mk-bg-dark" style={{ scrollMarginTop: 64 }}>
        <div className="mk-wrap">
          <div className="mk-head">
            <p className="mk-eyebrow">Le diagnostic, sans jargon</p>
            <h2 className="mk-h2">Comprendre avant d’ajouter une solution.</h2>
            <p className="mk-lead">Un échange guidé pour transformer une impression de surcharge en prochaines étapes compréhensibles.</p>
          </div>
          <div className="mk-steps">
            {METHOD.map((step, i) => (
              <div key={step.title} className="mk-step">
                <span className="n">0{i + 1}</span>
                <h3 className="mk-h3">{step.title}</h3>
                <p className="mk-body">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Vous repartez avec</p>
            <h2 className="mk-h2">De la clarté, même si vous vous arrêtez là.</h2>
            <p className="mk-lead">La valeur du diagnostic ne dépend pas d’une mission ensuite. Vous repartez avec une lecture utile pour décider.</p>
            <Link to="/inscription" search={signup} className="mk-link">Choisir mon créneau <ArrowRight /></Link>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {TAKEAWAYS.map(({ icon: ItemIcon, title, detail }) => (
              <div key={title} className="mk-card" style={{ gridTemplateColumns: '48px 1fr', alignItems: 'center', columnGap: 20 }}>
                <span className="ic"><ItemIcon /></span>
                <div style={{ display: 'grid', gap: 4 }}>
                  <h3 className="mk-h4">{title}</h3>
                  <p className="mk-body">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec mk-bg-cool">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Un cadre qui respecte votre métier</p>
            <h2 className="mk-h2">Votre activité reste au centre. Vos limites aussi.</h2>
            <p className="mk-lead">{story.guardrail}</p>
            <div className="mk-grid-2" style={{ width: '100%', marginTop: 8 }}>
              {[
                { title: 'Pas de vente forcée', detail: 'Une suite n’est proposée que si elle répond à un besoin validé.' },
                { title: 'Tout est cadré avant accord', detail: 'Périmètre, livrables, calendrier et prix sont présentés avant toute mission.' },
              ].map((item) => (
                <div key={item.title} className="mk-card" style={{ padding: 24 }}>
                  <h3 className="mk-h4">{item.title}</h3>
                  <p className="mk-small">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <p className="mk-eyebrow">Questions fréquentes · <span>{sector.label.fr}</span></p>
            <FaqList items={story.faq} />
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Le premier pas"
        title="Votre situation mérite un vrai temps de recul."
        description="Réservez un échange offert d’environ 2h15. Vous gardez la liberté de décider après."
        primary={{ label: 'Choisir mon créneau', to: '/inscription', search: signup }}
        secondary={{ label: 'Nous contacter', to: '/contact' }}
        showOffer={false}
      />
    </div>
  )
}

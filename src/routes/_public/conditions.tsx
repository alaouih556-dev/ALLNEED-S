import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Note, PageHero } from '@/components/marketing'

export const Route = createFileRoute('/_public/conditions')({
  component: ConditionsPage,
  head: () => ({ meta: [{ title: 'Notre cadre d’intervention — ALLNEEDS' }] }),
})

const rules = [
  { title: 'Le diagnostic vous appartient', detail: 'Le premier échange permet de faire un état des lieux et de recommander trois priorités. Vous restez libre de poursuivre ou non.' },
  { title: 'Tout est cadré avant accord', detail: 'Si une suite est pertinente, le périmètre, les livrables, le calendrier, le prix et les limites sont présentés dans votre espace et sur un devis écrit avant votre décision.' },
  { title: 'Aucune promesse sans mesure', detail: 'Les opportunités et les résultats attendus sont évalués à partir de la situation réelle de votre établissement.' },
  { title: 'Les prestataires restent responsables', detail: 'Pour les prestations externalisées, le contrat est conclu directement entre votre établissement et le prestataire. Toute commission éventuelle est signalée.' },
]

function ConditionsPage() {
  return (
    <div className="mk">
      <PageHero
        eyebrow="Transparence & confiance"
        title="Un cadre clair"
        highlight="avant chaque décision."
        lead="Le diagnostic commence par votre réalité. Si vous souhaitez aller plus loin, vous connaissez le contenu, le prix et les limites avant de vous engager."
      />

      <section className="mk-sec mk-bg-cool">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky" style={{ justifyItems: 'stretch' }}>
            <div className="mk-shield">
              <span className="ic"><ShieldCheck /></span>
              <h2 className="mk-h3" style={{ color: '#fff' }}>Vos informations restent utiles et limitées.</h2>
              <p className="mk-body">
                Les informations transmises servent à comprendre votre demande et préparer le diagnostic. Les sujets
                sensibles propres à votre secteur restent protégés et cadrés avec vous.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 28 }}>
            <div className="mk-head">
              <p className="mk-eyebrow">Nos règles</p>
              <h2 className="mk-h2" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)' }}>Quatre règles qui s’appliquent à chaque demande.</h2>
            </div>
            <ol className="mk-rules">
              {rules.map((rule, i) => (
                <li key={rule.title}>
                  <span className="n">0{i + 1}</span>
                  <div>
                    <h3 className="mk-h4">{rule.title}</h3>
                    <p className="mk-body">{rule.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Note tone="warning" title="Version de démonstration">
              Cette plateforme présente un prototype. Les mentions légales, les coordonnées de l’entreprise et les
              conditions contractuelles définitives doivent être validées avant commercialisation.
            </Note>
            <div className="mk-cta-row">
              <Link to="/inscription" className="mk-btn mk-btn-dark">
                Prendre rendez-vous pour le diagnostic <ArrowRight />
              </Link>
              <Link to="/contact" className="mk-btn mk-btn-line">
                Poser une question
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

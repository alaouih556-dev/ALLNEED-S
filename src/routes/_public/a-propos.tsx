import { DEFAULT_SECTOR } from '@/lib/active-sectors'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ClipboardList, FileCheck2, Network, PackageCheck, ShieldCheck, Users } from 'lucide-react'
import { SECTORS } from '@/data/catalog'
import { CtaBand, PageHero } from '@/components/marketing'

export const Route = createFileRoute('/_public/a-propos')({
  component: AProposPage,
  head: () => ({
    meta: [
      { title: 'Qui est derrière ALLNEEDS' },
      {
        name: 'description',
        content: 'Notre méthode, notre cadre, nos engagements et nos références.',
      },
    ],
  }),
})

const PRINCIPES = [
  {
    icon: ShieldCheck,
    title: 'Un cadre qui protège',
    detail:
      'Aucune donnée nominative d’élève, de patient ou de client. Images d’enfants uniquement avec autorisation écrite des représentants légaux, à recueillir par l’établissement.',
  },
  {
    icon: Users,
    title: 'Un seul interlocuteur',
    detail:
      'Nous mobilisons les compétences nécessaires : graphiste, développeur, juriste administratif, consultant communication. Vous n’avez pas à chercher dix prestataires.',
  },
  {
    icon: FileCheck2,
    title: 'Un périmètre écrit',
    detail:
      'Avant toute mission, vous voyez les livrables, les limites, le calendrier et le prix dans votre espace et sur le devis.',
  },
  {
    icon: Network,
    title: 'Des prestataires vérifiés',
    detail:
      'Existence légale, références clients, cohérence des tarifs, respect des règles applicables aux mineurs. Nous informons de toute commission éventuellement perçue.',
  },
]

const PREUVES = [
  { icon: ClipboardList, title: 'Un cadrage écrit', detail: 'Objectifs, livrables, limites, délais et responsabilités définis avec vous.' },
  { icon: PackageCheck, title: 'Des livrables montrables', detail: 'Process, supports, tableaux de bord et outils remis à votre établissement.' },
  { icon: FileCheck2, title: 'Un suivi lisible', detail: 'Décisions, étapes et points de blocage consignés au fil de la mission.' },
]

function AProposPage() {
  return (
    <div className="mk">
      <PageHero
        eyebrow="Notre façon de travailler"
        title="D’abord comprendre votre réalité."
        highlight="Ensuite, trouver le bon appui."
        lead="ALLNEEDS relie les besoins réels des établissements aux compétences capables de les faire avancer. Chaque suite est expliquée, cadrée et laissée à votre décision."
      >
        <div className="mk-cta-row">
          <Link to="/inscription" className="mk-btn mk-btn-cyan">
            Faire le point gratuitement <ArrowRight />
          </Link>
          <Link to="/contact" className="mk-btn mk-btn-line-light">
            Nous contacter
          </Link>
        </div>
      </PageHero>

      {/* Méthode */}
      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Notre méthode</p>
            <h2 className="mk-h2">Le besoin de l’établissement est le point de départ.</h2>
          </div>
          <div className="mk-prose">
            <p>
              Nous ne partons pas d’un catalogue. Nous partons de votre histoire et de votre calendrier : inscriptions,
              rentrée, saison haute, échéances d’assurance.
            </p>
            <p>
              Un seul interlocuteur suit votre demande du premier échange jusqu’à la signature avec le prestataire, puis
              jusqu’au bilan. Les livrables sont produits pour être utilisés par votre équipe, pas pour être rangés dans
              un dossier.
            </p>
            <p>
              Nous ne promettons pas de résultat chiffré avant analyse. Sur les charges, nous n’annonçons aucune économie
              avant d’avoir mesuré la situation réelle.
            </p>
          </div>
        </div>
      </section>

      {/* Engagements */}
      <section className="mk-sec mk-bg-cool">
        <div className="mk-wrap">
          <div className="mk-head">
            <p className="mk-eyebrow">Notre cadre</p>
            <h2 className="mk-h2">Nos engagements, quel que soit votre secteur.</h2>
          </div>
          <div className="mk-grid-2" style={{ marginTop: 56 }}>
            {PRINCIPES.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="mk-card">
                <span className="ic"><Icon /></span>
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principes */}
      <section className="mk-sec mk-bg-dark">
        <div className="mk-wrap">
          <div className="mk-head">
            <p className="mk-eyebrow">Nos principes</p>
            <h2 className="mk-h2">Trois raisons qui reviennent dans chaque mission.</h2>
          </div>
          <div className="mk-steps">
            {SECTORS[DEFAULT_SECTOR].reasons.map((reason, i) => (
              <div key={reason.title} className="mk-step">
                <span className="n">0{i + 1}</span>
                <h3 className="mk-h3">{reason.title}</h3>
                <p className="mk-body">{reason.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preuves */}
      <section className="mk-sec mk-bg-warm">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Des preuves de travail</p>
            <h2 className="mk-h2">Des éléments concrets pour décider.</h2>
            <p className="mk-lead">
              Nous privilégions un périmètre vérifiable et des pièces que vous pouvez examiner plutôt que des chiffres ou
              des témoignages sans contexte.
            </p>
          </div>
          <div className="mk-values">
            {PREUVES.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="mk-value">
                <span className="num" style={{ paddingTop: 0 }}>
                  <span className="mk-sector-icon" style={{ width: 48, height: 48, borderRadius: 14 }}><Icon style={{ width: 22, height: 22 }} /></span>
                </span>
                <div>
                  <h3 className="mk-h3">{title}</h3>
                  <p className="mk-body">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Le premier pas : un diagnostic offert d’environ 2h15."
        description="Sans engagement. Vous repartez avec trois priorités écrites et la liberté de choisir la suite."
        primary={{ label: 'Faire le point', to: '/inscription' }}
        secondary={{ label: 'Nous contacter', to: '/contact' }}
      />
    </div>
  )
}

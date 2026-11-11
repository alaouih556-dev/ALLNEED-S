import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Check, FileCheck2, GraduationCap, HeartPulse, Plane, ShieldCheck } from 'lucide-react'
import { SECTOR_LABEL } from '@/data/catalog'
import { CtaBand, FaqList } from '@/components/marketing'
import type { Sector } from '@/types'
import { selectSector } from '@/lib/sector-filter'

const STORIES: Record<Sector, { headline: string; tension: string; symptoms: string[]; guardrail: string; faq: { q: string; a: string }[] }> = {
  enseignement: {
    headline: 'Quand les familles attendent une réponse et que tout remonte à la direction.',
    tension: 'Admissions, relances, rentrée : les sujets s’enchaînent et reposent souvent sur les mêmes personnes. Il devient difficile de savoir quelle action débloquera vraiment la situation.',
    symptoms: ['Des demandes d’information suivies dans plusieurs outils.', 'Des relances faites au dernier moment.', 'Des rôles et consignes qui manquent de clarté pour l’équipe.'],
    guardrail: 'Nous parlons d’organisation, d’admissions et d’échanges avec les familles, pas de pédagogie. Les données nominatives d’élèves restent dans votre établissement.',
    faq: [{q:'Le diagnostic porte-t-il sur la pédagogie ?',a:'Non. Il concerne l’organisation, les admissions, les échanges avec les familles, les outils et les besoins opérationnels.'},{q:'Faut-il transmettre des données d’élèves ?',a:'Non. Les processus peuvent être examinés sans recevoir de données nominatives.'},{q:'Que vais-je obtenir ?',a:'Une synthèse de la situation, les points d’appui et de blocage, puis trois priorités recommandées.'}],
  },
  sante: {
    headline: 'Quand l’accueil et l’organisation prennent le temps du soin.',
    tension: 'Appels, rendez-vous, annulations et imprévus sollicitent l’équipe toute la journée. Un regard extérieur aide à distinguer les irritants quotidiens des vrais leviers d’organisation.',
    symptoms: ['Des créneaux qui restent vides malgré les demandes.', 'Des annulations et relances difficiles à suivre.', 'Des rôles d’accueil et d’administration qui se chevauchent.'],
    guardrail: 'Le diagnostic porte sur l’organisation et l’administratif. Il ne concerne pas l’acte médical et ne nécessite aucun dossier patient nominatif.',
    faq: [{q:'Avez-vous besoin des dossiers patients ?',a:'Non. Nous travaillons à partir d’éléments d’organisation et de volumes, sans donnée patient nominative.'},{q:'Intervenez-vous sur les soins ?',a:'Non. Le diagnostic concerne l’organisation, l’accueil et les besoins opérationnels.'},{q:'Que vais-je obtenir ?',a:'Une synthèse des constats et trois priorités recommandées pour votre structure.'}],
  },
  tourisme: {
    headline: 'Quand les réservations et les messages se croisent au cœur de la saison.',
    tension: 'Les demandes arrivent sur plusieurs canaux, les réponses s’accumulent et les périodes fortes approchent. Avant d’ajouter un outil, il faut voir où les occasions se perdent.',
    symptoms: ['Des demandes dispersées entre plusieurs canaux.', 'Des réponses et relances difficiles à coordonner.', 'Une haute saison qui approche sans plan partagé.'],
    guardrail: 'Le diagnostic part de vos canaux, de votre saisonnalité et de vos outils actuels. Il n’impose pas le remplacement de votre système de réservation.',
    faq: [{q:'Devez-vous changer mon outil de réservation ?',a:'Non. Le premier échange commence par vos outils et vos habitudes actuels.'},{q:'Cela concerne-t-il la restauration et les expériences ?',a:'Oui. Les questions sont adaptées à votre activité touristique.'},{q:'Que vais-je obtenir ?',a:'Une synthèse des points de friction et trois priorités recommandées.'}],
  },
}

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

const SECTOR_ICON = { enseignement: GraduationCap, sante: HeartPulse, tourisme: Plane } as const

export function SectorPage({ sector }: { sector: Sector }) {
  useEffect(() => { selectSector(sector) }, [sector])
  const story = STORIES[sector]
  const Icon = SECTOR_ICON[sector]

  return (
    <div className="mk">
      <section className="mk-hero mk-bg-ink">
        <div className="mk-wrap mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill"><Icon /> Une réalité métier · ALLNEEDS {SECTOR_LABEL[sector]}</span>
            <h1 className="mk-h1" style={{ fontSize: 'clamp(2.3rem,4vw,3.7rem)' }}>{story.headline}</h1>
            <p className="mk-lead" style={{ maxWidth: 580 }}>{story.tension}</p>
            <div className="mk-cta-row">
              <Link to="/inscription" className="mk-btn mk-btn-cyan">
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
            <Link to="/inscription" className="mk-link">Choisir mon créneau <ArrowRight /></Link>
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
            <p className="mk-eyebrow">Questions fréquentes · {SECTOR_LABEL[sector]}</p>
            <FaqList items={story.faq} />
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Le premier pas"
        title="Votre situation mérite un vrai temps de recul."
        description="Réservez un échange offert d’environ 2h15. Vous gardez la liberté de décider après."
        primary={{ label: 'Choisir mon créneau', to: '/inscription' }}
        secondary={{ label: 'Nous contacter', to: '/contact' }}
        showOffer={false}
      />
    </div>
  )
}

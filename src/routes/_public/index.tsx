import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleCheckBig,
  Compass,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { selectSector, useSelectedSector } from '@/lib/sector-filter'

export const Route = createFileRoute('/_public/')({
  component: Home,
  head: () => ({ meta: [{ title: 'ALLNEEDS — Du besoin à l’action' }] }),
})

const sectors = [
  {
    id: 'sante' as const,
    name: 'Santé',
    icon: HeartPulse,
    desc: 'Structurez vos priorités sans toucher à l’acte médical.',
    intent: 'Patients · organisation · charges',
    tags: 'Cabinets · Centres · Laboratoires',
    color: '#087bfa',
  },
  {
    id: 'enseignement' as const,
    name: 'Enseignement',
    icon: GraduationCap,
    desc: 'Clarifiez vos inscriptions, votre image et votre organisation.',
    intent: 'Inscriptions · équipe · prestataires',
    tags: 'Écoles · Crèches · Formation',
    color: '#8979da',
  },
  {
    id: 'tourisme' as const,
    name: 'Tourisme',
    icon: Compass,
    desc: 'Pilotez réservations, visibilité, exploitation et fournisseurs.',
    intent: 'Réservations · visibilité · exploitation',
    tags: 'Hébergement · Restauration · Activités',
    color: '#0cae9d',
  },
]

const spaces = [
  {
    label: 'Espace Client',
    title: 'Votre besoin reste au centre.',
    copy: 'Suivez vos demandes, vos missions, vos rendez-vous et les prochaines actions dans un espace limité à votre secteur.',
    image: '/previews/client-sante.png',
    caption: 'Aperçu de votre espace Client Santé',
    icon: LayoutDashboard,
  },
  {
    label: 'Espace Concierge',
    title: 'Traiter vite, sans se disperser.',
    copy: 'Une file de travail centrée uniquement sur les entreprises attribuées, avec statuts visibles, relances et actions contextuelles.',
    image: '/previews/concierge.png',
    caption: 'Interface Concierge — portefeuille attribué',
    icon: UsersRound,
  },
  {
    label: 'Administration',
    title: 'Piloter l’ensemble avec contrôle.',
    copy: 'Une vue globale pour suivre les comptes, affectations, besoins, missions et accès sans mélanger les expériences utilisateurs.',
    image: '/previews/admin.png',
    caption: 'Interface Administrateur — pilotage global',
    icon: ShieldCheck,
  },
]

function Home() {
  const selected = useSelectedSector()

  return (
    <div className="v14-home">
      <section className="v14-hero container-page">
        <div className="v14-hero-copy">
          <span className="v14-kicker"><Sparkles size={13} /> BESOIN → SOLUTION → ACTION</span>
          <h1>
            Dites-nous ce qui bloque.
            <span> ALLNEEDS vous aide à avancer.</span>
          </h1>
          <p>
            Un point d’entrée simple pour comprendre votre situation, choisir les bonnes priorités et suivre les actions utiles à votre activité.
          </p>
          <div className="v14-hero-actions">
            <a href="#secteurs" className="v14-btn-primary">Commencer par mon besoin <ArrowRight size={18} /></a>
            <Link to="/connexion" className="v14-btn-secondary">Accéder à mon espace</Link>
          </div>
          <div className="v14-trust-row" aria-label="Principes ALLNEEDS">
            <span><Check size={15} /> Un secteur à la fois</span>
            <span><Check size={15} /> Des priorités claires</span>
            <span><Check size={15} /> Un suivi visible</span>
          </div>
        </div>

        <div className="v14-solution-panel" aria-label="Exemple de parcours ALLNEEDS">
          <div className="v14-panel-head">
            <span>Votre parcours</span>
            <span className="v14-live-dot">● prêt à démarrer</span>
          </div>
          <div className="v14-intent-card">
            <small>1 · VOTRE BESOIN</small>
            <strong>« Je veux savoir où agir en priorité. »</strong>
            <span>Diagnostic · secteur adapté · 3 priorités</span>
          </div>
          <div className="v14-flow-line" />
          <div className="v14-solution-grid">
            <article><span>2</span><div><small>COMPRENDRE</small><strong>Faire le point</strong></div><CircleCheckBig size={18} /></article>
            <article><span>3</span><div><small>STRUCTURER</small><strong>Transformer les priorités</strong></div><CircleCheckBig size={18} /></article>
            <article><span>4</span><div><small>AGIR</small><strong>Suivre les prochaines actions</strong></div><CircleCheckBig size={18} /></article>
          </div>
          <div className="v14-panel-note"><MessageSquareText size={18} /><span><strong>Une seule question à la fois.</strong><br />La suite s’adapte à votre secteur et à votre situation.</span></div>
        </div>
      </section>

      <section className="v14-intent-strip">
        <div className="container-page v14-intent-strip-inner">
          <span>Vous avez plusieurs sujets ?</span>
          <strong>Commencez par le plus important.</strong>
          <p>ALLNEEDS garde le fil de vos besoins, sans vous demander de tout traiter en même temps.</p>
        </div>
      </section>

      <section id="secteurs" className="container-page v14-sectors">
        <div className="v14-section-head">
          <div>
            <span className="v14-kicker">CHOISISSEZ VOTRE CONTEXTE</span>
            <h2>Dans quel univers se situe votre besoin ?</h2>
          </div>
          <p>Un choix suffit. Les autres secteurs disparaissent ensuite du parcours pour garder une expérience simple et cohérente.</p>
        </div>
        <div className="v14-sector-grid">
          {sectors.map((sector) => {
            const Icon = sector.icon
            const isSelected = selected === sector.id
            return (
              <Link
                key={sector.id}
                to="/secteurs/$sector"
                params={{ sector: sector.id }}
                onClick={() => selectSector(sector.id)}
                className={`v14-sector-card ${isSelected ? 'is-selected' : ''}`}
                style={{ '--sector-accent': sector.color } as React.CSSProperties}
              >
                <div className="v14-sector-top">
                  <span className="v14-sector-icon"><Icon size={26} /></span>
                  {isSelected ? <span className="v14-current">Secteur actuel</span> : <ArrowUpRight size={20} />}
                </div>
                <small>{sector.intent}</small>
                <h3>{sector.name}</h3>
                <p>{sector.desc}</p>
                <div className="v14-sector-bottom"><span>{sector.tags}</span><strong>Voir mon parcours <ArrowRight size={15} /></strong></div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="v14-journey">
        <div className="container-page">
          <div className="v14-section-head v14-section-head-light">
            <div>
              <span className="v14-kicker">UN PARCOURS PROGRESSIF</span>
              <h2>Comprendre d’abord. Décider ensuite.</h2>
            </div>
            <p>Chaque étape répond à une intention claire. Vous ne voyez que ce qui est utile au moment où vous en avez besoin.</p>
          </div>
          <div className="v14-journey-grid">
            {[
              ['01', 'Comprendre', 'Identifier les faits, les difficultés et les 3 priorités de votre structure.'],
              ['02', 'Structurer', 'Transformer les priorités retenues en méthodes, supports et outils concrets.'],
              ['03', 'Agir', 'Mettre en œuvre, suivre les résultats et ajuster selon la mission choisie.'],
            ].map(([number, title, copy]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page v14-spaces">
        <div className="v14-section-head">
          <div>
            <span className="v14-kicker">DÉCOUVREZ VOS ESPACES</span>
            <h2>Voyez ce que vous obtenez après connexion.</h2>
          </div>
          <p>Des aperçus volontairement limités : assez pour comprendre la valeur, sans exposer les données ni les fonctions sensibles.</p>
        </div>
        <div className="v14-space-list">
          {spaces.map((space, index) => {
            const Icon = space.icon
            return (
              <article className={`v14-space-row ${index % 2 ? 'is-reverse' : ''}`} key={space.label}>
                <div className="v14-space-copy">
                  <span className="v14-space-label"><Icon size={16} /> {space.label}</span>
                  <h3>{space.title}</h3>
                  <p>{space.copy}</p>
                  <div className="v14-space-proof"><Check size={15} /> Statuts visibles · prochaines actions · charge cognitive réduite</div>
                </div>
                <figure className="v14-space-preview">
                  <img src={space.image} alt={space.caption} loading="lazy" />
                  <figcaption>{space.caption}<span>Aperçu de démonstration</span></figcaption>
                </figure>
              </article>
            )
          })}
        </div>
      </section>

      <section className="container-page v14-final-cta">
        <div>
          <span className="v14-kicker">PRÊT À FAIRE LE POINT ?</span>
          <h2>Commencez par votre besoin le plus important.</h2>
          <p>Choisissez votre secteur, puis avancez étape par étape dans le parcours ALLNEEDS existant.</p>
        </div>
        <div className="v14-final-actions">
          <a href="#secteurs" className="v14-btn-primary">Choisir mon secteur <ArrowRight size={18} /></a>
          <Link to="/diagnostic" className="v14-btn-secondary">Diagnostic STARTER</Link>
        </div>
      </section>
    </div>
  )
}

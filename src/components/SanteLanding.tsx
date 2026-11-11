import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  CheckCircle2,
  HeartPulse,
  Landmark,
  Receipt,
  Star,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FaqList } from '@/components/marketing'

/* ------------------------------------------------------------------ */
/* Contenu                                                            */
/* ------------------------------------------------------------------ */

const HERO = {
  title: 'Votre structure de santé peut mieux fonctionner.',
  highlight: 'Identifions vos priorités.',
  lead:
    'Un diagnostic gratuit de 30 min pour comprendre votre organisation et définir vos prochaines priorités, lors d’un rendez-vous dédié.',
  cta: 'Demander mon diagnostic gratuit',
  secondary: 'Voir comment le diagnostic se déroule',
  checks: ['Gratuit', '30 min', 'Sur rendez-vous', 'Sans engagement'],
}

const PRIORITES = [
  'Une priorité visible pour vous',
  'Un levier discret mais décisif',
  'Ce que votre équipe attend',
]

const POURQUOI = [
  {
    title: 'Votre structure d’abord',
    detail: 'Nous partons de votre organisation, pas d’un catalogue de services.',
  },
  {
    title: 'Un cadre qui respecte votre profession',
    detail: 'Communication informative, aucune promesse médicale, aucun conseil clinique.',
  },
  {
    title: 'Un seul interlocuteur',
    detail: 'Nous mobilisons les compétences nécessaires, vous n’avez pas à chercher dix prestataires.',
  },
]

const STATS = [
  { value: '0 €', label: 'Gratuit', detail: 'Le diagnostic complet est offert lors d’un rendez-vous dédié.' },
  { value: '30 min', label: 'Un rendez-vous', detail: 'Le temps d’analyser les enjeux d’organisation de votre structure.' },
  { value: '3', label: 'Priorités', detail: 'Vous repartez avec trois priorités et des pistes d’action adaptées.' },
  { value: '0', label: 'Engagement', detail: 'Vous décidez librement de poursuivre ou non après le diagnostic.' },
]

const AXES: { title: string; detail: string; question: string; icon: ReactNode }[] = [
  {
    title: 'Patients et développement',
    detail: 'Parcours patient, rendez-vous, relance, suivi.',
    question: 'Mon agenda est rempli comme je le souhaite.',
    icon: <CalendarCheck />,
  },
  {
    title: 'Visibilité et confiance',
    detail: 'Présence en ligne informative, avis, image de la structure.',
    question: 'Mes patients me trouvent facilement en ligne et me font confiance.',
    icon: <Star />,
  },
  {
    title: 'Équipe et organisation',
    detail: 'Rôles, accueil, protocoles, outils de suivi.',
    question: 'Chacun connaît son rôle à l’accueil, sans me solliciter.',
    icon: <Users />,
  },
  {
    title: 'Charges et équipements',
    detail: 'Matériel, maintenance, assurances, contrats, fournisseurs.',
    question: 'Je connais mes charges (matériel, assurances, logiciels) et je les ai comparées.',
    icon: <Receipt />,
  },
  {
    title: 'Accompagnement et financement',
    detail: 'Accès aux programmes de financement auxquels votre structure peut prétendre.',
    question: 'Je connais les programmes de financement auxquels ma structure peut prétendre.',
    icon: <Landmark />,
  },
]

const STEPS = [
  { title: 'Prendre rendez-vous', detail: 'Choisissez un créneau pour votre diagnostic gratuit.' },
  { title: 'Faire le diagnostic', detail: 'Pendant 30 min, nous analysons les enjeux d’organisation de votre structure.' },
  { title: 'Recevoir vos priorités', detail: 'Vous repartez avec trois priorités et des pistes d’action adaptées.' },
]

/* Offres : noms actuels du projet (STARTER n’est pas affiché) */
const OFFRES = [
  {
    code: 'BASIQUE',
    verb: 'Comprendre',
    note: 'Diagnostic et état des lieux',
    included: ['Cartographier votre structure', 'Révéler vos 3 priorités'],
  },
  {
    code: 'PRO',
    verb: 'Structurer',
    note: 'Mission de structuration · paiement unique',
    included: ['Construire vos parcours et protocoles', 'Renforcer votre visibilité', 'Installer vos outils de pilotage'],
  },
  {
    code: 'PERFORMANCE',
    verb: 'Agir',
    note: 'Structuration + accompagnement 30 jours · paiement unique',
    included: ['Mettre en œuvre votre plan d’action', 'Piloter et ajuster avec vous', 'Optimiser vos charges'],
  },
]

/* Abonnements besoins : noms actuels du projet (CONNECT/PLUS/PRIORITÉ non affichés) */
const ABONNEMENTS = [
  { name: 'ESSENTIEL', tagline: 'Accès au réseau.' },
  { name: 'AVANCÉ', tagline: 'Comparer et suivre.' },
  { name: 'PREMIUM', tagline: 'Un accompagnement prioritaire.' },
]

const LAUNCH = {
  title: 'Offre de lancement',
  detail: '20 % de remise pour les 10 premiers clients qui souscrivent Pro ou Performance.',
  condition: 'Les abonnements Accès Santé sont exclus de l’offre de lancement.',
}

const ENGAGEMENTS = [
  'Diagnostic gratuit de 30 min, sur rendez-vous et sans engagement.',
  'Confidentialité de vos échanges et de vos données d’organisation.',
  'Aucune donnée de dossier patient n’est requise ni consultée.',
  'Un compte-rendu structuré avec vos 3 priorités.',
  'Un accompagnement professionnel par un interlocuteur unique.',
  'Une communication informative, sans promesse médicale.',
]

const FAQ = [
  {
    q: 'Le diagnostic est-il vraiment gratuit ?',
    a: 'Oui. Le diagnostic complet est gratuit et se déroule sur rendez-vous pendant 30 min. Il est sans engagement. Votre compte-rendu est utilisable même si vous ne donnez aucune suite. Le mini-questionnaire en ligne est une première indication et ne remplace pas ce rendez-vous.',
  },
  {
    q: 'Le diagnostic m’engage-t-il à acheter une formule ?',
    a: 'Non. Le diagnostic est gratuit et sans engagement. Vous décidez librement si vous souhaitez poursuivre après avoir découvert vos priorités et les modalités d’accompagnement.',
  },
  {
    q: 'Promettez-vous des résultats chiffrés ?',
    a: 'Non, pas avant analyse. Nous identifions, mesurons, ajustons et rendons compte.',
  },
  {
    q: 'Quelles informations dois-je fournir ?',
    a: 'Uniquement des informations d’organisation : agenda, accueil, équipe, charges. Aucun dossier patient. Vos documents sont conservés 90 jours si aucune suite n’est donnée.',
  },
]

/* ------------------------------------------------------------------ */
/* Hero — aperçu produit                                              */
/* ------------------------------------------------------------------ */

function ProductPreview() {
  return (
    <div style={{ position: 'relative' }} aria-hidden="true">
      <div className="mk-window">
        <div className="mk-window-bar">
          <i />
          <i />
          <i />
          <span>Votre compte-rendu · Diagnostic 360°</span>
        </div>
        <div className="mk-window-body">
          <div className="mk-window-row">
            <strong className="mk-h4">Les 5 axes passés en revue</strong>
            <span className="mk-chip blue">
              <HeartPulse /> Santé
            </span>
          </div>
          <ul className="mk-axis-list">
            {AXES.map((axe) => (
              <li key={axe.title}>
                <span className="ic">{axe.icon}</span>
                {axe.title}
                <span className="ok">
                  <CheckCircle2 />
                </span>
              </li>
            ))}
          </ul>
          <div className="mk-prio">
            <small>Vos 3 priorités</small>
            {PRIORITES.map((p, i) => (
              <div key={p} className="mk-prio-item">
                <b>{i + 1}</b>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mk-float">
        <span className="ic">
          <CalendarCheck />
        </span>
        <span>
          Rendez-vous confirmé
          <small>Diagnostic · 30 min</small>
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Axes — onglets                                                     */
/* ------------------------------------------------------------------ */

function AxesTabs() {
  const [active, setActive] = useState(0)
  const axe = AXES[active]

  return (
    <div className="mk-tabs">
      <div className="mk-tablist" role="tablist" aria-label="Les cinq leviers">
        {AXES.map((a, i) => (
          <button
            key={a.title}
            type="button"
            role="tab"
            id={`axe-tab-${i}`}
            aria-selected={i === active}
            aria-controls="axe-panel"
            className="mk-tab"
            onClick={() => setActive(i)}
          >
            <span className="ic">{a.icon}</span>
            <strong>{a.title}</strong>
          </button>
        ))}
      </div>

      <div className="mk-panel" role="tabpanel" id="axe-panel" aria-labelledby={`axe-tab-${active}`}>
        <div key={active} className="mk-fade" style={{ display: 'grid', gap: 22 }}>
          <span className="big-ic">{axe.icon}</span>
          <p className="mk-eyebrow">
            Levier {active + 1} sur {AXES.length}
          </p>
          <h3>{axe.title}</h3>
          <p>{axe.detail} Chaque axe est examiné lors du diagnostic pour faire émerger vos priorités.</p>
        </div>
        <div key={`q-${active}`} className="mk-question mk-fade">
          <small>La question à vous poser</small>
          <span>« {axe.question} »</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mini-questionnaire                                                 */
/* ------------------------------------------------------------------ */

function MiniQuestionnaire() {
  const [answers, setAnswers] = useState<(boolean | null)[]>(AXES.map(() => null))

  const handle = (i: number, valeur: boolean) => {
    const next = answers.slice()
    next[i] = valeur
    setAnswers(next)
  }

  const answered = answers.filter((a) => a !== null).length
  const complete = answered === AXES.length
  const gaps = complete ? AXES.filter((_, i) => !answers[i]).map((a) => a.title) : []

  return (
    <section className="mk-sec mk-bg-tint" id="mini-questionnaire">
      <div className="mk-wrap mk-split">
        <div className="mk-sticky">
          <p className="mk-eyebrow">Vous préférez commencer en ligne ?</p>
          <h2 className="mk-h2">Cinq questions pour une première indication.</h2>
          <p className="mk-lead">
            Ce mini-questionnaire ne remplace pas le diagnostic complet de 30 min sur rendez-vous. Il donne une
            première tendance sur les leviers à activer.
          </p>
          <div style={{ display: 'grid', gap: 10, width: '100%' }}>
            <div className="mk-progress" role="progressbar" aria-valuemin={0} aria-valuemax={AXES.length} aria-valuenow={answered} aria-label="Progression">
              <i style={{ width: `${(answered / AXES.length) * 100}%` }} />
            </div>
            <p className="mk-small">
              {answered} / {AXES.length} réponses
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div className="mk-quiz">
            {AXES.map((axe, i) => (
              <div key={axe.title} className={cn('mk-q', answers[i] !== null && 'done')}>
                <p>
                  {axe.question}
                  <small>{axe.title}</small>
                </p>
                <div className="mk-seg" role="group" aria-label={axe.question}>
                  {['Oui', 'Pas vraiment'].map((label, k) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={answers[i] === (k === 0)}
                      onClick={() => handle(i, k === 0)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {complete ? (
            <div className="mk-result mk-fade" aria-live="polite">
              {gaps.length > 0 ? (
                <>
                  <h3 className="mk-h3">
                    Vos réponses font apparaître {gaps.length} zone{gaps.length > 1 ? 's' : ''} d’attention
                  </h3>
                  <p className="mk-body" style={{ color: '#dce7f5' }}>{gaps.join(', ')}.</p>
                </>
              ) : (
                <>
                  <h3 className="mk-h3">Les 5 leviers vous semblent en place</h3>
                  <p className="mk-body" style={{ color: '#dce7f5' }}>
                    Le diagnostic complet vous dira où se cache encore un potentiel.
                  </p>
                </>
              )}
              <p className="mk-small">
                Cette indication en ligne ne remplace pas le diagnostic complet gratuit de 30 min sur rendez-vous.
                Mini-questionnaire indicatif, pas un score ni un diagnostic.
              </p>
              <Link to="/inscription" className="mk-btn mk-btn-cyan">
                Demander un rendez-vous pour le diagnostic <ArrowRight />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function SanteLanding() {
  return (
    <div className="mk">
      {/* Hero */}
      <section className="mk-hero mk-bg-ink">
        <div className="mk-wrap mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill">
              <HeartPulse /> ALLNEEDS
            </span>
            <h1 className="mk-h1">
              {HERO.title} <span className="mk-hl">{HERO.highlight}</span>
            </h1>
            <p className="mk-lead" style={{ maxWidth: 560 }}>{HERO.lead}</p>
            <div className="mk-cta-row">
              <Link to="/inscription" className="mk-btn mk-btn-cyan">
                {HERO.cta} <ArrowRight />
              </Link>
              <Link to="/diagnostic" className="mk-btn mk-btn-line-light">
                {HERO.secondary}
              </Link>
            </div>
            <ul className="mk-checks">
              {HERO.checks.map((c) => (
                <li key={c}>
                  <Check /> {c}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="mk-sec-sm mk-bg-white">
        <div className="mk-wrap">
          <p className="mk-eyebrow">Diagnostic 360° · Cabinets · Centres · Laboratoires · Paramédical</p>
          <div className="mk-stats" style={{ marginTop: 24 }}>
            {STATS.map((s) => (
              <div key={s.label} className="mk-stat">
                <strong>{s.value}</strong>
                <span className="mk-h4">{s.label}</span>
                <p className="mk-small">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi */}
      <section className="mk-sec mk-bg-warm">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Pourquoi ALLNEEDS</p>
            <h2 className="mk-h2">Une approche qui part de votre organisation, pas d’un catalogue.</h2>
            <Link to="/a-propos" className="mk-link">
              Qui sommes-nous <ArrowRight />
            </Link>
          </div>
          <div className="mk-values">
            {POURQUOI.map((r, i) => (
              <div key={r.title} className="mk-value">
                <span className="num">0{i + 1}</span>
                <div>
                  <h3 className="mk-h3">{r.title}</h3>
                  <p className="mk-body">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Les 5 axes */}
      <section className="mk-sec mk-bg-cool">
        <div className="mk-wrap">
          <div className="mk-head">
            <p className="mk-eyebrow">Cinq leviers pour votre structure</p>
            <h2 className="mk-h2">Les axes que nous passons en revue ensemble.</h2>
            <p className="mk-lead">Chaque axe est examiné lors du diagnostic pour faire émerger vos priorités.</p>
          </div>
          <AxesTabs />
        </div>
      </section>

      {/* Comment ça se passe */}
      <section className="mk-sec mk-bg-dark">
        <div className="mk-wrap">
          <div className="mk-head">
            <p className="mk-eyebrow">Parcours simple</p>
            <h2 className="mk-h2">Comment le diagnostic se déroule.</h2>
            <p className="mk-lead">Trois étapes, de la prise de contact à vos priorités.</p>
          </div>
          <div className="mk-steps">
            {STEPS.map((step, i) => (
              <div key={step.title} className="mk-step">
                <span className="n">0{i + 1}</span>
                <h3 className="mk-h3">{step.title}</h3>
                <p className="mk-body">{step.detail}</p>
              </div>
            ))}
          </div>
          <div className="mk-cta-row" style={{ marginTop: 40 }}>
            <Link to="/inscription" className="mk-btn mk-btn-cyan">
              Choisir un créneau <ArrowRight />
            </Link>
            <Link to="/diagnostic" className="mk-btn mk-btn-line-light">
              En savoir plus sur le diagnostic
            </Link>
          </div>
        </div>
      </section>

      {/* Mini-questionnaire */}
      <MiniQuestionnaire />

      {/* Offres */}
      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap">
          <div className="mk-head center">
            <p className="mk-eyebrow">Après le diagnostic</p>
            <h2 className="mk-h2">Un accompagnement adapté à vos priorités.</h2>
            <p className="mk-lead">Après le diagnostic, vous choisissez librement de poursuivre ou non.</p>
          </div>
          <div className="mk-grid-3" style={{ marginTop: 56 }}>
            {OFFRES.map((offre) => (
              <div key={offre.code} className={cn('mk-plan', offre.code === 'PRO' && 'featured')}>
                <span className="tag">{offre.code}</span>
                <h3>{offre.verb}</h3>
                <p className="mk-small">{offre.note}</p>
                <ul>
                  {offre.included.map((item) => (
                    <li key={item}>
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="spacer" />
                <Link
                  to="/inscription"
                  className={cn('mk-btn mk-btn-sm', offre.code === 'PRO' ? 'mk-btn-cyan' : 'mk-btn-line')}
                >
                  Commencer par le diagnostic <ArrowRight />
                </Link>
              </div>
            ))}
          </div>

          <div className="mk-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span className="pct">−20 %</span>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong>{LAUNCH.title}</strong>
                <p className="mk-small">{LAUNCH.detail}</p>
                <p className="mk-small" style={{ fontSize: '.78rem' }}>{LAUNCH.condition}</p>
              </div>
            </div>
            <Link to="/conditions" className="mk-link">
              Conditions de l’offre <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Abonnements besoins */}
      <section className="mk-sec-sm mk-bg-cool">
        <div className="mk-wrap mk-split center">
          <div style={{ display: 'grid', gap: 16 }}>
            <p className="mk-eyebrow">Abonnement besoins</p>
            <h2 className="mk-h2" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)' }}>
              Trouver, vérifier et suivre vos prestataires.
            </h2>
            <p className="mk-body">
              L’abonnement Accès Santé vous donne accès à un réseau de prestataires vérifiés, selon votre rythme. Les
              détails des formules et des abonnements sont communiqués lors d’un échange.
            </p>
          </div>
          <div className="mk-tiers">
            {ABONNEMENTS.map((a) => (
              <div key={a.name} className="mk-tier">
                <b>{a.name}</b>
                <span>{a.tagline}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Confiance */}
      <section className="mk-sec mk-bg-dark">
        <div className="mk-wrap mk-split">
          <div style={{ display: 'grid', gap: 22 }}>
            <p className="mk-eyebrow">
              <BadgeCheck className="h-4 w-4" /> Un cadre qui respecte votre profession
            </p>
            <p className="mk-quote">
              Nous n’intervenons <span className="mk-hl">jamais</span> sur l’acte médical.
            </p>
            <p className="mk-lead">
              Aucun accès aux dossiers patients : seulement des données d’organisation. Une communication informative,
              sans promesse médicale. Un seul interlocuteur, un périmètre clair dès le départ.
            </p>
          </div>
          <ul className="mk-commit">
            {ENGAGEMENTS.map((item) => (
              <li key={item}>
                <CheckCircle2 />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Questions fréquentes</p>
            <h2 className="mk-h2">Ce qu’il faut savoir avant de réserver.</h2>
            <Link to="/faq" className="mk-link">
              Toutes les questions <ArrowRight />
            </Link>
          </div>
          <FaqList items={FAQ} />
        </div>
      </section>
    </div>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, Clock3, FileCheck2, ShieldCheck } from 'lucide-react'
import { CtaBand } from '@/components/marketing'

export const Route = createFileRoute('/_public/diagnostic')({
  component: DiagnosticPage,
  head: () => ({ meta: [
    { title: 'Le diagnostic ALLNEEDS — Faire le point, librement' },
    { name: 'description', content: 'Découvrez le déroulé du diagnostic offert ALLNEEDS : un échange guidé, trois priorités écrites et aucune obligation de poursuivre.' },
  ] }),
})

const STEPS = [
  { title: 'Écouter', detail: 'Comprendre votre contexte et vos échéances.' },
  { title: 'Examiner', detail: 'Distinguer les faits, les forces et les frictions.' },
  { title: 'Prioriser', detail: 'Valider ensemble trois sujets à traiter.' },
]

const RESULTS = [
  { icon: FileCheck2, title: 'Une photo de la situation', detail: 'Les faits utiles et les points d’appui, résumés.' },
  { icon: ShieldCheck, title: 'Des difficultés clarifiées', detail: 'Les sujets à creuser, séparés des suppositions.' },
  { icon: Check, title: 'Trois priorités', detail: 'Les prochaines actions à valider avec vous.' },
]

const AFTER = [
  { title: 'Le diagnostic clarifie le besoin', detail: 'Il ne déclenche aucune commande.' },
  { title: 'La proposition est détaillée', detail: 'Vous savez ce qui sera fait, par qui, dans quel délai et à quel prix.' },
  { title: 'Le travail commence après votre accord', detail: 'Pas de mission engagée sur la base d’une estimation implicite.' },
]

function DiagnosticPage() {
  return (
    <div className="mk">
      <section className="mk-hero mk-bg-ink">
        <div className="mk-wrap mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill">Le diagnostic ALLNEEDS</span>
            <h1 className="mk-h1">
              Vous avez déjà assez de sujets en tête. <span className="mk-hl">Commençons par y voir clair.</span>
            </h1>
            <p className="mk-lead" style={{ maxWidth: 580 }}>
              Un temps cadré pour comprendre votre établissement, faire émerger l’essentiel et repartir avec un cap
              concret — sans devoir décider d’une mission aujourd’hui.
            </p>
            <div className="mk-cta-row">
              <Link to="/inscription" className="mk-btn mk-btn-cyan">
                Préparer mon diagnostic <ArrowRight />
              </Link>
            </div>
            <p className="mk-sub">Environ 2h15 · offert selon les conditions en vigueur · sans engagement</p>
          </div>

          <aside className="mk-hero-card">
            <div className="head">
              <span className="ic"><Clock3 /></span>
              <div>
                <strong>Le temps pour faire le tri</strong>
                <span>Pas pour remplir un questionnaire seul.</span>
              </div>
            </div>
            <ol className="mk-hero-steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className={i === 2 ? 'on' : undefined}>
                  <b>{i + 1}</b>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap">
          <div className="mk-head center">
            <p className="mk-eyebrow">Ce que vous obtenez</p>
            <h2 className="mk-h2">Une lecture utile. Pas un rapport qui dort.</h2>
            <p className="mk-lead">La synthèse sert à guider une décision et le travail de votre équipe.</p>
          </div>
          <div className="mk-grid-3" style={{ marginTop: 56 }}>
            {RESULTS.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="mk-card">
                <span className="ic"><Icon /></span>
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec mk-bg-cool">
        <div className="mk-wrap mk-split">
          <div className="mk-sticky">
            <p className="mk-eyebrow">Après le diagnostic</p>
            <h2 className="mk-h2">Vous choisissez. Le rythme vous appartient.</h2>
            <p className="mk-lead">
              Si une mission peut aider, ALLNEEDS présente une proposition complète, avec son prix, son périmètre et ses
              livrables. Vous pouvez l’accepter, la refuser ou prendre le temps d’y réfléchir.
            </p>
          </div>
          <ol className="mk-rules">
            {AFTER.map((item, i) => (
              <li key={item.title}>
                <span className="n">0{i + 1}</span>
                <div>
                  <h3 className="mk-h4">{item.title}</h3>
                  <p className="mk-body">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand
        eyebrow="Vous n’avez pas à tout préparer"
        title="Venez avec vos questions. On fera le tri ensemble."
        description="Quelques repères sur votre activité suffisent pour commencer. Les éléments sensibles ne sont pas nécessaires."
        primary={{ label: 'Choisir mon créneau', to: '/inscription' }}
        secondary={null}
        showOffer={false}
      />
    </div>
  )
}

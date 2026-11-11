import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, GraduationCap, HeartPulse, LogIn, MessageSquare, Plane, PlayCircle, CalendarCheck, type LucideIcon } from 'lucide-react'
import { SECTOR_LABEL, SECTOR_ORDER } from '@/data/catalog'
import { useDemo } from '@/store/store'
import { Field, Input, Textarea } from '@/components/ui'
import { Note, PageHero } from '@/components/marketing'
import type { Sector } from '@/types'

export const Route = createFileRoute('/_public/contact')({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: 'Contact — ALLNEEDS' },
      { name: 'description', content: 'Écrivez à ALLNEEDS : réponse sous 24 h ouvrées. Téléphone, WhatsApp et formulaire.' },
    ],
  }),
})

const SECTOR_ICON: Record<Sector, LucideIcon> = { enseignement: GraduationCap, sante: HeartPulse, tourisme: Plane }

const SUBJECTS = ['Question avant de m’engager', 'Le diagnostic', 'Les offres et les prix', 'Autre demande']

const SHORTCUTS: { to: '/inscription' | '/diagnostic' | '/connexion'; label: string; detail: string; icon: LucideIcon }[] = [
  { to: '/inscription', label: 'Réserver le diagnostic', detail: 'Choisir un créneau pour le premier échange.', icon: CalendarCheck },
  { to: '/diagnostic', label: 'Voir le déroulement du diagnostic', detail: 'Ce qui se passe, étape par étape.', icon: PlayCircle },
  { to: '/connexion', label: 'Accéder à mon espace', detail: 'Messagerie, documents et suivi.', icon: LogIn },
]

function ContactPage() {
  const { dispatch } = useDemo()
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({
    name: '',
    org: '',
    email: '',
    phone: '',
    sector: 'enseignement' as Sector,
    subject: SUBJECTS[0],
    message: '',
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    dispatch({
      type: 'REQUEST_CREATE',
      request: {
        kind: 'contact',
        name: form.name,
        org: form.org,
        email: form.email,
        phone: form.phone,
        sector: form.sector,
        city: '',
        message: `[${form.subject}] ${form.message}`,
        budget: '',
      },
    })
    setSent(true)
  }

  return (
    <div className="mk">
      <PageHero
        eyebrow="Parlons de votre situation"
        title="Une question"
        highlight="avant le premier pas ?"
        lead="Décrivez votre contexte, votre question ou votre échéance. Nous vous orienterons vers la prochaine étape la plus utile."
      />

      <section className="mk-sec mk-bg-cool">
        <div className="mk-wrap mk-contact">
          <div className="mk-formcard">
            {sent ? (
              <div className="mk-sent mk-fade">
                <span className="ok"><CheckCircle2 /></span>
                <h2 className="mk-h2" style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)' }}>Enregistré dans la démonstration</h2>
                <p className="mk-lead" style={{ maxWidth: 480 }}>
                  Merci {form.name.split(' ')[0] || 'pour votre message'}. Cette version conserve la saisie dans ce navigateur ; elle ne la transmet pas à l’équipe ALLNEEDS.
                </p>
                <button type="button" className="mk-btn mk-btn-line" onClick={() => setSent(false)}>
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mk-form">
                <div style={{ display: 'grid', gap: 8 }}>
                  <h2 className="mk-h2" style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)' }}>Nous écrire</h2>
                  <p className="mk-body">Tous les champs marqués * sont nécessaires.</p>
                </div>
                <Note title="Formulaire de démonstration">
                  La saisie reste sur cet appareil. Aucun message ni rendez-vous n’est transmis depuis cette version.
                </Note>

                <div className="mk-row-2">
                  <Field label="Votre nom" required>
                    <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Amina Bennani" autoComplete="name" required />
                  </Field>
                  <Field label="Votre établissement">
                    <Input value={form.org} onChange={(e) => set('org', e.target.value)} placeholder="Nom de votre établissement" autoComplete="organization" />
                  </Field>
                </div>

                <div className="mk-row-2">
                  <Field label="E-mail" required>
                    <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="vous@etablissement.ma" autoComplete="email" required />
                  </Field>
                  <Field label="Téléphone">
                    <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+212 6 ..." autoComplete="tel" />
                  </Field>
                </div>

                <div>
                  <div className="mk-q-label"><strong>Votre secteur</strong></div>
                  <div className="mk-chips" role="group" aria-label="Secteur">
                    {SECTOR_ORDER.map((sector) => {
                      const Icon = SECTOR_ICON[sector]
                      return (
                        <button key={sector} type="button" className="mk-chip-btn" aria-pressed={form.sector === sector} onClick={() => set('sector', sector)}>
                          <Icon /> {SECTOR_LABEL[sector]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="mk-q-label"><strong>Objet</strong></div>
                  <div className="mk-chips" role="group" aria-label="Objet">
                    {SUBJECTS.map((subject) => (
                      <button key={subject} type="button" className="mk-chip-btn" aria-pressed={form.subject === subject} onClick={() => set('subject', subject)}>
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Message" required>
                  <Textarea
                    rows={6}
                    value={form.message}
                    onChange={(e) => set('message', e.target.value)}
                    placeholder="Votre question, votre contexte, votre échéance…"
                    required
                  />
                </Field>

                <div className="mk-form-nav">
                  <p className="mk-small">Les coordonnées officielles et les informations légales seront communiquées avant toute souscription.</p>
                  <button type="submit" className="mk-btn mk-btn-dark">
                    Enregistrer dans la démo <ArrowRight />
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="mk-contact-aside">
            <div className="mk-contact-dark">
              <span className="ic"><MessageSquare /></span>
              <p className="mk-eyebrow">Prendre contact</p>
              <h3 className="mk-h3" style={{ color: '#fff' }}>Décrivez votre besoin dans le formulaire.</h3>
              <p className="mk-body">Nous vous orienterons vers la prochaine étape la plus utile.</p>
            </div>

            <div className="mk-contact-card">
              <p className="mk-eyebrow">Vous êtes déjà client ?</p>
              <p className="mk-body">
                Utilisez la messagerie de votre espace client : la réponse y est rattachée à votre besoin, donc traçable.
              </p>
            </div>

            <div className="mk-contact-card">
              <p className="mk-eyebrow">Raccourcis</p>
              <ul className="mk-shortcuts">
                {SHORTCUTS.map(({ to, label, detail, icon: Icon }) => (
                  <li key={to}>
                    <Link to={to}>
                      <span className="ic"><Icon /></span>
                      <span>
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </span>
                      <ArrowRight className="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Building2, Clock3, GraduationCap, HeartPulse, MapPin, Phone, Plane, Sprout, TrendingUp, Video, type LucideIcon } from 'lucide-react'
import { ACCESS_OFFERS, SECTOR_LABEL, SECTOR_ORDER } from '@/data/catalog'
import { AuthLayout } from '@/components/AuthLayout'
import { Note } from '@/components/marketing'
import { Checkbox, Field, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { AccessTier, Sector } from '@/types'

export const Route = createFileRoute('/inscription')({
  validateSearch: (search: Record<string, unknown>): { offre?: AccessTier } => {
    const value = search.offre ? String(search.offre).toUpperCase() : null
    const valid = ACCESS_OFFERS.some((o) => o.tier === value)
    // Omit the key when there is no valid offer, otherwise the router writes "?offre=null" into every link.
    return valid ? { offre: value as AccessTier } : {}
  },
  component: InscriptionPage,
  head: () => ({
    meta: [
      { title: 'Créer un compte — ALLNEEDS' },
      { name: 'description', content: 'Créez votre compte ALLNEEDS, choisissez votre secteur et votre espace métier.' },
    ],
  }),
})

const STEP_LABELS = ['Votre établissement', 'Votre contact', 'Votre créneau', 'Récapitulatif']
const APPOINTMENT_SLOTS = ['09:00 – 10:30', '10:00 – 11:30', '14:00 – 15:30', '16:00 – 17:30']

type Situation = 'entreprise_existante' | 'creation' | 'investisseur'
type Format = 'sur_site' | 'visio' | 'telephone'

const SITUATIONS: { value: Situation; label: string; desc: string; recap: string; icon: LucideIcon }[] = [
  { value: 'entreprise_existante', label: 'Mon activité existe', desc: 'Mieux organiser, résoudre, développer.', recap: 'Entreprise existante', icon: Building2 },
  { value: 'creation', label: 'Je prépare un projet', desc: 'Poser des bases solides, étape par étape.', recap: 'Entreprise en création', icon: Sprout },
  { value: 'investisseur', label: 'J’étudie une opportunité', desc: 'Évaluer le projet et les besoins.', recap: 'Investisseur', icon: TrendingUp },
]

const FORMATS: { value: Format; label: string; icon: LucideIcon }[] = [
  { value: 'visio', label: 'Visio', icon: Video },
  { value: 'sur_site', label: 'Sur site', icon: MapPin },
  { value: 'telephone', label: 'Téléphone', icon: Phone },
]

const SECTOR_ICON: Record<Sector, LucideIcon> = { enseignement: GraduationCap, sante: HeartPulse, tourisme: Plane }

const WORKSPACE_PROFILES: Record<Sector, { value: string; label: string; description: string }[]> = {
  enseignement: [
    { value: 'ecole', label: 'École / établissement scolaire', description: 'Inscriptions, élèves, familles, équipe et paiements.' },
    { value: 'creche', label: 'Crèche / maternelle', description: 'Admissions, familles, présence, équipe et facturation.' },
    { value: 'formation', label: 'Centre de formation', description: 'Inscriptions, sessions, apprenants, formateurs et règlements.' },
  ],
  sante: [
    { value: 'cabinet', label: 'Cabinet', description: 'Patients, rendez-vous, praticiens, paiements et charges.' },
    { value: 'centre', label: 'Centre de santé', description: 'Accueil, planning multi-praticiens, équipe, paiements et suivi.' },
    { value: 'laboratoire', label: 'Laboratoire', description: 'Accueil, dossiers, équipe, encaissements et organisation.' },
  ],
  tourisme: [
    { value: 'hebergement', label: 'Hébergement', description: 'Réservations, chambres, check-in/out, ménage et paiements.' },
    { value: 'restauration', label: 'Restauration', description: 'Tables, menus, ingrédients, stock, commandes et caisse.' },
    { value: 'activites', label: 'Activités', description: 'Planning, capacités, réservations, participants et paiements.' },
    { value: 'transport', label: 'Transport', description: 'Véhicules, chauffeurs, trajets, réservations et disponibilités.' },
    { value: 'agence', label: 'Agence de voyage', description: 'Dossiers, voyageurs, hébergement, repas, activités, transport et marge.' },
  ],
}

function InscriptionPage() {
  const { offre: offreFromUrl } = Route.useSearch()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    situation: 'entreprise_existante' as Situation, org: '', kind: '', sector: 'enseignement' as Sector, workspaceProfile: 'ecole', city: '', size: '',
    name: '', role: '', email: '', phone: '', appointmentDate: '', appointmentSlot: APPOINTMENT_SLOTS[0], appointmentFormat: 'visio' as Format, accept: false,
  })
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const stepperRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  // Bring the top of the new step into view; "Continuer" sits at the bottom of a long form.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    stepperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((v) => ({ ...v, [key]: value })) }
  function setSector(sector: Sector) { setForm((v) => ({ ...v, sector, workspaceProfile: WORKSPACE_PROFILES[sector][0].value })) }
  function validate(current: number) {
    if (current === 0 && !form.org.trim()) return 'Indiquez le nom de votre établissement.'
    if (current === 1 && (!form.name.trim() || !form.email.includes('@'))) return 'Nom et adresse e-mail valides sont nécessaires.'
    if (current === 2 && !form.appointmentDate) return 'Choisissez la date de votre rendez-vous.'
    if (current === 3 && !form.accept) return 'Vous devez accepter les conditions.'
    return ''
  }
  function next() { const m=validate(step); if(m){setError(m);return}; setError(''); setStep((v)=>Math.min(v+1, STEP_LABELS.length-1)) }
  async function submit() {
    const m=validate(3); if(m){setError(m);return}
    setError(''); setBusy(true)
    try {
      const response = await fetch('/api/registrations', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgName: form.org, name: form.name, email: form.email, phone: form.phone, sector: form.sector, city: form.city, workspaceProfile: form.workspaceProfile, appointmentDate: form.appointmentDate, appointmentSlot: form.appointmentSlot }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'La demande n’a pas pu être envoyée.')
      setSubmitted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La demande n’a pas pu être envoyée.')
    } finally { setBusy(false) }
  }

  const today = new Date().toISOString().slice(0, 10)
  const isLast = step === STEP_LABELS.length - 1

  if (submitted) return (
    <AuthLayout title="Demande envoyée" subtitle="Votre demande est enregistrée et va être affectée à un concierge ALLNEEDS.">
      <div className="mk-form">
        <Note tone="success" title="Étape suivante">
          Un e-mail de confirmation vient de vous être envoyé. Un concierge ALLNEEDS sera affecté à votre dossier et vous recevrez ensuite un lien personnel pour créer votre mot de passe. Le compte ne sera accessible qu’après cette étape.
        </Note>
        <button type="button" className="mk-btn mk-btn-dark" onClick={() => void navigate({ to: '/connexion' })}>
          Retour à la connexion <ArrowRight />
        </button>
      </div>
    </AuthLayout>
  )

  return <AuthLayout
    wide
    title="Commençons par votre réalité."
    subtitle="Quelques repères pour préparer votre échange et vous orienter vers le bon parcours. Votre demande sera transmise à ALLNEEDS ; après validation, vous recevrez un lien pour créer votre mot de passe."
    footer={<>Déjà client ? <Link to="/connexion">Se connecter</Link></>}
  >
    <div ref={stepperRef} className="mk-stepper" aria-label="Progression">
      <div className="mk-stepper-head">
        <strong>{STEP_LABELS[step]}</strong>
        <span>Étape {step + 1} sur {STEP_LABELS.length}</span>
      </div>
      <div className="mk-stepper-bars" role="progressbar" aria-valuemin={1} aria-valuemax={STEP_LABELS.length} aria-valuenow={step + 1} aria-valuetext={`${STEP_LABELS[step]}, étape ${step + 1} sur ${STEP_LABELS.length}`}>
        {STEP_LABELS.map((label, i) => <i key={label} className={i <= step ? 'on' : undefined} />)}
      </div>
    </div>

    <div className="mk-form">
      {step === 0 ? <>
        <div>
          <div className="mk-q-label"><strong>Où en êtes-vous aujourd’hui ?</strong><span>Choisissez le contexte qui ressemble le plus à votre situation.</span></div>
          <div className="mk-choices">
            {SITUATIONS.map(({ value, label, desc, icon: Icon }) => (
              <button key={value} type="button" className="mk-choice" aria-pressed={form.situation === value} onClick={() => set('situation', value)}>
                <span className="ic"><Icon /></span>
                <strong>{label}</strong>
                <span>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mk-q-label"><strong>Votre secteur</strong></div>
          <div className="mk-chips" role="group" aria-label="Secteur">
            {SECTOR_ORDER.map((sector) => {
              const Icon = SECTOR_ICON[sector]
              return (
                <button key={sector} type="button" className="mk-chip-btn" aria-pressed={form.sector === sector} onClick={() => setSector(sector)}>
                  <Icon /> {SECTOR_LABEL[sector]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mk-q-label"><strong>Quel type d’établissement dirigez-vous ?</strong><span>Cela nous aide à adapter la conversation à votre métier.</span></div>
          <div className="mk-choices">
            {WORKSPACE_PROFILES[form.sector].map((profile) => (
              <button key={profile.value} type="button" className="mk-choice" aria-pressed={form.workspaceProfile === profile.value} onClick={() => set('workspaceProfile', profile.value)}>
                <strong>{profile.label}</strong>
                <span>{profile.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Nom de l’établissement" required><Input value={form.org} onChange={(e) => set('org', e.target.value)} placeholder="École Al Amal" autoComplete="organization" /></Field>
        <div className="mk-row-3">
          <Field label="Type de structure"><Input value={form.kind} onChange={(e) => set('kind', e.target.value)} placeholder="École privée" /></Field>
          <Field label="Ville"><Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" autoComplete="address-level2" /></Field>
          <Field label="Effectif"><Input value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="18 salariés" /></Field>
        </div>
        <Note>Nous ne demandons aucune donnée nominative d’élève, de patient ou de client pour ce premier échange.</Note>
      </> : null}

      {step === 1 ? <>
        <div className="mk-row-2">
          <Field label="Votre nom" required><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Amina Bennani" autoComplete="name" /></Field>
          <Field label="Votre fonction"><Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Directrice" autoComplete="organization-title" /></Field>
        </div>
        <Field label="Adresse e-mail" required><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="vous@etablissement.ma" autoComplete="email" /></Field>
        <Field label="Téléphone" hint="Utilisé pour les rendez-vous et WhatsApp."><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+212 6 ..." autoComplete="tel" /></Field>
        <Note>STARTER reste le diagnostic de lancement. CONNECT, PLUS et PRIORITÉ sont proposés séparément dans votre compte, selon les conditions de la fiche ALLNEEDS ACCÈS.</Note>
      </> : null}

      {step === 2 ? <>
        <Note>Choisissez le créneau souhaité. L’équipe ALLNEEDS pourra le confirmer après examen de votre demande.</Note>
        <Field label="Date du rendez-vous" required><Input type="date" min={today} value={form.appointmentDate} onChange={(e) => set('appointmentDate', e.target.value)} /></Field>
        <div>
          <div className="mk-q-label"><strong>Heure</strong></div>
          <div className="mk-chips" role="group" aria-label="Heure">
            {APPOINTMENT_SLOTS.map((slot) => (
              <button key={slot} type="button" className="mk-chip-btn" aria-pressed={form.appointmentSlot === slot} onClick={() => set('appointmentSlot', slot)}>
                <Clock3 /> {slot}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mk-q-label"><strong>Format du rendez-vous</strong></div>
          <div className="mk-chips" role="group" aria-label="Format du rendez-vous">
            {FORMATS.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" className="mk-chip-btn" aria-pressed={form.appointmentFormat === value} onClick={() => set('appointmentFormat', value)}>
                <Icon /> {label}
              </button>
            ))}
          </div>
        </div>
      </> : null}

      {step === 3 ? <>
        <div className="mk-recap">
          <div className="mk-recap-head">Récapitulatif</div>
          <dl>
            {[
              ['Situation', SITUATIONS.find((x) => x.value === form.situation)?.recap, 0],
              ['Établissement', form.org, 0],
              ['Secteur', SECTOR_LABEL[form.sector], 0],
              ['Espace métier', WORKSPACE_PROFILES[form.sector].find((x) => x.value === form.workspaceProfile)?.label, 0],
              ['Contact', form.name, 1],
              ['Rendez-vous', `${form.appointmentDate} · ${form.appointmentSlot} · ${FORMATS.find((x) => x.value === form.appointmentFormat)?.label}`, 2],
              ['ALLNEEDS ACCÈS', 'À choisir après création du compte', null],
            ].map(([label, value, target]) => (
              <div key={label as string}>
                <dt>{label}</dt>
                <dd>
                  {value}
                  {target !== null ? <> <button type="button" onClick={() => setStep(target as number)}>Modifier</button></> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {offreFromUrl ? <Note>Vous avez consulté la formule {offreFromUrl}. Elle ne sera pas activée automatiquement : vous la confirmerez depuis votre compte.</Note> : null}
        <Checkbox checked={form.accept} onChange={(e) => set('accept', e.target.checked)} label="J’accepte les conditions et la politique de confidentialité." />
      </> : null}

      {error ? <Note tone="danger">{error}</Note> : null}

      <div className="mk-form-nav">
        <button type="button" className="mk-btn mk-btn-ghost" onClick={() => { setError(''); setStep((v) => Math.max(0, v - 1)) }} disabled={step === 0}>
          <ArrowLeft /> Retour
        </button>
        {!isLast
          ? <button type="button" className="mk-btn mk-btn-dark" onClick={next}>Continuer <ArrowRight /></button>
          : <button type="button" className="mk-btn mk-btn-dark" onClick={submit} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer ma demande'} <ArrowRight /></button>}
      </div>
    </div>
  </AuthLayout>
}

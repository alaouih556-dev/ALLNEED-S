import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Building2, CheckCircle2 } from 'lucide-react'
import { ACCESS_OFFERS, SECTOR_LABEL, SECTOR_ORDER } from '@/data/catalog'
import { useDemo } from '@/store/store'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, Button, Card, Checkbox, Field, Input, Select, Steps } from '@/components/ui'
import { cn } from '@/lib/utils'
import { money } from '@/lib/format'
import type { AccessTier, Sector } from '@/types'

export const Route = createFileRoute('/inscription')({
  validateSearch: (search: Record<string, unknown>): { offre?: AccessTier | null } => {
    const value = search.offre ? String(search.offre).toUpperCase() : null
    const valid = ACCESS_OFFERS.some((o) => o.tier === value)
    return { offre: valid ? (value as AccessTier) : null }
  },
  component: InscriptionPage,
  head: () => ({
    meta: [
      { title: 'Créer un compte — ALLNEEDS' },
      { name: 'description', content: 'Créez votre compte ALLNEEDS et choisissez votre niveau ACCÈS.' },
    ],
  }),
})

const STEP_LABELS = ['Établissement', 'Coordonnées', 'Offre', 'Confirmation']

export function InscriptionPage() {
  const { offre: offreFromUrl } = Route.useSearch()
  const navigate = useNavigate()
  const { dispatch } = useDemo()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    org: '',
    kind: '',
    sector: 'enseignement' as Sector,
    city: '',
    size: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    tier: (offreFromUrl ?? 'CONNECT') as AccessTier,
    payment: 'annuel' as 'annuel' | 'trimestriel',
    accept: false,
  })
  const [error, setError] = useState('')

  const tier = ACCESS_OFFERS.find((o) => o.tier === form.tier) ?? ACCESS_OFFERS[0]

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function validate(current: number) {
    if (current === 0 && !form.org.trim()) return 'Indiquez le nom de votre établissement.'
    if (current === 1 && (!form.name.trim() || !form.email.includes('@')))
      return 'Nom et adresse e-mail valides sont nécessaires.'
    if (current === 3 && !form.accept) return 'Vous devez accepter les conditions de l’offre.'
    return ''
  }

  function next() {
    const message = validate(step)
    if (message) {
      setError(message)
      return
    }
    setError('')
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1))
  }

  function submit() {
    const message = validate(3)
    if (message) {
      setError(message)
      return
    }
    dispatch({ type: 'SUBSCRIPTION_PATCH', patch: { tier: form.tier, payment: form.payment, status: 'actif', consumed: 0 } })
    dispatch({ type: 'SET_ONBOARDED', value: false })
    navigate({ to: '/onboarding' })
  }

  return (
    <AuthLayout
      title="Créer votre compte ALLNEEDS"
      subtitle="Quatre étapes, deux minutes. Vous pourrez changer de niveau à tout moment."
      footer={
        <>
          Déjà client ?{' '}
          <Link to="/connexion" className="font-semibold text-brand-700">
            Se connecter
          </Link>
        </>
      }
    >
      <Steps steps={STEP_LABELS} current={step} className="mb-8" />

      <div className="space-y-5">
        {step === 0 ? (
          <>
            <Field label="Nom de l’établissement" required>
              <Input value={form.org} onChange={(e) => set('org', e.target.value)} placeholder="École Al Amal" />
            </Field>
            <Field label="Type de structure" hint="École privée, crèche, clinique, hôtel…">
              <Input value={form.kind} onChange={(e) => set('kind', e.target.value)} placeholder="École privée" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Secteur">
                <Select value={form.sector} onChange={(e) => set('sector', e.target.value as Sector)}>
                  {SECTOR_ORDER.map((sector) => (
                    <option key={sector} value={sector}>
                      {SECTOR_LABEL[sector]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ville">
                <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" />
              </Field>
              <Field label="Effectif">
                <Input value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="18 salariés" />
              </Field>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Votre nom" required>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Amina Bennani" />
              </Field>
              <Field label="Votre fonction">
                <Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Directrice" />
              </Field>
            </div>
            <Field label="Adresse e-mail" required>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="vous@etablissement.ma" />
            </Field>
            <Field label="Téléphone" hint="Utilisé pour les rendez-vous et WhatsApp.">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+212 6 ..." />
            </Field>
            <Alert tone="info">
              PRIORITÉ permet jusqu’à 3 utilisateurs. Vous pourrez inviter votre adjoint ou votre secrétaire depuis les
              paramètres de l’abonnement.
            </Alert>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="space-y-3">
              {ACCESS_OFFERS.map((offer) => (
                <button
                  key={offer.tier}
                  type="button"
                  onClick={() => set('tier', offer.tier)}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition',
                    form.tier === offer.tier ? 'border-brand-600 bg-brand-50' : 'border-ink-200 hover:border-ink-400',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-900">{offer.name}</span>
                    <span className="text-sm font-bold text-ink-950">{money(offer.priceYear)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {offer.needsPerYear} besoins · {offer.providersPerNeed} prestataires · réponse sous {offer.responseTime}
                  </p>
                </button>
              ))}
            </div>

            <Field label="Mode de paiement">
              <Select value={form.payment} onChange={(e) => set('payment', e.target.value as typeof form.payment)}>
                <option value="annuel">Annuel — en une fois</option>
                <option value="trimestriel">En 4 échéances trimestrielles</option>
              </Select>
            </Field>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-900">Total annuel HT</p>
                <p className="font-display text-2xl text-ink-950">{money(tier.priceYear)}</p>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                TVA 20 % en sus : {money(Math.round(tier.priceYear * 0.2))}.{' '}
                {form.payment === 'trimestriel' ? `soit ${money(Math.round(tier.priceYear / 4))} par trimestre.` : 'Paiement en une fois.'}
              </p>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Récapitulatif</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Établissement</dt>
                  <dd className="font-medium text-ink-900">{form.org}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Secteur</dt>
                  <dd className="font-medium text-ink-900">{SECTOR_LABEL[form.sector]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Contact</dt>
                  <dd className="text-right font-medium text-ink-900">{form.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Niveau ACCÈS</dt>
                  <dd className="font-medium text-ink-900">{tier.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Total annuel HT</dt>
                  <dd className="font-medium text-ink-950">{money(tier.priceYear)}</dd>
                </div>
              </dl>
            </Card>

            <Checkbox
              checked={form.accept}
              onChange={(e) => set('accept', e.target.checked)}
              label="J’accepte les conditions de l’offre et la politique de confidentialité."
              description="Abonnement d’un an, non-reconduction possible avec un préavis de 30 jours avant l’échéance."
            />

            <ul className="space-y-2 rounded-xl bg-ink-50 p-4 text-xs text-ink-600">
              {[
                'Aucune donnée nominative d’élève ou de patient n’est demandée.',
                'Le contrat prestataire est conclu directement entre vous et lui.',
                'ALLNEEDS vous informe de toute commission éventuellement perçue.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Retour
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={next}>
            Continuer
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit}>
            <Building2 className="h-4 w-4" />
            Créer mon compte
          </Button>
        )}
      </div>
    </AuthLayout>
  )
}

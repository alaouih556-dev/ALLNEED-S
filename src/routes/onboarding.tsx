import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Rocket, Upload } from 'lucide-react'
import { ACCESS_OFFERS } from '@/data/catalog'
import { useDemo } from '@/store/store'
import { AuthLayout } from '@/components/AuthLayout'
import { money } from '@/lib/format'
import { Alert, Button, Card, Progress, Steps, Textarea, Field, Input } from '@/components/ui'

const STEP_LABELS = ['Priorité', 'Pièces', 'Équipe']

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: 'Onboarding — ALLNEEDS' },
      {
        name: 'description',
        content: 'Trois questions pour préparer votre espace client ALLNEEDS.',
      },
    ],
  }),
})

export function OnboardingPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useDemo()
  const [step, setStep] = useState(0)
  const [priority, setPriority] = useState('')
  const [documents, setDocuments] = useState<string[]>([])
  const [users, setUsers] = useState<string[]>(['Amina Bennani — Direction'])
  const [invite, setInvite] = useState('')

  const tier = ACCESS_OFFERS.find((o) => o.tier === state.subscription.tier) ?? ACCESS_OFFERS[0]

  const AVAILABLE_DOCS = [
    'Organigramme et répartition des rôles',
    'Grille tarifaire en vigueur',
    'Historique des demandes (Excel, mail, cahier)',
    'Contrats de charges et assurances',
    'Comptes des réseaux sociaux',
  ]

  function finish() {
    dispatch({ type: 'SET_ONBOARDED', value: true })
    dispatch({
      type: 'TOAST_ADD',
      toast: {
        title: 'Onboarding terminé',
        description: 'Votre espace client est prêt. Premier besoin : dites-nous ce qui bloque.',
        tone: 'success',
      },
    })
    navigate({ to: '/app' })
  }

  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100)

  return (
    <AuthLayout
      title="Bienvenue. Trois questions, et c’est parti."
      subtitle="Cet onboarding prend trois minutes. Plus vos réponses sont précises, plus les prestataires proposés seront pertinents."
      footer={
        <button type="button" onClick={() => navigate({ to: '/app' })} className="text-xs font-semibold text-ink-400 hover:text-ink-700">
          Passer cette étape pour l’instant
        </button>
      }
    >
      <Progress value={progress} className="mb-6" />

      {step === 0 ? (
        <div className="space-y-5">
          <Field
            label="Quelle est la priorité numéro un de votre établissement ?"
            hint="Une phrase suffit. Nous en reparlerons précisément au diagnostic."
          >
            <Textarea
              rows={5}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="Nos inscriptions stagnent depuis deux ans alors que la notoriété est bonne…"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {[
              'Les inscriptions stagnent',
              'L’image ne suit pas',
              'L’organisation repose sur trop peu de personnes',
              'Les charges augmentent',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setPriority(chip)}
                className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:border-ink-400 hover:text-ink-900"
              >
                {chip}
              </button>
            ))}
          </div>

          <Alert tone="info" title="Et si vous ne savez pas ?">
            C’est exactement le rôle du diagnostic STARTER, offert en période de lancement. Vous repartez avec 3
            priorités écrites.
          </Alert>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Sélectionnez ce que vous pouvez nous transmettre. Rien n’est envoyé : c’est une checklist que votre
            interlocuteur utilisera.
          </p>

          <div className="space-y-2">
            {AVAILABLE_DOCS.map((doc) => {
              const selected = documents.includes(doc)
              return (
                <button
                  key={doc}
                  type="button"
                  onClick={() =>
                    setDocuments((prev) => (selected ? prev.filter((d) => d !== doc) : [...prev, doc]))
                  }
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-ink-200 hover:border-ink-400'
                  }`}
                >
                  {doc}
                  {selected ? <CheckCircle2 className="h-4 w-4 text-brand-700" /> : <Upload className="h-4 w-4 text-ink-300" />}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-ink-500">
            {documents.length > 0
              ? `${documents.length} élément(s) sélectionné(s).`
              : 'Aucun élément sélectionné — ce n’est pas bloquant.'}
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Utilisateurs</p>
            <p className="mt-2 text-xs text-ink-500">
              Niveau {tier.name} : {tier.users} utilisateur{tier.users !== '1' ? 's' : ''}.
            </p>
            <ul className="mt-4 space-y-2">
              {users.map((user) => (
                <li key={user} className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-4 py-2.5 text-sm text-ink-800">
                  {user}
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </li>
              ))}
            </ul>

            {users.length < 3 ? (
              <div className="mt-4 flex gap-2">
                <Input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="nom@etablissement.ma"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!invite.includes('@')) return
                    setUsers((prev) => [...prev, `${invite} — Invité`])
                    setInvite('')
                  }}
                >
                  Inviter
                </Button>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Récapitulatif abonnement</p>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">{tier.name}</p>
                <p className="text-xs text-ink-500">
                  {tier.needsPerYear} besoins par an · pool reportable sur 12 mois
                </p>
              </div>
              <p className="font-display text-2xl text-ink-950">{money(tier.priceYear)}</p>
            </div>
            <p className="mt-3 text-xs text-ink-500">HT / an · TVA 20 % en sus</p>
          </Card>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Retour
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Continuer
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish}>
            <Rocket className="h-4 w-4" />
            Terminer
          </Button>
        )}
      </div>

      <Steps steps={STEP_LABELS} current={step} className="mt-8" />
    </AuthLayout>
  )
}

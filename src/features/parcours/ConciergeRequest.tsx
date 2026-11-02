import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Loader2, MessagesSquare } from 'lucide-react'
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import type { ConciergeRequestPayload } from './useDiagnosticRecord'

const AVAILABILITY = [
  'Matin (9h–12h)',
  'Après-midi (14h–18h)',
  'Fin de journée (18h–20h)',
  'Peu importe',
]

/**
 * Demande de rendez-vous concierge. Le formulaire ne simule rien :
 * la demande est enregistrée sur le diagnostic et visible côté concierge.
 */
export function ConciergeRequest({
  sector,
  currentStep,
  defaultEmail,
  defaultCompany,
  alreadyRequested,
  onSubmit,
}: {
  sector: SectorKey
  currentStep: number
  defaultEmail: string
  defaultCompany: string
  alreadyRequested: boolean
  onSubmit: (payload: ConciergeRequestPayload) => Promise<void>
}) {
  const pack = PACKS[sector]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(alreadyRequested)
  const [value, setValue] = useState({
    company: defaultCompany,
    contact: '',
    phone: '',
    email: defaultEmail,
    city: '',
    availability: AVAILABILITY[1],
    objective: '',
    priority: '',
    comment: '',
  })

  const set = (key: keyof typeof value) => (event: { target: { value: string } }) =>
    setValue((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        ...value,
        sector: pack.label,
        submittedAt: new Date().toISOString(),
      })
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La demande n’a pas pu être enregistrée.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6" id="demande-concierge">
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Étape 3 · Demande concierge</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">
              Demandez à être rappelé
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              Un concierge lit votre diagnostic {pack.label.toLowerCase()} et vos réponses avant de vous
              appeler. Vous fixez vous-même le créneau. Aucun rendez-vous n’est imposé.
            </p>
          </div>
          <Badge tone={done ? 'success' : 'brand'}>{done ? 'Demande envoyée' : 'En attente'}</Badge>
        </div>

        {error ? (
          <Alert tone="danger" className="mt-5" title="Demande non enregistrée">
            {error}
          </Alert>
        ) : null}

        {done ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <Check className="h-4 w-4" strokeWidth={3} />
              Votre demande est enregistrée.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
              Votre concierge ouvre votre diagnostic, le vérifie, puis vous propose un créneau. Vous
              recevrez le rendez-vous dans votre espace.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/app/rendez-vous">
                <Button size="sm">Voir mes rendez-vous</Button>
              </Link>
              <Link to="/app/diagnostics">
                <Button size="sm" variant="outline">
                  Suivre ma restitution
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Établissement" required>
              <Input value={value.company} onChange={set('company')} required />
            </Field>
            <Field label="Votre nom" required>
              <Input value={value.contact} onChange={set('contact')} required autoComplete="name" />
            </Field>
            <Field label="Téléphone" required>
              <Input type="tel" value={value.phone} onChange={set('phone')} required autoComplete="tel" />
            </Field>
            <Field label="E-mail" required>
              <Input type="email" value={value.email} onChange={set('email')} required autoComplete="email" />
            </Field>
            <Field label="Ville">
              <Input value={value.city} onChange={set('city')} />
            </Field>
            <Field label="Créneau préféré" required>
              <Select value={value.availability} onChange={set('availability')}>
                {AVAILABILITY.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Objectif de l’échange" required>
                <Textarea
                  rows={3}
                  value={value.objective}
                  onChange={set('objective')}
                  required
                  placeholder="Ce que vous voulez décider ou débloquer grâce à cet échange."
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Point le plus urgent" required>
                <Textarea
                  rows={2}
                  value={value.priority}
                  onChange={set('priority')}
                  required
                  placeholder="La situation que vous voulez traiter en premier."
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Précisions utiles">
                <Textarea
                  rows={3}
                  value={value.comment}
                  onChange={set('comment')}
                  placeholder="Contraintes, horaires d’ouverture, responsables à impliquer…"
                />
              </Field>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
              <p className="flex items-center gap-2 text-xs text-ink-500">
                <MessagesSquare className="h-4 w-4 shrink-0 text-brand-700" />
                Réponse sous 1 jour ouvré · Premier échange offert
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Envoyer ma demande
                {!busy ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

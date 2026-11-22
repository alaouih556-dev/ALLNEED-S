import { useState } from 'react'
import { CalendarClock, Check, Loader2, MessageSquare, Save, Target } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import type { PriorityItem } from '@/lib/priorities'
import type { DiagnosticRecord, DiagnosticRecordStatus, DiagnosticSynthesis } from './useDiagnosticRecord'

const STATUS_LABEL: Record<DiagnosticRecordStatus, string> = {
  soumis: 'Soumis',
  analyse: 'En analyse',
  en_analyse: 'En analyse',
  pret_a_valider: 'Prêt à valider',
  restitue: 'Restitué',
}

const STATUS_TONE: Record<DiagnosticRecordStatus, 'info' | 'warning' | 'success'> = {
  soumis: 'info',
  analyse: 'warning',
  en_analyse: 'warning',
  pret_a_valider: 'warning',
  restitue: 'success',
}

const EMPTY_SYNTHESIS: DiagnosticSynthesis = {
  confirmed: [],
  priorities: [],
  watch: [],
  opportunities: [],
  actions: [],
}

function lines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function join(value: string[] | undefined) {
  return (value ?? []).join('\n')
}

/**
 * Revue concierge d'un diagnostic soumis : cadrage de la demande, notes
 * question par question, synthèse structurée, rendez-vous et validation.
 */
export function ConciergeReview({
  record,
  priorities,
  sector,
  onSave,
}: {
  record: DiagnosticRecord | null
  priorities: PriorityItem[]
  sector: SectorKey
  onSave: (id: string, body: Record<string, unknown>) => Promise<void>
}) {
  const pack = PACKS[sector]
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>(record?.questionNotes ?? {})
  const [synthesis, setSynthesis] = useState<DiagnosticSynthesis>(record?.synthesis ?? EMPTY_SYNTHESIS)
  const [rendezVous, setRendezVous] = useState(record?.rendezVousAt ?? '')

  if (!record) {
    return (
      <Card className="p-5 sm:p-7">
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="Aucun diagnostic soumis"
          description="Dès qu’un client envoie sa demande Account Manager, il apparaît ici avec ses réponses et ses priorités."
        />
      </Card>
    )
  }

  const request = record.conciergeRequest
  const status: DiagnosticRecordStatus = record.status ?? 'soumis'

  async function run(key: string, body: Record<string, unknown>, message: string) {
    setBusy(key)
    setError('')
    setInfo('')
    try {
      await onSave(record!.id, body)
      setInfo(message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="danger" title="Enregistrement impossible">
          {error}
        </Alert>
      ) : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Revue Account Manager</p>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-950">
              {request?.company || 'Diagnostic soumis'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              Lu le {new Date(record.createdAt).toLocaleDateString('fr-FR')} ·
              {request ? ` ${request.contact} · ${request.phone || 'téléphone non renseigné'} · ${request.city || 'ville non renseignée'}` : ''}
            </p>
            {request ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-ink-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Objectif</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700">{request.objective || '—'}</p>
                </div>
                <div className="rounded-xl bg-ink-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">
                    Point le plus urgent
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700">{request.priority || '—'}</p>
                </div>
                {request.comment ? (
                  <div className="rounded-xl border border-ink-100 p-4 sm:col-span-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">
                      Précisions du client
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-700">{request.comment}</p>
                  </div>
                ) : null}
                <div className="rounded-xl bg-brand-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-700">
                    Créneau préféré
                  </p>
                  <p className="mt-2 text-sm font-semibold text-brand-900">{request.availability}</p>
                </div>
              </div>
            ) : null}
          </div>
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Secteur</p>
            <p className="mt-1.5 text-sm font-semibold text-ink-950">{pack.label}</p>
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Format</p>
            <p className="mt-1.5 text-sm font-semibold text-ink-950">{record.format}</p>
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Priorités détectées</p>
            <p className="mt-1.5 text-sm font-semibold text-ink-950">{priorities.length}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-ink-100 pt-5">
          <Select
            value={status}
            onChange={(event) =>
              void run('status', { status: event.target.value as DiagnosticRecordStatus }, 'Statut mis à jour.')
            }
            className="w-44"
            aria-label="Statut du diagnostic"
          >
            <option value="soumis">Soumis</option>
            <option value="en_analyse">En analyse</option>
            <option value="pret_a_valider">Prêt à valider</option>
            <option value="restitue">Restitué</option>
          </Select>
          <Field label="Rendez-vous" className="min-w-[16rem] flex-1">
            <Input
              type="datetime-local"
              value={rendezVous.slice(0, 16)}
              onChange={(event) => setRendezVous(event.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={busy === 'rdv'}
            onClick={() =>
              void run(
                'rdv',
                { rendezVousAt: rendezVous ? new Date(rendezVous).toISOString() : null },
                'Rendez-vous enregistré.',
              )
            }
            className="self-end"
          >
            {busy === 'rdv' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
            Enregistrer le rendez-vous
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <p className="eyebrow">Priorités et réponses</p>
        <ul className="mt-5 space-y-4">
          {priorities.map((item) => (
            <li key={item.questionId} className="rounded-2xl border border-ink-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink-950">
                    {item.rank}. {item.title}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    Volet {item.voletId} · {item.voletTitle} · note {item.score}/5 · priorité {item.scorePriority}
                  </p>
                </div>
                <Badge tone={item.level === 'Élevée' ? 'danger' : item.level === 'Importante' ? 'warning' : 'neutral'}>
                  {item.level}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">{item.situation}</p>
              {item.comment ? <p className="mt-2 text-xs italic text-ink-500">« {item.comment} »</p> : null}
              <div className="mt-4">
                <Field label="Note interne sur cette question">
                  <Textarea
                    rows={2}
                    value={questionNotes[item.questionId] ?? ''}
                    onChange={(event) =>
                      setQuestionNotes((current) => ({ ...current, [item.questionId]: event.target.value }))
                    }
                    placeholder="Ce qu’il faut vérifier avec le client, ce qui a été dit, ce qui manque…"
                  />
                </Field>
              </div>
            </li>
          ))}
          {priorities.length === 0 ? (
            <li>
              <EmptyState title="Aucune priorité calculée" description="Le client n’a pas encore répondu au questionnaire." />
            </li>
          ) : null}
        </ul>

        <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-ink-100 pt-5">
          <Button
            variant="outline"
            disabled={busy === 'notes'}
            onClick={() => void run('notes', { questionNotes }, 'Notes enregistrées.')}
          >
            {busy === 'notes' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer les notes
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <p className="eyebrow">Synthèse de restitution</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
          Cinq chapitres, listes courtes, écrites en langage clair. Le client les retrouve tels quels dans
          sa restitution.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <SynthField
            label="Ce qui est confirmé"
            hint="Ce qui fonctionne déjà et qu’il ne faut pas défaire."
            value={join(synthesis.confirmed)}
            onChange={(value) => setSynthesis((current) => ({ ...current, confirmed: lines(value) }))}
          />
          <SynthField
            label="Priorités retenues"
            hint="Trois à cinq priorités, dans l’ordre de traitement."
            value={join(synthesis.priorities)}
            onChange={(value) => setSynthesis((current) => ({ ...current, priorities: lines(value) }))}
          />
          <SynthField
            label="À surveiller"
            hint="Risques et signaux faibles à vérifier régulièrement."
            value={join(synthesis.watch)}
            onChange={(value) => setSynthesis((current) => ({ ...current, watch: lines(value) }))}
          />
          <SynthField
            label="Opportunités"
            hint="Ce qui pourrait être saisi sans attendre."
            value={join(synthesis.opportunities)}
            onChange={(value) => setSynthesis((current) => ({ ...current, opportunities: lines(value) }))}
          />
          <SynthField
            label="Premières actions"
            hint="Gestes concrets pour les dix prochains jours."
            value={join(synthesis.actions)}
            onChange={(value) => setSynthesis((current) => ({ ...current, actions: lines(value) }))}
          />
          <div>
            <Field label="Note globale" hint="Lue par le client en fin de restitution.">
              <Textarea
                rows={7}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ce que vous voulez dire clairement au dirigeant."
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-ink-100 pt-5">
          <Button
            variant="outline"
            disabled={busy === 'synthese'}
            onClick={() => void run('synthese', { synthesis, notes }, 'Synthèse enregistrée.')}
          >
            {busy === 'synthese' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer la synthèse
          </Button>
          <Button
            disabled={busy === 'restaurer'}
            onClick={() =>
              void run(
                'restaurer',
                { synthesis, notes, questionNotes, status: 'restitue', restoredAt: new Date().toISOString() },
                'Restitution publiée au client.',
              )
            }
          >
            {busy === 'restaurer' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Publier la restitution
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
          <Target className="h-4 w-4" />
          Recommandation d’offre
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Les {priorities.length} priorités détectées couvrent{' '}
          {new Set(priorities.map((item) => item.voletId)).size} volet(s) sur {pack.volets.length}.
          Orienter vers{' '}
          <strong>
            {new Set(priorities.map((item) => item.voletId)).size <= 1
              ? 'STARTER'
              : new Set(priorities.map((item) => item.voletId)).size === 2
                ? 'PRO'
                : 'PERFORMANCE'}
          </strong>{' '}
          à l’issue de la restitution.
        </p>
      </Card>
    </div>
  )
}

function SynthField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Field label={label} hint={`${hint} Un élément par ligne.`}>
        <Textarea rows={7} value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
    </div>
  )
}